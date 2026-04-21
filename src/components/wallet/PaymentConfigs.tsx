import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Settings, Trash2 } from 'lucide-react';
import { cn, formatStage, formatCurrency } from '@/lib/utils';

const PAYMENT_TYPES = [
  { value: 'daily_wage', label: 'Daily Wage' },
  { value: 'per_stage', label: 'Per Stage' },
  { value: 'per_product', label: 'Per Product' },
  { value: 'commission', label: 'Commission' },
] as const;

const STAGES = [
  'wood_cutting', 'frame_assembly', 'board_fitting', 'sanding', 'fabric_lining',
  'painting', 'handle_installation', 'glass_installation', 'final_assembly', 'quality_inspection',
] as const;

interface ConfigForm {
  user_id: string;
  payment_type: string;
  amount: string;
  stage: string;
  description: string;
}

const emptyForm: ConfigForm = { user_id: '', payment_type: 'daily_wage', amount: '', stage: '', description: '' };

const PaymentConfigs = () => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ConfigForm>(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['payment-configs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_configs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['wallet-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.user_id || !form.amount) throw new Error('Please fill all required fields');
      const { error } = await supabase.from('payment_configs').insert({
        user_id: form.user_id,
        payment_type: form.payment_type as any,
        amount: parseFloat(form.amount),
        stage: form.payment_type === 'per_stage' && form.stage ? form.stage as any : null,
        description: form.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Payment config added!' });
      setShowForm(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['payment-configs'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Config removed' });
      queryClient.invalidateQueries({ queryKey: ['payment-configs'] });
    },
  });

  const getName = (uid: string) => profiles?.find(p => p.user_id === uid)?.full_name || 'Unknown';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{configs?.length || 0} config{(configs?.length || 0) !== 1 ? 's' : ''}</p>
        <Button onClick={() => { setForm(emptyForm); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Config'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              New Payment Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Worker *</Label>
                  <select value={form.user_id} onChange={(e) => setForm(f => ({ ...f, user_id: e.target.value }))}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm" required>
                    <option value="">Select worker</option>
                    {(profiles || []).map(p => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Type *</Label>
                  <select value={form.payment_type} onChange={(e) => setForm(f => ({ ...f, payment_type: e.target.value }))}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                    {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (Ksh) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-12" min="0" step="0.01" required />
                </div>
                {form.payment_type === 'per_stage' && (
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <select value={form.stage} onChange={(e) => setForm(f => ({ ...f, stage: e.target.value }))}
                      className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="">All stages</option>
                      {STAGES.map(s => <option key={s} value={s}>{formatStage(s)}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional note" className="h-12" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={createMutation.isPending || !form.user_id || !form.amount}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Configuration
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : (!configs || configs.length === 0) ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No payment configurations set up</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {configs.map((c) => (
            <Card key={c.id} className="border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{getName(c.user_id)}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                      {PAYMENT_TYPES.find(t => t.value === c.payment_type)?.label || c.payment_type}
                    </span>
                    {c.stage && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-md">{formatStage(c.stage)}</span>}
                    <span className="text-xs font-bold text-success">{formatCurrency(c.amount)}</span>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentConfigs;
