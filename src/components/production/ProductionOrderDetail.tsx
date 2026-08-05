import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, Lock, Unlock, Play, ListChecks, RotateCcw, User, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductionOrderDetailProps {
    orderId: string;
    onBack: () => void;
}

const STAGES_DEF = [
    { num: 1, name: 'Frame and body assembly' },
    { num: 2, name: 'Sanding and painting' },
    { num: 3, name: 'Cloth lining and final assembly' },
    { num: 4, name: 'Glass fitting' }
];

const ProductionOrderDetail = ({ orderId, onBack }: ProductionOrderDetailProps) => {
    const { user, role } = useAuth();
    const isAdminOrOfficer = role === 'admin' || role === 'inventory_officer';
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: order } = useQuery({
        queryKey: ['production_orders', orderId],
        queryFn: async () => {
            const { data, error } = await supabase.from('production_orders').select('*').eq('id', orderId).single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
    });

    const { data: stages, refetch: refetchStages } = useQuery({
        queryKey: ['wp_production_stages', orderId],
        queryFn: async () => {
            const { data, error } = await supabase.from('wp_production_stages').select('*').eq('order_id', orderId).order('stage_number', { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    const { data: tasks } = useQuery({
        queryKey: ['wp_production_tasks', orderId],
        queryFn: async () => {
            const { data, error } = await supabase.from('wp_production_tasks' as any)
                .select('*, assigned_officer:profiles(*)')
                .eq('order_id', orderId);
            if (error) throw error;
            return data || [];
        },
    });

    const { data: workers } = useQuery({
        queryKey: ['workshop-workers'],
        enabled: isAdminOrOfficer,
        queryFn: async () => {
            const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'workshop_worker');
            if (!roles?.length) return [];
            const userIds = roles.map(r => r.user_id);
            const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
            return profiles || [];
        }
    });

    const reassignMutation = useMutation({
        mutationFn: async ({ taskId, newUserId }: { taskId: string; newUserId: string }) => {
            const { error } = await supabase.from('wp_production_tasks').update({ assigned_officer_id: newUserId }).eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wp_production_tasks', orderId] });
            toast({ title: 'Worker reassigned successfully' });
        }
    });

    useEffect(() => {
        if (stages && stages.length === 0) {
            seedStagesMutation.mutate();
        }
    }, [stages]);

    const seedStagesMutation = useMutation({
        mutationFn: async () => {
            const stageInserts = STAGES_DEF.map(s => ({
                order_id: orderId,
                stage_number: s.num,
                stage_name: s.name,
                // All unlocked initially based on new requirements
                status: 'Unlocked'
            }));
            const { error } = await supabase.from('wp_production_stages').insert(stageInserts);
            if (error) throw error;
        },
        onSuccess: () => refetchStages(),
        onError: (err) => toast({ variant: 'destructive', title: 'Failed to create stages', description: 'Make sure you ran the SQL fix script (20260526000002_fix_rls_tasks.sql).' })
    });

    const startStageMutation = useMutation({
        mutationFn: async ({ stageId, stageName }: { stageId: string, stageName: string }) => {
            const { error } = await supabase.from('wp_production_tasks' as any).insert({
                stage_id: stageId,
                order_id: orderId,
                task_name: stageName,
                assigned_officer_id: user?.id,
                status: 'In Progress',
                started_at: new Date().toISOString(),
                product_type: order?.product_type || 'Unknown',
                stage_name: stageName
            });
            if (error) throw error;

            // Update order status if it's the first stage started
            if (order?.status !== 'in_production') {
                await supabase.from('production_orders').update({ status: 'in_production' }).eq('id', orderId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wp_production_tasks', orderId] });
            queryClient.invalidateQueries({ queryKey: ['production_orders', orderId] });
            toast({ title: 'Stage started successfully' });
        }
    });

    const completeStageMutation = useMutation({
        mutationFn: async ({ stageId, stageNum }: { stageId: string, stageNum: number }) => {
            // 1. Mark active tasks completed
            await supabase.from('wp_production_tasks')
                .update({ status: 'Completed', completed_at: new Date().toISOString() })
                .eq('stage_id', stageId)
                .eq('status', 'In Progress');

            // 2. Mark stage completed
            const { error: err1 } = await supabase.from('wp_production_stages')
                .update({ status: 'Completed', completed_at: new Date().toISOString() })
                .eq('id', stageId);
            if (err1) throw err1;

            // 3. Check if all stages for this order are completed
            const { data: allStages } = await supabase.from('wp_production_stages').select('status').eq('order_id', orderId);
            const allCompleted = allStages?.every(s => s.status === 'Completed' || (s.id === stageId)) || false;

            if (allCompleted) {
                await supabase.from('production_orders')
                    .update({ status: 'completed', current_stage: 4, completed_at: new Date().toISOString() }) // Final stage
                    .eq('id', orderId);

                const { data: order } = await supabase.from('production_orders').select('*').eq('id', orderId).single();
                if (order) {
                    await supabase.from('finished_products').insert({
                        production_order_id: orderId,
                        product_type: order.product_type,
                        production_cost: order.production_cost || 0,
                    });
                }
            } else {
                // Increment current stage in the order
                await supabase.from('production_orders')
                    .update({ current_stage: stageNum + 1 })
                    .eq('id', orderId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wp_production_stages', orderId] });
            queryClient.invalidateQueries({ queryKey: ['wp_production_tasks', orderId] });
            queryClient.invalidateQueries({ queryKey: ['production_orders', orderId] });
            queryClient.invalidateQueries({ queryKey: ['my-stages-completed-today', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['my-earnings-today', user?.id] });
            toast({ title: 'Stage marked as completed' });
        }
    });

    const getStageTasks = (stageId: string) => tasks?.filter(t => t.stage_id === stageId) || [];

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Queue
                </Button>
                <div className="h-4 w-[1px] bg-muted/40 mx-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        localStorage.removeItem('selected_production_order_id');
                        window.location.reload();
                    }}
                    className="text-primary hover:text-primary hover:bg-primary/5"
                >
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Workshop Overview
                </Button>
            </div>

            {order && (
                <div className="bg-card border rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-xl font-bold text-foreground">{order.product_type}</h2>
                            <p className="text-sm text-muted-foreground font-mono">Ref: {order.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <Badge variant={order.status === 'completed' ? 'default' : 'secondary'} className={order.status === 'completed' ? 'bg-success' : ''}>
                            {order.status === 'completed' ? 'Completed' : 'In Progress'}
                        </Badge>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-primary" />
                        Production Stages
                    </h3>
                    {stages?.length === 0 && (
                        <Button size="sm" variant="secondary" onClick={() => seedStagesMutation.mutate()}>
                            <RotateCcw className="h-4 w-4 mr-1" /> Initialize Stages
                        </Button>
                    )}
                </div>

                {(stages as any[] || []).map((stage) => {
                    const stageTasks = tasks?.filter((t: any) => t.stage_id === stage.id) || [];
                    const isCompleted = stage.status === 'Completed';

                    const previousStage = (stages as any[] || []).find((s: any) => s.stage_number === stage.stage_number - 1);
                    const isPreviousStageCompleted = !previousStage || previousStage.status === 'Completed';

                    // Determine if someone is actively working or has completed it
                    const myActiveTask = stageTasks.find((t: any) => t.assigned_officer_id === user?.id && t.status === 'In Progress');
                    const otherWorkerTask = stageTasks.find((t: any) => t.assigned_officer_id !== user?.id && t.status === 'In Progress');

                    const isTaken = !!myActiveTask || !!otherWorkerTask;
                    const workerTask = myActiveTask || otherWorkerTask || stageTasks[0];

                    // Locked if previous stage not completed OR taken by another worker
                    const isLocked = (!isPreviousStageCompleted) || (!!otherWorkerTask && !myActiveTask && !isCompleted);
                    const isUnlocked = isPreviousStageCompleted && !isTaken && !isCompleted;

                    return (
                        <Card key={stage.id} className={cn("overflow-hidden transition-all", isLocked && "opacity-60 bg-muted/30")}>
                            <CardHeader className="p-4 bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-3">
                                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                                        isCompleted ? "bg-success text-success-foreground" :
                                            isUnlocked ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                                    )}>
                                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : stage.stage_number}
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">{stage.stage_name}</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isCompleted ? `Completed ${stage.completed_at ? format(new Date(stage.completed_at), 'MMM d, HH:mm') : ''}` :
                                                isLocked ? (!isPreviousStageCompleted ? 'Waiting for previous stage' : 'Locked by another worker') : 'Available for Selection'}
                                        </p>
                                    </div>
                                </div>
                                {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                                {isUnlocked && <Unlock className="h-4 w-4 text-primary" />}
                            </CardHeader>

                            {(!isLocked || myActiveTask || (isAdminOrOfficer && isPreviousStageCompleted) || (isAdminOrOfficer && isTaken)) && !isCompleted && (
                                <CardContent className="p-4 bg-card">
                                    {workerTask && (
                                        <div className="mb-4 space-y-2">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase">Assigned To</p>
                                            <div className="flex items-center gap-2 text-sm bg-accent/30 rounded-lg p-2 border">
                                                <User className="h-4 w-4 text-primary" />
                                                {isAdminOrOfficer ? (
                                                    <select
                                                        className="bg-transparent font-medium outline-none cursor-pointer flex-1"
                                                        value={workerTask.assigned_officer_id}
                                                        onChange={(e) => reassignMutation.mutate({ taskId: workerTask.id, newUserId: e.target.value })}
                                                        disabled={reassignMutation.isPending}
                                                    >
                                                        <option value={workerTask.assigned_officer_id}>{workerTask.assigned_officer?.full_name || 'Unknown Officer'}</option>
                                                        {(workers || []).map(w => (
                                                            w.user_id !== workerTask.assigned_officer_id && <option key={w.user_id} value={w.user_id}>{w.full_name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="font-medium">{workerTask.assigned_officer?.full_name?.split(' ')[0] || 'Unknown Officer'}</span>
                                                )}
                                                <span className="text-xs text-muted-foreground ml-auto">
                                                    Started {workerTask.started_at ? format(new Date(workerTask.started_at), 'HH:mm') : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        {!isTaken ? (
                                            <Button
                                                variant="outline"
                                                onClick={() => startStageMutation.mutate({ stageId: stage.id, stageName: stage.stage_name })}
                                                disabled={startStageMutation.isPending}
                                                className="flex-1 border-dashed border-2 hover:border-primary hover:bg-primary/5 hover:text-primary"
                                            >
                                                <Play className="h-4 w-4 mr-2" />
                                                Select and Start Stage {stage.stage_number}
                                            </Button>
                                        ) : (myActiveTask || isAdminOrOfficer) && (
                                            <Button
                                                onClick={() => completeStageMutation.mutate({ stageId: stage.id, stageNum: stage.stage_number })}
                                                disabled={completeStageMutation.isPending}
                                                className="flex-1 bg-success hover:bg-success/90 text-white shadow-md"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Finish Stage {stage.stage_number} and Save
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default ProductionOrderDetail;
