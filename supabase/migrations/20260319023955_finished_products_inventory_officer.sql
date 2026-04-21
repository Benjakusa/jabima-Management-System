-- Migration: Allow inventory officers to manage finished products
-- 1. Make production_order_id nullable so inventory officers can add products
--    without a corresponding workshop production order.
ALTER TABLE public.finished_products
  ALTER COLUMN production_order_id DROP NOT NULL;

-- 2. Drop any stale partial policies we may have created in previous attempts
DROP POLICY IF EXISTS "inventory_officer can insert finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "inventory_officer can update finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "admin can delete finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "authenticated can read finished_products" ON public.finished_products;

-- 3. Grant inventory officers and admins full management of finished_products
--    (uses the existing has_role SECURITY DEFINER function in the schema)
CREATE POLICY "Inventory and Admins manage finished products"
ON public.finished_products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'inventory_officer') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'inventory_officer') OR public.has_role(auth.uid(), 'admin'));
