import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Loader2, Settings, Trash2, User, Pencil, Search,
  Save, AlertCircle, CheckCircle2, PlusCircle, X, Percent, DollarSign,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// The 4 workshop production stages (as named in the production module)
const WORKSHOP_STAGES = [
  'Stage 1 — Frame and body assembly',
  'Stage 2 — Sanding and painting',
  'Stage 3 — Cloth lining and final assembly',
  'Stage 4 — Glass fitting',
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  inventory_officer: 'Inventory Officer',
  workshop_worker: 'Workshop Worker',
  sales_officer: 'Sales Officer',
  driver: 'Driver',
  lowering_gear_operator: 'Lowering Gear Operator',
  branch_manager: 'Branch Manager',
  accountant: 'Accountant',
};

function getPaymentTypeOptions(role: string) {
  if (role === 'sales_officer') return [{ value: 'percentage', label: 'Percentage of Sales' }];
  if (role === 'workshop_worker') return [{ value: 'per_stage', label: 'Per Stage' }];
  return [
    { value: 'per_day', label: 'Per Day' },
    { value: 'per_product', label: 'Per Task' },
  ];
}

interface ConfigForm {
  user_id: string;
  payment_type: string;
  stage_label: string;
  product_type_id: string;
  amount: string;
  percentage: string;
}

interface PendingConfig extends ConfigForm {
  _localId: string;
  _employee_name: string;
  _role: string;
  _product_name: string;
}

const emptyForm: ConfigForm = {
  user_id: '',
  payment_type: '',
  stage_label: '',
  product_type_id: '',
  amount: '',
  percentage: '',
};

const PaymentConfigs = () => {
  const [showForm, setShowForm] = useState(false);
  const [editConfigId, setEditConfigId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigForm>(emptyForm);
  const [pendingConfigs, setPendingConfigs] = useState<PendingConfig[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const { data: configs, isLoading } = useQuery({
    queryKey: ['payment-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_configs')
        .select('*')
        .order('created_at', { ascending: false });
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
      const { data } = await supabase.from('user_roles').select('user_id, role');
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // ─── Derived Data ──────────────────────────────────────────────────────────

  const staffIds = new Set((allRoles || []).map((r: any) => r.user_id));
  const profiles = (allProfiles || []).filter((p: any) => staffIds.has(p.user_id));

  const getRoleForUser = (uid: string): string =>
    (allRoles || []).find((r: any) => r.user_id === uid)?.role || '';

  const getName = (uid: string) =>
    profiles.find((p: any) => p.user_id === uid)?.full_name || 'Unknown';

  const getProductName = (id: string) =>
    (products || []).find((p: any) => p.id === id)?.name || 'Unknown';

  const filteredProfiles = profiles.filter((p: any) =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Role-based form state ─────────────────────────────────────────────────

  const selectedUserRole = form.user_id ? getRoleForUser(form.user_id) : '';
  const isSales = selectedUserRole === 'sales_officer';
  const isWorkshop = selectedUserRole === 'workshop_worker';
  const isOther = !!selectedUserRole && !isSales && !isWorkshop;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleUserSelect = (uid: string) => {
    const role = getRoleForUser(uid);
    const types = getPaymentTypeOptions(role);
    setForm({ ...emptyForm, user_id: uid, payment_type: types[0]?.value || '' });
  };

  const isDuplicate = (cfg: PendingConfig, excludeLocalId?: string): boolean => {
    // Check pending list
    const inPending = pendingConfigs.some(p => {
      if (excludeLocalId && p._localId === excludeLocalId) return false;
      if (p.user_id !== cfg.user_id) return false;
      if (cfg.payment_type === 'per_stage') {
        return p.stage_label === cfg.stage_label && p.product_type_id === cfg.product_type_id;
      }
      return p.payment_type === cfg.payment_type;
    });
    if (inPending) return true;

    // Check already-saved configs
    return (configs || []).some((c: any) => {
      if (c.user_id !== cfg.user_id) return false;
      if (editConfigId && c.id === editConfigId) return false;
      if (cfg.payment_type === 'per_stage') {
        return c.stage_label === cfg.stage_label && c.product_type_id === cfg.product_type_id;
      }
      return c.payment_type === cfg.payment_type;
    });
  };

  const handleAddToStaging = () => {
    if (!form.user_id) { toast({ variant: 'destructive', title: 'Please select an employee' }); return; }

    // Validate per role
    if (isSales) {
      const pct = parseFloat(form.percentage);
      if (!form.percentage || isNaN(pct) || pct < 0 || pct > 100) {
        toast({ variant: 'destructive', title: 'Percentage must be between 0 and 100' }); return;
      }
    } else if (isWorkshop) {
      if (!form.stage_label) { toast({ variant: 'destructive', title: 'Please select a stage' }); return; }
      if (!form.product_type_id) { toast({ variant: 'destructive', title: 'Please select a product type' }); return; }
      const amt = parseFloat(form.amount);
      if (!form.amount || isNaN(amt) || amt <= 0) { toast({ variant: 'destructive', title: 'Amount must be greater than 0' }); return; }
    } else {
      if (!form.payment_type) { toast({ variant: 'destructive', title: 'Please select a payment type' }); return; }
      const amt = parseFloat(form.amount);
      if (!form.amount || isNaN(amt) || amt <= 0) { toast({ variant: 'destructive', title: 'Amount must be greater than 0' }); return; }
    }

    const pending: PendingConfig = {
      ...form,
      _localId: crypto.randomUUID(),
      _employee_name: getName(form.user_id),
      _role: selectedUserRole,
      _product_name: form.product_type_id ? getProductName(form.product_type_id) : '',
    };

    if (isDuplicate(pending)) {
      toast({
        variant: 'destructive',
        title: 'Duplicate configuration',
        description: 'This combination already exists for this employee.',
      });
      return;
    }

    setPendingConfigs(prev => [...prev, pending]);
    // Reset fields but keep user selected so they can add more
    setForm(f => ({
      ...f,
      stage_label: '',
      product_type_id: '',
      amount: '',
      percentage: '',
    }));
    toast({ title: 'Configuration added to staging area' });
  };

  const removePending = (localId: string) => {
    setPendingConfigs(prev => prev.filter(p => p._localId !== localId));
  };

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (pendingConfigs.length === 0) throw new Error('No configurations to save');
      const rows = pendingConfigs.map(cfg => {
        const isPercentage = cfg.payment_type === 'percentage';
        return {
          user_id: cfg.user_id,
          payment_type: cfg.payment_type as any,
          stage_label: cfg.stage_label || null,
          product_type_id: cfg.product_type_id || null,
          amount: isPercentage ? 0 : parseFloat(cfg.amount),
          percentage: isPercentage ? parseFloat(cfg.percentage) : null,
          rate_type: isPercentage ? 'percentage' : 'fixed',
          rate_value: isPercentage ? parseFloat(cfg.percentage) : parseFloat(cfg.amount),
          description: buildDescription(cfg),
        };
      });
      const { error } = await supabase.from('payment_configs').insert(rows as any[]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${pendingConfigs.length} configuration(s) saved!` });
      setPendingConfigs([]);
      setForm(emptyForm);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['payment-configs'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Save failed', description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editConfigId) return;
      const isPercentage = form.payment_type === 'percentage';
      const payload: any = {
        payment_type: form.payment_type,
        stage_label: form.stage_label || null,
        product_type_id: form.product_type_id || null,
        amount: isPercentage ? 0 : parseFloat(form.amount),
        percentage: isPercentage ? parseFloat(form.percentage) : null,
        rate_type: isPercentage ? 'percentage' : 'fixed',
        rate_value: isPercentage ? parseFloat(form.percentage) : parseFloat(form.amount),
      };
      const { error } = await supabase.from('payment_configs').update(payload).eq('id', editConfigId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Configuration updated!' });
      setEditConfigId(null);
      setForm(emptyForm);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['payment-configs'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Update failed', description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Configuration removed' });
      queryClient.invalidateQueries({ queryKey: ['payment-configs'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const buildDescription = (cfg: PendingConfig) => {
    const parts: string[] = [];
    if (cfg.stage_label) parts.push(cfg.stage_label);
    if (cfg._product_name) parts.push(cfg._product_name);
    else if (cfg.product_type_id) parts.push(getProductName(cfg.product_type_id));
    return parts.join(' | ') || null;
  };

  const formatSavedConfig = (c: any) => {
    if (c.payment_type === 'percentage') {
      const pct = c.percentage ?? c.rate_value ?? 0;
      return `${pct}% of Sales`;
    }
    if (c.payment_type === 'per_stage') {
      const stage = c.stage_label || 'Any stage';
      const product = c.product_type_id ? getProductName(c.product_type_id) : 'Any product';
      const amount = formatCurrency(c.rate_value || c.amount || 0);
      return `${stage} | ${product} — ${amount}`;
    }
    const label = c.payment_type === 'per_day' ? 'Per Day' : 'Per Task';
    return `${label} — ${formatCurrency(c.rate_value || c.amount || 0)}`;
  };

  const startEdit = (c: any) => {
    const isPercentage = c.payment_type === 'percentage';
    setEditConfigId(c.id);
    setForm({
      user_id: c.user_id,
      payment_type: c.payment_type,
      stage_label: c.stage_label || '',
      product_type_id: c.product_type_id || '',
      amount: !isPercentage ? String(c.rate_value || c.amount || '') : '',
      percentage: isPercentage ? String(c.percentage ?? c.rate_value ?? '') : '',
    });
    setPendingConfigs([]);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditConfigId(null);
    setForm(emptyForm);
    setPendingConfigs([]);
  };

  // Group configs by employee for the list view
  const configsByEmployee: Record<string, any[]> = {};
  for (const c of (configs || [])) {
    if (!configsByEmployee[c.user_id]) configsByEmployee[c.user_id] = [];
    configsByEmployee[c.user_id].push(c);
  }
  for (const p of profiles) {
    if (!configsByEmployee[(p as any).user_id]) configsByEmployee[(p as any).user_id] = [];
  }

  const filteredEmployees = filteredProfiles.filter((p: any) =>
    !selectedEmployee || p.user_id === selectedEmployee
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {profiles.length} employees • {(configs || []).length} total configs
        </p>
        {!showForm && (
          <Button onClick={() => { cancelForm(); setShowForm(true); }} size="lg">
            <Plus className="h-4 w-4" />
            New Configuration
          </Button>
        )}
      </div>

      {/* ── Form ── */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {editConfigId ? 'Edit Payment Configuration' : 'New Payment Configuration'}
              <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={cancelForm}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">

            {/* ── Step 1: Employee Selection ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Step 1 — Select Employee
              </Label>
              <select
                value={form.user_id}
                onChange={(e) => handleUserSelect(e.target.value)}
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
                disabled={!!editConfigId}
              >
                <option value="">Select employee…</option>
                {(profiles || []).map((p: any) => (
                  <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                ))}
              </select>
            </div>

            {/* ── Employee Info (auto-filled) ── */}
            {form.user_id && selectedUserRole && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Employee Name</Label>
                  <div className="h-10 px-3 flex items-center rounded-lg bg-muted/50 border text-sm font-medium text-foreground">
                    <User className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                    {getName(form.user_id)}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <div className="h-10 px-3 flex items-center rounded-lg bg-muted/50 border text-sm font-medium text-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {ROLE_LABELS[selectedUserRole] || selectedUserRole}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Config Fields (role-based) ── */}
            {form.user_id && selectedUserRole && (
              <>
                <div className="border-t pt-4 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Step 2 — Configure Payment
                  </Label>
                </div>

                {/* ── SALES OFFICER: Percentage only ── */}
                {isSales && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                      <Percent className="h-3.5 w-3.5 shrink-0" />
                      Payment Type: <strong>Percentage of Sales</strong> — auto-set for Sales Officers
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sales Commission (%)*</Label>
                      <Input
                        type="number"
                        value={form.percentage}
                        onChange={(e) => setForm(f => ({ ...f, percentage: e.target.value }))}
                        placeholder="e.g. 5"
                        className="h-11"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                      <p className="text-[10px] text-muted-foreground">Enter a value between 0 and 100</p>
                    </div>
                  </div>
                )}

                {/* ── WORKSHOP WORKER: Stage + Product Type + Amount ── */}
                {isWorkshop && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-success/5 border border-success/20 text-xs text-success flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5 shrink-0" />
                      Payment Type: <strong>Per Stage</strong> — auto-set for Workshop Workers
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Production Stage *</Label>
                        <select
                          value={form.stage_label}
                          onChange={(e) => setForm(f => ({ ...f, stage_label: e.target.value }))}
                          className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select stage…</option>
                          {WORKSHOP_STAGES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Product / Coffin Type *</Label>
                        <select
                          value={form.product_type_id}
                          onChange={(e) => setForm(f => ({ ...f, product_type_id: e.target.value }))}
                          className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select product…</option>
                          {(products || []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Amount (KES) *</Label>
                        <Input
                          type="number"
                          value={form.amount}
                          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="e.g. 500"
                          className="h-11"
                          min="1"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── OTHER ROLES: Per Day / Per Task ── */}
                {isOther && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Payment Type *</Label>
                        <select
                          value={form.payment_type}
                          onChange={(e) => setForm(f => ({ ...f, payment_type: e.target.value }))}
                          className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          {getPaymentTypeOptions(selectedUserRole).map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Amount (KES) *</Label>
                        <Input
                          type="number"
                          value={form.amount}
                          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="e.g. 1000"
                          className="h-11"
                          min="1"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Add to Staging Button (only for new configs, not edit mode) ── */}
                {!editConfigId && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5 hover:text-primary h-11"
                    onClick={handleAddToStaging}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Another Configuration
                  </Button>
                )}
              </>
            )}

            {/* ── Pending Configs Staging Table ── */}
            {pendingConfigs.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Pending — {pendingConfigs.length} configuration(s) ready to save
                </p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {pendingConfigs.map((cfg) => (
                    <div key={cfg._localId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/20 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{cfg._employee_name}</p>
                        <p className="text-muted-foreground truncate">
                          {cfg.payment_type === 'percentage' && `${cfg.percentage}% of Sales`}
                          {cfg.payment_type === 'per_stage' && `${cfg.stage_label} | ${cfg._product_name} — ${formatCurrency(parseFloat(cfg.amount))}`}
                          {(cfg.payment_type === 'per_day' || cfg.payment_type === 'per_product') && `${cfg.payment_type === 'per_day' ? 'Per Day' : 'Per Task'} — ${formatCurrency(parseFloat(cfg.amount))}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive shrink-0"
                        onClick={() => removePending(cfg._localId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="flex gap-2 pt-1">
              {editConfigId ? (
                <>
                  <Button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending || !form.user_id}
                    size="lg"
                    className="flex-1"
                  >
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Update Configuration
                  </Button>
                  <Button variant="outline" size="lg" onClick={cancelForm}>Cancel</Button>
                </>
              ) : (
                <>
                  {pendingConfigs.length > 0 ? (
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      size="lg"
                      className="flex-1 bg-success hover:bg-success/90"
                    >
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save {pendingConfigs.length} Configuration(s)
                    </Button>
                  ) : (
                    <Button
                      onClick={handleAddToStaging}
                      disabled={!form.user_id || !selectedUserRole}
                      size="lg"
                      className="flex-1"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Add Configuration
                    </Button>
                  )}
                  <Button variant="outline" size="lg" onClick={cancelForm}>Cancel</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Employee Search + Filter ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees…"
            className="pl-10 h-11"
          />
        </div>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm min-w-[140px]"
        >
          <option value="">All employees</option>
          {(profiles || []).map((p: any) => (
            <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
          ))}
        </select>
      </div>

      {/* ── Employee Config Cards ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card className="border">
          <CardContent className="p-12 text-center">
            <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No employees found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEmployees.map((emp: any) => {
            const empConfigs = configsByEmployee[emp.user_id] || [];
            const empRole = getRoleForUser(emp.user_id);
            return (
              <Card key={emp.user_id} className={cn('border transition-shadow hover:shadow-sm', empConfigs.length === 0 && 'opacity-70')}>
                <CardContent className="p-4">
                  {/* Employee header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{emp.full_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {ROLE_LABELS[empRole] || empRole || 'No role'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {empConfigs.length} config{empConfigs.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => {
                        cancelForm();
                        const role = getRoleForUser(emp.user_id);
                        const types = getPaymentTypeOptions(role);
                        setForm({ ...emptyForm, user_id: emp.user_id, payment_type: types[0]?.value || '' });
                        setShowForm(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Add Config
                    </Button>
                  </div>

                  {/* Config rows */}
                  {empConfigs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-lg">
                      No payment config — click "Add Config" to set one up
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {empConfigs.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-accent/30 text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Payment type badge */}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 capitalize">
                              {c.payment_type === 'percentage' ? '% Sales'
                                : c.payment_type === 'per_stage' ? 'Per Stage'
                                : c.payment_type === 'per_day' ? 'Per Day'
                                : c.payment_type === 'per_product' ? 'Per Task'
                                : c.payment_type}
                            </Badge>
                            {/* Stage badge (workshop) */}
                            {c.stage_label && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 hidden sm:inline-flex">
                                {c.stage_label.split(' — ')[0]}
                              </Badge>
                            )}
                            {/* Value */}
                            <span className="font-bold text-success shrink-0">
                              {c.payment_type === 'percentage'
                                ? `${c.percentage ?? c.rate_value ?? 0}%`
                                : formatCurrency(c.rate_value || c.amount || 0)}
                            </span>
                            {/* Description */}
                            <span className="text-muted-foreground truncate hidden md:inline">
                              {c.description || formatSavedConfig(c)}
                            </span>
                          </div>
                          <div className="flex gap-0.5 shrink-0 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => { startEdit(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => {
                                if (confirm('Remove this payment configuration?')) {
                                  deleteMutation.mutate(c.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
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
