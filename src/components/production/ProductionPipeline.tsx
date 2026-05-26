import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, Hammer, LayoutGrid, Wind, Palette, PaintBucket,
  Grip, GlassWater, Wrench, CheckCircle, User
} from 'lucide-react';
import { ReactNode } from 'react';

const STAGES: { value: string; label: string; icon: ReactNode; color: string }[] = [
  { value: 'frame_body', label: 'Frame/Body', icon: <Hammer className="h-4 w-4" />, color: 'bg-amber-500' },
  { value: 'sanding_paint', label: 'Sanding/Paint', icon: <PaintBucket className="h-4 w-4" />, color: 'bg-orange-500' },
  { value: 'cloth_lining', label: 'Cloth/Lining', icon: <Palette className="h-4 w-4" />, color: 'bg-emerald-500' },
  { value: 'glass_finish', label: 'Glass/Finish', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-blue-500' },
];

export { STAGES };

interface ProductionPipelineProps {
  onViewProduct: (id: string) => void;
}

const ProductionPipeline = ({ onViewProduct }: ProductionPipelineProps) => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['production-orders-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .eq('status', 'in_production')
        .order('started_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const { data: completedCount } = useQuery({
    queryKey: ['production-completed-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('production_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      if (error) throw error;
      return count || 0;
    },
  });

  const getOfficerName = (officerId: string | null) => {
    if (!officerId) return null;
    return profiles?.find(p => p.user_id === officerId)?.full_name || null;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const stageGroups = STAGES.map(stage => ({
    ...stage,
    orders: (orders || []).filter(o => o.current_stage === stage.value),
  }));

  const totalInProd = orders?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-card rounded-2xl border p-4">
        <div className="flex-1">
          <p className="text-2xl font-bold font-display text-foreground">{totalInProd}</p>
          <p className="text-xs text-muted-foreground">In Production</p>
        </div>
        <div className="flex-1 text-right">
          <p className="text-2xl font-bold font-display text-success">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
      </div>

      <div className="space-y-3">
        {stageGroups.map((stage) => (
          <div key={stage.value} className="bg-card rounded-2xl border overflow-hidden">
            <div className="flex items-center gap-3 p-3 border-b bg-secondary/30">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground", stage.color)}>
                {stage.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-foreground">{stage.label}</p>
              </div>
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full",
                stage.orders.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {stage.orders.length}
              </span>
            </div>

            {stage.orders.length > 0 && (
              <div className="p-2 space-y-1">
                {stage.orders.map((order) => {
                  const officerName = getOfficerName(order.assigned_officer_id);
                  return (
                    <button
                      key={order.id}
                      onClick={() => onViewProduct(order.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-accent transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{order.product_type}</p>
                          {order.product_code && (
                            <Badge variant="outline" className="text-[10px] font-mono shrink-0">{order.product_code}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {order.batch_number && (
                            <span className="text-xs text-muted-foreground">{order.batch_number}</span>
                          )}
                          {officerName && (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <User className="h-3 w-3" /> {officerName}
                            </span>
                          )}
                          {!officerName && (
                            <Badge variant="secondary" className="text-[10px]">Unassigned</Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-primary font-medium">View →</span>
                    </button>
                  );
                })}
              </div>
            )}

            {stage.orders.length === 0 && (
              <div className="p-3">
                <p className="text-xs text-muted-foreground text-center">No products at this stage</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductionPipeline;
