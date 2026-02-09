
-- Fix activity_logs INSERT policy to require user_id = auth.uid()
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert own logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
