
-- Add batch and product code columns to production_orders
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS expected_completion_date DATE,
  ADD COLUMN IF NOT EXISTS product_code TEXT UNIQUE;

-- Add worker_id to product_material_usage for tracking who requested materials
ALTER TABLE public.product_material_usage
  ADD COLUMN IF NOT EXISTS worker_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'used';

-- Create a function to generate sequential product codes
CREATE OR REPLACE FUNCTION public.generate_product_code(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prefix TEXT;
  _year TEXT;
  _seq INT;
  _code TEXT;
BEGIN
  -- Determine prefix from product type
  IF p_type ILIKE '%casket%' THEN
    _prefix := 'JFD-CS';
  ELSIF p_type ILIKE '%child%' THEN
    _prefix := 'JFD-CC';
  ELSE
    _prefix := 'JFD-CF';
  END IF;

  _year := EXTRACT(YEAR FROM NOW())::TEXT;

  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CASE WHEN product_code ~ ('^' || _prefix || '-' || _year || '-[0-9]+$')
    THEN SUBSTRING(product_code FROM '[0-9]+$')::INT
    ELSE 0 END
  ), 0) + 1
  INTO _seq
  FROM production_orders
  WHERE product_code LIKE _prefix || '-' || _year || '-%';

  _code := _prefix || '-' || _year || '-' || LPAD(_seq::TEXT, 4, '0');
  RETURN _code;
END;
$$;

-- Update the advance_production_stage function to also work with product_code
-- (no change needed, it works by order ID)

-- Add RLS policy for workers to insert material usage
CREATE POLICY "Workers can insert material usage"
  ON public.product_material_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (worker_id = auth.uid());

-- Workers can see material usage for orders they work on
CREATE POLICY "Workers can view own material usage"
  ON public.product_material_usage
  FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory_officer'::app_role));
