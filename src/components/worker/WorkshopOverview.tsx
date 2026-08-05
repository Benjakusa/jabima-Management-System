import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Factory, CheckCircle, Clock, Package, RefreshCw, DollarSign } from 'lucide-react';
import { formatStage, formatCurrency } from '@/lib/utils';

const WorkshopOverview = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-stages-completed-today', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['my-stage-logs', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['my-pending-requests', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['my-earnings-today', user?.id] });
  };



  // Dedicated query: stages completed by this worker today (fetched directly from DB)
  const { data: stagesCompletedToday } = useQuery({
    queryKey: ['my-stages-completed-today', user?.id],
    queryFn: async () => {
      // Use start of today in UTC to avoid timezone issues
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('stage_logs')
        .select('id')
        .eq('worker_id', user!.id)
        .eq('work_status', 'completed')
        .gte('completed_at', todayStart.toISOString());
      if (error) throw error;
      return data?.length || 0;
    },
    enabled: !!user,
  });

  const { data: myLogs } = useQuery({
    queryKey: ['my-stage-logs', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('stage_logs')
        .select('*')
        .eq('worker_id', user!.id)
        .gte('started_at', today)
        .order('started_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ['my-pending-requests', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('material_requests')
        .select('id')
        .eq('worker_id', user!.id)
        .eq('status', 'pending')
        .gte('created_at', today);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: earningsToday } = useQuery({
    queryKey: ['my-earnings-today', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('wallet_transactions')
        .select('amount, wallets!inner(user_id)')
        .eq('wallets.user_id', user!.id)
        .eq('type', 'earned')
        .gte('created_at', today);
      if (error) throw error;
      return data?.reduce((sum, t) => sum + t.amount, 0) || 0;
    },
    enabled: !!user,
  });

  const activeTask = myLogs?.find(l => !l.completed_at);

  const stats = [
    { label: 'Total Stages Completed', value: stagesCompletedToday ?? 0, icon: CheckCircle, color: 'text-success' },
    { label: 'Total Earnings', value: formatCurrency(earningsToday || 0), icon: DollarSign, color: 'text-primary' },
    { label: 'Material Requests', value: pendingRequests?.length || 0, icon: Package, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Workshop Overview</h2>
          <p className="text-xs text-muted-foreground">Your live task summary</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold font-display text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active task indicator */}
      {activeTask && (
        <Card className="border border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-warning animate-pulse" />
              <span className="text-sm font-medium text-foreground">Active Task</span>
            </div>
            <Badge variant="outline" className="text-warning border-warning/30">{formatStage(activeTask.stage)}</Badge>
            <p className="text-xs text-muted-foreground mt-1">Started: {new Date(activeTask.started_at).toLocaleTimeString()}</p>
          </CardContent>
        </Card>
      )}



      {/* Production timeline (recent activity) */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-2 text-sm">Recent Activity</h3>
        <div className="space-y-1">
          {(myLogs || []).filter(l => l.completed_at).slice(0, 8).map(l => (
            <div key={l.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-success" />
                <span className="text-foreground">{formatStage(l.stage)}</span>
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
  );
};

export default WorkshopOverview;
