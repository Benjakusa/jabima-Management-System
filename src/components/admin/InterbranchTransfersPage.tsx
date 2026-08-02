import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Truck, Search, CheckCircle, Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const InterbranchTransfersPage = () => {
  const [search, setSearch] = useState('');
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    source: 'warehouse', // warehouse | workshop
    finished_product_id: '',
    destination_type: 'branch', // branch | warehouse | workshop
    to_branch_id: '',
    notes: ''
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const branchMap = Object.fromEntries((branches || []).map((b: any) => [b.id, b.name]));

  const { data: transfers, isLoading, error: transfersError } = useQuery({
    queryKey: ['interbranch-transfers', branchMap],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interbranch_transfers' as any)
        .select('*, finished_products(product_type)')
        .order('transfer_date', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        from_branch: { name: branchMap[t.from_branch_id] || 'Warehouse' },
        to_branch: { name: branchMap[t.to_branch_id] || 'Unknown' },
      }));
    },
    refetchInterval: 5000,
  });

  const { data: availableStock } = useQuery({
    queryKey: ['dispatchable-stock', dispatchForm.source],
    queryFn: async () => {
      const statusFilter = dispatchForm.source === 'workshop' ? 'in_progress' : 'completed';
      const { data, error } = await supabase
        .from('finished_products')
        .select('id, product_type, batch_number')
        .eq('status', statusFilter)
        .eq('is_active', true)
        .is('branch_id', null);
      if (error) throw error;
      return data || [];
    }
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!dispatchForm.finished_product_id) throw new Error('Select a product');
      if (dispatchForm.destination_type === 'branch' && !dispatchForm.to_branch_id) throw new Error('Select a destination branch');

      const { error: insertErr } = await supabase.from('interbranch_transfers' as any).insert({
        finished_product_id: dispatchForm.finished_product_id,
        from_branch_id: null,
        to_branch_id: dispatchForm.destination_type === 'branch' ? dispatchForm.to_branch_id : null,
        destination_type: dispatchForm.destination_type,
        status: 'in_transit',
        initiated_by: user?.id,
        notes: dispatchForm.notes || null,
        quantity: 1
      });
      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase.from('finished_products').update({
        status: 'transferred'
      }).eq('id', dispatchForm.finished_product_id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      toast({ title: 'Transfer dispatched successfully' });
      setShowDispatch(false);
      setDispatchForm({ ...dispatchForm, finished_product_id: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['interbranch-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['dispatchable-stock'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const acceptMutation = useMutation({
    mutationFn: async (transfer: any) => {
      const { error: updateErr } = await supabase
        .from('interbranch_transfers' as any)
        .update({ status: 'received' })
        .eq('id', transfer.id);
      if (updateErr) throw updateErr;

      if (transfer.destination_type === 'warehouse') {
        const { error: prodErr } = await supabase
          .from('finished_products')
          .update({ status: 'completed' as any })
          .eq('id', transfer.finished_product_id);
        if (prodErr) throw prodErr;
      } else if (transfer.destination_type === 'workshop') {
        const { error: prodErr } = await supabase
          .from('finished_products')
          .update({ status: 'in_progress' as any })
          .eq('id', transfer.finished_product_id);
        if (prodErr) throw prodErr;
      }
    },
    onSuccess: () => {
      toast({ title: 'Transfer accepted' });
      queryClient.invalidateQueries({ queryKey: ['interbranch-transfers'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning';
      case 'in_transit': return 'bg-blue-500/10 text-blue-600';
      case 'received': return 'bg-success/10 text-success';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDestName = (t: any) => {
    if (t.destination_type === 'warehouse') return 'Main Warehouse';
    if (t.destination_type === 'workshop') return 'Workshop';
    return t.to_branch?.name || 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Interbranch Transfers</h2>
          <p className="text-sm text-muted-foreground">View all stock transfers between branches</p>
        </div>
        {(role === 'admin' || role === 'inventory_officer') && (
          <Button onClick={() => setShowDispatch(true)} className="gap-2">
            <Send className="h-4 w-4" /> New Dispatch
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transfers..."
          className="w-full h-11 rounded-lg border border-input bg-background pl-10 pr-4 text-sm" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : transfersError ? (
        <Card className="border border-destructive/30">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive font-medium mb-1">Failed to load transfers</p>
            <p className="text-xs text-muted-foreground">{(transfersError as any)?.message || 'Unknown error'}</p>
          </CardContent>
        </Card>
      ) : (!transfers || transfers.length === 0) ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No transfers yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(transfers || []).filter((t: any) =>
            (t.from_branch?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.to_branch?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.status || '').toLowerCase().includes(search.toLowerCase())
          ).map((t: any) => (
            <Card key={t.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">
                        {t.finished_products?.product_type || `Product #${t.finished_product_id?.slice(0, 8) || 'N/A'}`}
                      </p>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", getStatusColor(t.status))}>{t.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.from_branch?.name || 'Warehouse'} → {getDestName(t)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(t.transfer_date).toLocaleDateString()}
                      {t.notes && ` • ${t.notes}`}
                    </p>
                  </div>
                  {(t.destination_type === 'warehouse' || t.destination_type === 'workshop') && t.status === 'in_transit' && (role === 'admin' || role === 'inventory_officer') && (
                    <Button size="sm" onClick={() => acceptMutation.mutate(t)} disabled={acceptMutation.isPending} className="ml-4 gap-1 text-xs shrink-0">
                      {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      Accept
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dispatch Dialog */}
      <Dialog open={showDispatch} onOpenChange={setShowDispatch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatch Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source Location</Label>
              <select value={dispatchForm.source} onChange={e => setDispatchForm(f => ({ ...f, source: e.target.value, finished_product_id: '' }))}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="warehouse">Main Warehouse</option>
                <option value="workshop">Workshop</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Product to Send</Label>
              <select value={dispatchForm.finished_product_id} onChange={e => setDispatchForm(f => ({ ...f, finished_product_id: e.target.value }))}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Select available product...</option>
                {(availableStock || []).map(p => (
                  <option key={p.id} value={p.id}>{p.product_type} {p.batch_number ? `(${p.batch_number})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Destination Type</Label>
              <select value={dispatchForm.destination_type} onChange={e => setDispatchForm(f => ({ ...f, destination_type: e.target.value, to_branch_id: '' }))}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="branch">Branch</option>
                {dispatchForm.source === 'warehouse' && <option value="workshop">Workshop</option>}
                {dispatchForm.source === 'workshop' && <option value="warehouse">Main Warehouse</option>}
              </select>
            </div>
            {dispatchForm.destination_type === 'branch' && (
              <div className="space-y-2">
                <Label>Destination Branch</Label>
                <select value={dispatchForm.to_branch_id} onChange={e => setDispatchForm(f => ({ ...f, to_branch_id: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">Select branch...</option>
                  {(branches || []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={dispatchForm.notes} onChange={e => setDispatchForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for dispatch..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispatch(false)}>Cancel</Button>
            <Button onClick={() => dispatchMutation.mutate()} disabled={dispatchMutation.isPending || !dispatchForm.finished_product_id || (dispatchForm.destination_type === 'branch' && !dispatchForm.to_branch_id)}>
              {dispatchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Dispatch Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterbranchTransfersPage;
