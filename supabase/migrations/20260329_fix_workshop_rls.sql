-- Fix RLS for workshop workers

-- Ensure workshop workers can read inventory_materials
DROP POLICY IF EXISTS "Read inventory materials" ON public.inventory_materials;
CREATE POLICY "Read inventory materials"
ON public.inventory_materials
FOR SELECT
TO authenticated
USING (true);

-- Workshop workers can read their own stage_assignments
DROP POLICY IF EXISTS "Users manage own stage assignments" ON public.stage_assignments;
CREATE POLICY "Workshop workers manage own stage assignments"
ON public.stage_assignments
FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Workshop workers can create material_requests
DROP POLICY IF EXISTS "Workshop workers create material requests" ON public.material_requests;
CREATE POLICY "Workshop workers create material requests"
ON public.material_requests
FOR INSERT
TO authenticated
WITH CHECK (worker_id = auth.uid());

-- Workshop workers can view their own material_requests
DROP POLICY IF EXISTS "Workshop workers view own material requests" ON public.material_requests;
CREATE POLICY "Workshop workers view own material requests"
ON public.material_requests
FOR SELECT
TO authenticated
USING (worker_id = auth.uid());

-- Workshop workers can read production_orders
DROP POLICY IF EXISTS "Read production orders" ON public.production_orders;
CREATE POLICY "Read production orders"
ON public.production_orders
FOR SELECT
TO authenticated
USING (true);

-- Workshop workers can read stage_logs
DROP POLICY IF EXISTS "Read stage logs" ON public.stage_logs;
CREATE POLICY "Read stage logs"
ON public.stage_logs
FOR SELECT
TO authenticated
USING (true);

-- Workshop workers can insert stage_logs
DROP POLICY IF EXISTS "Workshop workers insert stage logs" ON public.stage_logs;
CREATE POLICY "Workshop workers insert stage logs"
ON public.stage_logs
FOR INSERT
TO authenticated
WITH CHECK (worker_id = auth.uid());

-- Workshop workers can update stage_logs (to mark complete)
DROP POLICY IF EXISTS "Workshop workers update stage logs" ON public.stage_logs;
CREATE POLICY "Workshop workers update stage logs"
ON public.stage_logs
FOR UPDATE
TO authenticated
USING (worker_id = auth.uid())
WITH CHECK (worker_id = auth.uid());

-- Workshop workers can insert product_material_usage
DROP POLICY IF EXISTS "Workshop workers insert material usage" ON public.product_material_usage;
CREATE POLICY "Workshop workers insert material usage"
ON public.product_material_usage
FOR INSERT
TO authenticated
WITH CHECK (worker_id = auth.uid());

-- Workshop workers can read product_material_usage
DROP POLICY IF EXISTS "Read product material usage" ON public.product_material_usage;
CREATE POLICY "Read product material usage"
ON public.product_material_usage
FOR SELECT
TO authenticated
USING (true);

-- Workshop workers can read inventory_materials (already exists but ensure it works)
DROP POLICY IF EXISTS "Read inventory materials" ON public.inventory_materials;
CREATE POLICY "Read inventory materials"
ON public.inventory_materials
FOR SELECT
TO authenticated
USING (true);
