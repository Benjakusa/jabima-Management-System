-- Step 1: Add price column to inventory_services
ALTER TABLE public.inventory_services ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 0;

-- Step 2: Ensure Sales Agents can read the list of services/equipment
DROP POLICY IF EXISTS "Read inventory services" ON public.inventory_services;
CREATE POLICY "Read inventory services" ON public.inventory_services 
FOR SELECT TO authenticated USING (true);

-- Step 3: Nuclear fix for finished_products RLS
-- Drop EVERY possible policy we might have created
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'finished_products' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.finished_products', pol.policyname);
    END LOOP;
END $$;

-- Re-enable RLS just in case it was disabled
ALTER TABLE public.finished_products ENABLE ROW LEVEL SECURITY;

-- Simple, direct policies
CREATE POLICY "fp_select_all" ON public.finished_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "fp_insert_auth" ON public.finished_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fp_update_auth" ON public.finished_products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fp_delete_admin" ON public.finished_products FOR DELETE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Ensure authenticated role has full table permissions
GRANT ALL ON public.finished_products TO authenticated;
GRANT ALL ON public.inventory_services TO authenticated;

-- Relax constraints again just to be absolutely sure
ALTER TABLE public.finished_products ALTER COLUMN production_order_id DROP NOT NULL;
