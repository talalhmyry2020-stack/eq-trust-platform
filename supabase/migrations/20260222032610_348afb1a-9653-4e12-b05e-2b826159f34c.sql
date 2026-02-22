
-- Allow logistics employees to view deals assigned to them via logistics_employee_id
CREATE POLICY "Logistics employees view assigned deals"
ON public.deals
FOR SELECT
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND logistics_employee_id = auth.uid()
);

-- Allow logistics employees to update deals assigned to them (for phase progression)
CREATE POLICY "Logistics employees update assigned deals"
ON public.deals
FOR UPDATE
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND logistics_employee_id = auth.uid()
);

-- Allow logistics employees to view logistics_reports for their deals
-- (already covered by "Employees manage own logistics reports" policy)

-- Allow logistics employees to view logistics_photos for their deals  
-- (already covered by "Employees manage own logistics photos" policy)
