import { useState, useMemo } from 'react';
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
import { FileText, CheckCircle, Loader2, Calendar, Play, Pause, Check } from 'lucide-react';

const DailyReportForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;

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

  const { data: todayTasks } = useQuery({
    queryKey: ['stage-logs-today', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('stage_logs')
        .select(`
          *,
          production_orders (
            batch_number,
            products (
              name
            )
          )
        `)
        .eq('worker_id', user!.id)
        .gte('started_at', todayStart)
        .lte('started_at', todayEnd)
        .order('started_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const taskCounts = useMemo(() => {
    if (!todayTasks) return { started: 0, midway: 0, completed: 0 };
    return {
      started: todayTasks.filter(t => t.work_status === 'started').length,
      midway: todayTasks.filter(t => t.work_status === 'midway').length,
      completed: todayTasks.filter(t => t.work_status === 'completed').length,
    };
  }, [todayTasks]);

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
      const completedTasks = todayTasks?.filter(t => t.work_status === 'completed') || [];
      const totalTasks = completedTasks.length;
      const trimmedSummary = summary.trim();
      if (!trimmedSummary) throw new Error('Please enter a summary');

      const tasksDetail = completedTasks.map(t => ({
        id: t.id,
        product: t.production_orders?.products?.name,
        batch: t.production_orders?.batch_number,
        stage: t.stage,
        completed_at: t.completed_at || new Date().toISOString(),
      }));

      const { error } = await supabase.from('daily_reports').insert({
        user_id: user!.id,
        tasks_completed: totalTasks,
        summary: trimmedSummary.slice(0, 1000),
        report_date: today,
        completed_tasks: tasksDetail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Report submitted!' });
      setSummary('');
      queryClient.invalidateQueries({ queryKey: ['daily-report-today'] });
      queryClient.invalidateQueries({ queryKey: ['daily-reports-recent'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const statusConfig = {
    started: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Started' },
    midway: { icon: Pause, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Midway' },
    completed: { icon: Check, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Completed' },
  };

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
            {todayReport.completed_tasks && todayReport.completed_tasks.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-muted-foreground">Completed:</p>
                {todayReport.completed_tasks.map((task: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-accent/20 text-xs">
                    <Check className="h-3 w-3 text-green-500" />
                    <span>{task.product}</span>
                    <Badge variant="outline" className="text-[10px]">{task.batch}</Badge>
                    <span className="text-muted-foreground text-[10px]">{task.stage}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">{todayReport.summary}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border">
          <CardContent className="p-4 space-y-3">
            {todayTasks && todayTasks.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Today's Tasks</Label>
                <div className="flex gap-2 mt-1 mb-2">
                  {(['started', 'midway', 'completed'] as const).map(status => {
                    const config = statusConfig[status];
                    const Icon = config.icon;
                    return (
                      <div key={status} className={`flex items-center gap-1 px-2 py-1 rounded ${config.bg}`}>
                        <Icon className={`h-3 w-3 ${config.color}`} />
                        <span className="text-xs font-medium">{taskCounts[status]}</span>
                        <span className="text-[10px] text-muted-foreground">{config.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Tasks Completed (auto-populated)</Label>
              <div className="mt-1 space-y-1 max-h-[100px] overflow-y-auto rounded-md border bg-accent/20">
                {todayTasks?.filter(t => t.work_status === 'completed').length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No completed tasks yet</div>
                ) : (
                  todayTasks?.filter(t => t.work_status === 'completed').map(task => (
                    <div key={task.id} className="flex items-center gap-2 px-3 py-1 text-xs">
                      <Check className="h-3 w-3 text-green-500" />
                      <span>{task.production_orders?.products?.name}</span>
                      <Badge variant="outline" className="text-[10px]">{task.production_orders?.batch_number}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{task.stage}</Badge>
                    </div>
                  ))
                )}
              </div>
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
