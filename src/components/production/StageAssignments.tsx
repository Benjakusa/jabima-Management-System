import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Users, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGES } from './ProductionPipeline';

const StageAssignments = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get workshop workers
  const { data: workers } = useQuery({
    queryKey: ['workshop-workers'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'workshop_worker');
      if (!roles || roles.length === 0) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      return profiles || [];
    },
  });

  // Get all assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['stage-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stage_assignments').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Get profiles for assignment display
  const { data: allProfiles } = useQuery({
    queryKey: ['all-worker-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorker || !selectedStage) throw new Error('Select worker and stage');
      const { error } = await supabase.from('stage_assignments').insert({
        user_id: selectedWorker,
        stage: selectedStage as any,
      });
      if (error) {
        if (error.code === '23505') throw new Error('This worker is already assigned to this stage');
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Worker assigned to stage' });
      setSelectedWorker('');
      setSelectedStage('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['stage-assignments'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stage_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Assignment removed' });
      queryClient.invalidateQueries({ queryKey: ['stage-assignments'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const getWorkerName = (userId: string) => 
    allProfiles?.find(p => p.user_id === userId)?.full_name || 'Unknown';

  // Group assignments by stage
  const stageAssignmentGroups = STAGES.map(stage => ({
    ...stage,
    assigned: (assignments || []).filter(a => a.stage === stage.value),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {workers?.length || 0} workshop worker{(workers?.length || 0) !== 1 ? 's' : ''} •{' '}
            {assignments?.length || 0} assignment{(assignments?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Assign Worker'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Select Worker</p>
              {(!workers || workers.length === 0) ? (
                <p className="text-xs text-muted-foreground bg-warning/10 border border-warning/20 rounded-xl p-3">
                  No workshop workers found. Create users with the "Workshop Worker" role first.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2">
                  {workers.map(w => (
                    <button key={w.user_id} type="button" onClick={() => setSelectedWorker(w.user_id)}
                      className={cn("px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors text-center truncate",
                        selectedWorker === w.user_id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                      )}>{w.full_name}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Select Stage</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-5 gap-2">
                {STAGES.map(s => (
                  <button key={s.value} type="button" onClick={() => setSelectedStage(s.value)}
                    className={cn("px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 justify-center",
                      selectedStage === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                    )}>
                    {s.icon}
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => assignMutation.mutate()} size="lg" className="w-full"
              disabled={assignMutation.isPending || !selectedWorker || !selectedStage}>
              {assignMutation.isPending ? <Loader2 className="animate-spin" /> : <Users className="h-4 w-4" />}
              Assign Worker
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assignments grid by stage */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {stageAssignmentGroups.map((stage) => (
            <div key={stage.value} className="bg-card rounded-2xl border overflow-hidden">
              <div className="flex items-center gap-3 p-3 border-b bg-secondary/30">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground", stage.color)}>
                  {stage.icon}
                </div>
                <p className="font-medium text-sm text-foreground flex-1">{stage.label}</p>
                <span className={cn(
                  "text-xs font-bold px-2.5 py-1 rounded-full",
                  stage.assigned.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {stage.assigned.length} worker{stage.assigned.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="p-2">
                {stage.assigned.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No workers assigned</p>
                ) : (
                  <div className="space-y-1">
                    {stage.assigned.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-accent/50">
                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-primary text-xs font-bold">{getWorkerName(a.user_id).charAt(0)}</span>
                        </div>
                        <p className="text-sm text-foreground flex-1 truncate">{getWorkerName(a.user_id)}</p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Remove this assignment?')) removeMutation.mutate(a.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StageAssignments;
