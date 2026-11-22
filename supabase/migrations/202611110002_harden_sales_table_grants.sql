BEGIN;

-- Sales: block direct access for anonymous users.
REVOKE ALL ON TABLE public.dokkan_sales FROM anon;

-- Sales: authenticated users can read only.
REVOKE ALL ON TABLE public.dokkan_sales FROM authenticated;
GRANT SELECT ON TABLE public.dokkan_sales TO authenticated;

-- Sale items: block direct access for anonymous users.
REVOKE ALL ON TABLE public.dokkan_sale_items FROM anon;

-- Sale items: authenticated users can read only.
REVOKE ALL ON TABLE public.dokkan_sale_items FROM authenticated;
GRANT SELECT ON TABLE public.dokkan_sale_items TO authenticated;

COMMIT;