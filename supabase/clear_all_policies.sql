-- NUCLEAR POLICY CLEARANCE
-- This will specifically target every policy name we've ever used

-- 1. Drop ALL known policy names
DROP POLICY IF EXISTS "Inventory and Admins manage finished products" ON public.finished_products;
DROP POLICY IF EXISTS "inventory_officer can insert finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "inventory_officer can update finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "admin can delete finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "authenticated can read finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "Read finished products" ON public.finished_products;
DROP POLICY IF EXISTS "Admins manage finished products" ON public.finished_products;
DROP POLICY IF EXISTS "fp_select_all" ON public.finished_products;
DROP POLICY IF EXISTS "fp_insert_auth" ON public.finished_products;
DROP POLICY IF EXISTS "fp_update_auth" ON public.finished_products;
DROP POLICY IF EXISTS "fp_delete_admin" ON public.finished_products;
DROP POLICY IF EXISTS "allow_all_auth" ON public.finished_products;
DROP POLICY IF EXISTS "allow_public_insert" ON public.finished_products;
DROP POLICY IF EXISTS "everyone_insert" ON public.finished_products;

-- 2. Create one single, perfect policy for everyone
CREATE POLICY "master_allow_all" ON public.finished_products 
FOR ALL TO public 
USING (true) 
WITH CHECK (true);

-- 3. Re-enable RLS just to be sure it's active with the new policy
ALTER TABLE public.finished_products ENABLE ROW LEVEL SECURITY;

-- 4. Grant schema access
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.finished_products TO authenticated;

-- 5. Diagnostic: List what is left
SELECT polname, polcmd, polpermissive FROM pg_policy WHERE polrelid = 'public.finished_products'::regclass;
