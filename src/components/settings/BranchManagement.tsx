import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Building2, Trash2, MapPin } from 'lucide-react';

interface BranchForm {
  name: string;
  location: string;
}

const emptyForm: BranchForm = { name: '', location: '' };

const BranchManagement = () => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Branch name is required');
      const { error } = await supabase.from('branches').insert({
        name: form.name.trim(),
        location: form.location.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Branch created!' });
      setShowForm(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['branches-settings'] });
      queryClient.invalidateQueries({ queryKey: ['branches-list'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Branch deleted' });
      queryClient.invalidateQueries({ queryKey: ['branches-settings'] });
      queryClient.invalidateQueries({ queryKey: ['branches-list'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{branches?.length || 0} branch{(branches?.length || 0) !== 1 ? 'es' : ''}</p>
        <Button onClick={() => { setForm(emptyForm); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Branch'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              New Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nairobi Main" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Mombasa Road" className="h-12" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={createMutation.isPending || !form.name.trim()}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Branch
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : (!branches || branches.length === 0) ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No branches created yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {branches.map(b => (
            <Card key={b.id} className="border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{b.name}</p>
                    {b.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{b.location}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(b.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
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

export default BranchManagement;
