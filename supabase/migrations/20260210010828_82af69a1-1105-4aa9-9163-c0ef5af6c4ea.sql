
-- Add new columns to deals table
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS client_full_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS country text DEFAULT '',
ADD COLUMN IF NOT EXISTS city text DEFAULT '',
ADD COLUMN IF NOT EXISTS national_id text DEFAULT '',
ADD COLUMN IF NOT EXISTS commercial_register_number text DEFAULT '',
ADD COLUMN IF NOT EXISTS entity_type text DEFAULT '',
ADD COLUMN IF NOT EXISTS identity_doc_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS commercial_register_doc_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS product_type text DEFAULT '',
ADD COLUMN IF NOT EXISTS product_description text DEFAULT '',
ADD COLUMN IF NOT EXISTS product_image_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS import_country text DEFAULT '';

-- Create storage bucket for deal documents
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-documents', 'deal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Clients can upload their own documents
CREATE POLICY "Clients upload own deal docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Clients can view their own documents
CREATE POLICY "Clients view own deal docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'deal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Admins can view all deal documents
CREATE POLICY "Admins view all deal docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'deal-documents' AND public.has_role(auth.uid(), 'admin'::app_role));
