-- ============================================================
-- Wallet Automation Enhancement for Workshop Officers (V3 FINAL)
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_workshop_earnings(
  p_user_id UUID,
  p_stage_name TEXT,
  p_product_type_name TEXT
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_rate DECIMAL(10,2) := 0;
BEGIN
  -- 1. Safely attempt to find the product ID from the product name (case-insensitive)
  SELECT id INTO v_product_id FROM public.products WHERE name ILIKE p_product_type_name LIMIT 1;

  -- 2. Find the matching config
  -- We match the stage name using ILIKE to ignore case and "Stage 1 — " prefixes.
  SELECT rate_value INTO v_rate
  FROM public.payment_configs
  WHERE user_id = p_user_id
    AND payment_type = 'per_stage'
    AND (stage_label ILIKE '%' || p_stage_name || '%')
    AND (product_type_id = v_product_id OR product_type_id IS NULL)
  ORDER BY 
    CASE WHEN product_type_id = v_product_id THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN COALESCE(v_rate, 0);
END;
$$;

-- Fix the wp_daily_reports RLS policy that might be causing 400 Bad Request
DROP POLICY IF EXISTS "Workshop all own wp_reports" ON public.wp_daily_reports;
CREATE POLICY "Workshop all own wp_reports" ON public.wp_daily_reports 
FOR ALL TO authenticated USING (
  officer_id = auth.uid()
) WITH CHECK (
  officer_id = auth.uid()
);

-- Force the trigger to apply just in case it didn't in previous runs
DROP TRIGGER IF EXISTS trg_wp_task_completed_earnings ON public.wp_production_tasks;
CREATE TRIGGER trg_wp_task_completed_earnings
  AFTER UPDATE OF status ON public.wp_production_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_wp_task_earnings();

COMMIT;
