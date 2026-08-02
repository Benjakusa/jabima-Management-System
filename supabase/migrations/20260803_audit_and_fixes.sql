-- ============================================================
-- JABIMA AUDIT FIXES — SQL MIGRATION
-- ============================================================

-- 1 & 2: Update admin_edit_sale to include availability check and instalment recalculation
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
  v_new_product_status text;
  v_total_paid numeric;
  v_pending_count integer;
  v_new_amount_per_instalment numeric;
  v_remaining_balance numeric;
BEGIN
  -- 1. Get old sale
  SELECT * INTO v_old_sale FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- 1b. Check if new product is available
  IF v_old_sale.finished_product_id != p_new_product_id THEN
    SELECT status INTO v_new_product_status FROM public.finished_products WHERE id = p_new_product_id;
    IF v_new_product_status != 'completed' THEN
      RAISE EXCEPTION 'The selected product is not available for sale. Current status: %', v_new_product_status;
    END IF;
  END IF;
  
  -- 2. Revert old commission
  v_old_commission := public.resolve_sales_commission(v_old_sale.sales_officer_id, v_old_sale.selling_price);
  IF v_old_commission > 0 THEN
    -- Revert from wallet
    UPDATE public.wallets 
    SET pending_earnings = pending_earnings - v_old_commission 
    WHERE user_id = v_old_sale.sales_officer_id;
    
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

  -- 5. Handle Instalment Schedule Recalculation
  IF v_old_sale.is_lipa_pole_pole THEN
    SELECT COALESCE(SUM(amount_paid), 0) INTO v_total_paid FROM public.instalment_schedule WHERE sale_id = p_sale_id;
    SELECT COUNT(*) INTO v_pending_count FROM public.instalment_schedule WHERE sale_id = p_sale_id AND status = 'pending';
    
    IF v_pending_count > 0 THEN
      v_remaining_balance := p_new_price - v_total_paid;
      IF v_remaining_balance < 0 THEN
         v_remaining_balance := 0;
      END IF;
      
      v_new_amount_per_instalment := v_remaining_balance / v_pending_count;
      
      UPDATE public.instalment_schedule
      SET amount_due = v_new_amount_per_instalment
      WHERE sale_id = p_sale_id AND status = 'pending';
    END IF;
  END IF;

  -- 6. Update Sale
  UPDATE public.sales
  SET selling_price = p_new_price,
      customer_name = p_new_customer,
      finished_product_id = p_new_product_id
  WHERE id = p_sale_id;

  -- 7. Add new commission
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


-- 4 & 5: Production Orders Protection and Audit

CREATE TABLE IF NOT EXISTS public.production_orders_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid REFERENCES public.production_orders(id),
  old_product_type text,
  new_product_type text,
  old_notes text,
  new_notes text,
  old_expected_date date,
  new_expected_date date,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  action text DEFAULT 'edit'
);

ALTER TABLE public.production_orders_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view production_orders_audit"
  ON public.production_orders_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_officer'));

CREATE OR REPLACE FUNCTION public.update_production_order(
  p_order_id uuid,
  p_product_type text,
  p_notes text,
  p_expected_date date,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_order record;
BEGIN
  -- Get existing order
  SELECT * INTO v_old_order FROM public.production_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;

  -- Protect completed orders from backend
  IF v_old_order.status = 'completed' THEN
    RAISE EXCEPTION 'Completed production orders cannot be edited';
  END IF;

  -- Insert audit trail
  INSERT INTO public.production_orders_audit (
    production_order_id, old_product_type, new_product_type, old_notes, new_notes, old_expected_date, new_expected_date, changed_by
  ) VALUES (
    p_order_id, v_old_order.product_type, p_product_type, v_old_order.notes, p_notes, v_old_order.expected_completion_date, p_expected_date, p_user_id
  );

  -- Update order
  UPDATE public.production_orders
  SET product_type = p_product_type,
      notes = p_notes,
      expected_completion_date = p_expected_date
  WHERE id = p_order_id;

END;
$$;
