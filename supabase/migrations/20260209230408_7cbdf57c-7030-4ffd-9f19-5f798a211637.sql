
-- =============================================
-- 1. ROLES SYSTEM (RBAC)
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'employee', 'client');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: Only admins can manage roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- 2. EMPLOYEE PERMISSIONS
-- =============================================
CREATE TYPE public.employee_permission AS ENUM (
  'view_deals', 'manage_deals', 'contact_clients', 'view_clients', 'manage_clients'
);

CREATE TABLE public.employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission employee_permission NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage employee permissions"
  ON public.employee_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view own permissions"
  ON public.employee_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- 3. EMPLOYEE-CLIENT ASSIGNMENTS
-- =============================================
CREATE TABLE public.employee_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, client_id)
);

ALTER TABLE public.employee_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage assignments"
  ON public.employee_client_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees view own assignments"
  ON public.employee_client_assignments FOR SELECT TO authenticated
  USING (auth.uid() = employee_id);

-- =============================================
-- 4. DEALS / BROKERAGE SYSTEM
-- =============================================
CREATE TYPE public.deal_status AS ENUM ('active', 'delayed', 'paused', 'completed', 'cancelled');

CREATE TABLE public.deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stages"
  ON public.deal_stages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage stages"
  ON public.deal_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default stages
INSERT INTO public.deal_stages (name, display_order) VALUES
  ('جديدة', 1),
  ('قيد المراجعة', 2),
  ('قيد التنفيذ', 3),
  ('بانتظار الموافقة', 4),
  ('مكتملة', 5);

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_number SERIAL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deal_type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  stage_id UUID REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  status deal_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins full access to deals"
  ON public.deals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Employees with view_deals permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _perm employee_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_permissions
    WHERE user_id = _user_id AND permission = _perm
  )
$$;

CREATE POLICY "Employees view assigned deals"
  ON public.deals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'employee') AND
    (public.has_permission(auth.uid(), 'view_deals') OR public.has_permission(auth.uid(), 'manage_deals')) AND
    employee_id = auth.uid()
  );

CREATE POLICY "Employees manage assigned deals"
  ON public.deals FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'employee') AND
    public.has_permission(auth.uid(), 'manage_deals') AND
    employee_id = auth.uid()
  );

-- Clients view own deals
CREATE POLICY "Clients view own deals"
  ON public.deals FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. ACTIVITY LOGS (AUDIT TRAIL)
-- =============================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- 6. SYSTEM SETTINGS
-- =============================================
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.system_settings (key, value) VALUES
  ('webhooks', '{"deal_created": "", "deal_updated": "", "deal_deleted": "", "user_registered": ""}'::jsonb),
  ('security', '{"max_login_attempts": 5, "auto_suspend": true, "email_verification": true}'::jsonb);

-- =============================================
-- 7. AUTO-ASSIGN CLIENT ROLE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- =============================================
-- 8. UPDATE PROFILES TABLE - add status column
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
