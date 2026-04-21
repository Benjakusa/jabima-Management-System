-- DIAGNOSTIC SCRIPT
-- Run these one by one or all together to check the state of the database

-- 1. Check if the production_order_id is nullable (should be 'YES')
SELECT is_nullable 
FROM information_schema.columns 
WHERE table_name = 'finished_products' AND column_name = 'production_order_id';

-- 2. Check current policies on finished_products
SELECT * FROM pg_policies WHERE tablename = 'finished_products';

-- 3. Check if your user actually has the expected role (replace YOUR_USER_ID if you know it, otherwise check all)
SELECT user_id, role FROM public.user_roles;

-- 4. Check if the has_role function works as expected
-- This needs a specific UUID to test, but we can check its definition
SELECT pg_get_functiondef('public.has_role'::regproc);
