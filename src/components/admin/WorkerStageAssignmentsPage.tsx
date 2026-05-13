import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Users, Factory, DollarSign, Search, UserCheck } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { STAGES } from '@/components/production/ProductionPipeline';

const WorkerStageAssignmentsPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [rateOverride, setRateOverride] = useState('');

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ['worker-profiles'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['workshop_worker', 'admin']);
      if (!roles) return [];
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, branch_id').in('user_id', ids);
      return profiles || [];
    },
  });

  const { data: productionStages } = useQuery({
    queryKey: ['production-stages-list'],
    queryFn: async () => {
      const { data } = await supabase.from('production_stages' as any).select('*').order('sort_order');
      return data || [];
    },
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['worker-stage-assignments-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('worker_stage_assignments' as any)
        .select('*, production_stages(name, label)');
      return data || [];
    },
  });

  const { data: commissionPresets } = useQuery({
    queryKey: ['commission-presets-list'],
    queryFn: async () => {
      const { data } = await supabase.from('commission_presets' as any).select('*');
      return data || [];
    },
  });

  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedWorker || !selectedStage) throw new Error('Select worker and stage');
      const { error } = await supabase.from('worker_stage_assignments' as any).insert({
        worker_id: selectedWorker,
        stage_id: selectedStage,
        rate_override: parseFloat(rateOverride) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Assignment added' });
      setSelectedWorker('');
      setSelectedStage('');
      setRateOverride('');
      queryClient.invalidateQueries({ queryKey: ['worker-stage-assignments-admin'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('worker_stage_assignments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-stage-assignments-admin'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const updateRate = useMutation({
    mutationFn: async ({ id, rate_override }: { id: string; rate_override: number | null }) => {
      const { error } = await supabase.from('worker_stage_assignments' as any).update({ rate_override }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-stage-assignments-admin'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const getWorkerName = (id: string) => workers?.find(w => w.user_id === id)?.full_name || id.slice(0, 8);
  const getStageName = (id: string) => {
    const ps = productionStages?.find((s: any) => s.id === id);
    if (ps) return ps.label;
    return id.slice(0, 8);
  };

  const filtered = (assignments || []).filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return getWorkerName(a.worker_id).toLowerCase().includes(q) || getStageName(a.stage_id).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Worker Stage Assignments</h2>
        <p className="text-sm text-muted-foreground">Assign workshop workers to production stages with optional rate overrides</p>
      </div>

      {/* Add Assignment Form */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Assign Worker to Stage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); addAssignment.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Worker *</Label>
                <select value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}
                  className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">Select worker...</option>
                  {(workers || []).map((w: any) => (
                    <option key={w.user_id} value={w.user_id}>{w.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Stage *</Label>
                <select value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">Select stage...</option>
                  {(productionStages || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Rate Override (KES, optional)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" value={rateOverride} onChange={(e) => setRateOverride(e.target.value)}
                    className="h-12 pl-10 text-sm" placeholder="Leave blank for default" min="0" />
                </div>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full"
              disabled={addAssignment.isPending || !selectedWorker || !selectedStage}>
              {addAssignment.isPending ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
              Assign Stage
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Assignments */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by worker or stage..." className="pl-10 h-11" />
      </div>

      {assignmentsLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No assignments found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a: any) => (
            <Card key={a.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground text-sm">{getWorkerName(a.worker_id)}</span>
                      <Badge variant="outline" className="text-[10px]">{getStageName(a.stage_id)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {a.rate_override ? (
                        <span className="text-xs text-success font-medium">Rate: {formatCurrency(a.rate_override)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Default rate</span>
                      )}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded", a.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <select value={a.rate_override || ''} onChange={(e) => updateRate.mutate({ id: a.id, rate_override: e.target.value ? parseFloat(e.target.value) : null })}
                      className="h-8 rounded border border-input bg-background px-2 text-[10px]">
                      <option value="">Default rate</option>
                      {[500, 600, 800, 1000, 1200, 1500].map(r => (
                        <option key={r} value={r}>{formatCurrency(r)}</option>
                      ))}
                    </select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeAssignment.mutate(a.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerStageAssignmentsPage;
