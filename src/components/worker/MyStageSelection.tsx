import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Check, Factory, DollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { STAGES } from '@/components/production/ProductionPipeline';

const MyStageSelection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: myAssignments, isLoading } = useQuery({
    queryKey: ['my-stage-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('stage_assignments')
        .select('stage')
        .eq('user_id', user!.id);
      return data?.map(a => a.stage) || [];
    },
    enabled: !!user,
  });

  const { data: myWorkerAssignments } = useQuery({
    queryKey: ['my-worker-stage-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('worker_stage_assignments' as any)
        .select('*, production_stages(name, label)')
        .eq('worker_id', user!.id);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (stage: string) => {
      const { error } = await supabase.from('stage_assignments').insert({
        user_id: user!.id,
        stage: stage,
      } as any);
      if (error) {
        if (error.code === '23505') throw new Error('Already assigned to this stage');
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Stage added!' });
      queryClient.invalidateQueries({ queryKey: ['my-stage-assignments'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const removeMutation = useMutation({
    mutationFn: async (stage: string) => {
      const { error } = await supabase
        .from('stage_assignments')
        .delete()
        .eq('user_id', user!.id)
        .eq('stage', stage as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Stage removed' });
      queryClient.invalidateQueries({ queryKey: ['my-stage-assignments'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const getRateOverride = (stageValue: string): number | null => {
    const stage = STAGES.find(s => s.value === stageValue);
    if (!stage) return null;
    const workerAss = (myWorkerAssignments || []).find((a: any) => a.production_stages?.name === stageValue);
    return workerAss?.rate_override || null;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <h3 className="font-semibold text-foreground text-sm mb-1">Choose Your Stages</h3>
        <p className="text-xs text-muted-foreground">
          Tap a stage to add or remove it from your list. Stages with custom rates show your earnings per task.
        </p>
      </div>

      <div className="space-y-2">
        {STAGES.map(stage => {
          const isAssigned = myAssignments?.includes(stage.value);
          const isPending = addMutation.isPending || removeMutation.isPending;
          const rateOverride = getRateOverride(stage.value);

          return (
            <Card
              key={stage.value}
              className={cn(
                "border cursor-pointer transition-all",
                isAssigned ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "hover:border-primary/30"
              )}
              onClick={() => {
                if (isPending) return;
                if (isAssigned) {
                  removeMutation.mutate(stage.value);
                } else {
                  addMutation.mutate(stage.value);
                }
              }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground transition-colors",
                  stage.color,
                  isAssigned && "ring-2 ring-primary ring-offset-2"
                )}>
                  {stage.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{stage.label}</p>
                  {rateOverride && (
                    <p className="text-[10px] text-success font-medium flex items-center gap-1 mt-0.5">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(rateOverride)} per task
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isAssigned ? (
                    <>
                      <span className="text-xs text-primary font-medium">Selected</span>
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">Tap to add</span>
                      <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                        <Plus className="h-3 w-3 text-muted-foreground/50" />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {myWorkerAssignments && (myWorkerAssignments as any[]).length > 0 && (
        <Card className="border border-success/20 bg-success/5">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-success" />
              Custom Rates from Admin
            </h4>
            <div className="space-y-1">
              {(myWorkerAssignments as any[]).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span>{a.production_stages?.label || 'Unknown stage'}</span>
                  {a.rate_override ? (
                    <span className="font-medium text-success">{formatCurrency(a.rate_override)}</span>
                  ) : (
                    <span className="text-muted-foreground">Default rate</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-card rounded-2xl border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{myAssignments?.length || 0}</span> stage{myAssignments?.length !== 1 ? 's' : ''} selected
        </p>
        {myAssignments && myAssignments.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            You can work on tasks at: {myAssignments.map(s => STAGES.find(st => st.value === s)?.label).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
};

export default MyStageSelection;
