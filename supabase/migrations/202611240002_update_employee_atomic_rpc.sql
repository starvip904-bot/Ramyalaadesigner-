
-- Dokkan: atomic employee update RPC
-- REVIEW ONLY: DO NOT RUN YET.

CREATE OR REPLACE FUNCTION public.dokkan_update_employee(
  p_store_id uuid,
  p_employee_id uuid,
  p_name text,
  p_phone text,
  p_role text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_update_email boolean DEFAULT false,
  p_branch_ids uuid[] DEFAULT NULL,
  p_update_branches boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_role text;
  v_employee public.dokkan_employees%ROWTYPE;
  v_store_status text;
  v_email text;
  v_branch_ids uuid[];
  v_current_branch_ids uuid[];
  v_email_changed boolean := false;
  v_branches_changed boolean := false;
  v_draft_id uuid;
  v_pending_exists boolean := false;
  v_first_branch uuid;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_store_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Invalid identifiers';
  END IF;

  -- Validate basic input.
  IF p_name IS NULL
     OR length(btrim(p_name)) < 2
     OR length(btrim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Invalid employee name';
  END IF;

  IF p_phone IS NOT NULL AND length(btrim(p_phone)) > 40 THEN
    RAISE EXCEPTION 'Invalid employee phone';
  END IF;

  IF p_update_email THEN
    v_email := NULLIF(lower(btrim(p_email)), '');

    IF v_email IS NOT NULL
       AND (
         length(v_email) > 320
         OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       ) THEN
      RAISE EXCEPTION 'Invalid employee email';
    END IF;
  END IF;

  -- Lock order: store first, employee second.
  SELECT s.status
  INTO v_store_status
  FROM public.dokkan_stores s
  WHERE s.id = p_store_id
  FOR UPDATE;

  IF NOT FOUND OR v_store_status <> 'active' THEN
    RAISE EXCEPTION 'Store is unavailable';
  END IF;

  -- Resolve the actor's active store role.
  SELECT m.role
  INTO v_actor_role
  FROM public.dokkan_members m
  WHERE m.store_id = p_store_id
    AND m.user_id = v_actor_id
    AND m.status = 'active'
    AND m.role IN ('owner', 'admin', 'manager')
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Lock the employee after locking the store.
  SELECT e.*
  INTO v_employee
  FROM public.dokkan_employees e
  WHERE e.id = p_employee_id
    AND e.store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  -- Managers may only edit name and phone.
  IF v_actor_role = 'manager' THEN
    IF p_update_email
       OR p_update_branches
       OR p_role IS NOT NULL
       OR p_branch_ids IS NOT NULL THEN
      RAISE EXCEPTION 'Manager may only edit name and phone';
    END IF;

    -- Employee must overlap at least one branch
    -- assigned to the manager.
    IF NOT EXISTS (
      SELECT 1
      FROM public.dokkan_members m
      JOIN public.dokkan_member_branches mb
        ON mb.member_id = m.id
       AND mb.store_id = m.store_id
      JOIN public.dokkan_employee_branches eb
        ON eb.branch_id = mb.branch_id
       AND eb.store_id = mb.store_id
      WHERE m.store_id = p_store_id
        AND m.user_id = v_actor_id
        AND m.status = 'active'
        AND m.role = 'manager'
        AND eb.employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'Employee is outside manager branch scope';
    END IF;

    UPDATE public.dokkan_employees
    SET name = btrim(p_name),
        phone = NULLIF(btrim(p_phone), ''),
        updated_at = now()
    WHERE id = p_employee_id
      AND store_id = p_store_id;

  ELSE
    -- Owner/admin may update the approved employee fields.
    IF p_role IS NOT NULL
       AND p_role NOT IN ('manager', 'cashier', 'stock_manager', 'viewer') THEN
      RAISE EXCEPTION 'Invalid employee role';
    END IF;

    IF p_update_branches THEN
      v_branch_ids := COALESCE(p_branch_ids, ARRAY[]::uuid[]);

      IF cardinality(v_branch_ids) <>
         (SELECT count(DISTINCT x)
          FROM unnest(v_branch_ids) AS x) THEN
        RAISE EXCEPTION 'Duplicate branch assignment';
      END IF;

      IF cardinality(v_branch_ids) > 0
         AND EXISTS (
           SELECT 1
           FROM unnest(v_branch_ids) AS requested(branch_id)
           LEFT JOIN public.dokkan_branches b
             ON b.id = requested.branch_id
            AND b.store_id = p_store_id
            AND b.status = 'active'
           WHERE b.id IS NULL
         ) THEN
        RAISE EXCEPTION 'Invalid or inactive branch';
      END IF;

      SELECT COALESCE(
        array_agg(eb.branch_id ORDER BY eb.branch_id),
        ARRAY[]::uuid[]
      )
      INTO v_current_branch_ids
      FROM public.dokkan_employee_branches eb
      WHERE eb.employee_id = p_employee_id
        AND eb.store_id = p_store_id;

      v_branches_changed :=
        v_current_branch_ids IS DISTINCT FROM
        (SELECT COALESCE(
          array_agg(x ORDER BY x),
          ARRAY[]::uuid[]
        ) FROM unnest(v_branch_ids) AS x);
    END IF;

    IF p_update_email THEN
      v_email_changed := v_employee.email IS DISTINCT FROM v_email;
    END IF;

    -- A pending invitation blocks changes to its email
    -- or branch metadata.
    IF (v_email_changed OR v_branches_changed) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.dokkan_employee_invitations i
        WHERE i.store_id = p_store_id
          AND i.employee_id = p_employee_id
          AND i.status = 'pending'
        FOR UPDATE
      )
      INTO v_pending_exists;

      IF v_pending_exists THEN
        RAISE EXCEPTION
          'Pending invitation prevents email or branch changes';
      END IF;
    END IF;

    UPDATE public.dokkan_employees
    SET name = btrim(p_name),
        phone = NULLIF(btrim(p_phone), ''),
        role = COALESCE(p_role, role),
        email = CASE
          WHEN p_update_email THEN v_email
          ELSE email
        END,
        branch_id = CASE
          WHEN p_update_branches THEN
            (SELECT x FROM unnest(v_branch_ids) AS x LIMIT 1)
          ELSE branch_id
        END,
        updated_at = now()
    WHERE id = p_employee_id
      AND store_id = p_store_id;

    -- Synchronize permanent branch assignments.
    IF p_update_branches THEN
      DELETE FROM public.dokkan_employee_branches
      WHERE employee_id = p_employee_id
        AND store_id = p_store_id;

      INSERT INTO public.dokkan_employee_branches (
        employee_id, store_id, branch_id
      )
      SELECT p_employee_id, p_store_id, x
      FROM unnest(v_branch_ids) AS x;
    END IF;

    -- Synchronize invitation draft only when email or
    -- branch assignments have actually changed.
    IF v_email_changed OR v_branches_changed THEN

      SELECT i.id
      INTO v_draft_id
      FROM public.dokkan_employee_invitations i
      WHERE i.store_id = p_store_id
        AND i.employee_id = p_employee_id
        AND i.status = 'draft'
      ORDER BY i.created_at DESC
      LIMIT 1
      FOR UPDATE;

      IF p_update_email AND v_email IS NULL THEN
        IF v_draft_id IS NOT NULL THEN
          UPDATE public.dokkan_employee_invitations
          SET status = 'cancelled',
              token_hash = NULL,
              updated_at = now()
          WHERE id = v_draft_id
            AND store_id = p_store_id;
        END IF;

      ELSIF v_employee.email IS NOT NULL OR v_email IS NOT NULL THEN
        -- If only branches changed, retain the existing
        -- employee email.
        IF NOT p_update_email THEN
          v_email := v_employee.email;
        END IF;

        IF v_email IS NOT NULL THEN
          IF v_draft_id IS NULL AND v_email_changed THEN
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
              p_employee_id,
              v_email,
              'draft',
              v_actor_id,
              now() + interval '30 days',
              NULL
            )
            RETURNING id INTO v_draft_id;

          ELSIF v_draft_id IS NOT NULL THEN
            UPDATE public.dokkan_employee_invitations
            SET email = v_email,
                invited_by = v_actor_id,
                expires_at = now() + interval '30 days',
                token_hash = NULL,
                updated_at = now()
            WHERE id = v_draft_id
              AND store_id = p_store_id;
          END IF;
        END IF;
      END IF;

      -- Update draft branch metadata when a draft remains.
      IF v_draft_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM public.dokkan_employee_invitations i
           WHERE i.id = v_draft_id
             AND i.store_id = p_store_id
             AND i.status = 'draft'
         ) THEN

        DELETE FROM public.dokkan_employee_invitation_branches
        WHERE invitation_id = v_draft_id
          AND store_id = p_store_id;

        INSERT INTO public.dokkan_employee_invitation_branches (
          invitation_id, store_id, branch_id
        )
        SELECT v_draft_id, p_store_id, eb.branch_id
        FROM public.dokkan_employee_branches eb
        WHERE eb.employee_id = p_employee_id
          AND eb.store_id = p_store_id;
      END IF;
    END IF;
  END IF;

  -- Audit contains no email or phone values.
  SELECT eb.branch_id
  INTO v_first_branch
  FROM public.dokkan_employee_branches eb
  WHERE eb.employee_id = p_employee_id
    AND eb.store_id = p_store_id
  ORDER BY eb.branch_id
  LIMIT 1;

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
    v_first_branch,
    v_actor_id,
    'update',
    'employee',
    p_employee_id,
    jsonb_build_object(
      'actor_role', v_actor_role,
      'email_changed', CASE
        WHEN v_actor_role IN ('owner', 'admin')
        THEN v_email_changed ELSE false END,
      'branches_changed', CASE
        WHEN v_actor_role IN ('owner', 'admin')
        THEN v_branches_changed ELSE false END,
      'manager_limited_update', v_actor_role = 'manager'
    )
  );

  RETURN p_employee_id;
END;
$function$;

-- Restrict the RPC to authenticated callers.
REVOKE ALL ON FUNCTION public.dokkan_update_employee(
  uuid, uuid, text, text, text, text, boolean, uuid[], boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_update_employee(
  uuid, uuid, text, text, text, text, boolean, uuid[], boolean
) TO authenticated;
