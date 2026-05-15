-- Allow sales officers and other branch users to create interbranch transfers
CREATE POLICY "Branch users can create interbranch transfers"
  ON public.interbranch_transfers FOR INSERT TO authenticated WITH CHECK (
    from_branch_id IN (SELECT branch_id FROM public.profiles WHERE user_id = auth.uid())
    AND initiated_by = auth.uid()
  );
