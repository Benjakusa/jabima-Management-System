-- Allow inventory officers to INSERT into shop_inventory (when fulfilling product requests)
DROP POLICY IF EXISTS "Inventory officers insert shop inventory" ON public.shop_inventory;
CREATE POLICY "Inventory officers insert shop inventory"
ON public.shop_inventory
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND (user_roles.role = 'inventory_officer' OR user_roles.role = 'admin')
    )
);
