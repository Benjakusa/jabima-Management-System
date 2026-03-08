import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const conditionOptions = [
  { value: 'new', label: 'New (Restock)', color: 'bg-success/10 text-success' },
  { value: 'used', label: 'Used (Restock)', color: 'bg-primary/10 text-primary' },
  { value: 'damaged', label: 'Damaged (Discard)', color: 'bg-destructive/10 text-destructive' },
];

const InventoryReturnProcessing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [inspectCondition, setInspectCondition] = useState<Record<string, string>>({});

  const { data: returns, isLoading } = useQuery({
    queryKey: ['material-returns-officer', filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_returns')
        .select('*, inventory_materials(name, unit, quantity), production_orders(product_type, product_code)')
        .eq('status', filter)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: workerProfiles } = useQuery({
    queryKey: ['worker-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const getWorkerName = (id: string) => workerProfiles?.find(p => p.user_id === id)?.full_name || 'Unknown';

  const acceptMutation = useMutation({
    mutationFn: async ({ id, materialId, qty, condition }: { id: string; materialId: string; qty: number; condition: string }) => {
      const { error } = await supabase
        .from('material_returns')
        .update({ status: 'accepted', inspected_by: user!.id, inspected_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      // Restock if not damaged
      if (condition !== 'damaged') {
        const { data: mat } = await supabase.from('inventory_materials').select('quantity').eq('id', materialId).single();
        if (mat) {
          await supabase.from('inventory_materials').update({ quantity: mat.quantity + qty }).eq('id', materialId);
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Return accepted & inspected' });
      queryClient.invalidateQueries({ queryKey: ['material-returns-officer'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-materials'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_returns')
        .update({ status: 'rejected', inspected_by: user!.id, inspected_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Return rejected' });
      queryClient.invalidateQueries({ queryKey: ['material-returns-officer'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const reasonLabels: Record<string, string> = {
    excess: 'Excess Material',
    damaged: 'Damaged',
    wrong_size: 'Wrong Size',
    quality_issue: 'Quality Issue',
  };

  const filters = [
    { key: 'pending' as const, label: 'Pending', icon: Clock },
    { key: 'accepted' as const, label: 'Accepted', icon: CheckCircle },
    { key: 'rejected' as const, label: 'Rejected', icon: XCircle },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
              filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-accent"
            )}>
            <f.icon className="h-4 w-4" />
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-28" />)}
        </div>
      ) : (returns || []).length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <RotateCcw className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No {filter} returns</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(returns || []).map((ret: any) => {
            const material = ret.inventory_materials;
            const order = ret.production_orders;
            const selectedCondition = inspectCondition[ret.id] || 'used';

            return (
              <Card key={ret.id} className="border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{material?.name || 'Unknown'}</p>
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        <p>Order: {order?.product_code || order?.product_type || '—'}</p>
                        <p>Returned by: {getWorkerName(ret.worker_id)}</p>
                        <p>Qty: <span className="font-semibold text-foreground">{ret.quantity_returned} {material?.unit}</span></p>
                        <p>Reason: <span className="font-medium">{reasonLabels[ret.reason] || ret.reason}</span></p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(ret.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {filter === 'pending' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Inspect Condition:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {conditionOptions.map(c => (
                          <button key={c.value} onClick={() => setInspectCondition(s => ({ ...s, [ret.id]: c.value }))}
                            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                              selectedCondition === c.value ? "bg-primary text-primary-foreground border-primary" : cn("border-border", c.color)
                            )}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => acceptMutation.mutate({ id: ret.id, materialId: ret.material_id, qty: ret.quantity_returned, condition: selectedCondition })}
                          disabled={acceptMutation.isPending} className="gap-1">
                          {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          Accept & {selectedCondition === 'damaged' ? 'Discard' : 'Restock'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(ret.id)}
                          disabled={rejectMutation.isPending}
                          className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5">
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
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

export default InventoryReturnProcessing;
