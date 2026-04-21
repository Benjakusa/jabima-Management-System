import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Factory, CheckCircle, Clock, Loader2, Package, Plus, X, Hand, ChevronDown, ChevronRight, Circle, Play } from 'lucide-react';
import { cn, formatStage } from '@/lib/utils';
import { STAGES } from '@/components/production/ProductionPipeline';

const statusOptions = [
  { value: 'started', label: 'Started', icon: Play, color: 'bg-blue-500' },
  { value: 'midway', label: 'Midway', icon: Circle, color: 'bg-warning' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-success' },
];

const WorkshopTasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [materialForm, setMaterialForm] = useState<{ orderId: string; stage: string } | null>(null);
  const [materialId, setMaterialId] = useState('');
  const [materialQty, setMaterialQty] = useState('');

  const { data: mySelectedStages } = useQuery({
    queryKey: ['my-stage-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('stage_assignments')
        .select('stage')
        .eq('user_id', user!.id);
      return data?.map(a => a.stage) || [];
    },
    enabled: !!user,
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

  const { data: allOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['all-production-orders'],
    queryFn: async () => {
      const { data } = await supabase.from('production_orders')
        .select('*')
        .eq('status', 'in_production')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: materials } = useQuery({
    queryKey: ['available-materials'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_materials').select('id, name, unit, quantity');
      return data || [];
    },
  });

  const { data: myMaterialUsage } = useQuery({
    queryKey: ['my-material-usage', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('product_material_usage')
        .select('*, inventory_materials(name, unit)')
        .eq('worker_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!user,
  });

  const activeLog = myLogs?.find(l => !l.completed_at && l.work_status !== 'completed');

  const getOrderBatch = (orderId: string) => {
    const order = allOrders?.find(o => o.id === orderId);
    return order?.batch_number || 'No Batch';
  };

  const getOrderProduct = (orderId: string) => {
    const order = allOrders?.find(o => o.id === orderId);
    return order?.product_type || 'Unknown';
  };

  const toggleBatch = (batchNumber: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchNumber)) {
        next.delete(batchNumber);
      } else {
        next.add(batchNumber);
      }
      return next;
    });
  };

  const groupedByBatch = allOrders?.reduce((acc, order) => {
    const batch = order.batch_number || 'No Batch';
    if (!acc[batch]) acc[batch] = [];
    acc[batch].push(order);
    return acc;
  }, {} as Record<string, typeof allOrders>) || {};

  const availableTasks = allOrders?.filter(order => {
    if (!mySelectedStages?.includes(order.current_stage)) return false;
    const hasActiveLog = myLogs?.some(l => l.production_order_id === order.id && l.stage === order.current_stage && !l.completed_at && l.work_status !== 'completed');
    if (hasActiveLog) return false;
    return true;
  }) || [];

  const pickTaskMutation = useMutation({
    mutationFn: async (order: { id: string; current_stage: string }) => {
      const { error } = await supabase.from('stage_logs').insert({
        production_order_id: order.id,
        stage: order.current_stage as any,
        worker_id: user!.id,
        work_status: 'started',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Task picked! Start working on it now.' });
      queryClient.invalidateQueries({ queryKey: ['my-stage-logs'] });
      queryClient.invalidateQueries({ queryKey: ['all-production-orders'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ logId, newStatus }: { logId: string; newStatus: string }) => {
      const updateData: any = { work_status: newStatus };
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('stage_logs').update(updateData).eq('id', logId);
      if (error) throw error;
      
      if (newStatus === 'completed') {
        const log = myLogs?.find(l => l.id === logId);
        if (log) {
          const { error: advanceError } = await supabase.rpc('advance_production_stage', {
            _order_id: log.production_order_id,
            _current_stage: log.stage as any,
            _worker_id: user!.id,
          });
          if (advanceError) throw advanceError;
        }
      }
    },
    onSuccess: (_, { newStatus }) => {
      if (newStatus === 'completed') {
        toast({ title: 'Stage completed!' });
      } else {
        toast({ title: `Status updated to ${newStatus}` });
      }
      queryClient.invalidateQueries({ queryKey: ['my-stage-logs'] });
      queryClient.invalidateQueries({ queryKey: ['all-production-orders'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const materialMutation = useMutation({
    mutationFn: async () => {
      if (!materialForm || !materialId || !materialQty) throw new Error('Fill all fields');
      const qty = parseFloat(materialQty);
      if (qty <= 0) throw new Error('Quantity must be positive');
      const { error } = await supabase.from('product_material_usage').insert({
        production_order_id: materialForm.orderId,
        stage: materialForm.stage as any,
        material_id: materialId,
        quantity_used: qty,
        worker_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Material usage recorded!' });
      setMaterialForm(null);
      setMaterialId('');
      setMaterialQty('');
      queryClient.invalidateQueries({ queryKey: ['my-material-usage'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const getStageInfo = (stageValue: string) => STAGES.find(s => s.value === stageValue);

  const getStatusInfo = (status: string) => statusOptions.find(s => s.value === status) || statusOptions[0];

  return (
    <div className="space-y-6">
      {/* My active task */}
      {activeLog && (
        <div>
          <h2 className="font-display font-semibold text-foreground mb-2 text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" /> My Active Task
          </h2>
          <Card className="border border-warning/30 bg-warning/5">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px] font-mono">{getOrderBatch(activeLog.production_order_id)}</Badge>
                    <Badge variant="outline" className="text-warning border-warning/30">{formatStage(activeLog.stage)}</Badge>
                  </div>
                  <p className="text-sm text-foreground">{getOrderProduct(activeLog.production_order_id)}</p>
                  <p className="text-xs text-muted-foreground">Started: {new Date(activeLog.started_at).toLocaleTimeString()}</p>
                </div>
              </div>

              {/* Status selector */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Update Status:</Label>
                <div className="flex gap-2">
                  {statusOptions.map(opt => {
                    const StatusIcon = opt.icon;
                    const isActive = activeLog.work_status === opt.value;
                    return (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className={cn("flex-1 gap-1", !isActive && "border-dashed")}
                        onClick={() => updateStatusMutation.mutate({ logId: activeLog.id, newStatus: opt.value })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Material logging */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setMaterialForm({ orderId: activeLog.production_order_id, stage: activeLog.stage })}>
                  <Package className="h-3 w-3 mr-1" /> Log Material
                </Button>
              </div>

              {/* Materials used */}
              {myMaterialUsage && myMaterialUsage.filter(m => m.production_order_id === activeLog.production_order_id && m.stage === activeLog.stage).length > 0 && (
                <div className="border-t border-warning/20 pt-2">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">Materials Used:</p>
                  <div className="flex flex-wrap gap-1">
                    {myMaterialUsage.filter(m => m.production_order_id === activeLog.production_order_id && m.stage === activeLog.stage).map(m => (
                      <Badge key={m.id} variant="secondary" className="text-[10px]">
                        {(m as any).inventory_materials?.name}: {m.quantity_used} {(m as any).inventory_materials?.unit}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Material logging form */}
      {materialForm && (
        <Card className="border border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Log Material Usage
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMaterialForm(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Order: {materialForm.orderId.slice(0, 8)} • Stage: {formatStage(materialForm.stage)}
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Material</Label>
              <select value={materialId} onChange={e => setMaterialId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select material...</option>
                {(materials || []).map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.quantity} {m.unit} available)</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Quantity Used</Label>
              <Input type="number" min="0.01" step="0.01" value={materialQty} onChange={e => setMaterialQty(e.target.value)} placeholder="0" />
            </div>
            <Button size="sm" className="w-full" onClick={() => materialMutation.mutate()} disabled={materialMutation.isPending || !materialId || !materialQty}>
              {materialMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Record Usage
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Available tasks by batch */}
      <div>
        <h2 className="font-display font-semibold text-foreground mb-2 text-sm flex items-center gap-2">
          <Factory className="h-4 w-4" /> Available Tasks ({availableTasks.length})
        </h2>
        
        {!mySelectedStages || mySelectedStages.length === 0 ? (
          <Card className="border">
            <CardContent className="p-6 text-center">
              <Factory className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select your stages first in "My Stages" tab to see available tasks.</p>
            </CardContent>
          </Card>
        ) : loadingOrders ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
        ) : Object.keys(groupedByBatch).length === 0 ? (
          <Card className="border border-primary/20 bg-primary/5"><CardContent className="p-6 text-center">
            <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tasks available right now.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedByBatch).map(([batchNumber, orders]) => {
              const batchTasks = orders.filter(o => mySelectedStages?.includes(o.current_stage));
              const isExpanded = expandedBatches.has(batchNumber);
              
              if (batchTasks.length === 0) return null;
              
              return (
                <Card key={batchNumber} className="border">
                  <button
                    onClick={() => toggleBatch(batchNumber)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <p className="font-medium text-foreground">{batchNumber}</p>
                        <p className="text-xs text-muted-foreground">{batchTasks.length} task{batchTasks.length !== 1 ? 's' : ''} at your stages</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{batchTasks.length} available</Badge>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t p-3 space-y-2">
                      {batchTasks.map(order => {
                        const hasActiveLog = myLogs?.some(l => l.production_order_id === order.id && l.stage === order.current_stage && !l.completed_at && l.work_status !== 'completed');
                        const stageInfo = getStageInfo(order.current_stage);
                        
                        return (
                          <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground", stageInfo?.color || 'bg-muted')}>
                                {stageInfo?.icon || <Factory className="h-4 w-4" />}
                              </div>
                              <div>
                                <p className="text-sm text-foreground">{order.product_type}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="secondary" className="text-[10px] font-mono">{batchNumber}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{formatStage(order.current_stage)}</Badge>
                                </div>
                              </div>
                            </div>
                            {!hasActiveLog && !activeLog && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => pickTaskMutation.mutate(order)}
                                disabled={pickTaskMutation.isPending}
                              >
                                <Hand className="h-3 w-3 mr-1" /> Pick
                              </Button>
                            )}
                            {hasActiveLog && (
                              <Badge variant="default" className="text-[10px]">In Progress</Badge>
                            )}
                            {!hasActiveLog && activeLog && (
                              <Badge variant="secondary" className="text-[10px]">Busy</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* My selected stages info */}
      {mySelectedStages && mySelectedStages.length > 0 && (
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground mb-2">My selected stages:</p>
          <div className="flex flex-wrap gap-1">
            {mySelectedStages.map(stage => {
              const stageInfo = getStageInfo(stage);
              return (
                <Badge key={stage} variant="outline" className="text-[10px] flex items-center gap-1">
                  <span className={cn("w-2 h-2 rounded-full", stageInfo?.color?.replace('bg-', ''))} />
                  {stageInfo?.label || stage}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkshopTasks;
