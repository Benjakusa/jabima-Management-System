-- CONSOLIDATED WORKSHOP MODULE FIXES
-- Run this in the Supabase SQL Editor to ensure everything is set up correctly.

BEGIN;

-- 1. Ensure wp_production_tasks has all required columns
ALTER TABLE public.wp_production_tasks ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE public.wp_production_tasks ADD COLUMN IF NOT EXISTS stage_name TEXT;

-- 2. Update foreign keys for easier joins
ALTER TABLE public.wp_production_tasks DROP CONSTRAINT IF EXISTS wp_production_tasks_assigned_officer_id_fkey;
ALTER TABLE public.wp_production_tasks 
  ADD CONSTRAINT wp_production_tasks_assigned_officer_fkey 
  FOREIGN KEY (assigned_officer_id) REFERENCES public.profiles(user_id);

ALTER TABLE public.wp_daily_reports DROP CONSTRAINT IF EXISTS wp_daily_reports_officer_id_fkey;
ALTER TABLE public.wp_daily_reports
  ADD CONSTRAINT wp_daily_reports_officer_fkey
  FOREIGN KEY (officer_id) REFERENCES public.profiles(user_id);

-- 3. Earnings Processing Trigger
CREATE OR REPLACE FUNCTION public.process_wp_report_earnings()
RETURNS TRIGGER AS $$
DECLARE
  v_total_earned DECIMAL(10,2) := 0;
  v_task RECORD;
  v_rate DECIMAL(10,2);
BEGIN
  IF NEW.tasks IS NULL OR jsonb_array_length(NEW.tasks) = 0 THEN
    RETURN NEW;
  END IF;

  FOR v_task IN SELECT * FROM jsonb_to_recordset(NEW.tasks) AS t(stage_id UUID) LOOP
    SELECT rate_override INTO v_rate
    FROM public.worker_stage_assignments 
    WHERE worker_id = NEW.officer_id 
      AND stage_id = v_task.stage_id 
      AND is_active = true
    LIMIT 1;
    
    IF v_rate IS NOT NULL AND v_rate > 0 THEN
      v_total_earned := v_total_earned + v_rate;
    END IF;
  END LOOP;

  IF v_total_earned > 0 THEN
    PERFORM public.credit_earnings(
      NEW.officer_id,
      v_total_earned,
      'Workshop Earnings - ' || NEW.report_date::TEXT,
      'wp_report_' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_wp_report_earnings ON public.wp_daily_reports;
CREATE TRIGGER trg_wp_report_earnings
  AFTER INSERT ON public.wp_daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.process_wp_report_earnings();

-- 4. Broaden profiles visibility for task displays
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

COMMIT;
