CREATE POLICY "Workshop insert wp_stages" ON public.wp_production_stages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'workshop_worker')
);
