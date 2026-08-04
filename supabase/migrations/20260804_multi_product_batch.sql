-- Multi-product batch creation.
-- Extends batch creation so a single batch/work order can contain multiple
-- product types in one transaction, while keeping the existing
-- create_production_batch(p_product_type, p_quantity, ...) fully compatible
-- for previously created batches and any callers.

CREATE OR REPLACE FUNCTION public.create_production_batch_multi(
  p_items JSONB,
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
  _item JSONB;
  _type TEXT;
  _qty INT;
  _i INT;
  _code TEXT;
  _total INT := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one product line is required';
  END IF;

  IF p_batch_number IS NULL OR btrim(p_batch_number) = '' THEN
    RAISE EXCEPTION 'Batch number is required';
  END IF;

  -- Validate every product line up-front so nothing is partially saved.
  FOR _item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    _type := btrim(COALESCE(_item->>'product_type', ''));
    _qty := (_item->>'quantity')::int;

    IF _type = '' THEN
      RAISE EXCEPTION 'Every product line requires a product type';
    END IF;
    IF _qty IS NULL OR _qty < 1 OR _qty > 100 THEN
      RAISE EXCEPTION 'Quantity must be between 1 and 100 for product: %', _type;
    END IF;

    _total := _total + _qty;
    IF _total > 1000 THEN
      RAISE EXCEPTION 'Total quantity for one batch cannot exceed 1000';
    END IF;
  END LOOP;

  -- Insert all product lines under the same batch_number.
  FOR _item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    _type := btrim(COALESCE(_item->>'product_type', ''));
    _qty := (_item->>'quantity')::int;

    FOR _i IN 1.._qty LOOP
      _code := generate_product_code(_type);

      RETURN QUERY
      INSERT INTO production_orders (
        product_type, product_code, batch_number, notes,
        expected_completion_date, created_by
      ) VALUES (
        _type, _code, p_batch_number, p_notes,
        p_expected_completion_date, p_created_by
      )
      RETURNING *;
    END LOOP;
  END LOOP;
END;
$$;