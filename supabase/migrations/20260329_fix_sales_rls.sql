-- Allow sales officers to update finished_products (mark as sold)
DROP POLICY IF EXISTS "Sales officers update finished products" ON public.finished_products;
CREATE POLICY "Sales officers update finished products"
ON public.finished_products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow sales officers to delete from shop_inventory (when product is sold)
DROP POLICY IF EXISTS "Sales officers delete from shop inventory" ON public.shop_inventory;
CREATE POLICY "Sales officers delete from shop inventory"
ON public.shop_inventory
FOR DELETE
TO authenticated
USING (true);
