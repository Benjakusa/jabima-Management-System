import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Layers, Pencil, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const MaterialCategoriesPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['material-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('material_categories' as any).select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Category name is required');
      if (editId) {
        const { error } = await supabase.from('material_categories' as any).update({ name: name.trim() }).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('material_categories' as any).insert({ name: name.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? 'Category updated' : 'Category created' });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('material_categories' as any).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      toast({ title: 'Category updated' });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const resetForm = () => {
    setName('');
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (cat: any) => {
    setName(cat.name);
    setEditId(cat.id);
    setShowForm(true);
  };

  const filtered = (categories || []).filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Material Categories</h2>
          <p className="text-sm text-muted-foreground">Manage material categories for inventory</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Category'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {editId ? 'Edit Category' : 'New Category'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wood, Fabric, Hardware" className="h-12" required />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !name.trim()}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {editId ? 'Update Category' : 'Create Category'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..." className="pl-10 h-11" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No categories found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((cat: any) => (
            <Card key={cat.id} className={cn("border", !cat.is_active && "opacity-60")}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{cat.name}</p>
                    {!cat.is_active && <span className="text-[10px] text-muted-foreground">Inactive</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActiveMutation.mutate({ id: cat.id, is_active: !cat.is_active })}>
                    <Trash2 className={cn("h-3.5 w-3.5", cat.is_active ? "text-warning" : "text-success")} />
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

export default MaterialCategoriesPage;
