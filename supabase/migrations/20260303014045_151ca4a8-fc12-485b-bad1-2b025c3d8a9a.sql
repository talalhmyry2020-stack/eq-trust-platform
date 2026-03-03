
-- Add destination logistics employee field
ALTER TABLE public.deals ADD COLUMN destination_logistics_employee_id uuid DEFAULT NULL;

-- RLS: destination logistics employees can view their assigned deals
CREATE POLICY "Destination logistics view assigned deals"
ON public.deals
FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role) AND (destination_logistics_employee_id = auth.uid()));

-- RLS: destination logistics employees can update their assigned deals
CREATE POLICY "Destination logistics update assigned deals"
ON public.deals
FOR UPDATE
USING (has_role(auth.uid(), 'employee'::app_role) AND (destination_logistics_employee_id = auth.uid()));

-- RLS: destination logistics employees can manage logistics reports for their deals
CREATE POLICY "Destination logistics manage reports"
ON public.logistics_reports
FOR ALL
USING (auth.uid() = employee_id)
WITH CHECK (auth.uid() = employee_id);

-- RLS: destination logistics employees can manage logistics photos for their deals
CREATE POLICY "Destination logistics manage photos"
ON public.logistics_photos
FOR ALL
USING (EXISTS (
  SELECT 1 FROM logistics_reports lr
  WHERE lr.id = logistics_photos.report_id AND lr.employee_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM logistics_reports lr
  WHERE lr.id = logistics_photos.report_id AND lr.employee_id = auth.uid()
));
