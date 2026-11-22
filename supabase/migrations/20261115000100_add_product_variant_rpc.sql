
-- Add a new variant to an existing product.
-- Existing variants and historical inventory movements remain unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.dokkan_add_product_variant(
  target_store_id uuid,
  target_product_id uuid,
  variant_sku text,
  variant_barcode text DEFAULT NULL,
  variant_size text DEFAULT NULL,
  variant_color text DEFAULT NULL,
  variant_price numeric DEFAULT 0,
  variant_cost numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_variant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF target_store_id IS NULL OR target_product_id IS NULL THEN
    RAISE EXCEPTION 'invalid product';
  END IF;

  IF NOT private.dokkan_has_role(
    target_store_id,
    ARRAY['owner', 'admin', 'manager', 'stock_manager']::text[]
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dokkan_products AS p
    WHERE p.id = target_product_id
      AND p.store_id = target_store_id
  ) THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  IF NULLIF(TRIM(variant_sku), '') IS NULL
     OR variant_price IS NULL
     OR variant_cost IS NULL
     OR variant_price < 0
     OR variant_cost < 0
     OR variant_price::text IN ('NaN', 'Infinity', '-Infinity')
     OR variant_cost::text IN ('NaN', 'Infinity', '-Infinity')
  THEN
    RAISE EXCEPTION 'invalid variant';
  END IF;

  INSERT INTO public.dokkan_product_variants (
    store_id,
    product_id,
    sku,
    barcode,
    size,
    color,
    price,
    cost
  )
  VALUES (
    target_store_id,
    target_product_id,
    TRIM(variant_sku),
    NULLIF(TRIM(variant_barcode), ''),
    NULLIF(TRIM(variant_size), ''),
    NULLIF(TRIM(variant_color), ''),
    variant_price,
    variant_cost
  )
  RETURNING id INTO new_variant_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id
  )
  VALUES (
    target_store_id,
    'create',
    'product_variant',
    new_variant_id,
    auth.uid()
  );

  RETURN new_variant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.dokkan_add_product_variant(
  uuid, uuid, text, text, text, text, numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.dokkan_add_product_variant(
  uuid, uuid, text, text, text, text, numeric, numeric
) TO authenticated;

COMMIT;
