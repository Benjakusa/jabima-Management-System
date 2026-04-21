-- Fix RLS policies for finished_products
-- Drop all existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'finished_products' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.finished_products', pol.policyname);
    END LOOP;
END $$;

-- Create clean policies
CREATE POLICY "finished_products_all_auth_select" ON public.finished_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "finished_products_all_auth_insert" ON public.finished_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "finished_products_all_auth_update" ON public.finished_products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "finished_products_all_auth_delete" ON public.finished_products FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON public.finished_products TO authenticated;
GRANT ALL ON public.finished_products TO service_role;
