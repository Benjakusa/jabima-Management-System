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
import { Package, Plus, Loader2, Clock, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { cn, formatStage } from '@/lib/utils';

const WorkshopMaterialRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ production_order_id: '', material_id: '', quantity_requested: '', priority: 'normal', notes: '' });

  const { data: assignments } = useQuery({
    queryKey: ['my-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stage_assignments').select('stage').eq('user_id', user!.id);
      return data?.map(a => a.stage) || [];
    },
    enabled: !!user,
  });

  // Load all production orders in production (not filtered by stage)
  const { data: activeOrders } = useQuery({
    queryKey: ['all-production-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('production_orders')
        .select('id, product_type, product_code, current_stage, status')
        .eq('status', 'in_production')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: materials, isLoading: materialsLoading, error: materialsError } = useQuery({
    queryKey: ['available-materials'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_materials').select('id, name, unit, quantity');
      if (error) {
        console.error('Error loading materials:', error);
        throw error;
      }
      return data || [];
    },
  });

  if (materialsError) {
    console.error('Materials query error:', materialsError);
  }

  const { data: requests, isLoading } = useQuery({
    queryKey: ['my-material-requests', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('material_requests')
        .select('*, inventory_materials(name, unit), production_orders(product_code, product_type, batch_number)')
        .eq('worker_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.production_order_id || !form.material_id || !form.quantity_requested) throw new Error('Fill required fields');
      const order = activeOrders?.find(o => o.id === form.production_order_id);
      const { error } = await supabase.from('material_requests').insert({
        production_order_id: form.production_order_id,
        material_id: form.material_id,
        worker_id: user!.id,
        stage: order?.current_stage || 'wood_cutting',
        quantity_requested: parseFloat(form.quantity_requested),
        priority: form.priority,
        notes: form.notes.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Material request submitted!' });
      setShowForm(false);
      setForm({ production_order_id: '', material_id: '', quantity_requested: '', priority: 'normal', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-pending-requests'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    fulfilled: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
  };

  const priorityColors: Record<string, string> = {
    normal: 'bg-secondary text-muted-foreground',
    urgent: 'bg-warning/10 text-warning',
    emergency: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-foreground text-sm">Material Requests</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showForm ? 'Cancel' : 'New Request'}
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
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" required disabled={materialsLoading}>
                <option value="">{materialsLoading ? 'Loading...' : 'Select material...'}</option>
                {(materials || []).map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.quantity} {m.unit} available)</option>
                ))}
              </select>
              {materialsError && <p className="text-xs text-red-500">Error: {materialsError.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Quantity *</Label>
                <Input type="number" min="0.01" step="0.01" value={form.quantity_requested} onChange={e => setForm(f => ({ ...f, quantity_requested: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Priority</Label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
            <Button size="sm" className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.production_order_id || !form.material_id || !form.quantity_requested}>
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
              Submit Request
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-16" />)}</div>
      ) : (!requests || requests.length === 0) ? (
        <Card className="border"><CardContent className="p-8 text-center">
          <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No material requests yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <Card key={r.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground text-sm">{(r as any).inventory_materials?.name}</p>
                  <div className="flex gap-1">
                    <Badge className={cn("text-[10px]", statusColors[r.status] || '')}>{r.status}</Badge>
                    <Badge className={cn("text-[10px]", priorityColors[r.priority] || '')}>{r.priority}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.quantity_requested} {(r as any).inventory_materials?.unit} • {(r as any).production_orders?.product_code || 'N/A'}
                </p>
                {r.notes && <p className="text-[10px] text-muted-foreground mt-1">{r.notes}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkshopMaterialRequests;
