import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Factory, CheckCircle, Clock, Package, Settings } from 'lucide-react';
import { formatStage } from '@/lib/utils';

const WorkshopOverview = () => {
  const { user } = useAuth();

  const { data: assignments } = useQuery({
    queryKey: ['my-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stage_assignments').select('stage').eq('user_id', user!.id);
      return data?.map(a => a.stage) || [];
    },
    enabled: !!user,
  });

  const { data: myOrders } = useQuery({
    queryKey: ['my-stage-orders', assignments],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      const { data } = await supabase.from('production_orders')
        .select('*')
        .in('current_stage', assignments)
        .eq('status', 'in_production');
      return data || [];
    },
    enabled: !!assignments && assignments.length > 0,
  });

  const { data: myLogs } = useQuery({
    queryKey: ['my-stage-logs', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stage_logs')
        .select('*')
        .eq('worker_id', user!.id)
        .order('started_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ['my-pending-requests', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('material_requests')
        .select('id')
        .eq('worker_id', user!.id)
        .eq('status', 'pending');
      return data || [];
    },
    enabled: !!user,
  });

  const completedToday = myLogs?.filter(l => l.completed_at && new Date(l.completed_at).toDateString() === new Date().toDateString()).length || 0;
  const activeTask = myLogs?.find(l => !l.completed_at);

  const stats = [
    { label: 'Pending Tasks', value: myOrders?.length || 0, icon: Factory, color: 'text-warning' },
    { label: 'Done Today', value: completedToday, icon: CheckCircle, color: 'text-success' },
    { label: 'Material Requests', value: pendingRequests?.length || 0, icon: Package, color: 'text-primary' },
    { label: 'My Stages', value: assignments?.length || 0, icon: Clock, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Assigned stages */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-2 text-sm">My Assigned Stages</h3>
        <div className="flex flex-wrap gap-2">
          {(assignments || []).map(s => (
            <Badge key={s} variant="secondary" className="text-xs py-1 px-3">{formatStage(s)}</Badge>
          ))}
          {(!assignments || assignments.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Use the <span className="font-medium text-foreground">My Stages</span> tab below to choose your work areas
            </p>
          )}
        </div>
      </div>

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
