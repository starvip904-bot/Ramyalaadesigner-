
-- Dokkan: Sale return request and approval workflow.
-- Pending requests are stored separately from executed sale returns.
-- Only approval executes the existing financial and inventory return logic.

BEGIN;

-- =========================================================
-- 1. Separate request tables
-- =========================================================

CREATE TABLE public.dokkan_sale_return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.dokkan_stores(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.dokkan_sales(id),
  branch_id uuid NOT NULL REFERENCES public.dokkan_branches(id),
  return_type text NOT NULL DEFAULT 'refund'
    CHECK (return_type IN ('refund', 'exchange')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_refund_method text
    CHECK (
      requested_refund_method IS NULL
      OR requested_refund_method IN ('cash', 'card', 'transfer')
    ),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_notes text,
  processed_return_id uuid UNIQUE
    REFERENCES public.dokkan_sale_returns(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  CONSTRAINT dokkan_sale_return_requests_idempotency_length
    CHECK (
      length(trim(idempotency_key)) BETWEEN 8 AND 120
    ),
  CONSTRAINT dokkan_sale_return_requests_decision_length
    CHECK (
      decision_notes IS NULL OR length(decision_notes) <= 1000
    ),
  CONSTRAINT dokkan_sale_return_requests_notes_length
    CHECK (
      notes IS NULL OR length(notes) <= 1000
    ),
  CONSTRAINT dokkan_sale_return_requests_store_idempotency_unique
    UNIQUE (store_id, idempotency_key)
);

CREATE TABLE public.dokkan_sale_return_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL
    REFERENCES public.dokkan_sale_return_requests(id) ON DELETE CASCADE,
  product_variant_id uuid NOT NULL
    REFERENCES public.dokkan_product_variants(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dokkan_sale_return_request_items_unique
    UNIQUE (request_id, product_variant_id)
);

CREATE INDEX dokkan_sale_return_requests_store_status_created_idx
  ON public.dokkan_sale_return_requests
  (store_id, status, created_at DESC);

CREATE INDEX dokkan_sale_return_requests_sale_status_idx
  ON public.dokkan_sale_return_requests
  (sale_id, status);

CREATE INDEX dokkan_sale_return_request_items_variant_idx
  ON public.dokkan_sale_return_request_items
  (product_variant_id);


-- =========================================================
-- 2. RLS: members may read requests in accessible branches.
--    All writes happen through the protected RPC functions.
-- =========================================================

ALTER TABLE public.dokkan_sale_return_requests
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dokkan_sale_return_request_items
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY dokkan_sale_return_requests_branch_read
  ON public.dokkan_sale_return_requests
  FOR SELECT
  TO authenticated
  USING (private.dokkan_can_branch(branch_id));

CREATE POLICY dokkan_sale_return_request_items_branch_read
  ON public.dokkan_sale_return_request_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dokkan_sale_return_requests r
      WHERE r.id = request_id
        AND private.dokkan_can_branch(r.branch_id)
    )
  );

REVOKE ALL ON TABLE public.dokkan_sale_return_requests
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.dokkan_sale_return_request_items
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.dokkan_sale_return_requests
  TO authenticated;

GRANT SELECT ON TABLE public.dokkan_sale_return_request_items
  TO authenticated;


-- =========================================================
-- 3. Create a pending request.
--    This function NEVER changes stock or sale balances.
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_request_sale_return(
  p_sale_id uuid,
  p_items jsonb,
  p_refund_method text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale public.dokkan_sales%rowtype;
  v_request_id uuid;
  v_existing_id uuid;
  v_existing_sale_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity numeric(14,3);
  v_sold_quantity numeric(14,3);
  v_returned_quantity numeric(14,3);
  v_reserved_quantity numeric(14,3);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_sale_id IS NULL
     OR p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR nullif(trim(p_idempotency_key), '') IS NULL
     OR length(trim(p_idempotency_key)) < 8
     OR length(trim(p_idempotency_key)) > 120
     OR length(coalesce(p_notes, '')) > 1000
     OR (
       p_refund_method IS NOT NULL
       AND p_refund_method NOT IN ('cash', 'card', 'transfer')
     ) THEN
    RAISE EXCEPTION 'invalid return request';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS e(value)
    GROUP BY e.value->>'variant_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate return item';
  END IF;

  -- Lock the sale so concurrent requests cannot reserve the same quantity.
  SELECT *
  INTO v_sale
  FROM public.dokkan_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT private.dokkan_has_role(
       v_sale.store_id,
       ARRAY['owner', 'admin', 'manager', 'cashier']::text[]
     )
     OR NOT private.dokkan_can_branch(v_sale.branch_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_sale.store_id::text || ':return-request:' || trim(p_idempotency_key),
      0
    )
  );

  SELECT id, sale_id
  INTO v_existing_id, v_existing_sale_id
  FROM public.dokkan_sale_return_requests
  WHERE store_id = v_sale.store_id
    AND idempotency_key = trim(p_idempotency_key);

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_sale_id = p_sale_id THEN
      RETURN v_existing_id;
    END IF;

    RAISE EXCEPTION 'idempotency key already used';
  END IF;

  IF v_sale.status = 'returned' THEN
    RAISE EXCEPTION 'sale already returned';
  END IF;

  -- Lock variants in a stable order.
  FOR v_variant_id IN
    SELECT (e.value->>'variant_id')::uuid
    FROM jsonb_array_elements(p_items) AS e(value)
    ORDER BY (e.value->>'variant_id')::uuid
  LOOP
    PERFORM 1
    FROM public.dokkan_product_variants v
    WHERE v.id = v_variant_id
      AND v.store_id = v_sale.store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid product variant';
    END IF;
  END LOOP;

  -- Validate every requested quantity against:
  -- sold quantity - executed returns - other pending requests.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item->'variant_id') <> 'string'
       OR jsonb_typeof(v_item->'quantity') <> 'number' THEN
      RAISE EXCEPTION 'invalid return quantity';
    END IF;

    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    IF v_variant_id IS NULL
       OR v_quantity IS NULL
       OR v_quantity <= 0
       OR v_quantity > 1000000 THEN
      RAISE EXCEPTION 'invalid return quantity';
    END IF;

    SELECT coalesce(sum(si.quantity), 0)
    INTO v_sold_quantity
    FROM public.dokkan_sale_items si
    WHERE si.sale_id = p_sale_id
      AND si.product_variant_id = v_variant_id;

    IF v_sold_quantity <= 0 THEN
      RAISE EXCEPTION 'item not found in sale';
    END IF;

    SELECT coalesce(sum(ri.quantity), 0)
    INTO v_returned_quantity
    FROM public.dokkan_sale_return_items ri
    JOIN public.dokkan_sale_returns sr
      ON sr.id = ri.return_id
    WHERE sr.sale_id = p_sale_id
      AND ri.product_variant_id = v_variant_id;

    SELECT coalesce(sum(qi.quantity), 0)
    INTO v_reserved_quantity
    FROM public.dokkan_sale_return_request_items qi
    JOIN public.dokkan_sale_return_requests qr
      ON qr.id = qi.request_id
    WHERE qr.sale_id = p_sale_id
      AND qr.status = 'pending'
      AND qi.product_variant_id = v_variant_id;

    IF v_quantity >
       v_sold_quantity - v_returned_quantity - v_reserved_quantity THEN
      RAISE EXCEPTION 'return quantity exceeds available quantity';
    END IF;
  END LOOP;

  INSERT INTO public.dokkan_sale_return_requests (
    store_id,
    sale_id,
    branch_id,
    return_type,
    status,
    requested_refund_method,
    notes,
    created_by,
    idempotency_key
  )
  VALUES (
    v_sale.store_id,
    p_sale_id,
    v_sale.branch_id,
    'refund',
    'pending',
    p_refund_method,
    nullif(trim(p_notes), ''),
    v_user_id,
    trim(p_idempotency_key)
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.dokkan_sale_return_request_items (
    request_id,
    product_variant_id,
    quantity
  )
  SELECT
    v_request_id,
    (e.value->>'variant_id')::uuid,
    (e.value->>'quantity')::numeric
  FROM jsonb_array_elements(p_items) AS e(value);

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
    v_sale.store_id,
    v_sale.branch_id,
    v_user_id,
    'sale_return_requested',
    'sale_return_request',
    v_request_id,
    jsonb_build_object('sale_id', p_sale_id)
  );

  RETURN v_request_id;
END;
$function$;


-- =========================================================
-- 4. Approve or reject a request.
--    Only the owner or the assigned branch manager may decide.
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_decide_sale_return(
  p_request_id uuid,
  p_decision text,
  p_decision_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.dokkan_sale_return_requests%rowtype;
  v_sale public.dokkan_sales%rowtype;
  v_item record;
  v_sold_quantity numeric(14,3);
  v_returned_quantity numeric(14,3);
  v_reserved_quantity numeric(14,3);
  v_processed_return_id uuid;
  v_items jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_request_id IS NULL
     OR p_decision IS NULL
     OR p_decision NOT IN ('approved', 'rejected')
     OR length(coalesce(p_decision_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT *
  INTO v_request
  FROM public.dokkan_sale_return_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'return request not found';
  END IF;

  SELECT *
  INTO v_sale
  FROM public.dokkan_sales
  WHERE id = v_request.sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale not found';
  END IF;

  -- Admin is intentionally not an approver.
  -- Owner has store-wide access; manager must be assigned to this branch.
  IF NOT (
    private.dokkan_has_role(
      v_request.store_id,
      ARRAY['owner']::text[]
    )
    OR (
      private.dokkan_has_role(
        v_request.store_id,
        ARRAY['manager']::text[]
      )
      AND private.dokkan_can_branch(v_request.branch_id)
    )
  ) THEN
    RAISE EXCEPTION 'not authorized to decide return request';
  END IF;

  -- Idempotent retry after a successful approval.
  IF v_request.status = 'approved' THEN
    IF p_decision = 'approved'
       AND v_request.processed_return_id IS NOT NULL THEN
      RETURN v_request.processed_return_id;
    END IF;

    RAISE EXCEPTION 'return request already decided';
  END IF;

  IF v_request.status = 'rejected' THEN
    IF p_decision = 'rejected' THEN
      RETURN v_request.id;
    END IF;

    RAISE EXCEPTION 'return request already rejected';
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.dokkan_sale_return_requests
    SET
      status = 'rejected',
      decided_by = v_user_id,
      decided_at = now(),
      decision_notes = nullif(trim(p_decision_notes), '')
    WHERE id = v_request.id;

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
      v_request.store_id,
      v_request.branch_id,
      v_user_id,
      'sale_return_rejected',
      'sale_return_request',
      v_request.id,
      jsonb_build_object(
        'sale_id', v_request.sale_id,
        'decision_notes', p_decision_notes
      )
    );

    RETURN v_request.id;
  END IF;

  -- Re-check reservations at approval time.
  -- Other pending requests remain reserved; this request is excluded.
  FOR v_item IN
    SELECT product_variant_id, quantity
    FROM public.dokkan_sale_return_request_items
    WHERE request_id = v_request.id
    ORDER BY product_variant_id
  LOOP
    SELECT coalesce(sum(si.quantity), 0)
    INTO v_sold_quantity
    FROM public.dokkan_sale_items si
    WHERE si.sale_id = v_request.sale_id
      AND si.product_variant_id = v_item.product_variant_id;

    SELECT coalesce(sum(ri.quantity), 0)
    INTO v_returned_quantity
    FROM public.dokkan_sale_return_items ri
    JOIN public.dokkan_sale_returns sr
      ON sr.id = ri.return_id
    WHERE sr.sale_id = v_request.sale_id
      AND ri.product_variant_id = v_item.product_variant_id;

    SELECT coalesce(sum(qi.quantity), 0)
    INTO v_reserved_quantity
    FROM public.dokkan_sale_return_request_items qi
    JOIN public.dokkan_sale_return_requests qr
      ON qr.id = qi.request_id
    WHERE qr.sale_id = v_request.sale_id
      AND qr.status = 'pending'
      AND qr.id <> v_request.id
      AND qi.product_variant_id = v_item.product_variant_id;

    IF v_item.quantity >
       v_sold_quantity - v_returned_quantity - v_reserved_quantity THEN
      RAISE EXCEPTION 'return quantity exceeds available quantity';
    END IF;
  END LOOP;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'variant_id', product_variant_id,
        'quantity', quantity
      )
      ORDER BY product_variant_id
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.dokkan_sale_return_request_items
  WHERE request_id = v_request.id;

  -- Execute the existing trusted return logic only now.
  -- The generated key prevents duplicate execution on retries.
  v_processed_return_id := public.dokkan_create_sale_return(
    v_request.sale_id,
    v_items,
    v_request.requested_refund_method,
    v_request.notes,
    'approved-request-' || v_request.id::text
  );

  UPDATE public.dokkan_sale_return_requests
  SET
    status = 'approved',
    decided_by = v_user_id,
    decided_at = now(),
    decision_notes = nullif(trim(p_decision_notes), ''),
    processed_return_id = v_processed_return_id
  WHERE id = v_request.id;

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
    v_request.store_id,
    v_request.branch_id,
    v_user_id,
    'sale_return_approved',
    'sale_return_request',
    v_request.id,
    jsonb_build_object(
      'sale_id', v_request.sale_id,
      'processed_return_id', v_processed_return_id
    )
  );

  RETURN v_processed_return_id;
END;
$function$;


-- =========================================================
-- 5. Restrict RPC access.
--    The legacy direct-return RPC is now internal to the
--    approval workflow and must not be callable by clients.
-- =========================================================

REVOKE ALL ON FUNCTION public.dokkan_request_sale_return(
  uuid, jsonb, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_request_sale_return(
  uuid, jsonb, text, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.dokkan_decide_sale_return(
  uuid, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_decide_sale_return(
  uuid, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.dokkan_create_sale_return(
  uuid, jsonb, text, text, text
) FROM PUBLIC, anon, authenticated;

COMMIT;
