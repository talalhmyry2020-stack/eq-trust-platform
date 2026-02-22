
-- Fix user_roles: drop RESTRICTIVE select policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Fix employee_details: ensure SELECT policies are PERMISSIVE
DROP POLICY IF EXISTS "Admins full access to employee_details" ON public.employee_details;
DROP POLICY IF EXISTS "Employees view own details" ON public.employee_details;

CREATE POLICY "Admins full access to employee_details" ON public.employee_details
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view own details" ON public.employee_details
  FOR SELECT USING (auth.uid() = user_id);
