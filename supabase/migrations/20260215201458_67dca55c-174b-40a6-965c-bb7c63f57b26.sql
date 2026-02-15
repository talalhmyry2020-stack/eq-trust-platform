
-- Create a secure function to get admin contacts for clients
CREATE OR REPLACE FUNCTION public.get_admin_contacts()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.user_id
  WHERE r.role = 'admin'
$$;
