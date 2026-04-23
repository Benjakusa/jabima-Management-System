-- Fix inventory_materials policies for workshop access
ALTER TABLE inventory_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read inventory materials" ON inventory_materials;
DROP POLICY IF EXISTS "Admins manage inventory materials" ON inventory_materials;
DROP POLICY IF EXISTS "Inventory officers manage materials" ON inventory_materials;

-- Allow all authenticated users to read materials
CREATE POLICY "Anyone can read inventory_materials"
ON inventory_materials FOR SELECT
USING (true);

-- Allow inventory_officer and admin roles to manage (need user_roles table check via function)
CREATE POLICY "Inventory officers can manage inventory_materials"
ON inventory_materials FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('inventory_officer', 'admin')
    )
);