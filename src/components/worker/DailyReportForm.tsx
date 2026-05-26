import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, CheckCircle, Clock, Loader2, Lock, ListTodo } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const DailyReportForm = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date();

  // Fetch Submitted Report
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['wp_daily_reports', user?.id, format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wp_daily_reports')
        .select('*')
        .eq('officer_id', user?.id)
        .eq('report_date', format(today, 'yyyy-MM-dd'))
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Fetch Today's Completed Tasks
  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['wp_daily_tasks', user?.id],
    queryFn: async () => {
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      const { data, error } = await supabase
        .from('wp_production_tasks')
        .select('*')
        .eq('assigned_officer_id', user?.id)
        .eq('status', 'Completed')
        .gte('completed_at', start)
        .lte('completed_at', end);

      if (error) throw error;
      return data || [];
    },
    enabled: !report, // Only fetch dynamically if no submitted report
  });

  const submitReportMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('wp_daily_reports').insert({
        officer_id: user?.id,
        report_date: format(today, 'yyyy-MM-dd'),
        tasks: tasks,
        is_locked: true,
        submitted_at: new Date().toISOString()
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Daily Report Submitted', description: 'Your day works have been logged.' });
      queryClient.invalidateQueries({ queryKey: ['wp_daily_reports'] });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: err.message })
  });

  if (loadingTasks || loadingReport) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  const displayTasks = report ? report.tasks : (tasks || []);
  const distinctOrdersCount = new Set(displayTasks.map((t: any) => t.order_id)).size;
  // Calculate fully completed orders today logically (using derived logic since order completion time is tricky to fetch here without extra queries)
  const completedOrdersCount = displayTasks.filter((t: any) => t.production_orders?.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Daily Report</h2>
        <p className="text-sm text-muted-foreground">{format(today, 'PPPP')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <ListTodo className="h-6 w-6 text-primary mb-2" />
            <h4 className="text-2xl font-bold">{displayTasks.length}</h4>
            <p className="text-xs text-muted-foreground">Tasks Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Factory className="h-6 w-6 text-primary mb-2" />
            <h4 className="text-2xl font-bold">{distinctOrdersCount}</h4>
            <p className="text-xs text-muted-foreground">Orders Progressed</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <CheckCircle className="h-6 w-6 text-success mb-2" />
            <h4 className="text-2xl font-bold">{completedOrdersCount}</h4>
            <p className="text-xs text-muted-foreground">Orders Fully Finished</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Today's Activity Log</CardTitle>
              <CardDescription>Auto-generated from your completed workshop tasks.</CardDescription>
            </div>
            {report && <Badge variant="secondary" className="bg-success/10 text-success"><Lock className="h-3 w-3 mr-1" /> Submitted</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {displayTasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No tasks completed today.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displayTasks.map((task: any, index: number) => (
                <div key={task.id || index} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {task.order_id?.slice(0, 8).toUpperCase()}
                      </Badge>
                      <span className="font-medium text-sm">
                        {task.product_type || 'Production Task'}
                      </span>
                    </div>
                    <p className="text-foreground text-sm font-semibold">{task.task_name}</p>
                    <p className="text-xs text-muted-foreground">{task.stage_name || 'Workshop Stage'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {task.started_at && <>{format(new Date(task.started_at), 'HH:mm')} - </>}
                    {task.completed_at ? format(new Date(task.completed_at), 'HH:mm') : 'Done'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!report && displayTasks.length > 0 && (
        <Button
          size="lg"
          className="w-full"
          onClick={() => submitReportMutation.mutate()}
          disabled={submitReportMutation.isPending}
        >
          {submitReportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Submit & Lock Today's Report
        </Button>
      )}
    </div>
  );
};

// Extracted Factory icon to prevent compilation errors if it wasn't imported
import { Factory } from 'lucide-react';

export default DailyReportForm;
