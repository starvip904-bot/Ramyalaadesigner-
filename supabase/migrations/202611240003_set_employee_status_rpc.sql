
-- Dokkan: secure employee status update RPC
-- REVIEW ONLY: DO NOT RUN YET.

CREATE OR REPLACE FUNCTION public.dokkan_set_employee_status(
  p_store_id uuid,
  p_employee_id uuid,
  p_next_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid;
  v_store_status text;
  v_employee public.dokkan_employees%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_store_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Invalid identifiers';
  END IF;

  IF p_next_status IS NULL
     OR p_next_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid employee status';
  END IF;

  -- Lock store first.
  SELECT s.status
  INTO v_store_status
  FROM public.dokkan_stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF NOT FOUND OR v_store_status <> 'active' THEN
    RAISE EXCEPTION 'Store is unavailable';
  END IF;

  -- Only active owner/admin members are authorized.
  IF NOT private.dokkan_has_role(
    p_store_id,
    ARRAY['owner', 'admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Lock employee second.
  SELECT e.*
  INTO v_employee
  FROM public.dokkan_employees e
  WHERE e.id = p_employee_id
    AND e.store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  -- Do not create duplicate updates or audit events.
  IF v_employee.status = p_next_status THEN
    RETURN p_employee_id;
  END IF;

  UPDATE public.dokkan_employees
  SET status = p_next_status,
      updated_at = now()
  WHERE id = p_employee_id
    AND store_id = p_store_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    branch_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_store_id,
    NULL,
    v_actor_id,
    'update',
    'employee',
    p_employee_id,
    jsonb_build_object(
      'status_changed', true,
      'old_status', v_employee.status,
      'new_status', p_next_status
    )
  );

  RETURN p_employee_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.dokkan_set_employee_status(
  uuid, uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_set_employee_status(
  uuid, uuid, text
) TO authenticated;
