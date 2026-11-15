
-- Dokkan Inventory Count Foundation
-- Creates inventory count tables and their relational constraints.
-- Access policies and operational RPCs will be added separately.

BEGIN;

-- Ensure composite foreign keys can verify that variants and movements
-- belong to the same store, branch, and product variant.
CREATE UNIQUE INDEX IF NOT EXISTS dokkan_product_variants_id_store_unique
  ON public.dokkan_product_variants (id, store_id);

CREATE UNIQUE INDEX IF NOT EXISTS dokkan_inventory_movements_identity_unique
  ON public.dokkan_inventory_movements
    (id, store_id, branch_id, product_variant_id);


-- =========================================================
-- 1. Inventory count sessions
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dokkan_inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  store_id uuid NOT NULL
    REFERENCES public.dokkan_stores(id) ON DELETE RESTRICT,

  branch_id uuid NOT NULL,

  count_number text NOT NULL,

  count_type text NOT NULL
    CHECK (count_type IN ('full', 'partial')),

  status text NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'counting',
        'review',
        'approved',
        'cancelled'
      )
    ),

  notes text,

  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  started_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,

  started_at timestamptz,
  approved_at timestamptz,

  original_count_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dokkan_inventory_counts_branch_store_fk
    FOREIGN KEY (branch_id, store_id)
    REFERENCES public.dokkan_branches (id, store_id)
    ON DELETE RESTRICT,

  CONSTRAINT dokkan_inventory_counts_original_count_fk
    FOREIGN KEY (original_count_id, store_id, branch_id)
    REFERENCES public.dokkan_inventory_counts (id, store_id, branch_id)
    ON DELETE RESTRICT,

  CONSTRAINT dokkan_inventory_counts_number_unique
    UNIQUE (store_id, count_number),

  CONSTRAINT dokkan_inventory_counts_identity_unique
    UNIQUE (id, store_id, branch_id)
);


-- =========================================================
-- 2. Inventory count items
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dokkan_inventory_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  count_id uuid NOT NULL,
  store_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  product_variant_id uuid NOT NULL,

  -- Product information snapshot at the time it was added.
  product_name text NOT NULL,
  category text,
  brand text,
  sku text,
  barcode text,
  size text,
  color text,

  -- System quantity when the count session started.
  system_quantity_at_start numeric(14,3) NOT NULL DEFAULT 0
    CHECK (
      system_quantity_at_start >= 0
      AND system_quantity_at_start NOT IN (
        'NaN'::numeric,
        'Infinity'::numeric,
        '-Infinity'::numeric
      )
    ),

  -- System quantity at the actual counting time.
  system_quantity_at_count numeric(14,3)
    CHECK (
      system_quantity_at_count IS NULL
      OR (
        system_quantity_at_count >= 0
        AND system_quantity_at_count NOT IN (
          'NaN'::numeric,
          'Infinity'::numeric,
          '-Infinity'::numeric
        )
      )
    ),

  actual_quantity numeric(14,3)
    CHECK (
      actual_quantity IS NULL
      OR (
        actual_quantity >= 0
        AND actual_quantity NOT IN (
          'NaN'::numeric,
          'Infinity'::numeric,
          '-Infinity'::numeric
        )
      )
    ),

  difference numeric(14,3)
    CHECK (
      difference IS NULL
      OR difference NOT IN (
        'NaN'::numeric,
        'Infinity'::numeric,
        '-Infinity'::numeric
      )
    ),

  counted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  count_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dokkan_inventory_count_items_count_fk
    FOREIGN KEY (count_id, store_id, branch_id)
    REFERENCES public.dokkan_inventory_counts (id, store_id, branch_id)
    ON DELETE RESTRICT,

  CONSTRAINT dokkan_inventory_count_items_variant_fk
    FOREIGN KEY (product_variant_id, store_id)
    REFERENCES public.dokkan_product_variants (id, store_id)
    ON DELETE RESTRICT,

  CONSTRAINT dokkan_inventory_count_items_unique_variant
    UNIQUE (count_id, product_variant_id),

  CONSTRAINT dokkan_inventory_count_items_identity_unique
    UNIQUE (count_id, id, store_id, branch_id, product_variant_id),

  CONSTRAINT dokkan_inventory_count_items_count_values_check
    CHECK (
      (
        system_quantity_at_count IS NULL
        AND actual_quantity IS NULL
        AND difference IS NULL
        AND counted_by IS NULL
        AND count_at IS NULL
      )
      OR
      (
        system_quantity_at_count IS NOT NULL
        AND actual_quantity IS NOT NULL
        AND difference IS NOT NULL
        AND counted_by IS NOT NULL
        AND count_at IS NOT NULL
      )
    ),

  CONSTRAINT dokkan_inventory_count_items_difference_formula_check
    CHECK (
      difference IS NULL
      OR difference = actual_quantity - system_quantity_at_count
    )
);


-- =========================================================
-- 3. Inventory count event history
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dokkan_inventory_count_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  count_id uuid NOT NULL,
  store_id uuid NOT NULL,
  branch_id uuid NOT NULL,

  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,

  event_type text NOT NULL
    CHECK (
      event_type IN (
        'created',
        'started',
        'item_added',
        'item_counted',
        'submitted_for_review',
        'approved',
        'cancelled',
        'correction_created'
      )
    ),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dokkan_inventory_count_events_count_fk
    FOREIGN KEY (count_id, store_id, branch_id)
    REFERENCES public.dokkan_inventory_counts (id, store_id, branch_id)
    ON DELETE RESTRICT
);


-- =========================================================
-- 4. Inventory count adjustments
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dokkan_inventory_count_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  count_id uuid NOT NULL,
  count_item_id uuid NOT NULL,

  store_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  product_variant_id uuid NOT NULL,

  movement_id uuid NOT NULL,

  adjustment_quantity numeric(14,3) NOT NULL
    CHECK (
      adjustment_quantity <> 0
      AND adjustment_quantity NOT IN (
        'NaN'::numeric,
        'Infinity'::numeric,
        '-Infinity'::numeric
      )
    ),

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dokkan_inventory_count_adjustments_item_fk
    FOREIGN KEY (
      count_id,
      count_item_id,
      store_id,
      branch_id,
      product_variant_id
    )
    REFERENCES public.dokkan_inventory_count_items (
      count_id,
      id,
      store_id,
      branch_id,
      product_variant_id
    )
    ON DELETE RESTRICT,

  CONSTRAINT dokkan_inventory_count_adjustments_movement_fk
    FOREIGN KEY (
      movement_id,
      store_id,
      branch_id,
      product_variant_id
    )
    REFERENCES public.dokkan_inventory_movements (
      id,
      store_id,
      branch_id,
      product_variant_id
    )
    ON DELETE RESTRICT,

  CONSTRAINT dokkan_inventory_count_adjustments_movement_unique
    UNIQUE (movement_id),

  CONSTRAINT dokkan_inventory_count_adjustments_item_unique
    UNIQUE (count_item_id)
);


-- =========================================================
-- 5. Supporting indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS dokkan_inventory_counts_store_branch_status_idx
  ON public.dokkan_inventory_counts (store_id, branch_id, status);

CREATE INDEX IF NOT EXISTS dokkan_inventory_counts_created_at_idx
  ON public.dokkan_inventory_counts (created_at DESC);

CREATE INDEX IF NOT EXISTS dokkan_inventory_count_items_count_idx
  ON public.dokkan_inventory_count_items (count_id);

CREATE INDEX IF NOT EXISTS dokkan_inventory_count_items_variant_idx
  ON public.dokkan_inventory_count_items (product_variant_id);

CREATE INDEX IF NOT EXISTS dokkan_inventory_count_events_count_idx
  ON public.dokkan_inventory_count_events (count_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dokkan_inventory_count_adjustments_count_idx
  ON public.dokkan_inventory_count_adjustments (count_id);


-- =========================================================
-- 6. Enable Row Level Security
-- =========================================================

ALTER TABLE public.dokkan_inventory_counts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dokkan_inventory_count_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dokkan_inventory_count_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dokkan_inventory_count_adjustments
  ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 7. No direct table access
-- Access will be provided through controlled RPC functions.
-- =========================================================

REVOKE ALL ON TABLE public.dokkan_inventory_counts
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.dokkan_inventory_count_items
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.dokkan_inventory_count_events
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.dokkan_inventory_count_adjustments
  FROM PUBLIC, anon, authenticated;


COMMIT;
