import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Search, ShoppingCart, Receipt, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaleForm {
  finished_product_id: string;
  customer_name: string;
  customer_phone: string;
  selling_price: string;
  mpesa_code: string;
  branch_id: string;
  enable_instalments: boolean;
  deposit: string;
  frequency: string;
  num_instalments: string;
}

const emptyForm: SaleForm = {
  finished_product_id: '', customer_name: '', customer_phone: '', selling_price: '', mpesa_code: '', branch_id: '',
  enable_instalments: false, deposit: '', frequency: 'monthly', num_instalments: '3',
};

interface Props {
  onViewReceipt: (saleId: string) => void;
}

const ProductSalesList = ({ onViewReceipt }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sales, isLoading } = useQuery({
    queryKey: ['product-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: finishedProducts } = useQuery({
    queryKey: ['available-products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('finished_products')
        .select('id, product_type, production_cost')
        .eq('status', 'completed')
        .not('status', 'is', 'sold');
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

  const { data: profiles } = useQuery({
    queryKey: ['sales-officer-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const selectedProduct = finishedProducts?.find(p => p.id === form.finished_product_id);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.finished_product_id || !form.customer_name.trim() || !form.selling_price) {
        throw new Error('Please fill all required fields');
      }
      if (!form.enable_instalments && !form.mpesa_code.trim()) {
        throw new Error('MPESA code required (or enable Lipa Pole Pole)');
      }
      const product = finishedProducts?.find(p => p.id === form.finished_product_id);
      if (!product) throw new Error('Product not found');

      const sellingPrice = parseFloat(form.selling_price);
      const depositAmount = form.enable_instalments ? (parseFloat(form.deposit) || 0) : sellingPrice;

      const { data, error } = await supabase.from('sales').insert({
        finished_product_id: form.finished_product_id,
        product_type: product.product_type,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        selling_price: sellingPrice,
        amount_paid: depositAmount,
        payment_status: form.enable_instalments ? (depositAmount > 0 ? 'partial' : 'unpaid') : 'paid',
        is_lipa_pole_pole: form.enable_instalments,
        instalment_plan: form.enable_instalments ? form.frequency : null,
        mpesa_code: form.mpesa_code.trim().toUpperCase() || `INSTALMENT-${Date.now().toString().slice(-6)}`,
        sales_officer_id: user!.id,
        branch_id: form.branch_id || null,
      } as any).select().single();
      if (error) throw error;

      // Generate instalment schedule when Lipa Pole Pole is enabled
      if (form.enable_instalments) {
        const deposit = parseFloat(form.deposit) || 0;
        const num = parseInt(form.num_instalments) || 1;
        const remaining = sellingPrice - deposit;
        const perInstallment = remaining / num;
        const startDate = new Date();
        const rows = [];
        for (let i = 0; i < num; i++) {
          const due = new Date(startDate);
          if (form.frequency === 'weekly') due.setDate(due.getDate() + (i + 1) * 7);
          else if (form.frequency === 'monthly') due.setMonth(due.getMonth() + (i + 1));
          else due.setMonth(due.getMonth() + (i + 1) * 3);
          rows.push({
            sale_id: data.id,
            due_date: due.toISOString().split('T')[0],
            amount_due: i === num - 1 ? +(remaining - perInstallment * (num - 1)).toFixed(2) : +perInstallment.toFixed(2),
            amount_paid: 0,
            status: 'pending',
          });
        }
        const { error: instError } = await supabase.from('instalment_schedule' as any).insert(rows);
        if (instError) throw instError;
      }

      // Update finished product status to sold
      await supabase.from('finished_products').update({ status: 'sold' as any }).eq('id', form.finished_product_id);

      return data;
    },
    onSuccess: (data) => {
      toast({ title: form.enable_instalments ? 'Sale with instalment plan created!' : 'Sale recorded successfully!' });
      setShowForm(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['available-products'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['sales-week'] });
      queryClient.invalidateQueries({ queryKey: ['sales-month'] });
      queryClient.invalidateQueries({ queryKey: ['recent-sales'] });
      queryClient.invalidateQueries({ queryKey: ['instalment-schedules'] });
      if (data) onViewReceipt(data.id);
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const filtered = (sales || []).filter(s =>
    s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    s.product_type.toLowerCase().includes(search.toLowerCase()) ||
    s.mpesa_code.toLowerCase().includes(search.toLowerCase())
  );

  const getName = (id: string) => profiles?.find(p => p.user_id === id)?.full_name || 'Unknown';
  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} sale{filtered.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { setForm(emptyForm); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Sale'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Record Product Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              {/* Product selection */}
              <div className="space-y-2">
                <Label>Select Product *</Label>
                {(!finishedProducts || finishedProducts.length === 0) ? (
                  <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl p-3">
                    No finished products available for sale. Complete production orders first.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {finishedProducts.map(p => (
                      <button key={p.id} type="button" onClick={() => setForm(f => ({ ...f, finished_product_id: p.id }))}
                        className={cn("px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors text-left",
                          form.finished_product_id === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                        )}>
                        <p className="font-medium">{p.product_type}</p>
                        <p className={cn("text-[10px]", form.finished_product_id === p.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          ID: {p.id.slice(0, 8)} • Cost: {fmt(p.production_cost)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input value={form.customer_name} onChange={(e) => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer full name" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Customer Phone</Label>
                  <Input value={form.customer_phone} onChange={(e) => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="+254 700 000 000" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price (Ksh) *</Label>
                  <Input type="number" value={form.selling_price} onChange={(e) => setForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="0" className="h-12" min="0" step="0.01" required />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">Production cost: {fmt(selectedProduct.production_cost)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>MPESA Transaction Code *</Label>
                  <Input value={form.mpesa_code} onChange={(e) => setForm(f => ({ ...f, mpesa_code: e.target.value }))} placeholder="e.g. SHK7Y2X9RQ" className="h-12 uppercase" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Branch</Label>
                  <select value={form.branch_id} onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">No branch</option>
                    {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Lipa Pole Pole Toggle */}
              <div className="space-y-2 border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.enable_instalments} onChange={e => setForm(f => ({ ...f, enable_instalments: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="text-sm font-medium">
                    Lipa Pole Pole <span className="text-muted-foreground font-normal">(Instalment Plan)</span>
                  </span>
                </label>
                {form.enable_instalments && (
                  <div className="bg-accent/20 p-3 rounded-lg grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Deposit (Ksh)</Label>
                      <Input type="number" value={form.deposit} onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} className="h-10 text-sm" placeholder="0" min="0" />
                    </div>
                    <div>
                      <Label className="text-xs">Frequency</Label>
                      <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Instalments</Label>
                      <Input type="number" min="1" max="24" value={form.num_instalments} onChange={e => setForm(f => ({ ...f, num_instalments: e.target.value }))} className="h-10 text-sm" />
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" size="lg" className="w-full"
                disabled={createMutation.isPending || !form.finished_product_id || !form.customer_name || !form.selling_price || (!form.enable_instalments && !form.mpesa_code)}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {form.enable_instalments ? 'Complete Sale with Instalment Plan' : 'Complete Sale & Generate Receipt'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer, product, or MPESA code..." className="pl-10 h-11" />
      </div>

      {/* Sales list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No sales recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sale) => (
            <Card key={sale.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">{sale.product_type}</p>
                      <span className="text-xs font-bold text-success">{fmt(sale.selling_price)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{sale.customer_name}</span>
                      <span className="bg-secondary px-2 py-0.5 rounded-md font-mono">{sale.mpesa_code}</span>
                      <span>{getName(sale.sales_officer_id)}</span>
                      <span>{new Date(sale.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onViewReceipt(sale.id)} className="h-8 w-8 shrink-0 ml-2">
                    <Receipt className="h-3.5 w-3.5" />
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

export default ProductSalesList;
