-- ============================================================
-- FULL FIX: Drop ALL overloads of resolve_earnings_amount
-- dynamically (regardless of exact type names) then recreate
-- the single definitive version with an explicit DECIMAL cast.
-- Also fixes RLS, completed_tasks column, and wallet trigger.
-- ============================================================

BEGIN;

-- ── Step 1: Dynamically drop EVERY overload of resolve_earnings_amount ─────
-- This catches ALL variants regardless of how they were created
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'resolve_earnings_amount'
      AND n.nspname  = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

-- ── Step 2: Recreate single, unambiguous version ───────────────────────────
CREATE FUNCTION public.resolve_earnings_amount(
  p_user_id       UUID,
  p_payment_types TEXT[],
  p_sale_amount   NUMERIC DEFAULT 0.0
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config
  FROM public.payment_configs
  WHERE user_id = p_user_id
    AND payment_type::text = ANY(p_payment_types)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- New schema: rate_type + rate_value
  IF (v_config.rate_type = 'percentage') AND p_sale_amount > 0 THEN
    RETURN ROUND((p_sale_amount * v_config.rate_value / 100.0)::NUMERIC, 2);
  ELSIF (v_config.rate_value IS NOT NULL) AND v_config.rate_value > 0 THEN
    RETURN v_config.rate_value;
  END IF;

  -- Legacy schema: flat amount field
  RETURN COALESCE(v_config.amount, 0);
END;
$$;

-- ── Step 3: Add completed_tasks column if missing ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'daily_reports'
      AND column_name  = 'completed_tasks'
  ) THEN
    ALTER TABLE public.daily_reports
      ADD COLUMN completed_tasks JSONB DEFAULT '[]'::jsonb;
  END IF;
END;
$$;

-- ── Step 4: Recreate RLS policies on daily_reports ────────────────────────
DROP POLICY IF EXISTS "Users create own reports" ON public.daily_reports;
CREATE POLICY "Users create own reports" ON public.daily_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users see own reports" ON public.daily_reports;
CREATE POLICY "Users see own reports" ON public.daily_reports
  FOR SELECT USING (user_id = auth.uid());

-- ── Step 5: Recreate wallet trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_report_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  -- Explicit NUMERIC cast to avoid overload ambiguity
  v_amount := public.resolve_earnings_amount(
    NEW.user_id,
    ARRAY['per_day', 'daily_wage'],
    0.0
  );

  IF v_amount > 0 THEN
    PERFORM public.credit_earnings(
      NEW.user_id,
      v_amount,
      'Daily wage - ' || COALESCE(NEW.report_date::TEXT, CURRENT_DATE::TEXT),
      'report_' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_earnings ON public.daily_reports;
CREATE TRIGGER trg_report_earnings
  AFTER INSERT ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_report_earnings();

COMMIT;
