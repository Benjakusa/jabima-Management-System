import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Pencil, Trash2, Loader2, Search, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaterialForm {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  min_stock_level: string;
  supplier_id: string;
}

const emptyForm: MaterialForm = {
  name: '', category: '', quantity: '0', unit: '', unit_cost: '0', min_stock_level: '0', supplier_id: '',
};

const FALLBACK_CATEGORIES = ['Wood', 'Fabric', 'Hardware', 'Paint', 'Glass', 'Adhesive', 'Metal', 'Other'];
const units = ['pieces', 'sheets', 'meters', 'feet', 'liters', 'kg', 'rolls', 'boxes', 'pairs'];

const RawMaterialsList = () => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: materials, isLoading } = useQuery({
    queryKey: ['inventory-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_materials')
        .select('*, suppliers(name)')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  useQuery({
    queryKey: ['mat-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('material_categories' as any).select('name').eq('is_active', true).order('name');
      if (data && data.length > 0) setCategories(data.map((c: any) => c.name));
      return data || [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name').order('name');
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        unit_cost: parseFloat(form.unit_cost) || 0,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        supplier_id: form.supplier_id || null,
      };

      if (editId) {
        const { error } = await supabase.from('inventory_materials').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_materials').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? 'Material updated' : 'Material added' });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['inventory-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-materials-overview'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Material deleted' });
      queryClient.invalidateQueries({ queryKey: ['inventory-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-materials-overview'] });
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

  const startEdit = (material: any) => {
    setForm({
      name: material.name,
      category: material.category,
      quantity: String(material.quantity),
      unit: material.unit,
      unit_cost: String(material.unit_cost),
      min_stock_level: String(material.min_stock_level),
      supplier_id: material.supplier_id || '',
    });
    setEditId(material.id);
    setShowForm(true);
  };

  const filtered = (materials || []).filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || m.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (val: number) => `Ksh ${val.toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} material{filtered.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Material'}
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {editId ? 'Edit Material' : 'Add New Material'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Pine Wood Planks" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          form.category === cat ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                        )}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} className="h-12" min="0" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {units.map(u => (
                      <button key={u} type="button" onClick={() => setForm(f => ({ ...f, unit: u }))}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          form.unit === u ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                        )}>{u}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost (Ksh)</Label>
                  <Input type="number" value={form.unit_cost} onChange={(e) => setForm(f => ({ ...f, unit_cost: e.target.value }))} className="h-12" min="0" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label>Min Stock Level</Label>
                  <Input type="number" value={form.min_stock_level} onChange={(e) => setForm(f => ({ ...f, min_stock_level: e.target.value }))} className="h-12" min="0" step="0.01" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Supplier</Label>
                  <select
                    value={form.supplier_id}
                    onChange={(e) => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No supplier</option>
                    {(suppliers || []).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !form.name || !form.category || !form.unit}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {editId ? 'Update Material' : 'Add Material'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search materials..." className="pl-10 h-11" />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm min-w-[100px]"
        >
          <option value="">All</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* Materials list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No materials found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((material) => {
            const isLow = material.quantity <= material.min_stock_level;
            const totalValue = material.quantity * material.unit_cost;
            return (
              <Card key={material.id} className={cn("border", isLow && "border-warning/40 bg-warning/5")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground truncate">{material.name}</p>
                        {isLow && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning shrink-0">LOW</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="bg-secondary px-2 py-0.5 rounded-md">{material.category}</span>
                        <span>{material.quantity} {material.unit}</span>
                        <span>{formatCurrency(material.unit_cost)} / {material.unit}</span>
                        <span className="font-medium text-foreground">Total: {formatCurrency(totalValue)}</span>
                      </div>
                      {(material as any).suppliers?.name && (
                        <p className="text-xs text-muted-foreground mt-1">Supplier: {(material as any).suppliers.name}</p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(material)} className="h-8 w-8">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm('Delete this material?')) deleteMutation.mutate(material.id);
                      }} className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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

export default RawMaterialsList;
