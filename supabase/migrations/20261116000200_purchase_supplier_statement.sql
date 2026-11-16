
-- Dokkan Purchase Details and Supplier Statement
-- Secure invoice-linked supplier payments and supplier statement.
-- No existing payment amounts or supplier balances are modified.

BEGIN;

-- 1. Prevent unallocated supplier payments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.dokkan_supplier_payments
    WHERE purchase_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Unallocated supplier payments exist; migration stopped';
  END IF;
END;
$$;

ALTER TABLE public.dokkan_supplier_payments
  ALTER COLUMN purchase_id SET NOT NULL;


-- 2. Secure purchase details RPC.
CREATE OR REPLACE FUNCTION public.dokkan_get_purchase(
  p_purchase_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result jsonb;
  sid uuid;
  bid uuid;
BEGIN
  SELECT store_id, branch_id
  INTO sid, bid
  FROM public.dokkan_purchases
  WHERE id = p_purchase_id;

  IF auth.uid() IS NULL
     OR sid IS NULL
     OR NOT private.dokkan_is_member(sid)
     OR NOT private.dokkan_can_branch(bid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT
    to_jsonb(p) ||
    jsonb_build_object(
      'branch',
      jsonb_build_object(
        'id', b.id,
        'name', b.name
      ),
      'supplier',
      CASE
        WHEN s.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'phone', s.phone
        )
      END,
      'items',
      COALESCE(
        (
          SELECT jsonb_agg(
            to_jsonb(pi) ||
            jsonb_build_object(
              'variant',
              jsonb_build_object(
                'id', v.id,
                'sku', v.sku,
                'barcode', v.barcode,
                'size', v.size,
                'color', v.color,
                'product_name', pr.name
              )
            )
            ORDER BY pi.id
          )
          FROM public.dokkan_purchase_items pi
          LEFT JOIN public.dokkan_product_variants v
            ON v.id = pi.product_variant_id
          LEFT JOIN public.dokkan_products pr
            ON pr.id = v.product_id
          WHERE pi.purchase_id = p.id
        ),
        '[]'::jsonb
      ),
      'payments',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', sp.id,
              'amount', sp.amount,
              'payment_method', sp.payment_method,
              'notes', sp.notes,
              'created_at', sp.created_at,
              'created_by', sp.created_by
            )
            ORDER BY sp.created_at, sp.id
          )
          FROM public.dokkan_supplier_payments sp
          WHERE sp.purchase_id = p.id
            AND sp.store_id = p.store_id
        ),
        '[]'::jsonb
      )
    )
  INTO result
  FROM public.dokkan_purchases p
  JOIN public.dokkan_branches b
    ON b.id = p.branch_id
   AND b.store_id = p.store_id
  LEFT JOIN public.dokkan_suppliers s
    ON s.id = p.supplier_id
   AND s.store_id = p.store_id
  WHERE p.id = p_purchase_id;

  RETURN result;
END;
$function$;


-- 3. Supplier statement RPC.
CREATE OR REPLACE FUNCTION public.dokkan_get_supplier_statement(
  p_supplier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  sid uuid;
  supplier_json jsonb;
  invoices_json jsonb;
  received_total numeric := 0;
  paid_total numeric := 0;
  advance_paid numeric := 0;
  unreceived_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT store_id
  INTO sid
  FROM public.dokkan_suppliers
  WHERE id = p_supplier_id;

  IF sid IS NULL OR NOT private.dokkan_is_member(sid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'phone', s.phone,
    'address', s.address,
    'category', s.category,
    'notes', s.notes
  )
  INTO supplier_json
  FROM public.dokkan_suppliers s
  WHERE s.id = p_supplier_id
    AND s.store_id = sid;

  SELECT
    COALESCE(SUM(
      CASE WHEN p.status = 'received'
        THEN p.total ELSE 0 END
    ), 0),
    COALESCE(SUM(p.amount_paid), 0),
    COALESCE(SUM(
      CASE WHEN p.status <> 'received'
        THEN p.amount_paid ELSE 0 END
    ), 0),
    COALESCE(SUM(
      CASE
        WHEN p.status IN ('pending', 'paid', 'partially_received')
          THEN p.total
        ELSE 0
      END
    ), 0)
  INTO
    received_total,
    paid_total,
    advance_paid,
    unreceived_total
  FROM public.dokkan_purchases p
  WHERE p.store_id = sid
    AND p.supplier_id = p_supplier_id
    AND private.dokkan_can_branch(p.branch_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'status', p.status,
        'total', p.total,
        'amount_paid', p.amount_paid,
        'remaining', p.total - p.amount_paid,
        'notes', p.notes,
        'created_at', p.created_at,
        'posted_at', p.posted_at,
        'branch',
        jsonb_build_object(
          'id', b.id,
          'name', b.name
        ),
        'payments',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', sp.id,
                'amount', sp.amount,
                'payment_method', sp.payment_method,
                'notes', sp.notes,
                'created_at', sp.created_at
              )
              ORDER BY sp.created_at, sp.id
            )
            FROM public.dokkan_supplier_payments sp
            WHERE sp.purchase_id = p.id
              AND sp.store_id = p.store_id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO invoices_json
  FROM public.dokkan_purchases p
  JOIN public.dokkan_branches b
    ON b.id = p.branch_id
   AND b.store_id = p.store_id
  WHERE p.store_id = sid
    AND p.supplier_id = p_supplier_id
    AND private.dokkan_can_branch(p.branch_id);

  RETURN jsonb_build_object(
    'supplier', supplier_json,
    'summary', jsonb_build_object(
      'received_invoice_total', received_total,
      'total_paid', paid_total,
      'advance_paid', advance_paid,
      'unreceived_invoice_total', unreceived_total,
      'balance', received_total - paid_total
    ),
    'invoices', invoices_json
  );
END;
$function$;


-- 4. Harden supplier payment RPC.
-- Payments remain linked to one purchase invoice.
-- Pre-receipt payments are allowed.
-- Cancelled invoices cannot receive new payments.

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
SET search_path = ''
AS $function$
DECLARE
  purchase_row public.dokkan_purchases%ROWTYPE;
  existing_id uuid;
  existing_purchase_id uuid;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR p_purchase_id IS NULL
     OR p_amount IS NULL
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_amount <= 0
     OR nullif(trim(p_idempotency_key), '') IS NULL
     OR payment_method IS NULL
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

  SELECT id, purchase_id
  INTO existing_id, existing_purchase_id
  FROM public.dokkan_supplier_payments
  WHERE store_id = purchase_row.store_id
    AND idempotency_key = trim(p_idempotency_key);

  IF existing_id IS NOT NULL THEN
    IF existing_purchase_id IS DISTINCT FROM p_purchase_id THEN
      RAISE EXCEPTION 'idempotency key already used for another purchase';
    END IF;

    RETURN existing_id;
  END IF;

  IF purchase_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'cannot pay a cancelled purchase';
  END IF;

  IF p_amount > purchase_row.total - purchase_row.amount_paid THEN
    RAISE EXCEPTION 'payment exceeds purchase remaining amount';
  END IF;

  INSERT INTO public.dokkan_supplier_payments (
    store_id,
    supplier_id,
    purchase_id,
    amount,
    payment_method,
    notes,
    idempotency_key,
    created_by
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
  SET
    amount_paid = amount_paid + p_amount,
    status = CASE
      WHEN purchase_row.status IN ('received', 'partially_received')
        THEN purchase_row.status
      WHEN amount_paid + p_amount >= total
        THEN 'paid'
      ELSE purchase_row.status
    END
  WHERE id = p_purchase_id;

  UPDATE public.dokkan_suppliers
  SET
    balance = balance - p_amount,
    updated_at = now()
  WHERE id = purchase_row.supplier_id
    AND store_id = purchase_row.store_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    branch_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
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
      'purchase_id', p_purchase_id,
      'payment_method', payment_method
    )
  );

  RETURN new_id;
END;
$function$;


-- 5. Restrict function execution.
REVOKE ALL ON FUNCTION public.dokkan_get_purchase(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_get_purchase(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.dokkan_get_supplier_statement(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_get_supplier_statement(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.dokkan_record_supplier_payment(
  uuid, numeric, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_record_supplier_payment(
  uuid, numeric, text, text, text
) TO authenticated;

COMMIT;
