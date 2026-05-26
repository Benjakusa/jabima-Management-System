-- CONSOLIDATE WORKSHOP STAGES TO 4
-- Frame/Body, Sanding/Paint, Cloth/Lining, Glass/Finish

BEGIN;

-- 1. Remove old stages
-- IMPORTANT: This will remove existing assignments and stage lookups for the old 10-stage model.
TRUNCATE public.worker_stage_assignments CASCADE;
TRUNCATE public.production_stages CASCADE;

-- 2. Seed exactly 4 stages
INSERT INTO public.production_stages (name, label, sort_order) VALUES
  ('frame_body', 'Frame/Body', 1),
  ('sanding_paint', 'Sanding/Paint', 2),
  ('cloth_lining', 'Cloth/Lining', 3),
  ('glass_finish', 'Glass/Finish', 4);

-- 3. Update existing production orders to start at stage 1
-- (Optional: only for orders with 10-stage model that are now in production)
-- But better to let the code handle the new 4-stage model for new orders.

COMMIT;
