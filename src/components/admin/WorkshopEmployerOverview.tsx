import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Factory, Activity, CheckCircle, Clock, User, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// The 4 stages as stored by ProductionOrderDetail (integer 1-4)
const STAGE_DEFS = [
    { num: 1, label: 'Frame / Body', color: 'bg-amber-500' },
    { num: 2, label: 'Sanding / Paint', color: 'bg-orange-500' },
    { num: 3, label: 'Cloth / Lining', color: 'bg-emerald-500' },
    { num: 4, label: 'Glass / Finish', color: 'bg-blue-500' },
];

const WorkshopEmployerOverview = () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const queryClient = useQueryClient();

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['admin-workshop-live'] });
        queryClient.invalidateQueries({ queryKey: ['admin-workshop-completed-today'] });
        queryClient.invalidateQueries({ queryKey: ['admin-workshop-total-completed'] });
    };

    // Fetch all currently active production orders
    const { data: liveOrders, isLoading, isFetching } = useQuery({
        queryKey: ['admin-workshop-live'],
        queryFn: async () => {
            const { data: orders, error: ordersError } = await supabase
                .from('production_orders')
                .select('id, product_type, product_code, batch_number, current_stage, created_at, started_at, status')
                .eq('status', 'in_production')
                .order('started_at', { ascending: false });

            if (ordersError) throw ordersError;
            if (!orders || orders.length === 0) return [];

            const orderIds = orders.map(o => o.id);

            // Fetch active stage tasks (worker currently working — no completed_at yet)
            const { data: activeTasks } = await supabase
                .from('wp_production_tasks' as any)
                .select('id, order_id, stage_name, assigned_officer_id, started_at, status')
                .in('order_id', orderIds)
                .eq('status', 'In Progress');

            // Fetch worker profiles for active workers
            const activeWorkerIds = [...new Set((activeTasks || []).map((t: any) => t.assigned_officer_id).filter(Boolean))];
            let profiles: { user_id: string; full_name: string }[] = [];
            if (activeWorkerIds.length > 0) {
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('user_id, full_name')
                    .in('user_id', activeWorkerIds);
                profiles = prof || [];
            }

            return orders.map(order => {
                const orderTasks = (activeTasks || []).filter((t: any) => t.order_id === order.id);
                // current_stage stored as integer 1-4
                const stageNum = typeof order.current_stage === 'number'
                    ? order.current_stage
                    : parseInt(String(order.current_stage)) || 1;
                const stageIdx = stageNum - 1; // 0-based index
                const progress = Math.round((stageIdx / STAGE_DEFS.length) * 100);

                const activeWorkers = orderTasks.map((task: any) => {
                    const profile = profiles.find(p => p.user_id === task.assigned_officer_id);
                    return { name: profile?.full_name || 'Worker', stageName: task.stage_name };
                });

                return {
                    ...order,
                    stageIdx,
                    stageNum,
                    progress,
                    activeWorkers,
                    isActive: orderTasks.length > 0,
                };
            });
        },
        refetchInterval: 30000,
    });

    // Count of orders completed today
    const { data: completedTodayCount } = useQuery({
        queryKey: ['admin-workshop-completed-today', today],
        queryFn: async () => {
            const { count } = await supabase
                .from('production_orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed')
                .gte('completed_at', today);
            return count || 0;
        },
        refetchInterval: 30000,
    });

    // Total completed all time
    const { data: totalCompletedCount } = useQuery({
        queryKey: ['admin-workshop-total-completed'],
        queryFn: async () => {
            const { count } = await supabase
                .from('production_orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed');
            return count || 0;
        },
        refetchInterval: 60000,
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                <h3 className="font-display text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Factory className="h-5 w-5 text-primary" /> Live Workshop Overview
                </h3>
                <Card className="border animate-pulse h-40 bg-card rounded-2xl" />
            </div>
        );
    }

    const inProductionCount = liveOrders?.length || 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                    <Factory className="h-5 w-5 text-primary" /> Live Workshop Overview
                </h3>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                        <Activity className="h-3 w-3 mr-1 animate-pulse" /> Live Now
                    </Badge>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isFetching}
                        className="h-8 px-2"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Summary stats row */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="border">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold font-display text-foreground">{inProductionCount}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">In Production</p>
                    </CardContent>
                </Card>
                <Card className="border">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold font-display text-success">{completedTodayCount ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Done Today</p>
                    </CardContent>
                </Card>
                <Card className="border">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold font-display text-primary">{totalCompletedCount ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Total Done</p>
                    </CardContent>
                </Card>
            </div>

            {!liveOrders || liveOrders.length === 0 ? (
                <Card className="border border-dashed">
                    <CardContent className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground">
                        <CheckCircle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p>No active workshop production orders currently.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {liveOrders.map(order => {
                        const currentStageDef = STAGE_DEFS[order.stageIdx] || STAGE_DEFS[0];

                        return (
                            <Card key={order.id} className="border shadow-sm overflow-hidden flex flex-col">
                                <CardHeader className="p-4 bg-muted/10 border-b pb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <CardTitle className="text-base truncate max-w-[200px]" title={order.product_type}>
                                                {order.product_type}
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                                {order.product_code ? order.product_code : `Ref: ${order.id.slice(0, 8).toUpperCase()}`}
                                                {order.batch_number && ` · ${order.batch_number}`}
                                            </p>
                                        </div>
                                        {order.isActive ? (
                                            <Badge variant="outline" className="bg-accent/40 text-primary border-primary/20 whitespace-nowrap">
                                                <Activity className="h-3 w-3 mr-1" /> Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="whitespace-nowrap">
                                                <Clock className="h-3 w-3 mr-1" /> Idle
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Progress bar: based on current stage number */}
                                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                                        <div
                                            className="h-full bg-primary transition-all duration-500 ease-in-out"
                                            style={{ width: `${order.progress}%` }}
                                        />
                                    </div>
                                </CardHeader>

                                <CardContent className="p-4 flex-1 flex flex-col gap-3">
                                    {/* Stage indicator pills */}
                                    <div className="flex gap-1 h-full">
                                        {STAGE_DEFS.map((stage, i) => {
                                            const isPast = i < order.stageIdx;
                                            const isCurrent = i === order.stageIdx;
                                            return (
                                                <div
                                                    key={stage.num}
                                                    className={cn(
                                                        'flex-1 flex flex-col items-center justify-center text-center p-2 rounded-lg border',
                                                        isPast
                                                            ? 'bg-success/5 border-success/20 text-success'
                                                            : isCurrent
                                                                ? 'bg-primary/5 border-primary/30 shadow-[inset_0_0_10px_rgba(var(--primary),0.1)]'
                                                                : 'bg-muted/10 border-transparent text-muted-foreground opacity-60'
                                                    )}
                                                >
                                                    <div className="text-[10px] uppercase font-semibold leading-tight line-clamp-2 h-7">
                                                        {stage.label}
                                                    </div>
                                                    {isPast ? (
                                                        <CheckCircle className="h-4 w-4 mt-1.5 text-success" />
                                                    ) : isCurrent ? (
                                                        <div className="mt-1.5 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                                            <User className="h-3 w-3 text-primary" />
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                                    )}
                                                    {isCurrent && order.isActive && (
                                                        <p className="text-[9px] mt-1 text-primary w-full truncate px-1">
                                                            Working...
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Active workers on this order */}
                                    {order.activeWorkers.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                                            {order.activeWorkers.map((w: any, i: number) => (
                                                <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                                                    <User className="h-2.5 w-2.5" />
                                                    {w.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WorkshopEmployerOverview;
