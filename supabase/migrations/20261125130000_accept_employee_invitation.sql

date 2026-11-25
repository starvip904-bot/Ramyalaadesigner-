
-- Accept an employee invitation using a verified Supabase Auth user.
-- This function is callable only with the service_role key.
-- Employee access is restricted to the branches stored in the invitation.

CREATE OR REPLACE FUNCTION public.dokkan_accept_employee_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invitation public.dokkan_employee_invitations%ROWTYPE;
  v_employee public.dokkan_employees%ROWTYPE;
  v_member_id uuid;
  v_email text;
  v_branch_count integer;
  v_invalid_branch_count integer;
BEGIN
  -- Never allow browser-authenticated users to call this function.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_user_id IS NULL
     OR p_email IS NULL
  THEN
    RAISE EXCEPTION 'INVALID_INVITATION_INPUT';
  END IF;

  v_email := lower(btrim(p_email));

  IF length(v_email) < 5 OR length(v_email) > 320 THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  -- Lock the invitation to prevent simultaneous acceptance.
  SELECT *
  INTO v_invitation
  FROM public.dokkan_employee_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_NOT_PENDING';
  END IF;

  IF v_invitation.expires_at IS NULL
     OR v_invitation.expires_at <= now()
  THEN
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;

  IF lower(btrim(v_invitation.email)) <> v_email THEN
    RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH';
  END IF;

  -- Lock and validate the employee record.
  SELECT *
  INTO v_employee
  FROM public.dokkan_employees
  WHERE id = v_invitation.employee_id
    AND store_id = v_invitation.store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND';
  END IF;

  IF v_employee.status <> 'active' THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_ACTIVE';
  END IF;

  IF lower(btrim(coalesce(v_employee.email, ''))) <> v_email THEN
    RAISE EXCEPTION 'EMPLOYEE_EMAIL_MISMATCH';
  END IF;

  IF v_employee.role NOT IN (
    'manager',
    'cashier',
    'stock_manager',
    'viewer'
  ) THEN
    RAISE EXCEPTION 'EMPLOYEE_ROLE_INVALID';
  END IF;

  -- The invitation must contain at least one branch.
  SELECT count(*)
  INTO v_branch_count
  FROM public.dokkan_employee_invitation_branches
  WHERE invitation_id = v_invitation.id
    AND store_id = v_invitation.store_id;

  IF v_branch_count = 0 THEN
    RAISE EXCEPTION 'INVITATION_HAS_NO_BRANCHES';
  END IF;

  -- Every assigned branch must still be active and belong to this store.
  SELECT count(*)
  INTO v_invalid_branch_count
  FROM public.dokkan_employee_invitation_branches ib
  LEFT JOIN public.dokkan_branches b
    ON b.id = ib.branch_id
   AND b.store_id = ib.store_id
  WHERE ib.invitation_id = v_invitation.id
    AND ib.store_id = v_invitation.store_id
    AND (
      b.id IS NULL
      OR b.status <> 'active'
    );

  IF v_invalid_branch_count > 0 THEN
    RAISE EXCEPTION 'INVITATION_BRANCH_INVALID';
  END IF;

  -- Do not attach an existing store account to another employee.
  IF EXISTS (
    SELECT 1
    FROM public.dokkan_members m
    WHERE m.store_id = v_invitation.store_id
      AND (
        m.user_id = p_user_id
        OR m.employee_id = v_employee.id
      )
  ) THEN
    RAISE EXCEPTION 'MEMBERSHIP_ALREADY_EXISTS';
  END IF;

  -- Create the employee's active store membership.
  INSERT INTO public.dokkan_members (
    store_id,
    user_id,
    role,
    display_name,
    status,
    employee_id
  )
  VALUES (
    v_invitation.store_id,
    p_user_id,
    v_employee.role,
    v_employee.name,
    'active',
    v_employee.id
  )
  RETURNING id INTO v_member_id;

  -- Copy only the branches explicitly assigned to this invitation.
  INSERT INTO public.dokkan_member_branches (
    member_id,
    store_id,
    branch_id
  )
  SELECT
    v_member_id,
    ib.store_id,
    ib.branch_id
  FROM public.dokkan_employee_invitation_branches ib
  WHERE ib.invitation_id = v_invitation.id
    AND ib.store_id = v_invitation.store_id;

  -- Mark the invitation as accepted and invalidate its token.
  UPDATE public.dokkan_employee_invitations
  SET
    status = 'accepted',
    accepted_user_id = p_user_id,
    accepted_at = now(),
    token_hash = NULL,
    updated_at = now()
  WHERE id = v_invitation.id
    AND store_id = v_invitation.store_id;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', v_member_id,
    'store_id', v_invitation.store_id,
    'employee_id', v_employee.id,
    'role', v_employee.role,
    'branches_assigned', v_branch_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dokkan_accept_employee_invitation(text, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_accept_employee_invitation(text, uuid, text)
TO service_role;
