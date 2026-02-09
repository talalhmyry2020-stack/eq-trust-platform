
CREATE TABLE public.verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow public insert/select since users aren't authenticated yet during verification
CREATE POLICY "Anyone can insert verification codes"
ON public.verification_codes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read verification codes"
ON public.verification_codes FOR SELECT
USING (true);

CREATE POLICY "Anyone can update verification codes"
ON public.verification_codes FOR UPDATE
USING (true);

-- Index for fast lookups
CREATE INDEX idx_verification_codes_email ON public.verification_codes (email, code);
