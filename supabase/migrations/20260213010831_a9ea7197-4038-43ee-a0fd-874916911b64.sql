
-- إضافة صلاحيات المفتش الميداني الجديدة
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'receive_briefing';
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'geo_checkin';
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'capture_evidence';
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'visual_validation';
ALTER TYPE public.employee_permission ADD VALUE IF NOT EXISTS 'submit_report';

-- جدول تفاصيل الموظفين (المسمى الوظيفي، النبذة، إلخ)
CREATE TABLE public.employee_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  job_title text NOT NULL DEFAULT '',
  job_code text NOT NULL DEFAULT '',
  motto text DEFAULT '',
  description text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;

-- المدير يملك صلاحية كاملة
CREATE POLICY "Admins full access to employee_details"
ON public.employee_details
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- الموظف يشاهد بياناته فقط
CREATE POLICY "Employees view own details"
ON public.employee_details
FOR SELECT
USING (auth.uid() = user_id);

-- تحديث تلقائي لـ updated_at
CREATE TRIGGER update_employee_details_updated_at
BEFORE UPDATE ON public.employee_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
