-- Add redundant fields to wp_production_tasks for easier report autopopulation
BEGIN;

ALTER TABLE public.wp_production_tasks ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE public.wp_production_tasks ADD COLUMN IF NOT EXISTS stage_name TEXT;

COMMIT;
