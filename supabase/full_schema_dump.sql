-- COMPREHENSIVE SCHEMA DIAGNOSTIC
-- Run this and copy the output to share with me.

-- 1. Table structure for finished_products
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'finished_products'
ORDER BY ordinal_position;

-- 2. ALL policies currently on the table
SELECT 
    polname as policy_name,
    polcmd as command,
    polpermissive as is_permissive,
    polroles as roles,
    pg_get_expr(polqual, polrelid) as using_expr,
    pg_get_expr(polwithcheck, polrelid) as with_check_expr
FROM pg_policy 
WHERE polrelid = 'public.finished_products'::regclass;

-- 3. Check if RLS is actually enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'finished_products';

-- 4. Check for any TRIGGERS
SELECT tgname, tgenabled, tgtype FROM pg_trigger WHERE tgrelid = 'public.finished_products'::regclass;

-- 5. Check if the 'has_role' function exists and its definition
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'has_role';

-- 6. Check the user_roles for the current user (if any)
SELECT role FROM public.user_roles WHERE user_id = auth.uid();
