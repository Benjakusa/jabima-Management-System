ALTER TABLE public.wp_production_stages DROP CONSTRAINT IF EXISTS wp_production_stages_order_id_fkey;
ALTER TABLE public.wp_production_tasks DROP CONSTRAINT IF EXISTS wp_production_tasks_order_id_fkey;

ALTER TABLE public.wp_production_stages ADD CONSTRAINT wp_production_stages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.production_orders(id) ON DELETE CASCADE;
ALTER TABLE public.wp_production_tasks ADD CONSTRAINT wp_production_tasks_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.production_orders(id) ON DELETE CASCADE;

DROP TABLE IF EXISTS public.wp_production_orders;
