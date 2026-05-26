-- Workshop Production Module Schema

-- 1. Production Orders (wp = workshop production)
CREATE TABLE IF NOT EXISTS public.wp_production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID, -- Reference to original request or inventory
    product_name TEXT NOT NULL,
    product_type TEXT NOT NULL,
    placed_by UUID REFERENCES auth.users(id),
    placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_stage INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'In Progress', 'Completed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Production Stages
CREATE TABLE IF NOT EXISTS public.wp_production_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.wp_production_orders(id) ON DELETE CASCADE,
    stage_number INTEGER NOT NULL, -- 1 to 4
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Locked', -- 'Locked', 'Unlocked', 'Completed'
    unlocked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(order_id, stage_number)
);

-- 3. Production Tasks
CREATE TABLE IF NOT EXISTS public.wp_production_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID REFERENCES public.wp_production_stages(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.wp_production_orders(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    assigned_officer_id UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Pending' -- 'Pending', 'In Progress', 'Completed'
);

-- 4. Daily Reports
CREATE TABLE IF NOT EXISTS public.wp_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    officer_id UUID REFERENCES auth.users(id),
    tasks JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of Task IDs or Task objects
    submitted_at TIMESTAMPTZ,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(report_date, officer_id)
);

-- Enable RLS
ALTER TABLE public.wp_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_production_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_production_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_daily_reports ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can do everything
CREATE POLICY "Admins full access wp_orders" ON public.wp_production_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins full access wp_stages" ON public.wp_production_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins full access wp_tasks" ON public.wp_production_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins full access wp_reports" ON public.wp_daily_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Inventory Officers can read orders and logs
CREATE POLICY "Inventory read wp_orders" ON public.wp_production_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'inventory_officer')
);
CREATE POLICY "Inventory read wp_stages" ON public.wp_production_stages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'inventory_officer')
);
CREATE POLICY "Inventory read wp_tasks" ON public.wp_production_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'inventory_officer')
);
CREATE POLICY "Inventory insert wp_orders" ON public.wp_production_orders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'inventory_officer')
);
CREATE POLICY "Inventory insert wp_stages" ON public.wp_production_stages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'inventory_officer')
);

-- Workshop Officers can read orders, update tasks, manage their own reports
CREATE POLICY "Workshop read wp_orders" ON public.wp_production_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);
CREATE POLICY "Workshop update wp_orders" ON public.wp_production_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);

CREATE POLICY "Workshop read wp_stages" ON public.wp_production_stages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);
CREATE POLICY "Workshop update wp_stages" ON public.wp_production_stages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);

CREATE POLICY "Workshop read wp_tasks" ON public.wp_production_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);
CREATE POLICY "Workshop insert wp_tasks" ON public.wp_production_tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);
CREATE POLICY "Workshop update wp_tasks" ON public.wp_production_tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);

CREATE POLICY "Workshop all own wp_reports" ON public.wp_daily_reports FOR ALL USING (
  officer_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);
