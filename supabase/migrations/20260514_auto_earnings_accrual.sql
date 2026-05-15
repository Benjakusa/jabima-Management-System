-- =============================================
-- Automatic Wallet Earnings Accrual
-- Credits pending_earnings based on each worker's
-- payment_config when they complete tasks
-- =============================================

-- Core function: safely credit earnings to a user's wallet
CREATE OR REPLACE FUNCTION public.credit_earnings(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT,
  p_reference TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  -- Get or create wallet (safety net)
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id) VALUES (p_user_id) RETURNING id INTO v_wallet_id;
  END IF;

  -- Dedup: skip if this reference was already credited
  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE wallet_id = v_wallet_id AND reference_number = p_reference
  ) THEN
    RETURN;
  END IF;

  -- Credit pending earnings
  UPDATE wallets
  SET pending_earnings = pending_earnings + p_amount,
      updated_at = now()
  WHERE id = v_wallet_id;

  -- Audit trail
  INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_number)
  VALUES (v_wallet_id, p_amount, 'earned', p_description, p_reference);
END;
$$;

-- Helper: resolve payment amount from a user's config
CREATE OR REPLACE FUNCTION public.resolve_earnings_amount(
  p_user_id UUID,
  p_payment_types TEXT[],
  p_sale_amount DECIMAL DEFAULT 0
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config FROM payment_configs
  WHERE user_id = p_user_id
    AND payment_type::text = ANY(p_payment_types)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- New schema: rate_type + rate_value
  IF v_config.rate_type = 'percentage' AND p_sale_amount > 0 THEN
    RETURN ROUND((p_sale_amount * v_config.rate_value / 100), 2);
  ELSIF v_config.rate_value > 0 THEN
    RETURN v_config.rate_value;
  END IF;

  -- Legacy schema: flat amount
  RETURN COALESCE(v_config.amount, 0);
END;
$$;

-- ========================
-- 1. PRODUCT SALES → commission / per_product
-- ========================
CREATE OR REPLACE FUNCTION public.handle_sale_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(10,2);
BEGIN
  v_amount := resolve_earnings_amount(
    NEW.sales_officer_id,
    ARRAY['commission', 'per_product', 'percentage'],
    NEW.selling_price
  );

  IF v_amount > 0 THEN
    PERFORM credit_earnings(
      NEW.sales_officer_id,
      v_amount,
      'Commission - ' || COALESCE(NEW.product_type, 'Product') || ' - ' || COALESCE(NEW.customer_name, 'Sale'),
      'sale_' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_earnings ON sales;
CREATE TRIGGER trg_sale_earnings
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sale_earnings();

-- ========================
-- 2. SERVICE SALES → commission / per_service
-- ========================
CREATE OR REPLACE FUNCTION public.handle_service_sale_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(10,2);
BEGIN
  v_amount := resolve_earnings_amount(
    NEW.sales_officer_id,
    ARRAY['commission', 'per_service', 'percentage'],
    NEW.amount
  );

  IF v_amount > 0 THEN
    PERFORM credit_earnings(
      NEW.sales_officer_id,
      v_amount,
      'Service - ' || COALESCE(NEW.service_name, 'Service') || ' - ' || COALESCE(NEW.customer_name, 'Sale'),
      'svc_' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_sale_earnings ON service_sales;
CREATE TRIGGER trg_service_sale_earnings
  AFTER INSERT ON service_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_service_sale_earnings();

-- ========================
-- 3. DAILY REPORTS → per_day / daily_wage
-- ========================
CREATE OR REPLACE FUNCTION public.handle_report_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(10,2);
BEGIN
  v_amount := resolve_earnings_amount(
    NEW.user_id,
    ARRAY['per_day', 'daily_wage'],
    0
  );

  IF v_amount > 0 THEN
    PERFORM credit_earnings(
      NEW.user_id,
      v_amount,
      'Daily wage - ' || COALESCE(NEW.report_date::TEXT, CURRENT_DATE::TEXT),
      'report_' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_earnings ON daily_reports;
CREATE TRIGGER trg_report_earnings
  AFTER INSERT ON daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_report_earnings();

-- ========================
-- 4. STAGE COMPLETION → per_stage
-- ========================
CREATE OR REPLACE FUNCTION public.handle_stage_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(10,2);
BEGIN
  -- Only credit when stage is newly completed
  IF TG_OP = 'UPDATE' AND NEW.completed_at IS NOT NULL
     AND (OLD.completed_at IS NULL OR OLD.completed_at IS DISTINCT FROM NEW.completed_at)
  THEN
    v_amount := resolve_earnings_amount(
      NEW.worker_id,
      ARRAY['per_stage'],
      0
    );

    IF v_amount > 0 THEN
      PERFORM credit_earnings(
        NEW.worker_id,
        v_amount,
        'Stage completed - ' || COALESCE(NEW.stage::TEXT, 'Stage') || ' (Order ' || COALESCE(NEW.production_order_id::TEXT, '') || ')',
        'stage_' || NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stage_earnings ON stage_logs;
CREATE TRIGGER trg_stage_earnings
  AFTER UPDATE ON stage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_stage_earnings();
