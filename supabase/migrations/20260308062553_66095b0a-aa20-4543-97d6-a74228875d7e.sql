
-- Add size and material_type to production_orders
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT 'adult',
  ADD COLUMN IF NOT EXISTS material_type TEXT NOT NULL DEFAULT 'pine';

-- Material requests table (workers request materials with priority)
CREATE TABLE public.material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id),
  material_id UUID NOT NULL REFERENCES public.inventory_materials(id),
  worker_id UUID NOT NULL,
  stage TEXT NOT NULL,
  quantity_requested NUMERIC NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  fulfilled_by UUID,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can create own requests"
  ON public.material_requests FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can view own requests"
  ON public.material_requests FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "Admins manage material requests"
  ON public.material_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Inventory officers manage material requests"
  ON public.material_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'inventory_officer'::app_role));

-- Material returns table
CREATE TABLE public.material_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id),
  material_id UUID NOT NULL REFERENCES public.inventory_materials(id),
  worker_id UUID NOT NULL,
  quantity_returned NUMERIC NOT NULL,
  reason TEXT NOT NULL DEFAULT 'excess',
  status TEXT NOT NULL DEFAULT 'pending',
  inspected_by UUID,
  inspected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can create own returns"
  ON public.material_returns FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can view own returns"
  ON public.material_returns FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "Admins manage material returns"
  ON public.material_returns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Inventory officers manage material returns"
  ON public.material_returns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'inventory_officer'::app_role));
