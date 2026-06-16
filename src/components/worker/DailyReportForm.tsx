import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, CheckCircle, Clock, Loader2, Lock, ListTodo, PlusCircle, Wallet } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ─────────────────────────────────────────────────
// INVENTORY OFFICER: Manual modal-based report form
// ─────────────────────────────────────────────────
const InventoryDailyReport = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [tasksCount, setTasksCount] = useState('');

  // Check if already submitted today
  const { data: existingReport, isLoading } = useQuery({
    queryKey: ['inv-daily-report', user?.id, format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', user!.id)
        .eq('report_date', format(today, 'yyyy-MM-dd'))
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch payment config to show expected daily wage
  const { data: payConfig } = useQuery({
    queryKey: ['pay-config', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_configs')
        .select('*')
        .eq('user_id', user!.id)
        .in('payment_type', ['daily_wage', 'per_day'] as any[])
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!summary.trim()) throw new Error('Please write a report summary before submitting.');

      // Insert into daily_reports — DB trigger handle_report_earnings fires automatically
      // and credits the daily_wage to the wallet.
      const { error, data } = await supabase.from('daily_reports').insert({
        user_id: user!.id,
        report_date: format(today, 'yyyy-MM-dd'),
        summary: summary.trim(),
        tasks_completed: tasksCount ? parseInt(tasksCount) : 0,
      } as any).select('id').single();

      if (error) {
        // Surface the actual DB error message for debugging
        console.error('[DailyReport] Insert error:', error);
        const msg = error.message || error.details || error.hint || JSON.stringify(error);
        // If it's a duplicate key, report already exists
        if (error.code === '23505') {
          throw new Error('A report for today already exists. Please refresh the page.');
        }
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: '✅ Report Submitted!',
        description: 'Your daily report has been logged and your wallet has been updated.',
      });
      setOpen(false);
      setSummary('');
      setTasksCount('');
      queryClient.invalidateQueries({ queryKey: ['inv-daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['my-wallet-transactions'] });
    },
    onError: (err: Error) =>
      toast({ variant: 'destructive', title: 'Submission Failed', description: err.message }),
  });

  if (isLoading) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Daily Report</h2>
        <p className="text-sm text-muted-foreground">{format(today, 'PPPP')}</p>
      </div>

      {/* Status card */}
      {existingReport ? (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Report Submitted</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Submitted at {new Date(existingReport.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge variant="secondary" className="bg-success/10 text-success border-success/30">
              <Lock className="h-3 w-3 mr-1" /> Locked for {format(today, 'MMM d')}
            </Badge>

            {existingReport.summary && (
              <div className="w-full text-left bg-background rounded-xl border p-4 mt-2">
                <p className="text-xs text-muted-foreground font-medium mb-1">Your Summary</p>
                <p className="text-sm text-foreground leading-relaxed">{existingReport.summary}</p>
              </div>
            )}

            {(existingReport.tasks_completed ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <ListTodo className="h-4 w-4 text-primary" />
                <span className="font-semibold">{existingReport.tasks_completed}</span>
                <span className="text-muted-foreground">activities logged</span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">No Report Yet Today</p>
              <p className="text-sm text-muted-foreground mt-1">
                Submit your end-of-day report to log your activities and receive your daily earnings.
              </p>
            </div>

            {payConfig && (
              <div className="flex items-center gap-2 text-sm bg-primary/5 rounded-xl px-4 py-2 border border-primary/20">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Daily wage:</span>
                <span className="font-bold text-primary">
                  Ksh {(payConfig as any).rate_value ?? (payConfig as any).amount ?? '—'}
                </span>
                <span className="text-muted-foreground text-xs">will be credited on submit</span>
              </div>
            )}

            <Button
              size="lg"
              className="w-full max-w-xs gap-2 mt-2"
              onClick={() => setOpen(true)}
            >
              <PlusCircle className="h-4 w-4" />
              Write Today's Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Report submission modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Daily Report — {format(today, 'MMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              Describe what you did today. Once submitted, this report is locked and your wallet will be credited.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="report-summary">Report Summary <span className="text-destructive">*</span></Label>
              <Textarea
                id="report-summary"
                placeholder="e.g. Processed 5 material requests, inspected 2 returns, approved 3 product requests for Branch Nairobi..."
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className="min-h-[140px] resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{summary.length} characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tasks-count">Number of Activities (optional)</Label>
              <Input
                id="tasks-count"
                type="number"
                min="0"
                placeholder="e.g. 8"
                value={tasksCount}
                onChange={e => setTasksCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Total tasks/requests you handled today (for reporting purposes).
              </p>
            </div>

            {payConfig && (
              <div className="flex items-center gap-2 bg-success/5 border border-success/20 rounded-xl p-3">
                <Wallet className="h-4 w-4 text-success shrink-0" />
                <p className="text-sm text-success font-medium">
                  Ksh {(payConfig as any).rate_value ?? (payConfig as any).amount ?? '0'} will be added to your wallet on submit.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !summary.trim()}
              className="gap-2"
            >
              {submitMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                : <><CheckCircle className="h-4 w-4" /> Submit & Lock Report</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─────────────────────────────────────────────────
// WORKSHOP WORKER: Auto-fetch from wp_production_tasks
// ─────────────────────────────────────────────────
const WorkshopDailyReport = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date();

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
    enabled: !report,
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
    onError: (err) => toast({ variant: 'destructive', title: 'Error', description: (err as Error).message })
  });

  if (loadingTasks || loadingReport) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  const displayTasks = report ? report.tasks : (tasks || []);
  const distinctOrdersCount = new Set(displayTasks.map((t: any) => t.order_id)).size;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Daily Report</h2>
        <p className="text-sm text-muted-foreground">{format(today, 'PPPP')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <ListTodo className="h-6 w-6 text-primary mb-2" />
            <h4 className="text-2xl font-bold">{displayTasks.length}</h4>
            <p className="text-xs text-muted-foreground">Tasks Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <CheckCircle className="h-6 w-6 text-primary mb-2" />
            <h4 className="text-2xl font-bold">{distinctOrdersCount}</h4>
            <p className="text-xs text-muted-foreground">Orders Progressed</p>
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
                      <span className="font-medium text-sm">{task.product_type || 'Production Task'}</span>
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

// ─────────────────────────────────────────────────
// MAIN EXPORT: routes based on role
// ─────────────────────────────────────────────────
const DailyReportForm = () => {
  const { role } = useAuth();

  if (role === 'inventory_officer') {
    return <InventoryDailyReport />;
  }

  return <WorkshopDailyReport />;
};

export default DailyReportForm;
