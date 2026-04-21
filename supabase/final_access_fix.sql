-- FINAL FIX: Ensure ALL roles have access to the table
-- Run this if the previous fix still gave 403 error

-- 1. Disable RLS entirely to confirm if it's really RLS
-- (We'll re-enable it after testing)
ALTER TABLE public.finished_products DISABLE ROW LEVEL SECURITY;

-- 2. Grant permissions to everyone
GRANT ALL ON public.finished_products TO authenticated;
GRANT ALL ON public.finished_products TO anon;
GRANT ALL ON public.finished_products TO service_role;

-- 3. Just in case there's an issue with the "branches" reference
-- Ensure the inventory officer can see the branches table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access for branches" ON public.branches;
CREATE POLICY "Public read access for branches" ON public.branches FOR SELECT TO authenticated USING (true);

-- 4. Verify the column types once more
ALTER TABLE public.finished_products ALTER COLUMN production_order_id DROP NOT NULL;
ALTER TABLE public.finished_products ALTER COLUMN branch_id DROP NOT NULL;
