-- Fix RLS policies for product_requests to correctly handle profile.id vs auth.uid()
DROP POLICY IF EXISTS "Sales officers can view their own requests" ON public.product_requests;
DROP POLICY IF EXISTS "Sales officers can create their own requests" ON public.product_requests;
DROP POLICY IF EXISTS "Inventory officers and admins can view all requests" ON public.product_requests;
DROP POLICY IF EXISTS "Inventory officers and admins can update requests" ON public.product_requests;

CREATE POLICY "Sales officers can view their own requests"
ON public.product_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = sales_officer_id
        AND profiles.user_id = auth.uid()
    )
);

CREATE POLICY "Sales officers can create their own requests"
ON public.product_requests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = sales_officer_id
        AND profiles.user_id = auth.uid()
    )
);

CREATE POLICY "Inventory officers and admins can view all requests"
ON public.product_requests FOR SELECT
USING (
    public.has_role(auth.uid(), 'inventory_officer') 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Inventory officers and admins can update requests"
ON public.product_requests FOR UPDATE
USING (
    public.has_role(auth.uid(), 'inventory_officer') 
    OR public.has_role(auth.uid(), 'admin')
);

-- Also fix product_returns while we are at it
DROP POLICY IF EXISTS "Inventory officers and admins can view all returns" ON public.product_returns;
DROP POLICY IF EXISTS "Inventory officers and admins can update returns" ON public.product_returns;

CREATE POLICY "Inventory officers and admins can view all returns"
ON public.product_returns FOR SELECT
USING (
    public.has_role(auth.uid(), 'inventory_officer') 
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Inventory officers and admins can update returns"
ON public.product_returns FOR UPDATE
USING (
    public.has_role(auth.uid(), 'inventory_officer') 
    OR public.has_role(auth.uid(), 'admin')
);
