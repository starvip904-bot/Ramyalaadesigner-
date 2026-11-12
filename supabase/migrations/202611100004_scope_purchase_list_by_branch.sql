
CREATE OR REPLACE FUNCTION public.dokkan_list_purchases(
  p_store_id uuid,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- التأكد من أن المستخدم عضو نشط في المتجر
  IF NOT private.dokkan_is_member(p_store_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- جلب المشتريات المسموح للمستخدم برؤية فروعها فقط
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(p) || jsonb_build_object(
        'items',
        COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.id)
            FROM public.dokkan_purchase_items pi
            WHERE pi.purchase_id = p.id
          ),
          '[]'::jsonb
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
        'branch',
        jsonb_build_object(
          'id', b.id,
          'name', b.name
        )
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO result
  FROM public.dokkan_purchases p
  LEFT JOIN public.dokkan_suppliers s
    ON s.id = p.supplier_id
   AND s.store_id = p.store_id
  JOIN public.dokkan_branches b
    ON b.id = p.branch_id
   AND b.store_id = p.store_id
  WHERE p.store_id = p_store_id
    AND private.dokkan_can_branch(p.branch_id)
    AND (
      p_search IS NULL
      OR p.id::text ILIKE '%' || p_search || '%'
      OR COALESCE(s.name, '') ILIKE '%' || p_search || '%'
    );

  RETURN result;
END;
$function$;
