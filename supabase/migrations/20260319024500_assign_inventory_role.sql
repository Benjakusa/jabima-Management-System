-- Assign inventory_officer role to benjakusa@gmail.com
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user ID from the auth.users table
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'benjakusa@gmail.com';
    
    -- If the user exists, insert the role
    IF target_user_id IS NOT NULL THEN
        -- Using public.app_role enum type
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'inventory_officer'::public.app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;
