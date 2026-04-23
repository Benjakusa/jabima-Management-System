-- Migration to create missing tables for sales agents and inventory management

-- 1. Create product_requests table
CREATE TABLE IF NOT EXISTS public.product_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    sales_officer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    selected_product_ids UUID[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add column if table already exists (try both singular and plural)
ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS selected_product_ids UUID[] DEFAULT '{}';

-- Enable RLS for product_requests
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Sales officers can view their own requests" ON product_requests;
DROP POLICY IF EXISTS "Sales officers can create their own requests" ON product_requests;
DROP POLICY IF EXISTS "Inventory officers and admins can view all requests" ON product_requests;
DROP POLICY IF EXISTS "Inventory officers and admins can update requests" ON product_requests;

-- Simpler policies for product_requests
CREATE POLICY "Anyone authenticated can insert product_requests"
ON product_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone authenticated can view product_requests"
ON product_requests FOR SELECT
USING (true);

CREATE POLICY "Anyone authenticated can update product_requests"
ON product_requests FOR UPDATE
USING (true);

-- 2. Create shop_inventory table (if needed)
CREATE TABLE IF NOT EXISTS public.shop_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finished_product_id UUID NOT NULL REFERENCES public.finished_products(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    transferred_at TIMESTAMPTZ DEFAULT now(),
    transferred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Fix shop_inventory policies - allow inventory_officer and admin
DROP POLICY IF EXISTS "Read shop inventory" ON shop_inventory;
DROP POLICY IF EXISTS "Admins manage shop inventory" ON shop_inventory;

CREATE POLICY "Anyone authenticated can read shop_inventory"
ON shop_inventory FOR SELECT
USING (true);

CREATE POLICY "Inventory officers and admins can manage shop_inventory"
ON shop_inventory FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('inventory_officer', 'admin')
    )
);
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finished_product_id UUID NOT NULL REFERENCES public.finished_products(id) ON DELETE CASCADE,
    sales_officer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
    processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for product_returns
ALTER TABLE public.product_returns ENABLE ROW LEVEL SECURITY;

-- Policies for product_returns
CREATE POLICY "Sales officers can view their own returns"
ON public.product_returns FOR SELECT
USING (auth.uid() = sales_officer_id);

CREATE POLICY "Sales officers can create their own returns"
ON public.product_returns FOR INSERT
WITH CHECK (auth.uid() = sales_officer_id);

CREATE POLICY "Inventory officers and admins can view all returns"
ON public.product_returns FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('inventory_officer', 'admin')
    )
);

CREATE POLICY "Inventory officers and admins can update returns"
ON public.product_returns FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('inventory_officer', 'admin')
    )
);

-- 3. Create sales_agent_services table
CREATE TABLE IF NOT EXISTS public.sales_agent_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_officer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sales_officer_id, service_name)
);

-- Enable RLS for sales_agent_services
ALTER TABLE public.sales_agent_services ENABLE ROW LEVEL SECURITY;

-- Policies for sales_agent_services
CREATE POLICY "Sales officers can manage their own services"
ON public.sales_agent_services FOR ALL
USING (auth.uid() = sales_officer_id);

CREATE POLICY "Admin can view all agent services"
ON public.sales_agent_services FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Grant access to authenticated users
GRANT ALL ON public.product_requests TO authenticated;
GRANT ALL ON public.product_returns TO authenticated;
GRANT ALL ON public.sales_agent_services TO authenticated;
