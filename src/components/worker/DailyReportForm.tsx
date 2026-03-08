import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, CheckCircle, Loader2, Calendar } from 'lucide-react';

const DailyReportForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tasksCompleted, setTasksCompleted] = useState('');
  const [summary, setSummary] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const { data: todayReport } = useQuery({
    queryKey: ['daily-report-today', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', user!.id)
        .eq('report_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: recentReports } = useQuery({
    queryKey: ['daily-reports-recent', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', user!.id)
        .order('report_date', { ascending: false })
        .limit(7);
      return data || [];
    },
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const tasks = parseInt(tasksCompleted) || 0;
      const trimmedSummary = summary.trim();
      if (!trimmedSummary) throw new Error('Please enter a summary');

      const { error } = await supabase.from('daily_reports').insert({
        user_id: user!.id,
        tasks_completed: tasks,
        summary: trimmedSummary.slice(0, 1000),
        report_date: today,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Report submitted!' });
      setTasksCompleted('');
      setSummary('');
      queryClient.invalidateQueries({ queryKey: ['daily-report-today'] });
      queryClient.invalidateQueries({ queryKey: ['daily-reports-recent'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" /> Daily Report
      </h2>

      {todayReport ? (
        <Card className="border border-success/30 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-foreground">Today's report submitted</span>
            </div>
            <p className="text-xs text-muted-foreground">Tasks: {todayReport.tasks_completed}</p>
            <p className="text-xs text-muted-foreground mt-1">{todayReport.summary}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs">Tasks Completed</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={tasksCompleted}
                onChange={e => setTasksCompleted(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Summary</Label>
              <Textarea
                placeholder="What did you work on today?"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                maxLength={1000}
                className="mt-1 min-h-[60px]"
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !summary.trim()}
            >
              {submitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              Submit Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent reports */}
      {recentReports && recentReports.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Recent Reports</h3>
          <div className="space-y-1">
            {recentReports.filter(r => r.report_date !== today).slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground text-xs">{new Date(r.report_date).toLocaleDateString()}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.tasks_completed} tasks</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReportForm;
