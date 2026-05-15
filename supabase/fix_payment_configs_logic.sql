-- 1. Migrate corrupt existing PaymentConfigs that were stored as a flat amount
UPDATE public.payment_configs
SET 
  rate_type = 'percentage',
  rate_value = amount,
  amount = 0
WHERE payment_type IN ('commission', 'percentage') AND rate_type = 'fixed' AND amount > 0;

-- 2. Update handle_sale_earnings trigger to include 'percentage'
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

-- 3. Update handle_service_sale_earnings trigger to include 'percentage'
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
