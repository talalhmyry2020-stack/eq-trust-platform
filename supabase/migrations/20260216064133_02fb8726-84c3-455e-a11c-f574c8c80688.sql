
-- Drop existing RESTRICTIVE policies on employee_details
DROP POLICY IF EXISTS "Admins full access to employee_details" ON public.employee_details;
DROP POLICY IF EXISTS "Employees view own details" ON public.employee_details;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins full access to employee_details"
ON public.employee_details
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view own details"
ON public.employee_details
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
