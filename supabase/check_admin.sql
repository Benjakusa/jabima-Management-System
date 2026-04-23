-- Check if admin user exists and has admin role
SELECT 
  u.id,
  u.email,
  u.created_at,
  r.role
FROM auth.users u
LEFT JOIN public.user_roles r ON u.id = r.user_id
WHERE u.email = 'inf@jabimafuneraldirectors.co.ke';