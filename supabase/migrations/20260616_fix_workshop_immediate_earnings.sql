-- ============================================================
-- Wallet Automation Enhancement for Workshop Officers
-- Enables immediate crediting on stage completion based on 
-- stage name and product type.
-- ============================================================

BEGIN;

-- 1. Helper to resolve the correct wallet config for a workshop task
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
  -- Attempt to find the product ID from the product name
  SELECT id INTO v_product_id FROM public.products WHERE name = p_product_type_name LIMIT 1;

  -- Find the matching config
  -- payment_type MUST be 'per_stage' for workshop workers
  SELECT rate_value INTO v_rate
  FROM public.payment_configs
  WHERE user_id = p_user_id
    AND payment_type = 'per_stage'
    AND stage_label = p_stage_name
    AND (product_type_id = v_product_id OR product_type_id IS NULL)
  ORDER BY 
    CASE WHEN product_type_id IS NOT NULL THEN 0 ELSE 1 END -- Prioritize exact product match over generic
  LIMIT 1;

  RETURN COALESCE(v_rate, 0);
END;
$$;


-- 2. Trigger function to credit earnings immediately on stage completion
CREATE OR REPLACE FUNCTION public.handle_wp_task_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(10,2);
BEGIN
  -- We only care when status changes to 'Completed'
  IF NEW.status = 'Completed' AND (OLD.status IS DISTINCT FROM 'Completed') THEN
    
    -- Resolve amount based on assigned worker, stage name, and product type
    v_amount := public.resolve_workshop_earnings(
      NEW.assigned_officer_id,
      NEW.stage_name,
      NEW.product_type
    );

    IF v_amount > 0 THEN
      -- Create the transaction
      PERFORM public.credit_earnings(
        NEW.assigned_officer_id,
        v_amount,
        'Workshop Earnings - ' || COALESCE(NEW.stage_name, 'Stage') || ' (' || COALESCE(NEW.product_type, 'Product') || ')',
        'wp_task_' || NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- 3. Attach trigger to wp_production_tasks
DROP TRIGGER IF EXISTS trg_wp_task_completed_earnings ON public.wp_production_tasks;
CREATE TRIGGER trg_wp_task_completed_earnings
  AFTER UPDATE OF status ON public.wp_production_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_wp_task_earnings();


-- 4. Remove the old delayed end-of-day trigger from daily reports to prevent duplicate crediting
DROP TRIGGER IF EXISTS trg_wp_report_earnings ON public.wp_daily_reports;
DROP FUNCTION IF EXISTS public.process_wp_report_earnings();

COMMIT;
