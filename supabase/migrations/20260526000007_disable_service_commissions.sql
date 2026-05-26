-- Disable automatic earnings accrual for service sales
-- As per user request: only product commissions should be implemented on the wallet

DROP TRIGGER IF EXISTS trg_service_sale_earnings ON public.service_sales;
DROP FUNCTION IF EXISTS public.handle_service_sale_earnings();
