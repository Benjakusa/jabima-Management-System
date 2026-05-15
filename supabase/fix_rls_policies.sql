-- ============================================================
-- FIX: All RLS policies that incorrectly reference profiles.role
-- The `profiles` table has NO `role` column.
-- Roles are stored in `user_roles` and checked via `has_role()`.
-- Also fixes `profiles.id = auth.uid()` → `profiles.user_id = auth.uid()`
-- ============================================================

-- ========================
-- 1. FIX: shop_inventory — "Inventory officers and admins can manage"
-- Old: profiles.id = auth.uid() AND profiles.role IN ('inventory_officer', 'admin')
-- ========================
DROP POLICY IF EXISTS "Inventory officers and admins can manage shop_inventory" ON public.shop_inventory;
CREATE POLICY "Inventory officers and admins can manage shop_inventory"
  ON public.shop_inventory FOR ALL
  USING (
    public.has_role(auth.uid(), 'inventory_officer')
    OR public.has_role(auth.uid(), 'admin')
  );

-- ========================
-- 2. FIX: product_returns — "Inventory officers and admins can view all returns"
-- ========================
DROP POLICY IF EXISTS "Inventory officers and admins can view all returns" ON public.product_returns;
CREATE POLICY "Inventory officers and admins can view all returns"
  ON public.product_returns FOR SELECT
  USING (
    public.has_role(auth.uid(), 'inventory_officer')
    OR public.has_role(auth.uid(), 'admin')
  );

-- ========================
-- 3. FIX: product_returns — "Inventory officers and admins can update returns"
-- ========================
DROP POLICY IF EXISTS "Inventory officers and admins can update returns" ON public.product_returns;
CREATE POLICY "Inventory officers and admins can update returns"
  ON public.product_returns FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'inventory_officer')
    OR public.has_role(auth.uid(), 'admin')
  );

-- ========================
-- 4. FIX: sales_agent_services — "Admin can view all agent services"
-- ========================
DROP POLICY IF EXISTS "Admin can view all agent services" ON public.sales_agent_services;
CREATE POLICY "Admin can view all agent services"
  ON public.sales_agent_services FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 5. FIX: stock_returns — "Destination branch can view incoming stock_returns"
-- Old: profiles.id = auth.uid() AND profiles.role = 'sales_officer' AND profiles.branch_id = destination_branch_id
-- Fix: Use has_role() and profiles.user_id
-- ========================
DROP POLICY IF EXISTS "Destination branch can view incoming stock_returns" ON public.stock_returns;
CREATE POLICY "Destination branch can view incoming stock_returns"
  ON public.stock_returns FOR SELECT TO authenticated
  USING (
    destination_branch_id IS NOT NULL
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.branch_id = destination_branch_id
    )
    AND public.has_role(auth.uid(), 'sales_officer')
  );

-- ========================
-- 6. FIX: stock_returns — "Destination branch can accept incoming stock_returns"
-- ========================
DROP POLICY IF EXISTS "Destination branch can accept incoming stock_returns" ON public.stock_returns;
CREATE POLICY "Destination branch can accept incoming stock_returns"
  ON public.stock_returns FOR UPDATE TO authenticated
  USING (
    destination_branch_id IS NOT NULL
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.branch_id = destination_branch_id
    )
    AND public.has_role(auth.uid(), 'sales_officer')
  ) WITH CHECK (
    status IN ('accepted', 'rejected')
  );

-- ========================
-- 7. FIX: shop_inventory — "Sales officers insert into own shop_inventory"
-- ========================
DROP POLICY IF EXISTS "Sales officers insert into own shop_inventory" ON public.shop_inventory;
CREATE POLICY "Sales officers insert into own shop_inventory"
  ON public.shop_inventory FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'sales_officer')
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.branch_id = branch_id
    )
  );

-- ========================
-- 8. ADD: paid_at column to instalment_schedule
-- The code references paid_at when marking instalments as paid
-- ========================
ALTER TABLE public.instalment_schedule
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- ========================
-- 9. Fix: instalment_schedule status check — add 'partial' if not in the CHECK
-- ========================
ALTER TABLE public.instalment_schedule DROP CONSTRAINT IF EXISTS instalment_schedule_status_check;
ALTER TABLE public.instalment_schedule ADD CONSTRAINT instalment_schedule_status_check
  CHECK (status IN ('pending', 'partial', 'paid', 'overdue'));

-- ========================
-- 10. Fix: service_sales — add payment tracking columns (same pattern as sales)
-- ========================
ALTER TABLE public.service_sales
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

-- ========================
-- 11. Grant ALL on updated/new tables
-- ========================
GRANT ALL ON public.instalment_schedule TO authenticated;

-- ========================
-- VERIFICATION: Confirm fixes were applied
-- ========================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('shop_inventory', 'product_returns', 'sales_agent_services', 'stock_returns')
  AND qual ILIKE '%profiles%'
ORDER BY tablename, policyname;
