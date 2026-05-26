import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Factory, Activity, CheckCircle, Clock, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STAGES_DEF = [
    { num: 1, name: 'Frame/Body' },
    { num: 2, name: 'Sanding/Paint' },
    { num: 3, name: 'Cloth/Lining' },
    { num: 4, name: 'Glass/Finish' }
];

const WorkshopEmployerOverview = () => {
    const { data: liveOrders, isLoading } = useQuery({
        queryKey: ['admin-workshop-live'],
        queryFn: async () => {
            // Get all currently active production orders
            const { data: orders } = await supabase.from('production_orders')
                .select(`id, product_type, created_at, status`)
                .eq('status', 'in_production')
                .order('created_at', { ascending: false });

            if (!orders || orders.length === 0) return [];

            const orderIds = orders.map(o => o.id);

            // Fetch stages and tasks for these orders
            const [stagesRes, tasksRes] = await Promise.all([
                supabase.from('wp_production_stages' as any).select('*').in('order_id', orderIds),
                supabase.from('wp_production_tasks' as any)
                    .select('*')
                    .in('order_id', orderIds)
            ]);

            return orders.map(order => ({
                ...order,
                stages: stagesRes.data?.filter(s => s.order_id === order.id) || [],
                tasks: tasksRes.data?.filter(t => t.order_id === order.id) || []
            }));
        },
        refetchInterval: 30000 // Refetch every 30 seconds for live updates
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                    <Factory className="h-5 w-5 text-primary" /> Live Workshop Overview
                </h3>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <Activity className="h-3 w-3 mr-1 animate-pulse" /> Live Now
                </Badge>
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
                        // Count completed vs total to show progress
                        const stagesCount = order.stages.length > 0 ? order.stages.length : STAGES_DEF.length;
                        const completedCount = order.stages.filter((s: any) => s.status === 'Completed').length;
                        const progress = (completedCount / stagesCount) * 100;
                        const activeTasks = order.tasks.filter((t: any) => t.status === 'In Progress');

                        return (
                            <Card key={order.id} className="border shadow-sm overflow-hidden flex flex-col">
                                <CardHeader className="p-4 bg-muted/10 border-b pb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <CardTitle className="text-base truncate max-w-[200px]" title={order.product_type}>{order.product_type}</CardTitle>
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">Ref: {order.id.slice(0, 8).toUpperCase()}</p>
                                        </div>
                                        {activeTasks.length > 0 ? (
                                            <Badge variant="outline" className="bg-accent/40 text-primary border-primary/20 whitespace-nowrap">
                                                <Activity className="h-3 w-3 mr-1 animate-spin-slow" /> Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="whitespace-nowrap">
                                                <Clock className="h-3 w-3 mr-1" /> Idle
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Progress Bar Container */}
                                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                                        <div className="h-full bg-primary transition-all duration-500 ease-in-out" style={{ width: `${order.stages.length === 0 ? 0 : progress}%` }} />
                                    </div>
                                </CardHeader>

                                <CardContent className="p-4 flex-1 flex flex-col gap-3">
                                    {order.stages.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-2 text-muted-foreground">
                                            <AlertCircle className="h-6 w-6 mb-1 opacity-50" />
                                            <p className="text-xs">Stages not initialized</p>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1 h-full">
                                            {STAGES_DEF.map(def => {
                                                const stageData = order.stages.find((s: any) => s.stage_number === def.num);
                                                const isCompleted = stageData?.status === 'Completed';
                                                // Find if there is an active worker on this stage
                                                const stageTask = order.tasks.find((t: any) => t.stage_id === stageData?.id);
                                                const isWorking = stageTask?.status === 'In Progress';

                                                return (
                                                    <div key={def.num} className={cn(
                                                        "flex-1 flex flex-col items-center justify-center text-center p-2 rounded-lg border",
                                                        isCompleted ? "bg-success/5 border-success/20 text-success"
                                                            : isWorking ? "bg-primary/5 border-primary/30 shadow-[inset_0_0_10px_rgba(var(--primary),0.1)]"
                                                                : "bg-muted/10 border-transparent text-muted-foreground opacity-60"
                                                    )}>
                                                        <div className="text-[10px] uppercase font-semibold leading-tight line-clamp-2 h-7">{def.name}</div>
                                                        {isCompleted ? (
                                                            <CheckCircle className="h-4 w-4 mt-1.5 text-success" />
                                                        ) : isWorking ? (
                                                            <div className="mt-1.5 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center" title={stageTask?.assigned_officer?.full_name}>
                                                                <User className="h-3 w-3 text-primary" />
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                                        )}
                                                        {isWorking && (
                                                            <p className="text-[9px] mt-1 text-primary w-full truncate px-1">
                                                                Working...
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
