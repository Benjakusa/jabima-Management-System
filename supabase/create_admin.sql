-- Create or get the admin user
-- This script will create the user with admin role

-- First, try to find if user exists by email
DO $$
DECLARE
  new_user_id UUID;
  existing_user UUID;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO existing_user 
  FROM auth.users 
  WHERE email = 'inf@jabimafuneraldirectors.co.ke';

  IF existing_user IS NULL THEN
    -- User doesn't exist, create them
    -- Note: We cannot create users directly in auth.users table
    -- We need to use auth.admin.create_user function or the API
    RAISE NOTICE 'User does not exist yet. Please create user through Supabase Admin UI or API.';
  ELSE
    RAISE NOTICE 'User exists with ID: %', existing_user;
    
    -- Insert or update admin role
    DELETE FROM public.user_roles WHERE user_id = existing_user AND role = 'admin';
    INSERT INTO public.user_roles (user_id, role) VALUES (existing_user, 'admin');
    
    -- Update profile if needed
    UPDATE public.profiles 
    SET full_name = 'Admin', phone = '+254700000000', email = 'inf@jabimafuneraldirectors.co.ke'
    WHERE user_id = existing_user;
    
    RAISE NOTICE 'Admin role assigned successfully!';
  END IF;
END $$;
