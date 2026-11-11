
BEGIN;

-- Block anonymous access to return records.
REVOKE ALL ON TABLE public.dokkan_sale_returns FROM anon;
REVOKE ALL ON TABLE public.dokkan_sale_return_items FROM anon;

-- Authenticated users can read returns only.
REVOKE ALL ON TABLE public.dokkan_sale_returns FROM authenticated;
REVOKE ALL ON TABLE public.dokkan_sale_return_items FROM authenticated;

GRANT SELECT ON TABLE public.dokkan_sale_returns TO authenticated;
GRANT SELECT ON TABLE public.dokkan_sale_return_items TO authenticated;

COMMIT;
