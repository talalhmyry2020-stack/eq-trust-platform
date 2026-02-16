
-- Add mission_type to distinguish initial/quality/port inspections
ALTER TABLE public.deal_inspection_missions 
ADD COLUMN IF NOT EXISTS mission_type text NOT NULL DEFAULT 'initial';

-- Add shipping & sovereignty tracking to deals
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS shipping_tracking_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS sovereignty_timer_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS sovereignty_timer_end timestamp with time zone,
ADD COLUMN IF NOT EXISTS logistics_employee_id uuid;

-- Add quality report fields to missions
ALTER TABLE public.deal_inspection_missions
ADD COLUMN IF NOT EXISTS quality_report text,
ADD COLUMN IF NOT EXISTS quality_status text DEFAULT 'pending';
