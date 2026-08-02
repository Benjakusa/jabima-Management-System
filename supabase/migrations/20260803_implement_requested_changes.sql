-- Migration to support requested changes
-- 1. Edit Sales Audit & Function
-- 2. Transfers Destination Type

BEGIN;

-- Create Sales Audit Table
CREATE TABLE IF NOT EXISTS public.sales_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  old_selling_price numeric,
  new_selling_price numeric,
  old_product_id uuid REFERENCES public.finished_products(id),
  new_product_id uuid REFERENCES public.finished_products(id),
  old_customer_name text,
  new_customer_name text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now()
);

-- Safely disable service commissions (if they exist)
DROP TRIGGER IF EXISTS trg_service_sale_earnings ON public.service_sales;
DROP FUNCTION IF EXISTS public.handle_service_sale_earnings();

-- Extend interbranch_transfers to support Warehouse & Workshop
DO $$
BEGIN
    ALTER TABLE public.interbranch_transfers ADD COLUMN destination_type text DEFAULT 'branch' CHECK (destination_type IN ('branch', 'warehouse', 'workshop'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.interbranch_transfers ALTER COLUMN to_branch_id DROP NOT NULL;

-- Create RPC for Admin to Edit Sales safely
CREATE OR REPLACE FUNCTION public.admin_edit_sale(
  p_sale_id uuid,
  p_new_price numeric,
  p_new_customer text,
  p_new_product_id uuid,
  p_admin_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_sale record;
  v_old_commission numeric;
  v_new_commission numeric;
BEGIN
  -- 1. Get old sale
  SELECT * INTO v_old_sale FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  
  -- 2. Revert old commission
  v_old_commission := public.resolve_sales_commission(v_old_sale.sales_officer_id, v_old_sale.selling_price);
  IF v_old_commission > 0 THEN
    -- Revert from wallet
    UPDATE public.wallets 
    SET pending_earnings = pending_earnings - v_old_commission 
    WHERE user_id = v_old_sale.sales_officer_id;
    
    -- We can delete the specific transaction or insert a negative one. Let's delete it.
    DELETE FROM public.wallet_transactions 
    WHERE wallet_id = (SELECT id FROM public.wallets WHERE user_id = v_old_sale.sales_officer_id) 
    AND reference_number = 'sale_' || p_sale_id::text
    AND amount = v_old_commission;
  END IF;

  -- 3. Handle product change
  IF v_old_sale.finished_product_id != p_new_product_id THEN
    -- Revert old product to inventory
    UPDATE public.finished_products SET status = 'completed' WHERE id = v_old_sale.finished_product_id;
    -- Re-insert to shop inventory if it came from a branch
    IF v_old_sale.branch_id IS NOT NULL THEN
       INSERT INTO public.shop_inventory (finished_product_id, branch_id) 
       VALUES (v_old_sale.finished_product_id, v_old_sale.branch_id);
    END IF;

    -- Mark new product as sold
    UPDATE public.finished_products SET status = 'sold' WHERE id = p_new_product_id;
    -- Delete new product from shop inventory
    DELETE FROM public.shop_inventory WHERE finished_product_id = p_new_product_id;
  END IF;

  -- 4. Insert Audit Record
  INSERT INTO public.sales_audit (sale_id, old_selling_price, new_selling_price, old_product_id, new_product_id, old_customer_name, new_customer_name, changed_by)
  VALUES (p_sale_id, v_old_sale.selling_price, p_new_price, v_old_sale.finished_product_id, p_new_product_id, v_old_sale.customer_name, p_new_customer, p_admin_id);

  -- 5. Update Sale
  UPDATE public.sales
  SET selling_price = p_new_price,
      customer_name = p_new_customer,
      finished_product_id = p_new_product_id
  WHERE id = p_sale_id;

  -- 6. Add new commission
  v_new_commission := public.resolve_sales_commission(v_old_sale.sales_officer_id, p_new_price);
  IF v_new_commission > 0 THEN
    PERFORM public.credit_earnings(
      v_old_sale.sales_officer_id,
      v_new_commission,
      'Commission (Edited) — Product sold to ' || p_new_customer,
      'sale_' || p_sale_id::text
    );
  END IF;
END;
$$;

-- Allow reading sales_audit for admins
ALTER TABLE public.sales_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view sales_audit"
  ON public.sales_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMIT;
