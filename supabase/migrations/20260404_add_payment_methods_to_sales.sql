-- Update sales and service_sales to support multiple payment methods
ALTER TABLE public.sales ALTER COLUMN mpesa_code DROP NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'mpesa' CHECK (payment_method IN ('cash', 'mpesa_stk', 'mpesa_till'));
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS amount_received DECIMAL(10,2);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS change_given DECIMAL(10,2);

ALTER TABLE public.service_sales ALTER COLUMN mpesa_code DROP NOT NULL;
ALTER TABLE public.service_sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'mpesa' CHECK (payment_method IN ('cash', 'mpesa_stk', 'mpesa_till'));
ALTER TABLE public.service_sales ADD COLUMN IF NOT EXISTS amount_received DECIMAL(10,2);
ALTER TABLE public.service_sales ADD COLUMN IF NOT EXISTS change_given DECIMAL(10,2);
