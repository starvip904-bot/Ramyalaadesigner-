
-- Ensure newly created stores receive an ID automatically.
-- Existing store IDs and records remain unchanged.
ALTER TABLE public.dokkan_stores
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
