-- Migration to add individual product selection to requests
ALTER TABLE public.product_requests 
ADD COLUMN selected_product_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.product_requests.selected_product_ids IS 'Array of finished_product_ids picked by the sales officer';
