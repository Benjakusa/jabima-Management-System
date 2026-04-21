-- LAST RESORT: Drop and recreate the table to clear any hidden issues
-- WARNING: This will delete all data in the finished_products table!

-- 1. Drop the table and all its policies
DROP TABLE IF EXISTS public.finished_products CASCADE;

-- 2. Recreate the table with the correct schema
CREATE TABLE public.finished_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  production_cost DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  production_order_id UUID REFERENCES public.production_orders(id), -- Nullable by default now
  branch_id UUID REFERENCES public.branches(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS but add a PERMISSIVE policy immediately
ALTER TABLE public.finished_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_auth" ON public.finished_products 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Grant permissions
GRANT ALL ON public.finished_products TO authenticated;
GRANT ALL ON public.finished_products TO service_role;

-- 5. Verify it's empty and clean
SELECT * FROM public.finished_products;
