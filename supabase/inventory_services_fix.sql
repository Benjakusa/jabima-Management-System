-- Add base_price column if missing
ALTER TABLE public.inventory_services ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 0;

-- Drop ALL existing policies on inventory_services
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'inventory_services' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.inventory_services', pol.policyname);
  END LOOP;
END $$;

-- Create permissive RLS policies for all authenticated users
CREATE POLICY "inv_services_select" ON public.inventory_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv_services_insert" ON public.inventory_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inv_services_update" ON public.inventory_services FOR UPDATE TO authenticated USING (true);
CREATE POLICY "inv_services_delete" ON public.inventory_services FOR DELETE TO authenticated USING (true);

-- Grant all permissions
GRANT ALL ON public.inventory_services TO authenticated;