import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Settings, Trash2, User, DollarSign, Pencil, Search } from 'lucide-react';
import { cn, formatStage, formatCurrency } from '@/lib/utils';

const PAYMENT_TYPES = [
  { value: 'daily_wage', label: 'Daily Wage' },
  { value: 'per_stage', label: 'Per Stage' },
  { value: 'per_product', label: 'Per Product' },
  { value: 'commission', label: 'Commission' },
  { value: 'per_service', label: 'Per Service' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'percentage', label: '% of Sale' },
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
  const [editConfigId, setEditConfigId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
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

  const { data: allProfiles } = useQuery({
    queryKey: ['wallet-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, branch_id');
      return data || [];
    },
  });

  const { data: allRoles } = useQuery({
    queryKey: ['wallet-user-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id');
      return data || [];
    },
  });

  const staffIds = new Set((allRoles || []).map((r: any) => r.user_id));
  const profiles = (allProfiles || []).filter((p: any) => staffIds.has(p.user_id));

  const filteredProfiles = profiles.filter((p: any) =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const isPercentageType = form.payment_type === 'commission' || form.payment_type === 'percentage';

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.user_id || !form.amount) throw new Error('Please fill all required fields');
      const amount = parseFloat(form.amount);
      if (isPercentageType && amount > 100) throw new Error('Percentage/Commission value cannot exceed 100%');
      if (isPercentageType && amount < 0) throw new Error('Percentage/Commission cannot be negative');
      const payload = {
        user_id: form.user_id,
        payment_type: form.payment_type as any,
        amount: isPercentageType ? 0 : amount,
        rate_type: isPercentageType ? 'percentage' : 'fixed',
        rate_value: isPercentageType ? amount : 0,
        stage: form.payment_type === 'per_stage' && form.stage ? form.stage as any : null,
        description: form.description.trim() || null,
      };
      if (editConfigId) {
        const { error } = await supabase.from('payment_configs').update(payload).eq('id', editConfigId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_configs').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editConfigId ? 'Config updated' : 'Payment config added!' });
      setShowForm(false);
      setEditConfigId(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['payment-configs'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
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

  const getName = (uid: string) => profiles.find(p => p.user_id === uid)?.full_name || 'Unknown';

  // Group configs by employee
  const configsByEmployee: Record<string, any[]> = {};
  for (const c of (configs || [])) {
    if (!configsByEmployee[c.user_id]) configsByEmployee[c.user_id] = [];
    configsByEmployee[c.user_id].push(c);
  }
  // Ensure all workers appear (even those with no configs)
  for (const p of profiles) {
    if (!configsByEmployee[p.user_id]) configsByEmployee[p.user_id] = [];
  }

  const filteredEmployees = filteredProfiles.filter((p: any) =>
    !selectedEmployee || p.user_id === selectedEmployee
  );

  const startEditConfig = (c: any) => {
    setEditConfigId(c.id);
    setForm({
      user_id: c.user_id,
      payment_type: c.payment_type,
      amount: String(c.amount),
      stage: c.stage || '',
      description: c.description || '',
    });
    setShowForm(true);
  };

  const startNewConfig = (userId?: string) => {
    setEditConfigId(null);
    setForm({ ...emptyForm, user_id: userId || '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{profiles.length} employees • {(configs || []).length} total configs</p>
        </div>
        <Button onClick={() => startNewConfig()} size="lg">
          <Plus className="h-4 w-4" />
          Add Config
        </Button>
      </div>

      {/* Add/Edit Config Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {editConfigId ? 'Edit Payment Configuration' : 'New Payment Configuration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee *</Label>
                  <select value={form.user_id} onChange={(e) => setForm(f => ({ ...f, user_id: e.target.value }))}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm" required>
                    <option value="">Select employee</option>
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
                  <Label>{isPercentageType ? 'Rate (%)' : 'Amount (Ksh)'} *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder={isPercentageType ? "e.g. 10" : "0"}
                    className="h-12" min="0" max={isPercentageType ? 100 : undefined} step="0.01" required />
                  {isPercentageType && (
                    <p className="text-[10px] text-muted-foreground mt-1">Enter a value between 0 and 100 (max 100%)</p>
                  )}
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
                  <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Casket assembly rate, Weekend rate" className="h-12" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="lg" className="flex-1" disabled={createMutation.isPending || !form.user_id || !form.amount}>
                  {createMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                  {editConfigId ? 'Update Config' : 'Save Config'}
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => { setShowForm(false); setEditConfigId(null); setForm(emptyForm); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Employee Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..." className="pl-10 h-11" />
        </div>
        <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm min-w-[140px]">
          <option value="">All employees</option>
          {(profiles || []).map((p: any) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
        </select>
      </div>

      {/* Per-Employee Config Cards */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />)}</div>
      ) : filteredEmployees.length === 0 ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No employees found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredEmployees.map((emp: any) => {
            const empConfigs = configsByEmployee[emp.user_id] || [];
            return (
              <Card key={emp.user_id} className={cn("border", empConfigs.length === 0 && "opacity-70")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{emp.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{empConfigs.length} config{empConfigs.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => startNewConfig(emp.user_id)}>
                      <Plus className="h-3 w-3" />
                      Add Config
                    </Button>
                  </div>

                  {empConfigs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No payment config — click "Add Config" to set one up</p>
                  ) : (
                    <div className="space-y-1.5">
                      {empConfigs.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-accent/30 text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                              {PAYMENT_TYPES.find(t => t.value === c.payment_type)?.label || c.payment_type}
                            </Badge>
                            {c.stage && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                                {formatStage(c.stage)}
                              </Badge>
                            )}
                            <span className="font-bold text-success shrink-0">{formatCurrency(c.amount)}</span>
                            {c.description && (
                              <span className="text-muted-foreground truncate hidden sm:inline">{c.description}</span>
                            )}
                          </div>
                          <div className="flex gap-0.5 shrink-0 ml-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditConfig(c)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
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

export default PaymentConfigs;
