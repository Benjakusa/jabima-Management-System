import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Tags, Pencil, Search, DollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const ProductsDesignsPage = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'Casket', description: '', selling_price: '' });
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products' as any).select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Product name is required');
      const payload = {
        name: form.name.trim(),
        category: form.category || null,
        description: form.description.trim() || null,
        selling_price: parseFloat(form.selling_price) || 0,
        created_by: user?.id,
      };
      if (editId) {
        const { error } = await supabase.from('products' as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? 'Product updated' : 'Product created' });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('products' as any).update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
    },
  });

  const resetForm = () => {
    setForm({ name: '', category: 'Casket', description: '', selling_price: '' });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (p: any) => {
    setForm({ name: p.name, category: p.category || '', description: p.description || '', selling_price: String(p.selling_price || 0) });
    setEditId(p.id);
    setShowForm(true);
  };

  const filtered = (products || []).filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Products / Designs</h2>
          <p className="text-sm text-muted-foreground">Manage casket designs and product catalogue</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Product'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" />
              {editId ? 'Edit Product' : 'New Product / Design'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Executive, Half glass" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Casket, Urn, Accessory" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price (Ksh)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" value={form.selling_price} onChange={(e) => setForm(f => ({ ...f, selling_price: e.target.value }))} className="h-12 pl-10" min="0" step="0.01" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="h-12" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !form.name.trim()}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {editId ? 'Update Product' : 'Create Product'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 h-11" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Tags className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No products found</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((p: any) => (
            <Card key={p.id} className={cn("border", !p.is_active && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {p.category && <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-md">{p.category}</span>}
                      {p.selling_price > 0 && <span className="text-[10px] font-bold text-success">{formatCurrency(p.selling_price)}</span>}
                      {!p.is_active && <span className="text-[10px] text-muted-foreground">Inactive</span>}
                    </div>
                    {p.description && <p className="text-[10px] text-muted-foreground mt-1">{p.description}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                      <X className={cn("h-3.5 w-3.5", p.is_active ? "text-warning" : "text-success")} />
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

export default ProductsDesignsPage;
