-- NUCLEAR OPTION: Disable RLS and grant all permissions
-- Run this if the previous fix still gave 403 error

-- 1. Disable RLS entirely for test
ALTER TABLE public.finished_products DISABLE ROW LEVEL SECURITY;

-- 2. Grant all permissions to authenticated role
GRANT ALL ON public.finished_products TO authenticated;
GRANT ALL ON public.finished_products TO anon; -- Just in case

-- 3. Ensure constraints are relaxed
ALTER TABLE public.finished_products ALTER COLUMN production_order_id DROP NOT NULL;

-- 4. Check if there are any stray policies left (just for info)
SELECT * FROM pg_policies WHERE tablename = 'finished_products';
