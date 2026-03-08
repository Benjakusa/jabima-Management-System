import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, FileText } from 'lucide-react';

const DailyReportReminder = () => {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  const { data: todayReport, isLoading } = useQuery({
    queryKey: ['daily-report-today', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('user_id', user!.id)
        .eq('report_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (isLoading || todayReport) return null;

  const isLate = hour >= 16;

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${isLate ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/5'}`}>
      {isLate ? (
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      ) : (
        <FileText className="h-5 w-5 text-warning shrink-0" />
      )}
      <p className={`text-xs font-medium ${isLate ? 'text-destructive' : 'text-warning'}`}>
        {isLate
          ? "You haven't submitted today's daily report yet. Please submit before end of day."
          : "Don't forget to submit your daily report before you leave today."}
      </p>
    </div>
  );
};

export default DailyReportReminder;
