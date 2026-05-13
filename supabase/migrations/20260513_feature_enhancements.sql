-- ============================================================
-- JABIMA FEATURE ENHANCEMENTS — Comprehensive Migration
-- All migrations are idempotent (safe to run multiple times)
-- No DROP, TRUNCATE, or destructive operations
-- ============================================================

-- ========================
-- 1. NEW USER ROLES (extend enum) 
-- ========================

-- Postgres enums don't support IF NOT EXISTS for values, so we use DO blocks
DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lowering_gear_operator';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_manager';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add description to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS description text;

-- Extend payment_type enum with new rate types
DO $$ BEGIN
  ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'per_service';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'per_day';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'percentage';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- 2. MATERIAL CATEGORIES
-- ========================

CREATE TABLE IF NOT EXISTS public.material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.inventory_materials
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.material_categories(id),
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.inventory_materials
  ALTER COLUMN category_id DROP NOT NULL;

-- Seed default material categories (idempotent)
INSERT INTO public.material_categories (name) VALUES
  ('Wood'), ('Fabric'), ('Hardware'), ('Paint'), ('Glass'),
  ('Adhesive'), ('Metal'), ('Other')
ON CONFLICT (name) DO NOTHING;

-- ========================
-- 3. PRODUCTS / DESIGNS TABLE (replaces hardcoded casket names)
-- ========================

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

-- Seed default products (idempotent) so existing code still works
INSERT INTO public.products (name, category) VALUES
  ('Simple', 'Casket'),
  ('Half glass', 'Casket'),
  ('High roof', 'Casket'),
  ('Executive', 'Casket'),
  ('Dumu', 'Casket'),
  ('Saitoti', 'Casket'),
  ('Dragon', 'Casket'),
  ('Tommy', 'Casket'),
  ('Reagan', 'Casket'),
  ('English coffin', 'Casket'),
  ('Kupa', 'Casket'),
  ('Custom Order', 'Casket')
ON CONFLICT DO NOTHING;

-- Also add is_active / created_by to finished_products for consistency
ALTER TABLE public.finished_products
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.finished_products
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- ========================
-- 4. EDITABLE SHOP ITEMS (Services & Goods per branch)
-- ========================

CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id),
  name text NOT NULL,
  type text CHECK (type IN ('service', 'good')) NOT NULL,
  unit_price numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ========================
-- 5. PAYMENT TRANSACTIONS (Partial & Multiple Payments)
-- ========================

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id),
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  reference_number text,
  paid_at timestamptz DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  notes text
);

-- Extend sales table for multi-payment tracking
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','partial','paid'));

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS is_lipa_pole_pole boolean DEFAULT false;

-- ========================
-- 6. WALLET / COMMISSION CONFIGURATIONS
-- ========================

-- Extend payment_configs with rate type info
ALTER TABLE public.payment_configs
  ADD COLUMN IF NOT EXISTS rate_type text DEFAULT 'fixed'
    CHECK (rate_type IN ('fixed','percentage','per_service','per_day')),
  ADD COLUMN IF NOT EXISTS rate_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applies_to_role text,
  ADD COLUMN IF NOT EXISTS applies_to_stage_id uuid;

-- Commission presets table
CREATE TABLE IF NOT EXISTS public.commission_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  label text NOT NULL,
  rate_type text NOT NULL,
  rate_value numeric NOT NULL,
  currency text DEFAULT 'KES',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed commission presets (idempotent)
INSERT INTO public.commission_presets (role, label, rate_type, rate_value) VALUES
  ('driver',                'Driver daily rate',           'per_day',     1000),
  ('lowering_gear_operator','Lowering gear per service',   'per_service',  600)
ON CONFLICT DO NOTHING;

-- ========================
-- 7. INTERBRANCH TRANSFERS
-- ========================

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
-- 8. BRANCH ENHANCEMENTS
-- ========================

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ========================
-- 9. STOCK RETURNS ENHANCEMENTS
-- ========================

-- stock_returns might not exist yet - create it if needed
CREATE TABLE IF NOT EXISTS public.stock_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_product_id uuid REFERENCES public.finished_products(id),
  returned_by uuid REFERENCES auth.users(id),
  return_reason text,
  is_unsold boolean DEFAULT false,
  destination_branch_id uuid REFERENCES public.branches(id),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stock_returns
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS is_unsold boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS destination_branch_id uuid REFERENCES public.branches(id);

-- ========================
-- 10. ITEM UPGRADE & LIPA POLE POLE (Instalments)
-- ========================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS original_product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS upgraded_product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS upgrade_price_difference numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instalment_plan text;

CREATE TABLE IF NOT EXISTS public.instalment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id),
  due_date date NOT NULL,
  amount_due numeric NOT NULL,
  amount_paid numeric DEFAULT 0,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','partial','paid','overdue')),
  created_at timestamptz DEFAULT now()
);

-- ========================
-- 11. WORKSHOP WALLET — MULTI-STAGE SELECTION
-- ========================

ALTER TABLE public.stage_assignments
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- production_stages table may not exist if stages are stored as enum
-- Create a production_stages table from the enum values
CREATE TABLE IF NOT EXISTS public.production_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed production stages from the existing enum (idempotent)
INSERT INTO public.production_stages (name, label, sort_order) VALUES
  ('wood_cutting', 'Wood Cutting', 1),
  ('frame_assembly', 'Frame Assembly', 2),
  ('board_fitting', 'Board Fitting', 3),
  ('sanding', 'Sanding', 4),
  ('fabric_lining', 'Fabric Lining', 5),
  ('painting', 'Painting', 6),
  ('handle_installation', 'Handle Installation', 7),
  ('glass_installation', 'Glass Installation', 8),
  ('final_assembly', 'Final Assembly', 9),
  ('quality_inspection', 'Quality Inspection', 10)
ON CONFLICT (name) DO NOTHING;

-- Create worker_stage_assignments if not exists (enhanced version)
CREATE TABLE IF NOT EXISTS public.worker_stage_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES auth.users(id),
  stage_id uuid REFERENCES public.production_stages(id),
  commission_preset_id uuid REFERENCES public.commission_presets(id),
  rate_override numeric,
  is_active boolean DEFAULT true,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(worker_id, stage_id)
);

-- Add stage_id column reference to stage_assignments if it doesn't exist (currently uses enum)
ALTER TABLE public.stage_assignments
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.production_stages(id);

-- ========================
-- 12. BRANCH STOCK SUMMARY VIEW
-- ========================

CREATE OR REPLACE VIEW public.branch_stock_summary AS
SELECT
  b.id AS branch_id,
  b.name AS branch_name,
  fp.id AS product_id,
  fp.product_type AS product_name,
  fp.location,
  COUNT(fp.id) AS quantity_available
FROM public.branches b
LEFT JOIN public.finished_products fp
  ON fp.branch_id = b.id AND (fp.status = 'completed' OR fp.status = 'transferred') AND fp.is_active = true
GROUP BY b.id, b.name, fp.id, fp.product_type, fp.location;

-- ========================
-- 13. RLS POLICIES FOR NEW TABLES
-- ========================

-- Enable RLS on new tables
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interbranch_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instalment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_stage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_stages ENABLE ROW LEVEL SECURITY;

-- material_categories: admins + inventory can manage, all authenticated can read
CREATE POLICY "Authenticated can read material_categories"
  ON public.material_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage material_categories"
  ON public.material_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory can manage material_categories"
  ON public.material_categories FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- products: admin + inventory + workshop can manage, all can read
CREATE POLICY "Authenticated can read products"
  ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory can manage products"
  ON public.products FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));
CREATE POLICY "Workshop can manage products"
  ON public.products FOR ALL USING (public.has_role(auth.uid(), 'workshop_worker'));

-- shop_items: manage per branch
CREATE POLICY "Authenticated can read shop_items"
  ON public.shop_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage shop_items"
  ON public.shop_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales officers can manage their branch shop_items"
  ON public.shop_items FOR ALL USING (public.has_role(auth.uid(), 'sales_officer'));

-- payment_transactions
CREATE POLICY "Read own payment_transactions"
  ON public.payment_transactions FOR SELECT TO authenticated USING (
    recorded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.sales_officer_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins can manage payment_transactions"
  ON public.payment_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales can insert payment_transactions"
  ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'sales_officer') OR public.has_role(auth.uid(), 'admin')
  );

-- commission_presets
CREATE POLICY "Authenticated can read commission_presets"
  ON public.commission_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage commission_presets"
  ON public.commission_presets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- interbranch_transfers
CREATE POLICY "Authenticated can read interbranch_transfers"
  ON public.interbranch_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage interbranch_transfers"
  ON public.interbranch_transfers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inventory can manage interbranch_transfers"
  ON public.interbranch_transfers FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- stock_returns
CREATE POLICY "Read own stock_returns"
  ON public.stock_returns FOR SELECT TO authenticated USING (
    returned_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
  );
CREATE POLICY "Insert own stock_returns"
  ON public.stock_returns FOR INSERT TO authenticated WITH CHECK (
    returned_by = auth.uid()
  );
CREATE POLICY "Admins + inventory manage stock_returns"
  ON public.stock_returns FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
  );

-- instalment_schedule
CREATE POLICY "Read instalment_schedule"
  ON public.instalment_schedule FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.sales_officer_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Admins manage instalment_schedule"
  ON public.instalment_schedule FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Workers insert instalment_schedule"
  ON public.instalment_schedule FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.sales_officer_id = auth.uid())
  );
CREATE POLICY "Workers update instalment_schedule"
  ON public.instalment_schedule FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.sales_officer_id = auth.uid())
  );

-- worker_stage_assignments
CREATE POLICY "Workers read own stage assignments"
  ON public.worker_stage_assignments FOR SELECT TO authenticated USING (
    worker_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins manage worker_stage_assignments"
  ON public.worker_stage_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- production_stages
CREATE POLICY "Authenticated can read production_stages"
  ON public.production_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage production_stages"
  ON public.production_stages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 14. EXISTING RLS POLICY UPDATES
-- ========================

-- Allow inventory to manage finished_products (needed for transfers, returns)
DROP POLICY IF EXISTS "Inventory officers can insert finished_products" ON public.finished_products;
DROP POLICY IF EXISTS "Inventory officers can update finished_products" ON public.finished_products;
CREATE POLICY "Inventory officers can manage finished_products"
  ON public.finished_products FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- Allow inventory + admin to manage sales (for adding payments, upgrades)
DROP POLICY IF EXISTS "Inventory + admin update sales" ON public.sales;
CREATE POLICY "Inventory + admin manage sales"
  ON public.sales FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer')
  );

-- Allow sales officers to update their own sales (for adding payments)
DROP POLICY IF EXISTS "Sales officers update own sales" ON public.sales;
CREATE POLICY "Sales officers update own sales"
  ON public.sales FOR UPDATE USING (sales_officer_id = auth.uid());

-- Allow workshop workers to manage products (for creating new designs)
DROP POLICY IF EXISTS "Workshop can read products" ON public.products;
-- already created above

-- Fix inventory_materials RLS — drop conflicting policies and recreate with standard has_role()
DROP POLICY IF EXISTS "Admins manage inventory materials" ON public.inventory_materials;
DROP POLICY IF EXISTS "Inventory officers manage materials" ON public.inventory_materials;
DROP POLICY IF EXISTS "Inventory officers can manage inventory_materials" ON public.inventory_materials;
DROP POLICY IF EXISTS "Anyone can read inventory_materials" ON public.inventory_materials;
DROP POLICY IF EXISTS "Read inventory materials" ON public.inventory_materials;

CREATE POLICY "Anyone can read inventory_materials"
  ON public.inventory_materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage inventory_materials"
  ON public.inventory_materials FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Inventory officers can manage inventory_materials"
  ON public.inventory_materials FOR ALL USING (public.has_role(auth.uid(), 'inventory_officer'));

-- ========================
-- 15. M-PESA TRANSACTIONS TABLE (for callback tracking)
-- ========================

CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  phone text,
  amount numeric,
  account_reference text,
  transaction_desc text,
  result_code integer,
  result_desc text,
  mpesa_receipt_number text,
  transaction_date text,
  status text DEFAULT 'pending',
  raw_callback jsonb,
  sale_id uuid REFERENCES public.sales(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mpesa_transactions"
  ON public.mpesa_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mpesa_transactions"
  ON public.mpesa_transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admins can manage mpesa_transactions"
  ON public.mpesa_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 16. GRANT PERMISSIONS
-- ========================

GRANT ALL ON public.material_categories TO authenticated;
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.shop_items TO authenticated;
GRANT ALL ON public.payment_transactions TO authenticated;
GRANT ALL ON public.commission_presets TO authenticated;
GRANT ALL ON public.interbranch_transfers TO authenticated;
GRANT ALL ON public.stock_returns TO authenticated;
GRANT ALL ON public.instalment_schedule TO authenticated;
GRANT ALL ON public.worker_stage_assignments TO authenticated;
GRANT ALL ON public.production_stages TO authenticated;
GRANT ALL ON public.mpesa_transactions TO authenticated;

-- ========================
-- 15. STOCK RETURNS — Branch Transfer Extensions
-- ========================

-- Extend status CHECK to include 'accepted'
ALTER TABLE public.stock_returns DROP CONSTRAINT IF EXISTS stock_returns_status_check;
ALTER TABLE public.stock_returns ADD CONSTRAINT stock_returns_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Receiving branch sales officers can view incoming transfers
DROP POLICY IF EXISTS "Destination branch can view incoming stock_returns" ON public.stock_returns;
CREATE POLICY "Destination branch can view incoming stock_returns"
  ON public.stock_returns FOR SELECT TO authenticated USING (
    destination_branch_id IS NOT NULL AND
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales_officer'
        AND profiles.branch_id = destination_branch_id
    )
  );

-- Receiving branch sales officers can accept/reject incoming transfers
DROP POLICY IF EXISTS "Destination branch can accept incoming stock_returns" ON public.stock_returns;
CREATE POLICY "Destination branch can accept incoming stock_returns"
  ON public.stock_returns FOR UPDATE TO authenticated USING (
    destination_branch_id IS NOT NULL AND
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales_officer'
        AND profiles.branch_id = destination_branch_id
    )
  ) WITH CHECK (
    status IN ('accepted', 'rejected')
  );

-- Sales officers can insert into shop_inventory for their own branch (when accepting transfers)
DROP POLICY IF EXISTS "Sales officers insert into own shop_inventory" ON public.shop_inventory;
CREATE POLICY "Sales officers insert into own shop_inventory"
  ON public.shop_inventory FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales_officer'
        AND profiles.branch_id = branch_id
    )
  );
