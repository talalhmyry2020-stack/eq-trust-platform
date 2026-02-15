
-- Allow clients to update their own deals (for phase transitions)
CREATE POLICY "Clients can update own deals"
ON public.deals
FOR UPDATE
USING (client_id = auth.uid() AND has_role(auth.uid(), 'client'::app_role));
