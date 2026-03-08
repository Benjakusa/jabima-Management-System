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
import { RotateCcw, Plus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WorkshopMaterialReturns = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ production_order_id: '', material_id: '', quantity_returned: '', reason: 'excess' });

  const { data: assignments } = useQuery({
    queryKey: ['my-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stage_assignments').select('stage').eq('user_id', user!.id);
      return data?.map(a => a.stage) || [];
    },
    enabled: !!user,
  });

  const { data: activeOrders } = useQuery({
    queryKey: ['my-active-orders-returns', assignments],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      const { data } = await supabase.from('production_orders')
        .select('id, product_type, product_code')
        .in('current_stage', assignments)
        .eq('status', 'in_production');
      return data || [];
    },
    enabled: !!assignments && assignments.length > 0,
  });

  const { data: materials } = useQuery({
    queryKey: ['available-materials'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_materials').select('id, name, unit');
      return data || [];
    },
  });

  const { data: returns, isLoading } = useQuery({
    queryKey: ['my-material-returns', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('material_returns')
        .select('*, inventory_materials(name, unit), production_orders(product_code, product_type)')
        .eq('worker_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.production_order_id || !form.material_id || !form.quantity_returned) throw new Error('Fill required fields');
      const { error } = await supabase.from('material_returns').insert({
        production_order_id: form.production_order_id,
        material_id: form.material_id,
        worker_id: user!.id,
        quantity_returned: parseFloat(form.quantity_returned),
        reason: form.reason,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Material return submitted for inspection!' });
      setShowForm(false);
      setForm({ production_order_id: '', material_id: '', quantity_returned: '', reason: 'excess' });
      queryClient.invalidateQueries({ queryKey: ['my-material-returns'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const reasons = [
    { value: 'excess', label: 'Excess Material' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'wrong_size', label: 'Wrong Size' },
    { value: 'quality_issue', label: 'Quality Issue' },
  ];

  const statusColors: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-foreground text-sm">Material Returns</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showForm ? 'Cancel' : 'New Return'}
        </Button>
      </div>

      {showForm && (
        <Card className="border border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Product *</Label>
              <select value={form.production_order_id} onChange={e => setForm(f => ({ ...f, production_order_id: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" required>
                <option value="">Select product...</option>
                {(activeOrders || []).map(o => (
                  <option key={o.id} value={o.id}>{o.product_code || o.id.slice(0, 8)} — {o.product_type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Material *</Label>
              <select value={form.material_id} onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" required>
                <option value="">Select material...</option>
                {(materials || []).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Quantity *</Label>
                <Input type="number" min="0.01" step="0.01" value={form.quantity_returned} onChange={e => setForm(f => ({ ...f, quantity_returned: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Reason</Label>
                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.production_order_id || !form.material_id || !form.quantity_returned}>
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Submit Return
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-16" />)}</div>
      ) : (!returns || returns.length === 0) ? (
        <Card className="border"><CardContent className="p-8 text-center">
          <RotateCcw className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No material returns</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {returns.map(r => (
            <Card key={r.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground text-sm">{(r as any).inventory_materials?.name}</p>
                  <Badge className={cn("text-[10px]", statusColors[r.status] || '')}>{r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.quantity_returned} {(r as any).inventory_materials?.unit} • {(r as any).production_orders?.product_code || 'N/A'} • {r.reason.replace(/_/g, ' ')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkshopMaterialReturns;
