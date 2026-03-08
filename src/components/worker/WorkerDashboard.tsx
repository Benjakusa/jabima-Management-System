import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Factory, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DailyReportForm from './DailyReportForm';
import DailyReportReminder from './DailyReportReminder';

const STAGES = [
  'wood_cutting', 'frame_assembly', 'board_fitting', 'sanding', 'fabric_lining',
  'painting', 'handle_installation', 'glass_installation', 'final_assembly', 'quality_inspection',
] as const;

const formatStage = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const WorkerDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // My assigned stages
  const { data: assignments } = useQuery({
    queryKey: ['my-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stage_assignments').select('stage').eq('user_id', user!.id);
      return data?.map(a => a.stage) || [];
    },
    enabled: !!user,
  });

  // Orders at my stages
  const { data: myOrders, isLoading } = useQuery({
    queryKey: ['my-stage-orders', assignments],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      const { data } = await supabase.from('production_orders')
        .select('*')
        .in('current_stage', assignments)
        .eq('status', 'in_production')
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!assignments && assignments.length > 0,
  });

  // My stage logs (recent)
  const { data: myLogs } = useQuery({
    queryKey: ['my-stage-logs', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stage_logs')
        .select('*')
        .eq('worker_id', user!.id)
        .order('started_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  // Active log (started but not completed)
  const activeLog = myLogs?.find(l => !l.completed_at);

  const startMutation = useMutation({
    mutationFn: async (order: { id: string; current_stage: string }) => {
      const { error } = await supabase.from('stage_logs').insert({
        production_order_id: order.id,
        stage: order.current_stage as any,
        worker_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Stage started!' });
      queryClient.invalidateQueries({ queryKey: ['my-stage-logs'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const completeMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from('stage_logs').update({ completed_at: new Date().toISOString() }).eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Stage completed!' });
      queryClient.invalidateQueries({ queryKey: ['my-stage-logs'] });
      queryClient.invalidateQueries({ queryKey: ['my-stage-orders'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const completedToday = myLogs?.filter(l => l.completed_at && new Date(l.completed_at).toDateString() === new Date().toDateString()).length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Factory className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm">Workshop</h1>
            <p className="text-[10px] text-muted-foreground">{profile?.full_name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Daily report reminder */}
        <DailyReportReminder />
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border"><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">My Stages</p>
            <p className="text-xl font-bold font-display text-primary">{assignments?.length || 0}</p>
          </CardContent></Card>
          <Card className="border"><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold font-display text-warning">{myOrders?.length || 0}</p>
          </CardContent></Card>
          <Card className="border"><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Done Today</p>
            <p className="text-xl font-bold font-display text-success">{completedToday}</p>
          </CardContent></Card>
        </div>

        {/* Assigned stages */}
        <div>
          <h2 className="font-display font-semibold text-foreground mb-2 text-sm">My Assigned Stages</h2>
          <div className="flex flex-wrap gap-2">
            {(assignments || []).map(s => (
              <Badge key={s} variant="secondary" className="text-xs py-1 px-3">{formatStage(s)}</Badge>
            ))}
            {(!assignments || assignments.length === 0) && <p className="text-sm text-muted-foreground">No stages assigned yet</p>}
          </div>
        </div>

        {/* Active task */}
        {activeLog && (
          <div>
            <h2 className="font-display font-semibold text-foreground mb-2 text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" /> Active Task
            </h2>
            <Card className="border border-warning/30 bg-warning/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="text-warning border-warning/30 mb-1">{formatStage(activeLog.stage)}</Badge>
                    <p className="text-xs text-muted-foreground">Order: {activeLog.production_order_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">Started: {new Date(activeLog.started_at).toLocaleTimeString()}</p>
                  </div>
                  <Button size="sm" onClick={() => completeMutation.mutate(activeLog.id)} disabled={completeMutation.isPending}>
                    {completeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending orders at my stages */}
        <div>
          <h2 className="font-display font-semibold text-foreground mb-2 text-sm">Orders at My Stages</h2>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-16" />)}</div>
          ) : (!myOrders || myOrders.length === 0) ? (
            <Card className="border"><CardContent className="p-8 text-center">
              <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All caught up! No pending orders.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {myOrders.map(order => {
                const alreadyStarted = myLogs?.some(l => l.production_order_id === order.id && !l.completed_at);
                return (
                  <Card key={order.id} className="border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground text-sm">{order.product_type}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{formatStage(order.current_stage)}</Badge>
                          <span className="text-[10px] text-muted-foreground">ID: {order.id.slice(0, 8)}</span>
                        </div>
                      </div>
                      {!activeLog && !alreadyStarted && (
                        <Button size="sm" variant="outline" onClick={() => startMutation.mutate(order)} disabled={startMutation.isPending}>
                          {startMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Factory className="h-3 w-3" />}
                          Start
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily Report */}
        <DailyReportForm />

        {/* Recent completed */}
        <div>
          <h2 className="font-display font-semibold text-foreground mb-2 text-sm">Recent Activity</h2>
          <div className="space-y-1">
            {(myLogs || []).filter(l => l.completed_at).slice(0, 10).map(l => (
              <div key={l.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span className="text-foreground">{formatStage(l.stage)}</span>
                  <span className="text-[10px] text-muted-foreground">{l.production_order_id.slice(0, 8)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(l.completed_at!).toLocaleDateString()}</span>
              </div>
            ))}
            {(!myLogs || myLogs.filter(l => l.completed_at).length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No completed tasks yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;
