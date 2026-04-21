-- Migration: Create products table (if not exists) and add external stock fields
-- Run this in your Supabase SQL Editor

-- 1. Create the unified products table (idempotent)
CREATE TABLE IF NOT EXISTS public.products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('raw_material', 'stock', 'finished_goods')),
  product_type        TEXT,
  unit                TEXT,
  quantity            DECIMAL(10,2) DEFAULT 1,
  unit_cost           DECIMAL(10,2) DEFAULT 0,
  production_cost     DECIMAL(10,2) DEFAULT 0,
  min_stock_level     DECIMAL(10,2) DEFAULT 0,
  status              TEXT DEFAULT 'available',
  location            TEXT,
  branch_id           UUID REFERENCES public.branches(id),
  production_order_id UUID REFERENCES public.production_orders(id),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- 2. Add external-stock columns (each is idempotent with IF NOT EXISTS)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'workshop'
    CHECK (source_type IN ('workshop', 'external'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_name TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Enable RLS and a permissive policy for inventory officers & admins
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inventory and Admins manage products" ON public.products;
CREATE POLICY "Inventory and Admins manage products" ON public.products
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Grant full access
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- 5. Update the production advancement function to write to products instead of finished_products
CREATE OR REPLACE FUNCTION public.advance_production_stage(
  _order_id uuid,
  _current_stage production_stage,
  _worker_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _stages production_stage[] := ARRAY[
    'wood_cutting', 'frame_assembly', 'board_fitting', 'sanding', 'fabric_lining',
    'painting', 'handle_installation', 'glass_installation', 'final_assembly', 'quality_inspection'
  ]::production_stage[];
  _idx int;
  _next_stage production_stage;
  _order_status product_status;
  _order_current_stage production_stage;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM stage_logs
    WHERE production_order_id = _order_id
      AND stage = _current_stage
      AND worker_id = _worker_id
      AND completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No completed stage log found for this worker/order/stage';
  END IF;

  SELECT status, current_stage INTO _order_status, _order_current_stage
  FROM production_orders WHERE id = _order_id;

  IF _order_status != 'in_production' OR _order_current_stage != _current_stage THEN
    RAISE EXCEPTION 'Order is not at the expected stage';
  END IF;

  _idx := array_position(_stages, _current_stage);

  IF _idx = array_length(_stages, 1) THEN
    UPDATE production_orders
    SET status = 'completed', completed_at = now()
    WHERE id = _order_id;

    INSERT INTO products (
        name, category, product_type, production_order_id,
        production_cost, source_type, status, completed_at
    )
    SELECT
        product_type, 'finished_goods', product_type, id,
        COALESCE(production_cost, 0), 'workshop', 'completed', now()
    FROM production_orders WHERE id = _order_id;
  ELSE
    _next_stage := _stages[_idx + 1];
    UPDATE production_orders SET current_stage = _next_stage WHERE id = _order_id;
  END IF;
END;
$$;
