import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Pencil, Trash2, Loader2, Users, Phone, Mail } from 'lucide-react';

interface SupplierForm {
  name: string;
  contact: string;
  email: string;
}

const emptyForm: SupplierForm = { name: '', contact: '', email: '' };

const SuppliersList = () => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim() || null,
        email: form.email.trim() || null,
      };
      if (editId) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suppliers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? 'Supplier updated' : 'Supplier added' });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Supplier deleted' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (s: any) => {
    setForm({ name: s.name, contact: s.contact || '', email: s.email || '' });
    setEditId(s.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{suppliers?.length || 0} supplier{(suppliers?.length || 0) !== 1 ? 's' : ''}</p>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Supplier'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {editId ? 'Edit Supplier' : 'Add New Supplier'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Supplier name" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.contact} onChange={(e) => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="+254 700 000 000" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@email.com" className="h-12" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !form.name}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {editId ? 'Update Supplier' : 'Add Supplier'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (suppliers || []).length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No suppliers yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(suppliers || []).map((s) => (
            <Card key={s.id} className="border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">{s.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{s.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    {s.contact && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.contact}</span>
                    )}
                    {s.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(s)} className="h-8 w-8">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm('Delete this supplier?')) deleteMutation.mutate(s.id);
                  }} className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuppliersList;
