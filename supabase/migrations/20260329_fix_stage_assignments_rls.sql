-- Fix RLS for stage_assignments to allow workshop workers to self-manage their stage selections

-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins manage stage assignments" ON public.stage_assignments;

-- Create policy that allows users to manage their own assignments
CREATE POLICY "Users manage own stage assignments"
ON public.stage_assignments
FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Also allow SELECT for admins to see all assignments
CREATE POLICY "Admins can view all stage assignments"
ON public.stage_assignments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
