-- 1. Create the unified products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('raw_material', 'stock', 'finished_goods')),
  product_type TEXT, -- For coffins/caskets
  unit TEXT, -- e.g., 'pcs', 'kg'
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_cost DECIMAL(10,2) DEFAULT 0,
  production_cost DECIMAL(10,2) DEFAULT 0,
  min_stock_level DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'available',
  location TEXT,
  branch_id UUID REFERENCES public.branches(id),
  production_order_id UUID REFERENCES public.production_orders(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ensure RLS is enabled and permissive
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- (We use the same "nuclear" approach that we know works for other tables)
DROP POLICY IF EXISTS "Inventory and Admins manage products" ON public.products;
CREATE POLICY "Inventory and Admins manage products" ON public.products
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Update foreign keys in other tables to point to 'products' instead
-- Update 'sales' table
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_finished_product_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_finished_product_id_fkey 
  FOREIGN KEY (finished_product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Update 'product_returns' table
ALTER TABLE public.product_returns DROP CONSTRAINT IF EXISTS product_returns_finished_product_id_fkey;
ALTER TABLE public.product_returns ADD CONSTRAINT product_returns_finished_product_id_fkey 
  FOREIGN KEY (finished_product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 5. Grant permissions
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- 6. Move existing data (if any was successfully added)
-- Note: product_type maps to name in products
INSERT INTO public.products (name, category, product_type, production_cost, status, branch_id, completed_at)
SELECT 
    product_type as name, 
    'finished_goods' as category, 
    product_type, 
    production_cost, 
    status, 
    branch_id, 
    completed_at
FROM public.finished_products
ON CONFLICT DO NOTHING;

-- 7. Redefine the production advancement function to insert into products
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
  -- Verify the worker has a completed stage log for this order/stage
  IF NOT EXISTS (
    SELECT 1 FROM stage_logs
    WHERE production_order_id = _order_id
      AND stage = _current_stage
      AND worker_id = _worker_id
      AND completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No completed stage log found for this worker/order/stage';
  END IF;

  -- Verify order is still at this stage and in production
  SELECT status, current_stage INTO _order_status, _order_current_stage
  FROM production_orders WHERE id = _order_id;

  IF _order_status != 'in_production' OR _order_current_stage != _current_stage THEN
    RAISE EXCEPTION 'Order is not at the expected stage';
  END IF;

  -- Find current stage index
  _idx := array_position(_stages, _current_stage);

  IF _idx = array_length(_stages, 1) THEN
    -- Last stage: mark order as completed and create finished product in the main products table
    UPDATE production_orders
    SET status = 'completed', completed_at = now()
    WHERE id = _order_id;

    -- Map data to the merged products table
    INSERT INTO products (
        name, 
        category, 
        product_type, 
        production_order_id, 
        production_cost, 
        status, 
        branch_id, 
        completed_at
    )
    SELECT 
        product_type as name, 
        'finished_goods' as category, 
        product_type, 
        id as production_order_id, 
        COALESCE(production_cost, 0), 
        'completed', 
        branch_id, 
        now()
    FROM production_orders WHERE id = _order_id;
  ELSE
    -- Advance to next stage
    _next_stage := _stages[_idx + 1];
    UPDATE production_orders
    SET current_stage = _next_stage
    WHERE id = _order_id;
  END IF;
END;
$$;

-- 8. Verify the products table structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products';
