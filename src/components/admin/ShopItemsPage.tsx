import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Store, Pencil, Search, DollarSign, Building2, Package, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

type StockLevel = 'good' | 'moderate' | 'low' | 'out';

const getStockLevel = (qty: number): StockLevel => {
  if (qty <= 0) return 'out';
  if (qty <= 3) return 'low';
  if (qty <= 10) return 'moderate';
  return 'good';
};

const stockConfig: Record<StockLevel, { label: string; color: string; icon: any }> = {
  good: { label: 'Good Stock', color: 'bg-success/10 text-success border-success/30', icon: CheckCircle },
  moderate: { label: 'Moderate', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: TrendingDown },
  low: { label: 'Low Stock', color: 'bg-warning/10 text-warning border-warning/30', icon: AlertTriangle },
  out: { label: 'Out of Stock', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: X },
};

const ShopItemsPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ branch_id: '', name: '', type: 'service' as 'service' | 'good', unit_price: '' });
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['shop-items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_items' as any).select('*, branches(name)').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: branchStock, isLoading: stockLoading } = useQuery({
    queryKey: ['branch-stock-overview'],
    queryFn: async () => {
      const { data: inventory } = await supabase
        .from('shop_inventory')
        .select('branch_id, finished_products(product_type, status)') as any;
      if (!inventory) return [];

      const grouped: Record<string, Record<string, number>> = {};
      for (const row of inventory) {
        const bid = row.branch_id;
        const pt = row.finished_products?.product_type || 'Unknown';
        if (!grouped[bid]) grouped[bid] = {};
        grouped[bid][pt] = (grouped[bid][pt] || 0) + 1;
      }
      return Object.entries(grouped).map(([branch_id, products]) => ({
        branch_id,
        products: Object.entries(products).map(([name, qty]) => ({ name, qty })),
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Item name is required');
      const payload = {
        branch_id: form.branch_id || null,
        name: form.name.trim(),
        type: form.type,
        unit_price: parseFloat(form.unit_price) || 0,
      };
      if (editId) {
        const { error } = await supabase.from('shop_items' as any).update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shop_items' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? 'Item updated' : 'Item created' });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('shop_items' as any).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shop-items'] }),
  });

  const resetForm = () => {
    setForm({ branch_id: '', name: '', type: 'service', unit_price: '' });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (item: any) => {
    setForm({ branch_id: item.branch_id || '', name: item.name, type: item.type, unit_price: String(item.unit_price || 0) });
    setEditId(item.id);
    setShowForm(true);
  };

  const filtered = (items || []).filter((i: any) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase());
    const matchesBranch = !filterBranch || i.branch_id === filterBranch;
    return matchesSearch && matchesBranch;
  });

  const getBranchStock = (branchId: string | null) => {
    if (!branchId) return [];
    return branchStock?.find((bs: any) => bs.branch_id === branchId)?.products || [];
  };

  const getTotalStockByLevel = (branchId: string) => {
    const products = getBranchStock(branchId);
    return {
      good: products.filter((p: any) => getStockLevel(p.qty) === 'good').length,
      moderate: products.filter((p: any) => getStockLevel(p.qty) === 'moderate').length,
      low: products.filter((p: any) => getStockLevel(p.qty) === 'low').length,
      out: products.filter((p: any) => getStockLevel(p.qty) === 'out').length,
      total: products.reduce((s: number, p: any) => s + p.qty, 0),
    };
  };

  const allBranchIds = [...new Set([...(branches || []).map((b: any) => b.id)])];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Shop Items & Stock by Branch</h2>
        <p className="text-sm text-muted-foreground">Monitor product stock levels across all branches</p>
      </div>

      {/* Branch Stock Overview */}
      {stockLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(branches || []).map((b: any) => {
            const stock = getTotalStockByLevel(b.id);
            const products = getBranchStock(b.id);
            return (
              <Card key={b.id} className={cn("border", products.length === 0 && "opacity-60")}>
                <CardHeader className="pb-2 px-4 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {b.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">{stock.total} units</Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {/* Stock level summary chips */}
                  <div className="flex flex-wrap gap-1">
                    {stock.good > 0 && (
                      <Badge className="text-[9px] bg-success/10 text-success border-success/30 hover:bg-success/20">
                        {stock.good} good
                      </Badge>
                    )}
                    {stock.moderate > 0 && (
                      <Badge className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20">
                        {stock.moderate} moderate
                      </Badge>
                    )}
                    {stock.low > 0 && (
                      <Badge className="text-[9px] bg-warning/10 text-warning border-warning/30 hover:bg-warning/20">
                        {stock.low} low
                      </Badge>
                    )}
                    {stock.out > 0 && (
                      <Badge className="text-[9px] bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">
                        {stock.out} out
                      </Badge>
                    )}
                    {products.length === 0 && (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">No products</Badge>
                    )}
                  </div>

                  {/* Product list with stock levels */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {products.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No stock assigned to this branch</p>
                    )}
                    {products.map((p: any) => {
                      const level = getStockLevel(p.qty);
                      const cfg = stockConfig[level];
                      const Icon = cfg.icon;
                      return (
                        <div key={p.name} className="flex items-center justify-between py-1 px-2 rounded bg-accent/30 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Icon className={cn("h-3 w-3 shrink-0", level === 'good' ? 'text-success' : level === 'low' ? 'text-warning' : level === 'out' ? 'text-destructive' : 'text-blue-500')} />
                            <span className="truncate text-foreground">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="font-bold text-foreground">{p.qty}</span>
                            <span className={cn("text-[8px] px-1 py-0.5 rounded border font-medium", cfg.color)}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">Shop Catalogue</h3>
            <p className="text-sm text-muted-foreground">Manage services and goods sold at branches</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Add Item'}
          </Button>
        </div>

        {showForm && (
          <Card className="border-primary/20 mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                {editId ? 'Edit Shop Item' : 'New Shop Item'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Hearse Hire, Flowers" className="h-12" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setForm(f => ({ ...f, type: 'service' }))}
                        className={cn("flex-1 py-3 rounded-xl text-sm font-medium border transition-colors", form.type === 'service' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
                        Service
                      </button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, type: 'good' }))}
                        className={cn("flex-1 py-3 rounded-xl text-sm font-medium border transition-colors", form.type === 'good' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
                        Good
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price (Ksh)</Label>
                    <Input type="number" value={form.unit_price} onChange={(e) => setForm(f => ({ ...f, unit_price: e.target.value }))} className="h-12" min="0" step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <select value={form.branch_id} onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))}
                      className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="">All branches</option>
                      {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !form.name.trim()}>
                  {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                  {editId ? 'Update Item' : 'Create Item'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="pl-10 h-11" />
          </div>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm min-w-[120px]">
            <option value="">All branches</option>
            {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="border"><CardContent className="p-12 text-center">
            <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No shop items found</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((item: any) => (
              <Card key={item.id} className={cn("border", !item.is_active && "opacity-60")}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full", item.type === 'service' ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600")}>
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {item.unit_price > 0 && <span className="font-medium text-success">{formatCurrency(item.unit_price)}</span>}
                      {item.branches?.name && <span>{item.branches.name}</span>}
                      {!item.is_active && <span className="text-muted-foreground">Inactive</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}>
                      <X className={cn("h-3.5 w-3.5", item.is_active ? "text-warning" : "text-success")} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopItemsPage;
