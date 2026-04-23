-- Fix shop_inventory policies - simpler version
DROP POLICY IF EXISTS "Read shop inventory" ON shop_inventory;
DROP POLICY IF EXISTS "Admins manage shop inventory" ON shop_inventory;

CREATE POLICY "Anyone authenticated can read shop_inventory"
ON shop_inventory FOR SELECT
USING (true);

CREATE POLICY "Anyone authenticated can manage shop_inventory"
ON shop_inventory FOR ALL
USING (true);
