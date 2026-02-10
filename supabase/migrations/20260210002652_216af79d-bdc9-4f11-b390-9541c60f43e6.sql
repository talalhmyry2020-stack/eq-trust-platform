
-- Allow clients to create their own deals
CREATE POLICY "Clients can create own deals"
ON public.deals FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = client_id AND
  has_role(auth.uid(), 'client'::app_role)
);
