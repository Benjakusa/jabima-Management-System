import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Pencil, Trash2, Loader2, Search, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EquipmentForm {
  name: string;
  category: string;
  quantity: string;
  condition: string;
  location: string;
}

const emptyForm: EquipmentForm = {
  name: '', category: '', quantity: '1', condition: 'good', location: '',
};

const eqCategories = ['Transport', 'Decoration', 'Ceremony', 'Tools', 'Storage', 'Cleaning', 'Other'];
const conditions = [
  { value: 'good', label: 'Good', color: 'bg-success/10 text-success' },
  { value: 'fair', label: 'Fair', color: 'bg-warning/10 text-warning' },
  { value: 'needs_repair', label: 'Needs Repair', color: 'bg-destructive/10 text-destructive' },
  { value: 'retired', label: 'Retired', color: 'bg-muted text-muted-foreground' },
];

const ServiceEquipmentList = () => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EquipmentForm>(emptyForm);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['inventory-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_services').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        quantity: parseInt(form.quantity) || 1,
        condition: form.condition,
        location: form.location.trim() || null,
      };
      if (editId) {
        const { error } = await supabase.from('inventory_services').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_services').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? 'Equipment updated' : 'Equipment added' });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['inventory-services'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-services-overview'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Equipment deleted' });
      queryClient.invalidateQueries({ queryKey: ['inventory-services'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-services-overview'] });
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

  const startEdit = (eq: any) => {
    setForm({
      name: eq.name,
      category: eq.category,
      quantity: String(eq.quantity),
      condition: eq.condition || 'good',
      location: eq.location || '',
    });
    setEditId(eq.id);
    setShowForm(true);
  };

  const filtered = (equipment || []).filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Equipment'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              {editId ? 'Edit Equipment' : 'Add New Equipment'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Hearse Cover Set" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {eqCategories.map(cat => (
                      <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          form.category === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                        )}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} className="h-12" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {conditions.map(c => (
                      <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, condition: c.value }))}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          form.condition === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                        )}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Location</Label>
                  <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Main Warehouse" className="h-12" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !form.name || !form.category}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {editId ? 'Update Equipment' : 'Add Equipment'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment..." className="pl-10 h-11" />
      </div>

      {/* Equipment list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No equipment found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((eq) => {
            const condObj = conditions.find(c => c.value === eq.condition) || conditions[0];
            return (
              <Card key={eq.id} className="border">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{eq.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                      <span className="bg-secondary px-2 py-0.5 rounded-md">{eq.category}</span>
                      <span>Qty: {eq.quantity}</span>
                      {eq.location && <span>{eq.location}</span>}
                    </div>
                  </div>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full shrink-0", condObj.color)}>
                    {condObj.label}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(eq)} className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm('Delete this equipment?')) deleteMutation.mutate(eq.id);
                    }} className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServiceEquipmentList;
