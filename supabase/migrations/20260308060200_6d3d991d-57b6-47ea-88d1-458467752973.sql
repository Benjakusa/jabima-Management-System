
CREATE OR REPLACE FUNCTION public.advance_production_stage(
  _order_id uuid,
  _current_stage production_stage,
  _worker_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _stages production_stage[] := ARRAY[
    'wood_cutting', 'frame_assembly', 'board_fitting', 'sanding', 'fabric_lining',
    'painting', 'handle_installation', 'glass_installation', 'final_assembly', 'quality_inspection'
  ]::production_stage[];
  _idx int;
  _next_stage production_stage;
  _order_status product_status;
  _order_current_stage production_stage;
BEGIN
  -- Verify the worker has a completed stage log for this order/stage
  IF NOT EXISTS (
    SELECT 1 FROM stage_logs
    WHERE production_order_id = _order_id
      AND stage = _current_stage
      AND worker_id = _worker_id
      AND completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No completed stage log found for this worker/order/stage';
  END IF;

  -- Verify order is still at this stage and in production
  SELECT status, current_stage INTO _order_status, _order_current_stage
  FROM production_orders WHERE id = _order_id;

  IF _order_status != 'in_production' OR _order_current_stage != _current_stage THEN
    RAISE EXCEPTION 'Order is not at the expected stage';
  END IF;

  -- Find current stage index
  _idx := array_position(_stages, _current_stage);

  IF _idx = array_length(_stages, 1) THEN
    -- Last stage: mark order as completed and create finished product
    UPDATE production_orders
    SET status = 'completed', completed_at = now()
    WHERE id = _order_id;

    INSERT INTO finished_products (production_order_id, product_type, production_cost)
    SELECT id, product_type, COALESCE(production_cost, 0)
    FROM production_orders WHERE id = _order_id;
  ELSE
    -- Advance to next stage
    _next_stage := _stages[_idx + 1];
    UPDATE production_orders
    SET current_stage = _next_stage
    WHERE id = _order_id;
  END IF;
END;
$$;
