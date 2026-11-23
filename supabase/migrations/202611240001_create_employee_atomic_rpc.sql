
-- DRAFT ONLY
-- Atomic employee creation for Dokkan.
-- Not executed. Review and test before applying.

CREATE OR REPLACE FUNCTION public.dokkan_create_employee(
  p_store_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_role text,
  p_branch_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_create_invitation boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid;
  v_store_status text;
  v_employee_id uuid;
  v_invitation_id uuid;
  v_branch_ids uuid[];
  v_branch_count integer;
  v_valid_branch_count integer;
  v_name text;
  v_phone text;
  v_email text;
BEGIN
  -- 1. Authenticated actor
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'STORE_REQUIRED';
  END IF;

  -- 2. Normalize and validate input
  v_name := btrim(p_name);
  v_phone := NULLIF(btrim(p_phone), '');
  v_email := NULLIF(lower(btrim(p_email)), '');

  IF v_name IS NULL
     OR char_length(v_name) < 2
     OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'INVALID_EMPLOYEE_NAME';
  END IF;

  IF v_phone IS NOT NULL AND char_length(v_phone) > 40 THEN
    RAISE EXCEPTION 'INVALID_EMPLOYEE_PHONE';
  END IF;

  IF p_role IS NULL OR p_role NOT IN (
    'manager', 'cashier', 'stock_manager', 'viewer'
  ) THEN
    RAISE EXCEPTION 'INVALID_EMPLOYEE_ROLE';
  END IF;

  IF v_email IS NOT NULL AND (
    char_length(v_email) > 320
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) THEN
    RAISE EXCEPTION 'INVALID_EMPLOYEE_EMAIL';
  END IF;

  -- 3. Lock store first.
  -- Branch status changes use the same store lock.
  SELECT s.status
    INTO v_store_status
  FROM public.dokkan_stores AS s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF NOT FOUND OR v_store_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'STORE_NOT_AVAILABLE';
  END IF;

  -- 4. Owner/admin only.
  IF NOT private.dokkan_has_role(
    p_store_id,
    ARRAY['owner', 'admin']::text[]
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED_TO_CREATE_EMPLOYEE';
  END IF;

  -- 5. Validate branch IDs.
  v_branch_ids := COALESCE(
    p_branch_ids,
    ARRAY[]::uuid[]
  );

  IF EXISTS (
    SELECT 1
    FROM unnest(v_branch_ids) AS x(branch_id)
    WHERE x.branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_BRANCH_ID';
  END IF;

  SELECT COUNT(DISTINCT x.branch_id)::integer
    INTO v_branch_count
  FROM unnest(v_branch_ids) AS x(branch_id);

  IF v_branch_count <> cardinality(v_branch_ids) THEN
    RAISE EXCEPTION 'DUPLICATE_BRANCH_IDS';
  END IF;

  SELECT COUNT(*)::integer
    INTO v_valid_branch_count
  FROM public.dokkan_branches AS b
  WHERE b.store_id = p_store_id
    AND b.status = 'active'
    AND b.id = ANY(v_branch_ids);

  IF v_valid_branch_count <> cardinality(v_branch_ids) THEN
    RAISE EXCEPTION 'INVALID_OR_INACTIVE_BRANCH';
  END IF;

  -- 6. Create employee.
  INSERT INTO public.dokkan_employees (
    store_id,
    branch_id,
    name,
    phone,
    email,
    role,
    status,
    created_by
  )
  VALUES (
    p_store_id,
    v_branch_ids[1],
    v_name,
    v_phone,
    v_email,
    p_role,
    'active',
    v_actor_id
  )
  RETURNING id INTO v_employee_id;

  -- 7. Save permanent branch assignments.
  INSERT INTO public.dokkan_employee_branches (
    employee_id,
    store_id,
    branch_id
  )
  SELECT
    v_employee_id,
    p_store_id,
    x.branch_id
  FROM unnest(v_branch_ids) AS x(branch_id);

  -- 8. Save invitation draft only when requested
  -- and an email exists. No Auth user or email is created.
  IF p_create_invitation IS TRUE AND v_email IS NOT NULL THEN

    INSERT INTO public.dokkan_employee_invitations (
      store_id,
      employee_id,
      email,
      status,
      invited_by,
      expires_at,
      token_hash
    )
    VALUES (
      p_store_id,
      v_employee_id,
      v_email,
      'draft',
      v_actor_id,
      now() + interval '30 days',
      NULL
    )
    RETURNING id INTO v_invitation_id;

    -- Documentation only; never the permission source.
    INSERT INTO public.dokkan_employee_invitation_branches (
      invitation_id,
      store_id,
      branch_id
    )
    SELECT
      v_invitation_id,
      p_store_id,
      x.branch_id
    FROM unnest(v_branch_ids) AS x(branch_id);
  END IF;

  -- 9. Audit event without full email or phone.
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
    'create',
    'employee',
    v_employee_id,
    jsonb_build_object(
      'role', p_role,
      'branch_count', cardinality(v_branch_ids),
      'invitation_draft_created',
        (p_create_invitation IS TRUE AND v_email IS NOT NULL)
    )
  );

  RETURN v_employee_id;
END;
$function$;

-- Restrict direct employee creation.
DROP POLICY IF EXISTS dokkan_employees_manager_insert
ON public.dokkan_employees;

REVOKE INSERT ON TABLE public.dokkan_employees
FROM anon, authenticated;

-- RPC execution permissions.
REVOKE ALL ON FUNCTION public.dokkan_create_employee(
  uuid, text, text, text, text, uuid[], boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_create_employee(
  uuid, text, text, text, text, uuid[], boolean
) TO authenticated;
