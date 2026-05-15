-- Fix the operator does not exist: payment_type = text error in resolve_earnings_amount
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
