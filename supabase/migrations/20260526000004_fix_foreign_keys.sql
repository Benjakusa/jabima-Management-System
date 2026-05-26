-- Fix foreign keys to allow PostgREST joins with profiles
BEGIN;

-- Update wp_production_tasks to reference profiles(user_id)
ALTER TABLE public.wp_production_tasks DROP CONSTRAINT IF EXISTS wp_production_tasks_assigned_officer_id_fkey;
ALTER TABLE public.wp_production_tasks 
  ADD CONSTRAINT wp_production_tasks_assigned_officer_fkey 
  FOREIGN KEY (assigned_officer_id) REFERENCES public.profiles(user_id);

-- Ensure wp_daily_reports has correct RLS and structure
-- The 406 might be because of an incorrect select or missing columns
-- Let's make sure it has an officer_id that matches profiles(user_id)
ALTER TABLE public.wp_daily_reports DROP CONSTRAINT IF EXISTS wp_daily_reports_officer_id_fkey;
ALTER TABLE public.wp_daily_reports
  ADD CONSTRAINT wp_daily_reports_officer_fkey
  FOREIGN KEY (officer_id) REFERENCES public.profiles(user_id);

COMMIT;
