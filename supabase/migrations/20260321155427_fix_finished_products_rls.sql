-- Fix RLS for finished_products and ensure proper permissions

-- 1. Relax constraints
ALTER TABLE public.finished_products 
  ALTER COLUMN production_order_id DROP NOT NULL;

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Inventory and Admins manage finished products" ON public.finished_products;
DROP POLICY IF EXISTS "Admins manage finished products" ON public.finished_products;
DROP POLICY IF EXISTS "Read finished products" ON public.finished_products;

-- 3. Create new robust policies
CREATE POLICY "Enable read access for all authenticated users"
ON public.finished_products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for inventory_officer and admin"
ON public.finished_products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND (user_roles.role = 'inventory_officer' OR user_roles.role = 'admin')
  )
);

CREATE POLICY "Enable update for inventory_officer and admin"
ON public.finished_products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND (user_roles.role = 'inventory_officer' OR user_roles.role = 'admin')
  )
);

CREATE POLICY "Enable delete for admin only"
ON public.finished_products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 4. Explicitly grant permissions
GRANT ALL ON public.finished_products TO authenticated;
GRANT ALL ON public.finished_products TO service_role;
