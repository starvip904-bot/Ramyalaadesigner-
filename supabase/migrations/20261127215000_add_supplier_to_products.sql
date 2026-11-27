
-- supabase/migrations/20261127215000_add_supplier_to_products.sql

-- إضافة مفتاح مركب يضمن أن المورد والمنتج تابعان لنفس المتجر.
CREATE UNIQUE INDEX IF NOT EXISTS
  dokkan_suppliers_store_id_id_unique
ON public.dokkan_suppliers (store_id, id);

-- إضافة المورد إلى المنتج.
-- يظل NULL للمنتجات القديمة حتى لا نفقد أو نغيّر بياناتها.
ALTER TABLE public.dokkan_products
ADD COLUMN IF NOT EXISTS supplier_id uuid;

-- منع ربط منتج بمورد تابع لمتجر آخر.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dokkan_products_store_supplier_fk'
      AND conrelid = 'public.dokkan_products'::regclass
  ) THEN
    ALTER TABLE public.dokkan_products
    ADD CONSTRAINT dokkan_products_store_supplier_fk
    FOREIGN KEY (store_id, supplier_id)
    REFERENCES public.dokkan_suppliers (store_id, id)
    ON DELETE RESTRICT;
  END IF;
END
$$;

-- تسريع البحث عن منتجات المورد.
CREATE INDEX IF NOT EXISTS
  dokkan_products_store_supplier_idx
ON public.dokkan_products (store_id, supplier_id);
