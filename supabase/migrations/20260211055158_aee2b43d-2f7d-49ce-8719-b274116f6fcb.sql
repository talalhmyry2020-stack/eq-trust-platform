
-- Add extra columns to deal_product_results for richer product search data
ALTER TABLE public.deal_product_results ADD COLUMN IF NOT EXISTS supplier_name text DEFAULT '';
ALTER TABLE public.deal_product_results ADD COLUMN IF NOT EXISTS origin_country text DEFAULT '';
ALTER TABLE public.deal_product_results ADD COLUMN IF NOT EXISTS product_url text DEFAULT '';
ALTER TABLE public.deal_product_results ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
