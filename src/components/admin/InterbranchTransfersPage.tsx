import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Truck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const InterbranchTransfersPage = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ finished_product_id: '', from_branch_id: '', to_branch_id: '', notes: '' });
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['interbranch-transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interbranch_transfers' as any)
        .select('*, from_branch:branches!from_branch_id(name), to_branch:branches!to_branch_id(name), finished_products(product_type)')
        .order('transfer_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: finishedProducts } = useQuery({
    queryKey: ['available-finished-products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('finished_products')
        .select('id, product_type, branch_id, location')
        .in('status', ['completed', 'transferred'])
        .eq('is_active', true)
        .order('product_type');
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.finished_product_id || !form.to_branch_id) throw new Error('Select product and destination branch');
      const product = (finishedProducts || []).find((p: any) => p.id === form.finished_product_id);
      const { error } = await supabase.from('interbranch_transfers' as any).insert({
        finished_product_id: form.finished_product_id,
        from_branch_id: (product as any)?.branch_id || null,
        to_branch_id: form.to_branch_id,
        quantity: 1,
        initiated_by: user?.id,
        status: 'pending',
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Transfer initiated' });
      setShowForm(false);
      setForm({ finished_product_id: '', from_branch_id: '', to_branch_id: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['interbranch-transfers'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('interbranch_transfers' as any).update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Transfer status updated' });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Interbranch Transfers</h2>
          <p className="text-sm text-muted-foreground">Transfer stock between branches</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Transfer'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> New Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Select Product *</Label>
                <select value={form.finished_product_id} onChange={(e) => setForm(f => ({ ...f, finished_product_id: e.target.value }))}
                  className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm" required>
                  <option value="">Choose product...</option>
                  {(finishedProducts || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.product_type} — {p.location || 'Warehouse'}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Destination Branch *</Label>
                <select value={form.to_branch_id} onChange={(e) => setForm(f => ({ ...f, to_branch_id: e.target.value }))}
                  className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm" required>
                  <option value="">Select branch...</option>
                  {(branches || []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Transfer reason, special instructions..." className="min-h-[60px]" />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={createMutation.isPending || !form.finished_product_id || !form.to_branch_id}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Truck className="h-4 w-4" />}
                Initiate Transfer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transfers..."
          className="w-full h-11 rounded-lg border border-input bg-background pl-10 pr-4 text-sm" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : (!transfers || transfers.length === 0) ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No transfers yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(transfers || []).filter((t: any) =>
            (t.finished_products?.product_type || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.from_branch?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.to_branch?.name || '').toLowerCase().includes(search.toLowerCase())
          ).map((t: any) => (
            <Card key={t.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">{t.finished_products?.product_type || 'Unknown'}</p>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", getStatusColor(t.status))}>{t.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.from_branch?.name || 'Warehouse'} → {t.to_branch?.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(t.transfer_date).toLocaleDateString()}
                      {t.notes && ` • ${t.notes}`}
                    </p>
                  </div>
                  {t.status === 'pending' && (
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'in_transit' })}>
                        Mark In Transit
                      </Button>
                    </div>
                  )}
                  {t.status === 'in_transit' && (
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" variant="default" className="h-7 text-[10px]" onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'received' })}>
                        Confirm Received
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default InterbranchTransfersPage;
