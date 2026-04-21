-- Add payment columns to sales and service_sales tables
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mpesa_stk', 'mpesa_till'));
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS amount_received DECIMAL(10,2);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS change_given DECIMAL(10,2);

ALTER TABLE public.service_sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mpesa_stk', 'mpesa_till'));
ALTER TABLE public.service_sales ADD COLUMN IF NOT EXISTS amount_received DECIMAL(10,2);
ALTER TABLE public.service_sales ADD COLUMN IF NOT EXISTS change_given DECIMAL(10,2);