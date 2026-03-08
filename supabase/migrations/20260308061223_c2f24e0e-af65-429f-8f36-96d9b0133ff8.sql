
-- Function to create a batch of production orders with auto-generated product codes
CREATE OR REPLACE FUNCTION public.create_production_batch(
  p_product_type TEXT,
  p_quantity INT,
  p_batch_number TEXT,
  p_notes TEXT DEFAULT NULL,
  p_expected_completion_date DATE DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS SETOF production_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _i INT;
  _code TEXT;
BEGIN
  IF p_quantity < 1 OR p_quantity > 100 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 100';
  END IF;

  FOR _i IN 1..p_quantity LOOP
    _code := generate_product_code(p_product_type);
    
    RETURN QUERY
    INSERT INTO production_orders (
      product_type, product_code, batch_number, notes, 
      expected_completion_date, created_by
    ) VALUES (
      p_product_type, _code, p_batch_number, p_notes,
      p_expected_completion_date, p_created_by
    )
    RETURNING *;
  END LOOP;
END;
$$;
