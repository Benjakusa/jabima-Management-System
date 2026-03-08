import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, Package, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const InventoryRequestProcessing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'fulfilled' | 'rejected'>('pending');
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [partialQty, setPartialQty] = useState<Record<string, string>>({});

  const { data: requests, isLoading } = useQuery({
    queryKey: ['material-requests-officer', filter],
    queryFn: async () => {
      const q = supabase
        .from('material_requests')
        .select('*, inventory_materials(name, unit, quantity), production_orders(product_type, product_code)')
        .eq('status', filter)
        .order('created_at', { ascending: false });
      const { data, error } = await q;
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

  const fulfillMutation = useMutation({
    mutationFn: async ({ id, materialId, qty }: { id: string; materialId: string; qty: number }) => {
      // Update request status
      const { error: reqErr } = await supabase
        .from('material_requests')
        .update({ status: 'fulfilled', fulfilled_by: user!.id, fulfilled_at: new Date().toISOString() })
        .eq('id', id);
      if (reqErr) throw reqErr;

      // Deduct from inventory
      const { data: mat } = await supabase.from('inventory_materials').select('quantity').eq('id', materialId).single();
      if (mat) {
        const newQty = Math.max(0, mat.quantity - qty);
        await supabase.from('inventory_materials').update({ quantity: newQty }).eq('id', materialId);
      }
    },
    onSuccess: () => {
      toast({ title: 'Request fulfilled' });
      queryClient.invalidateQueries({ queryKey: ['material-requests-officer'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-materials'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('material_requests')
        .update({ status: 'rejected', notes: notes || 'Rejected by inventory officer' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Request rejected' });
      queryClient.invalidateQueries({ queryKey: ['material-requests-officer'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const priorityColor: Record<string, string> = {
    emergency: 'bg-destructive/10 text-destructive',
    urgent: 'bg-warning/10 text-warning',
    normal: 'bg-secondary text-muted-foreground',
  };

  const filters = [
    { key: 'pending' as const, label: 'Pending', icon: Clock },
    { key: 'fulfilled' as const, label: 'Fulfilled', icon: CheckCircle },
    { key: 'rejected' as const, label: 'Rejected', icon: XCircle },
  ];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
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
      ) : (requests || []).length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No {filter} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(requests || []).map((req: any) => {
            const material = req.inventory_materials;
            const order = req.production_orders;
            const availableStock = material?.quantity ?? 0;
            const canFulfill = availableStock >= req.quantity_requested;
            const pQty = parseFloat(partialQty[req.id] || '') || req.quantity_requested;

            return (
              <Card key={req.id} className={cn("border", req.priority === 'emergency' && "border-destructive/40")}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground truncate">{material?.name || 'Unknown'}</p>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase", priorityColor[req.priority] || priorityColor.normal)}>
                          {req.priority}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Order: {order?.product_code || order?.product_type || '—'} • Stage: {req.stage?.replace(/_/g, ' ')}</p>
                        <p>Requested by: {getWorkerName(req.worker_id)}</p>
                        <p>Qty: <span className="font-semibold text-foreground">{req.quantity_requested} {material?.unit}</span>
                          {filter === 'pending' && (
                            <span className={cn("ml-2", canFulfill ? "text-success" : "text-destructive")}>
                              (Stock: {availableStock} {material?.unit})
                            </span>
                          )}
                        </p>
                        {req.notes && <p className="italic">Note: {req.notes}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {filter === 'pending' && (
                    <div className="space-y-2">
                      {!canFulfill && (
                        <div className="flex items-center gap-2 text-xs text-warning bg-warning/5 rounded-lg p-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Insufficient stock. You can partially fulfill.
                        </div>
                      )}
                      <div className="flex gap-2">
                        {!canFulfill && (
                          <input
                            type="number"
                            placeholder="Partial qty"
                            value={partialQty[req.id] || ''}
                            onChange={e => setPartialQty(p => ({ ...p, [req.id]: e.target.value }))}
                            className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-sm"
                            min="1"
                            max={availableStock}
                          />
                        )}
                        <Button size="sm" onClick={() => fulfillMutation.mutate({ id: req.id, materialId: req.material_id, qty: canFulfill ? req.quantity_requested : pQty })}
                          disabled={fulfillMutation.isPending || (!canFulfill && pQty > availableStock)}
                          className="gap-1">
                          {fulfillMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          {canFulfill ? 'Fulfill' : 'Partial Fulfill'}
                        </Button>
                        <div className="flex-1" />
                        <Button size="sm" variant="outline" onClick={() => {
                          const notes = rejectNotes[req.id] || '';
                          if (!notes && !confirm('Reject without a comment?')) return;
                          rejectMutation.mutate({ id: req.id, notes });
                        }} className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5">
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Rejection comment (optional)"
                        value={rejectNotes[req.id] || ''}
                        onChange={e => setRejectNotes(n => ({ ...n, [req.id]: e.target.value }))}
                        className="text-xs min-h-[40px]"
                        rows={1}
                      />
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

export default InventoryRequestProcessing;
