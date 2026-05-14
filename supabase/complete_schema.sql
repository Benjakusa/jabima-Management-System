-- ============================================================
-- JABIMA MANAGEMENT SYSTEM — Complete Database Schema
-- Run this in your new Supabase project's SQL Editor
-- ============================================================

-- ========================
-- 1. ENUM TYPES
-- ========================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'inventory_officer', 'workshop_worker', 'sales_officer');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.payment_type AS ENUM ('daily_wage', 'per_stage', 'per_product', 'commission');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_stage' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.production_stage AS ENUM (
      'wood_cutting', 'frame_assembly', 'board_fitting', 'sanding',
      'fabric_lining', 'painting', 'handle_installation', 'glass_installation',
      'final_assembly', 'quality_inspection'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.product_status AS ENUM ('in_production', 'completed', 'transferred', 'sold');
  END IF;
END $$;


-- ========================
-- 2. TABLES
-- ========================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  branch_id UUID,  -- FK added after branches table
  is_muted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Branches
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from profiles to branches
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_branch_id_fkey,
  ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

-- Payment configs
CREATE TABLE IF NOT EXISTS public.payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_type payment_type NOT NULL,
  stage production_stage,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  pending_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  approved_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'approved', 'paid')),
  description TEXT,
  payment_method TEXT,
  reference_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventory materials (raw materials)
CREATE TABLE IF NOT EXISTS public.inventory_materials (
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
CREATE TABLE IF NOT EXISTS public.inventory_services (
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
CREATE TABLE IF NOT EXISTS public.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  status product_status NOT NULL DEFAULT 'in_production',
  current_stage production_stage NOT NULL DEFAULT 'wood_cutting',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  production_cost DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  batch_number TEXT,
  notes TEXT,
  expected_completion_date DATE,
  product_code TEXT UNIQUE,
  size TEXT NOT NULL DEFAULT 'adult',
  material_type TEXT NOT NULL DEFAULT 'pine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stage assignments (worker → stage mapping)
CREATE TABLE IF NOT EXISTS public.stage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stage production_stage NOT NULL,
  UNIQUE(user_id, stage)
);

-- Stage logs (tracking each stage completion)
CREATE TABLE IF NOT EXISTS public.stage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES public.production_orders(id) ON DELETE CASCADE NOT NULL,
  stage production_stage NOT NULL,
  worker_id UUID REFERENCES auth.users(id) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- Product material usage
CREATE TABLE IF NOT EXISTS public.product_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES public.production_orders(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.inventory_materials(id) NOT NULL,
  quantity_used DECIMAL(10,2) NOT NULL,
  stage production_stage,
  worker_id UUID,
  status TEXT NOT NULL DEFAULT 'used',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Material requests
CREATE TABLE IF NOT EXISTS public.material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id),
  material_id UUID NOT NULL REFERENCES public.inventory_materials(id),
  worker_id UUID NOT NULL,
  stage TEXT NOT NULL,
  quantity_requested NUMERIC NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  fulfilled_by UUID,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Material returns
CREATE TABLE IF NOT EXISTS public.material_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id),
  material_id UUID NOT NULL REFERENCES public.inventory_materials(id),
  worker_id UUID NOT NULL,
  quantity_returned NUMERIC NOT NULL,
  reason TEXT NOT NULL DEFAULT 'excess',
  status TEXT NOT NULL DEFAULT 'pending',
  inspected_by UUID,
  inspected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Finished products
CREATE TABLE IF NOT EXISTS public.finished_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES public.production_orders(id) NOT NULL,
  product_type TEXT NOT NULL,
  production_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT NOT NULL DEFAULT 'main_warehouse',
  branch_id UUID REFERENCES public.branches(id),
  status product_status NOT NULL DEFAULT 'completed'
);

ALTER TABLE public.finished_products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.finished_products ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Shop inventory (products at branches)
CREATE TABLE IF NOT EXISTS public.shop_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_product_id UUID REFERENCES public.finished_products(id) NOT NULL,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transferred_by UUID REFERENCES auth.users(id)
);

-- Sales
CREATE TABLE IF NOT EXISTS public.sales (
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
CREATE TABLE IF NOT EXISTS public.service_sales (
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
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily reports
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT,
  tasks_completed INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products catalog
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  description text,
  selling_price numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Interbranch transfers
CREATE TABLE IF NOT EXISTS public.interbranch_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id),
  finished_product_id uuid REFERENCES public.finished_products(id),
  from_branch_id uuid REFERENCES public.branches(id),
  to_branch_id uuid REFERENCES public.branches(id),
  quantity integer DEFAULT 1,
  transfer_date timestamptz DEFAULT now(),
  initiated_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','in_transit','received','cancelled')),
  notes text
);


-- ========================
-- 3. ENABLE ROW LEVEL SECURITY
-- ========================

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
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finished_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interbranch_transfers ENABLE ROW LEVEL SECURITY;


-- ========================
-- 4. FUNCTIONS
-- ========================

-- Role checking helper (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role text)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  )
$$;

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-create profile + wallet on signup
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

-- Advance production stage
CREATE OR REPLACE FUNCTION public.advance_production_stage(
  _order_id uuid,
  _current_stage production_stage,
  _worker_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _stages production_stage[] := ARRAY[
    'wood_cutting', 'frame_assembly', 'board_fitting', 'sanding', 'fabric_lining',
    'painting', 'handle_installation', 'glass_installation', 'final_assembly', 'quality_inspection'
  ]::production_stage[];
  _idx int;
  _next_stage production_stage;
  _order_status product_status;
  _order_current_stage production_stage;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM stage_logs
    WHERE production_order_id = _order_id
      AND stage = _current_stage
      AND worker_id = _worker_id
      AND completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No completed stage log found for this worker/order/stage';
  END IF;

  SELECT status, current_stage INTO _order_status, _order_current_stage
  FROM production_orders WHERE id = _order_id;

  IF _order_status != 'in_production' OR _order_current_stage != _current_stage THEN
    RAISE EXCEPTION 'Order is not at the expected stage';
  END IF;

  _idx := array_position(_stages, _current_stage);

  IF _idx = array_length(_stages, 1) THEN
    UPDATE production_orders
    SET status = 'completed', completed_at = now()
    WHERE id = _order_id;

    INSERT INTO finished_products (production_order_id, product_type, production_cost)
    SELECT id, product_type, COALESCE(production_cost, 0)
    FROM production_orders WHERE id = _order_id;
  ELSE
    _next_stage := _stages[_idx + 1];
    UPDATE production_orders
    SET current_stage = _next_stage
    WHERE id = _order_id;
  END IF;
END;
$$;

-- Generate sequential product codes
CREATE OR REPLACE FUNCTION public.generate_product_code(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prefix TEXT;
  _year TEXT;
  _seq INT;
  _code TEXT;
BEGIN
  IF p_type ILIKE '%casket%' THEN
    _prefix := 'JFD-CS';
  ELSIF p_type ILIKE '%child%' THEN
    _prefix := 'JFD-CC';
  ELSE
    _prefix := 'JFD-CF';
  END IF;

  _year := EXTRACT(YEAR FROM NOW())::TEXT;

  SELECT COALESCE(MAX(
    CASE WHEN product_code ~ ('^' || _prefix || '-' || _year || '-[0-9]+$')
    THEN SUBSTRING(product_code FROM '[0-9]+$')::INT
    ELSE 0 END
  ), 0) + 1
  INTO _seq
  FROM production_orders
  WHERE product_code LIKE _prefix || '-' || _year || '-%';

  _code := _prefix || '-' || _year || '-' || LPAD(_seq::TEXT, 4, '0');
  RETURN _code;
END;
$$;

-- Create production batch
CREATE OR REPLACE FUNCTION public.create_production_batch(
  p_product_type TEXT,
  p_quantity INT,
  p_batch_number TEXT,
  p_notes TEXT DEFAULT NULL,
  p_expected_completion_date DATE DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS SETOF production_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _i INT;
  _code TEXT;
BEGIN
  IF p_quantity < 1 OR p_quantity > 100 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 100';
  END IF;

  FOR _i IN 1..p_quantity LOOP
    _code := generate_product_code(p_product_type);

    RETURN QUERY
    INSERT INTO production_orders (
      product_type, product_code, batch_number, notes,
      expected_completion_date, created_by
    ) VALUES (
      p_product_type, _code, p_batch_number, p_notes,
      p_expected_completion_date, p_created_by
    )
    RETURNING *;
  END LOOP;
END;
$$;


-- ========================
-- 5. TRIGGERS
-- ========================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_materials_updated_at ON public.inventory_materials;
CREATE TRIGGER update_inventory_materials_updated_at
  BEFORE UPDATE ON public.inventory_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_services_updated_at ON public.inventory_services;
CREATE TRIGGER update_inventory_services_updated_at
  BEFORE UPDATE ON public.inventory_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ========================
-- 6. RLS POLICIES
-- ========================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Branches
CREATE POLICY "Authenticated can read branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Payment configs
CREATE POLICY "Workers see own payment config" ON public.payment_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage payment configs" ON public.payment_configs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wallets
CREATE POLICY "Users see own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage wallets" ON public.wallets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wallet transactions
CREATE POLICY "Users see own wallet txns" ON public.wallet_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid())
);
CREATE POLICY "Admins manage wallet txns" ON public.wallet_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Suppliers
CREATE POLICY "Inventory and admins read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
);
CREATE POLICY "Admins manage suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory officers manage suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- Inventory materials
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

-- Production orders
CREATE POLICY "Read production orders" ON public.production_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage production orders" ON public.production_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Stage assignments
CREATE POLICY "Read stage assignments" ON public.stage_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stage assignments" ON public.stage_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Stage logs
CREATE POLICY "Workers see own stage logs" ON public.stage_logs FOR SELECT USING (worker_id = auth.uid());
CREATE POLICY "Workers can insert stage logs" ON public.stage_logs FOR INSERT WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Workers can update own stage logs" ON public.stage_logs FOR UPDATE USING (worker_id = auth.uid());
CREATE POLICY "Admins manage stage logs" ON public.stage_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Product material usage
CREATE POLICY "Read product material usage" ON public.product_material_usage FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
);
CREATE POLICY "Admins manage material usage" ON public.product_material_usage FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Workers can insert material usage" ON public.product_material_usage FOR INSERT TO authenticated WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Workers can view own material usage" ON public.product_material_usage FOR SELECT TO authenticated USING (
  worker_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory_officer'::app_role)
);

-- Material requests
CREATE POLICY "Workers can create own requests" ON public.material_requests FOR INSERT TO authenticated WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Workers can view own requests" ON public.material_requests FOR SELECT TO authenticated USING (worker_id = auth.uid());
CREATE POLICY "Admins manage material requests" ON public.material_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Inventory officers manage material requests" ON public.material_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'inventory_officer'::app_role));

-- Material returns
CREATE POLICY "Workers can create own returns" ON public.material_returns FOR INSERT TO authenticated WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Workers can view own returns" ON public.material_returns FOR SELECT TO authenticated USING (worker_id = auth.uid());
CREATE POLICY "Admins manage material returns" ON public.material_returns FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Inventory officers manage material returns" ON public.material_returns FOR ALL TO authenticated USING (has_role(auth.uid(), 'inventory_officer'::app_role));

-- Finished products
CREATE POLICY "Read finished products" ON public.finished_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage finished products" ON public.finished_products FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory officers can manage finished_products"
  ON public.finished_products FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- Shop inventory
CREATE POLICY "Read shop inventory" ON public.shop_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage shop inventory" ON public.shop_inventory FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales officers insert into own shop_inventory"
  ON public.shop_inventory FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'sales_officer'
        AND profiles.branch_id = branch_id
    )
  );

-- Sales
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

-- Daily reports
CREATE POLICY "Users see own reports" ON public.daily_reports FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create own reports" ON public.daily_reports FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage reports" ON public.daily_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Products policies
CREATE POLICY "Authenticated can read products"
  ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory can manage products"
  ON public.products FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));
CREATE POLICY "Workshop can manage products"
  ON public.products FOR ALL USING (public.has_role(auth.uid(), 'workshop_worker'));

-- interbranch_transfers policies
CREATE POLICY "Authenticated can read interbranch_transfers"
  ON public.interbranch_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage interbranch_transfers"
  ON public.interbranch_transfers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory can manage interbranch_transfers"
  ON public.interbranch_transfers FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

CREATE POLICY "Destination branch can accept interbranch transfers"
  ON public.interbranch_transfers FOR UPDATE TO authenticated USING (
    to_branch_id IN (SELECT branch_id FROM public.profiles WHERE user_id = auth.uid())
  );

GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.interbranch_transfers TO authenticated;
