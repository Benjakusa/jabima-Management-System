-- ============================================================
-- RETROACTIVE EARNINGS RECOVERY SCRIPT
-- This script safely calculates earnings for all historical records
-- (sales, service_sales, daily_reports, stage_logs) and credits workers.
-- Because `credit_earnings()` utilizes the `reference_number` for deduping,
-- it is 100% safe to run this multiple times without double-crediting!
-- ============================================================

DO $$
DECLARE
  v_sale RECORD;
  v_service RECORD;
  v_report RECORD;
  v_stage RECORD;
  v_amount DECIMAL;
BEGIN
  -- 1. Recover Product Sales
  FOR v_sale IN SELECT * FROM public.sales
  LOOP
    v_amount := public.resolve_earnings_amount(
      v_sale.sales_officer_id,
      ARRAY['commission', 'per_product', 'percentage'],
      v_sale.selling_price
    );
    IF v_amount > 0 THEN
      PERFORM public.credit_earnings(
        v_sale.sales_officer_id,
        v_amount,
        'Commission - ' || COALESCE(v_sale.product_type, 'Product') || ' - ' || COALESCE(v_sale.customer_name, 'Sale'),
        'sale_' || v_sale.id
      );
    END IF;
  END LOOP;

  -- 2. Recover Service Sales
  FOR v_service IN SELECT * FROM public.service_sales
  LOOP
    v_amount := public.resolve_earnings_amount(
      v_service.sales_officer_id,
      ARRAY['commission', 'per_service', 'percentage'],
      v_service.amount
    );
    IF v_amount > 0 THEN
      PERFORM public.credit_earnings(
        v_service.sales_officer_id,
        v_amount,
        'Service - ' || COALESCE(v_service.service_name, 'Service') || ' - ' || COALESCE(v_service.customer_name, 'Sale'),
        'svc_' || v_service.id
      );
    END IF;
  END LOOP;

  -- 3. Recover Daily Reports
  FOR v_report IN SELECT * FROM public.daily_reports
  LOOP
    v_amount := public.resolve_earnings_amount(
      v_report.user_id,
      ARRAY['per_day', 'daily_wage'],
      0
    );
    IF v_amount > 0 THEN
      PERFORM public.credit_earnings(
        v_report.user_id,
        v_amount,
        'Daily wage - ' || COALESCE(v_report.report_date::TEXT, CURRENT_DATE::TEXT),
        'report_' || v_report.id
      );
    END IF;
  END LOOP;

  -- 4. Recover Completed Stages (Workshop Workers)
  FOR v_stage IN SELECT * FROM public.stage_logs WHERE completed_at IS NOT NULL
  LOOP
    v_amount := public.resolve_earnings_amount(
      v_stage.worker_id,
      ARRAY['per_stage'],
      0
    );
    IF v_amount > 0 THEN
      PERFORM public.credit_earnings(
        v_stage.worker_id,
        v_amount,
        'Stage completed - ' || COALESCE(v_stage.stage::TEXT, 'Stage') || ' (Order ' || COALESCE(v_stage.production_order_id::TEXT, '') || ')',
        'stage_' || v_stage.id
      );
    END IF;
  END LOOP;

END $$;
