
CREATE OR REPLACE FUNCTION public.dokkan_record_supplier_payment(
  p_purchase_id uuid,
  p_amount numeric,
  payment_method text,
  p_notes text,
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  purchase_row public.dokkan_purchases%rowtype;
  existing_id uuid;
  new_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0
     OR nullif(trim(p_idempotency_key), '') IS NULL
     OR payment_method NOT IN ('cash', 'card', 'transfer') THEN
    RAISE EXCEPTION 'invalid payment';
  END IF;

  SELECT *
  INTO purchase_row
  FROM public.dokkan_purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT private.dokkan_has_role(
       purchase_row.store_id,
       ARRAY['owner', 'admin', 'manager']
     )
     OR NOT private.dokkan_can_branch(purchase_row.branch_id)
     OR purchase_row.supplier_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id
  INTO existing_id
  FROM public.dokkan_supplier_payments
  WHERE store_id = purchase_row.store_id
    AND idempotency_key = trim(p_idempotency_key);

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  IF p_amount > purchase_row.total - purchase_row.amount_paid THEN
    RAISE EXCEPTION 'invalid payment';
  END IF;

  INSERT INTO public.dokkan_supplier_payments(
    store_id, supplier_id, purchase_id, amount,
    payment_method, notes, idempotency_key, created_by
  )
  VALUES (
    purchase_row.store_id,
    purchase_row.supplier_id,
    p_purchase_id,
    p_amount,
    payment_method,
    nullif(trim(p_notes), ''),
    trim(p_idempotency_key),
    auth.uid()
  )
  RETURNING id INTO new_id;

  UPDATE public.dokkan_purchases
  SET amount_paid = amount_paid + p_amount,
      status = CASE
        WHEN amount_paid + p_amount >= total THEN 'paid'
        WHEN status = 'paid' THEN 'pending'
        ELSE status
      END
  WHERE id = p_purchase_id;

  UPDATE public.dokkan_suppliers
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = purchase_row.supplier_id
    AND store_id = purchase_row.store_id;

  INSERT INTO public.dokkan_audit_events(
    store_id, branch_id, action, entity_type,
    entity_id, actor_id, metadata
  )
  VALUES (
    purchase_row.store_id,
    purchase_row.branch_id,
    'supplier_payment',
    'supplier_payment',
    new_id,
    auth.uid(),
    jsonb_build_object(
      'amount', p_amount,
      'purchase_id', p_purchase_id
    )
  );

  RETURN new_id;
END;
$function$;
