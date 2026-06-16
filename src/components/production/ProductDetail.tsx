import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, User, Package, Calendar, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGES } from './ProductionPipeline';

interface Props {
  productId: string;
}

const ProductDetail = ({ productId }: Props) => {
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['production-order-detail', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: stageLogs } = useQuery({
    queryKey: ['stage-logs', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_logs')
        .select('*')
        .eq('production_order_id', productId)
        .order('started_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: materialUsage } = useQuery({
    queryKey: ['material-usage', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_material_usage')
        .select('*, inventory_materials(name, unit)')
        .eq('production_order_id', productId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: workerProfiles } = useQuery({
    queryKey: ['worker-profiles-detail'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const getWorkerName = (userId: string) =>
    workerProfiles?.find(p => p.user_id === userId)?.full_name || 'Unknown';

  if (orderLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-card rounded-2xl border p-12 text-center">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const isCompleted = order.status === 'completed';
  const currentStageIdx = STAGES.findIndex(s => s.value === order.current_stage);

  return (
    <div className="space-y-6">
      {/* Product Header */}
      <Card className={cn("border", isCompleted && "border-success/30 bg-success/5")}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">{order.product_type}</h3>
              {order.product_code && (
                <p className="text-sm font-mono text-primary font-medium">{order.product_code}</p>
              )}
              <p className="text-xs text-muted-foreground">ID: {order.id.slice(0, 8)}</p>
            </div>
            <span className={cn(
              "text-xs font-bold px-3 py-1 rounded-full",
              isCompleted ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
            )}>
              {isCompleted ? 'Completed' : 'In Production'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Started: {new Date(order.started_at).toLocaleDateString()}</span>
            </div>
            {order.expected_completion_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Due: {new Date(order.expected_completion_date).toLocaleDateString()}</span>
              </div>
            )}
            {order.completed_at && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                <span>Completed: {new Date(order.completed_at).toLocaleDateString()}</span>
              </div>
            )}
            {!isCompleted && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Current: {STAGES.find(s => s.value === order.current_stage)?.label}</span>
              </div>
            )}
            {order.batch_number && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Batch: {order.batch_number}</span>
              </div>
            )}
            {order.production_cost && order.production_cost > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Cost: Ksh {order.production_cost.toLocaleString()}</span>
              </div>
            )}
          </div>
          {order.notes && (
            <p className="text-xs text-muted-foreground mt-3 bg-accent/30 rounded-lg p-2">{order.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Stage Timeline */}
      <div>
        <h4 className="font-display font-semibold text-foreground mb-3">Production Timeline</h4>
        <div className="space-y-0">
          {STAGES.map((stage, idx) => {
            const log = stageLogs?.find(l => l.stage === stage.value);
            const isPast = isCompleted || idx < currentStageIdx;
            const isCurrent = !isCompleted && idx === currentStageIdx;
            const isFuture = !isCompleted && idx > currentStageIdx;

            return (
              <div key={stage.value}>
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-colors",
                  isCurrent && "bg-primary/5 border border-primary/20",
                  isPast && "opacity-90",
                  isFuture && "opacity-40"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isPast ? stage.color + " text-primary-foreground" :
                    isCurrent ? "bg-primary text-primary-foreground" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {isPast ? <CheckCircle className="h-4 w-4" /> : stage.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", isFuture ? "text-muted-foreground" : "text-foreground")}>
                      {stage.label}
                    </p>
                    {log && (
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getWorkerName(log.worker_id)}
                        </span>
                        <span>{new Date(log.started_at).toLocaleDateString()}</span>
                        {log.completed_at && (
                          <span>→ {new Date(log.completed_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                    {isCurrent && !log && (
                      <p className="text-xs text-primary">Currently at this stage</p>
                    )}
                  </div>
                  {isPast && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                  {isCurrent && <Clock className="h-4 w-4 text-primary shrink-0 animate-pulse" />}
                </div>
                {idx < STAGES.length - 1 && (
                  <div className="ml-[22px] w-px h-2 bg-border" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Materials Used */}
      {materialUsage && materialUsage.length > 0 && (
        <div>
          <h4 className="font-display font-semibold text-foreground mb-3">Materials Used</h4>
          <div className="space-y-2">
            {materialUsage.map((mu) => (
              <Card key={mu.id} className="border">
                <CardContent className="p-3 flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(mu as any).inventory_materials?.name || 'Unknown material'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mu.quantity_used} {(mu as any).inventory_materials?.unit || 'units'}
                      {mu.stage && ` • ${STAGES.find(s => s.value === mu.stage)?.label}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Stage Logs */}
      {stageLogs && stageLogs.length > 0 && (
        <div>
          <h4 className="font-display font-semibold text-foreground mb-3">Work Logs</h4>
          <div className="space-y-2">
            {stageLogs.map((log) => (
              <Card key={log.id} className="border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {STAGES.find(s => s.value === log.stage)?.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getWorkerName(log.worker_id)} • {new Date(log.started_at).toLocaleString()}
                      </p>
                    </div>
                    {log.completed_at ? (
                      <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">Done</span>
                    ) : (
                      <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">In Progress</span>
                    )}
                  </div>
                  {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
