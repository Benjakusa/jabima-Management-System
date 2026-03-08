import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Search, Receipt, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Transport', 'Fuel', 'Repairs', 'Supplies', 'Utilities', 'Rent', 'Salary Advance', 'Miscellaneous'];

interface ExpenseForm {
  category: string;
  amount: string;
  description: string;
  date: string;
}

const emptyForm: ExpenseForm = { category: 'Transport', amount: '', description: '', date: new Date().toISOString().slice(0, 10) };

const ExpenseList = () => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['expense-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.amount || !form.category) throw new Error('Please fill required fields');
      const { error } = await supabase.from('expenses').insert({
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description.trim() || null,
        date: form.date,
        recorded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Expense recorded!' });
      setShowForm(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['expenses-all'] });
      queryClient.invalidateQueries({ queryKey: ['report-expenses'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Expense deleted' });
      queryClient.invalidateQueries({ queryKey: ['expenses-all'] });
      queryClient.invalidateQueries({ queryKey: ['report-expenses'] });
    },
  });

  const filtered = (expenses || []).filter(e =>
    (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  const getName = (uid: string) => profiles?.find(p => p.user_id === uid)?.full_name || 'Unknown';
  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { setForm(emptyForm); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Expense'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Record Expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (Ksh) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-12" min="0" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" className="h-12" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={createMutation.isPending || !form.amount}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />}
                Record Expense
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="pl-10 h-11" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No expenses recorded yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <Card key={e.id} className="border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-foreground truncate">{e.description || e.category}</p>
                    <span className="text-xs font-bold text-destructive">{fmt(e.amount)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="bg-secondary px-2 py-0.5 rounded-md">{e.category}</span>
                    <span>{getName(e.recorded_by)}</span>
                    <span>{new Date(e.date).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(e.id)} className="h-8 w-8 shrink-0 ml-2 text-destructive hover:bg-destructive/10">
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

export default ExpenseList;
