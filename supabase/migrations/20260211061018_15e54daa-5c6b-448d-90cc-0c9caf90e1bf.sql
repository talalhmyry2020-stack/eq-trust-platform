
-- Table for dynamic column definitions per deal
CREATE TABLE public.deal_search_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  column_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_search_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to search columns"
ON public.deal_search_columns FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for dynamic row data per deal (JSONB for flexible columns)
CREATE TABLE public.deal_search_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  row_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_search_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to search rows"
ON public.deal_search_rows FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_deal_search_columns_deal ON public.deal_search_columns(deal_id);
CREATE INDEX idx_deal_search_rows_deal ON public.deal_search_rows(deal_id);
