
ALTER TABLE public.deal_negotiations
ADD COLUMN IF NOT EXISTS quantity_unit text NULL DEFAULT 'وحدة';
