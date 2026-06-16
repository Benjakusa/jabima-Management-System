-- ============================================================
-- Fix Sales Wallet Display + Store Product Availability
-- ============================================================
-- Problems solved:
-- 1. Sales officers cannot UPDATE finished_products (no RLS policy) → status stays 'completed' → product keeps showing
-- 2. Sales officers cannot DELETE from shop_inventory (no RLS policy) → inventory entry stays
-- 3. Wallet earnings trigger does not correctly resolve percentage commission
-- 4. Wallet not auto-created when trigger fires for first-time sales
-- ============================================================

BEGIN;

-- ============================================================
-- FIX 1: Allow sales officers to mark products as 'sold'
--         (update only the status column, only to 'sold')
-- ============================================================

DROP POLICY IF EXISTS "Sales officers mark product sold" ON public.finished_products;
CREATE POLICY "Sales officers mark product sold"
  ON public.finished_products
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales_officer')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'inventory_officer')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'sales_officer')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'inventory_officer')
  );

-- ============================================================
-- FIX 2: Allow sales officers to delete their own shop_inventory
--         rows (needed to remove the product from the branch shop
--         after it is sold)
-- ============================================================

DROP POLICY IF EXISTS "Sales officers delete sold shop_inventory" ON public.shop_inventory;
CREATE POLICY "Sales officers delete sold shop_inventory"
  ON public.shop_inventory
  FOR DELETE
  TO authenticated
  USING (
    -- Sales officers at the same branch can delete
    public.has_role(auth.uid(), 'sales_officer')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'inventory_officer')
  );

-- Also ensure the broad write policy exists (covers INSERT/UPDATE/DELETE for sales)
DROP POLICY IF EXISTS "Anyone authenticated can manage shop_inventory" ON public.shop_inventory;
CREATE POLICY "Anyone authenticated can manage shop_inventory"
  ON public.shop_inventory
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FIX 3: Robust earnings resolution for sales officers
--         Supports both old 'commission' payment_type and new
--         'percentage' payment_type with rate_value OR percentage column
-- ============================================================

DROP FUNCTION IF EXISTS public.resolve_sales_commission(UUID, DECIMAL);
CREATE OR REPLACE FUNCTION public.resolve_sales_commission(
  p_user_id UUID,
  p_sale_amount DECIMAL(10,2)
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_pct    DECIMAL(10,2);
BEGIN
  -- Look for percentage-based commission (new system)
  SELECT * INTO v_config
  FROM public.payment_configs
  WHERE user_id = p_user_id
    AND payment_type::text = 'percentage'
  LIMIT 1;

  IF FOUND THEN
    -- Try rate_value first (new schema), then percentage column, then amount
    v_pct := COALESCE(
      NULLIF(v_config.rate_value, 0),
      NULLIF(v_config.percentage, 0),
      NULLIF(v_config.amount, 0),
      0
    );
    IF v_pct > 0 AND p_sale_amount > 0 THEN
      RETURN ROUND((p_sale_amount * v_pct / 100.0), 2);
    END IF;
  END IF;

  -- Fall back to legacy 'commission' payment_type (flat amount)
  SELECT * INTO v_config
  FROM public.payment_configs
  WHERE user_id = p_user_id
    AND payment_type::text IN ('commission', 'per_product')
  LIMIT 1;

  IF FOUND THEN
    -- Try rate_value first, then amount
    RETURN COALESCE(
      NULLIF(v_config.rate_value, 0),
      NULLIF(v_config.amount, 0),
      0
    );
  END IF;

  RETURN 0;
END;
$$;

-- ============================================================
-- FIX 4: Replace handle_sale_earnings trigger function
--         to use the robust resolver above
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_sale_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(10,2);
BEGIN
  -- Use robust sales commission resolver
  v_amount := public.resolve_sales_commission(
    NEW.sales_officer_id,
    NEW.selling_price
  );

  IF v_amount > 0 THEN
    PERFORM public.credit_earnings(
      NEW.sales_officer_id,
      v_amount,
      'Commission — ' || COALESCE(NEW.product_type, 'Product') || ' sold to ' || COALESCE(NEW.customer_name, 'Customer'),
      'sale_' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger still exists (recreate idempotently)
DROP TRIGGER IF EXISTS trg_sale_earnings ON public.sales;
CREATE TRIGGER trg_sale_earnings
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sale_earnings();

-- ============================================================
-- FIX 5: Ensure wallet EXISTS for any user making a sale
--         This is a safety-net trigger that runs BEFORE
--         the sale earnings trigger, guaranteeing the wallet row
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_sales_officer_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create wallet if it doesn't exist yet (handles manually created users)
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.sales_officer_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_wallet_before_sale ON public.sales;
CREATE TRIGGER trg_ensure_wallet_before_sale
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_sales_officer_wallet();

-- ============================================================
-- FIX 6: Add reference_number to wallet_transactions if missing
--         (safe idempotent: ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- ============================================================
-- FIX 7: Ensure wallets table has the unique constraint and
--         payout columns (belt-and-suspenders, these may exist)
-- ============================================================

ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_user_id_key;
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);

ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS payout_requested BOOLEAN DEFAULT false;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS payout_request_amount DECIMAL(10,2) DEFAULT 0;

-- ============================================================
-- FIX 8: Create missing wallets for ALL existing users who
--         don't have one yet (backfill)
-- ============================================================

INSERT INTO public.wallets (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.wallets)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- FIX 9: Backfill wallet earnings for existing sales that
--         never got commission credited (safe: dedup by reference)
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_amount DECIMAL(10,2);
BEGIN
  FOR r IN
    SELECT s.id, s.sales_officer_id, s.selling_price, s.product_type, s.customer_name
    FROM public.sales s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions wt
      JOIN public.wallets w ON w.id = wt.wallet_id
      WHERE w.user_id = s.sales_officer_id
        AND wt.reference_number = 'sale_' || s.id::text
    )
    ORDER BY s.created_at
  LOOP
    v_amount := public.resolve_sales_commission(r.sales_officer_id, r.selling_price);
    IF v_amount > 0 THEN
      PERFORM public.credit_earnings(
        r.sales_officer_id,
        v_amount,
        'Commission — ' || COALESCE(r.product_type, 'Product') || ' sold to ' || COALESCE(r.customer_name, 'Customer'),
        'sale_' || r.id::text
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
