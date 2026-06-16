-- Test script to debug resolve_workshop_earnings
-- Let's create a test function that logs what resolve_workshop_earnings is doing.

CREATE OR REPLACE FUNCTION public.test_resolve_workshop(
  p_user_id UUID,
  p_stage_name TEXT,
  p_product_type_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id UUID;
  v_rate DECIMAL(10,2);
  v_config RECORD;
BEGIN
  SELECT id INTO v_product_id FROM public.products WHERE name = p_product_type_name LIMIT 1;
  
  SELECT * INTO v_config
  FROM public.payment_configs
  WHERE user_id = p_user_id
    AND payment_type = 'per_stage'
    AND (stage_label = p_stage_name OR stage_label LIKE '%' || p_stage_name || '%')
    AND (product_type_id = v_product_id OR product_type_id IS NULL)
  ORDER BY CASE WHEN product_type_id = v_product_id THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN jsonb_build_object(
    'v_product_id', v_product_id,
    'found_rate', v_config.rate_value,
    'found_config_id', v_config.id,
    'p_user_id', p_user_id,
    'p_stage_name', p_stage_name,
    'p_product_type_name', p_product_type_name
  );
END;
$$;
