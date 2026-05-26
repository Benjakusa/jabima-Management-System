-- Trigger to automatically credit earnings when a workshop daily report is submitted
CREATE OR REPLACE FUNCTION public.process_wp_report_earnings()
RETURNS TRIGGER AS $$
DECLARE
  v_total_earned DECIMAL(10,2) := 0;
  v_task RECORD;
  v_rate DECIMAL(10,2);
BEGIN
  -- Safety check: NEW.tasks is a jsonb array
  IF NEW.tasks IS NULL OR jsonb_array_length(NEW.tasks) = 0 THEN
    RETURN NEW;
  END IF;

  -- Iterate through tasks in the report
  FOR v_task IN SELECT * FROM jsonb_to_recordset(NEW.tasks) AS t(stage_id UUID) LOOP
    -- Find rate for this stage and worker in worker_stage_assignments
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

  -- Credit the wallet using existing helper
  IF v_total_earned > 0 THEN
    PERFORM public.credit_earnings(
      NEW.officer_id,
      v_total_earned,
      'Workshop Earnings - ' || COALESCE(NEW.report_date::TEXT, CURRENT_DATE::TEXT),
      'wp_report_' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_wp_report_earnings ON public.wp_daily_reports;
CREATE TRIGGER trg_wp_report_earnings
  AFTER INSERT ON public.wp_daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.process_wp_report_earnings();
