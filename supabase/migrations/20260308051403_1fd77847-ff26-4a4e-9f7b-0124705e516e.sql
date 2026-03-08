-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'inventory_officer', 'workshop_worker', 'sales_officer');

-- Payment type enum
CREATE TYPE public.payment_type AS ENUM ('daily_wage', 'per_stage', 'per_product', 'commission');

-- Production stage enum
CREATE TYPE public.production_stage AS ENUM (
  'wood_cutting', 'frame_assembly', 'board_fitting', 'sanding',
  'fabric_lining', 'painting', 'handle_installation', 'glass_installation',
  'final_assembly', 'quality_inspection'
);

-- Product status enum
CREATE TYPE public.product_status AS ENUM ('in_production', 'completed', 'transferred', 'sold');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Worker payment config
CREATE TABLE public.payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_type payment_type NOT NULL,
  stage production_stage,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallets
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  pending_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  approved_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'approved', 'paid')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventory materials (raw materials)
CREATE TABLE public.inventory_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_stock_level DECIMAL(10,2) NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service equipment inventory
CREATE TABLE public.inventory_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  condition TEXT DEFAULT 'good',
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production orders
CREATE TABLE public.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  status product_status NOT NULL DEFAULT 'in_production',
  current_stage production_stage NOT NULL DEFAULT 'wood_cutting',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  production_cost DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stage assignments (which worker handles which stage)
CREATE TABLE public.stage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stage production_stage NOT NULL,
  UNIQUE(user_id, stage)
);

-- Stage logs (tracking each stage completion)
CREATE TABLE public.stage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES public.production_orders(id) ON DELETE CASCADE NOT NULL,
  stage production_stage NOT NULL,
  worker_id UUID REFERENCES auth.users(id) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- Product material usage
CREATE TABLE public.product_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES public.production_orders(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.inventory_materials(id) NOT NULL,
  quantity_used DECIMAL(10,2) NOT NULL,
  stage production_stage,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Finished products
CREATE TABLE public.finished_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES public.production_orders(id) NOT NULL,
  product_type TEXT NOT NULL,
  production_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT NOT NULL DEFAULT 'main_warehouse',
  branch_id UUID REFERENCES public.branches(id),
  status product_status NOT NULL DEFAULT 'completed'
);

-- Shop inventory (products at branches)
CREATE TABLE public.shop_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_product_id UUID REFERENCES public.finished_products(id) NOT NULL,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transferred_by UUID REFERENCES auth.users(id)
);

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_product_id UUID REFERENCES public.finished_products(id) NOT NULL,
  product_type TEXT NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  mpesa_code TEXT NOT NULL,
  sales_officer_id UUID REFERENCES auth.users(id) NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service sales
CREATE TABLE public.service_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  mpesa_code TEXT NOT NULL,
  sales_officer_id UUID REFERENCES auth.users(id) NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily reports
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT,
  tasks_completed INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finished_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
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

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_materials_updated_at BEFORE UPDATE ON public.inventory_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_services_updated_at BEFORE UPDATE ON public.inventory_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: admins see all, users see own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User roles: admins manage, users read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Branches: all authenticated can read
CREATE POLICY "Authenticated can read branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Payment configs: admins manage, workers see own
CREATE POLICY "Workers see own payment config" ON public.payment_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage payment configs" ON public.payment_configs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wallets: users see own, admins see all
CREATE POLICY "Users see own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage wallets" ON public.wallets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wallet transactions
CREATE POLICY "Users see own wallet txns" ON public.wallet_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid())
);
CREATE POLICY "Admins manage wallet txns" ON public.wallet_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Suppliers: inventory officers and admins
CREATE POLICY "Inventory and admins read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
);
CREATE POLICY "Admins manage suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory officers manage suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- Inventory materials: inventory officers and admins
CREATE POLICY "Read inventory materials" ON public.inventory_materials FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
);
CREATE POLICY "Admins manage inventory materials" ON public.inventory_materials FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory officers manage materials" ON public.inventory_materials FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- Inventory services
CREATE POLICY "Read inventory services" ON public.inventory_services FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
);
CREATE POLICY "Admins manage inventory services" ON public.inventory_services FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory officers manage services" ON public.inventory_services FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- Production orders: all authenticated can read
CREATE POLICY "Read production orders" ON public.production_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage production orders" ON public.production_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Stage assignments
CREATE POLICY "Read stage assignments" ON public.stage_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stage assignments" ON public.stage_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Stage logs: workers see own, admins see all
CREATE POLICY "Workers see own stage logs" ON public.stage_logs FOR SELECT USING (worker_id = auth.uid());
CREATE POLICY "Workers can insert stage logs" ON public.stage_logs FOR INSERT WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Workers can update own stage logs" ON public.stage_logs FOR UPDATE USING (worker_id = auth.uid());
CREATE POLICY "Admins manage stage logs" ON public.stage_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Product material usage
CREATE POLICY "Read product material usage" ON public.product_material_usage FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
);
CREATE POLICY "Admins manage material usage" ON public.product_material_usage FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Finished products
CREATE POLICY "Read finished products" ON public.finished_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage finished products" ON public.finished_products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Shop inventory
CREATE POLICY "Read shop inventory" ON public.shop_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage shop inventory" ON public.shop_inventory FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Sales: sales officers see own, admins see all
CREATE POLICY "Sales officers see own sales" ON public.sales FOR SELECT USING (sales_officer_id = auth.uid());
CREATE POLICY "Sales officers create sales" ON public.sales FOR INSERT WITH CHECK (sales_officer_id = auth.uid());
CREATE POLICY "Admins manage sales" ON public.sales FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Service sales
CREATE POLICY "Sales officers see own service sales" ON public.service_sales FOR SELECT USING (sales_officer_id = auth.uid());
CREATE POLICY "Sales officers create service sales" ON public.service_sales FOR INSERT WITH CHECK (sales_officer_id = auth.uid());
CREATE POLICY "Admins manage service sales" ON public.service_sales FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Expenses
CREATE POLICY "Read expenses" ON public.expenses FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR recorded_by = auth.uid()
);
CREATE POLICY "Create expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Admins manage expenses" ON public.expenses FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Daily reports: users see own, admins see all
CREATE POLICY "Users see own reports" ON public.daily_reports FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create own reports" ON public.daily_reports FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage reports" ON public.daily_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));
