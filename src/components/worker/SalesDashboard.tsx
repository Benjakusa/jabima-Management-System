import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LogOut, ShoppingCart, Briefcase, Plus, X, Loader2, Receipt, Search, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import SaleReceipt from '@/components/sales/SaleReceipt';
import DailyReportForm from './DailyReportForm';
import DailyReportReminder from './DailyReportReminder';

const SERVICE_TYPES = ['Body Preservation', 'Body Transport', 'Hearse Service', 'Mortuary Service', 'Funeral Arrangement', 'Other'];

const SalesDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'home' | 'product' | 'service' | 'receipt'>('home');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'product' | 'service'>('product');

  // My sales
  const { data: mySales } = useQuery({
    queryKey: ['my-product-sales', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*').eq('sales_officer_id', user!.id).order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: myServiceSales } = useQuery({
    queryKey: ['my-service-sales', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('service_sales').select('*').eq('sales_officer_id', user!.id).order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: finishedProducts } = useQuery({
    queryKey: ['available-products'],
    queryFn: async () => {
      const { data } = await supabase.from('finished_products').select('id, product_type, production_cost').eq('status', 'completed');
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

  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;
  const todayProductRevenue = mySales?.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).reduce((sum, s) => sum + s.selling_price, 0) || 0;
  const todayServiceRevenue = myServiceSales?.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).reduce((sum, s) => sum + s.amount, 0) || 0;

  // Product sale form
  const [pForm, setPForm] = useState({ finished_product_id: '', customer_name: '', customer_phone: '', selling_price: '', mpesa_code: '', branch_id: '' });

  const productMutation = useMutation({
    mutationFn: async () => {
      const product = finishedProducts?.find(p => p.id === pForm.finished_product_id);
      if (!product) throw new Error('Select a product');
      const { data, error } = await supabase.from('sales').insert({
        finished_product_id: pForm.finished_product_id,
        product_type: product.product_type,
        customer_name: pForm.customer_name.trim(),
        customer_phone: pForm.customer_phone.trim() || null,
        selling_price: parseFloat(pForm.selling_price),
        mpesa_code: pForm.mpesa_code.trim().toUpperCase(),
        sales_officer_id: user!.id,
        branch_id: pForm.branch_id || null,
      }).select().single();
      if (error) throw error;
      await supabase.from('finished_products').update({ status: 'sold' as any }).eq('id', pForm.finished_product_id);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Sale recorded!' });
      setPForm({ finished_product_id: '', customer_name: '', customer_phone: '', selling_price: '', mpesa_code: '', branch_id: '' });
      queryClient.invalidateQueries({ queryKey: ['my-product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['available-products'] });
      if (data) { setReceiptId(data.id); setReceiptType('product'); setActiveView('receipt'); }
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  // Service sale form
  const [sForm, setSForm] = useState({ service_name: 'Body Preservation', customer_name: '', customer_phone: '', amount: '', mpesa_code: '', description: '', branch_id: '' });

  const serviceMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('service_sales').insert({
        service_name: sForm.service_name,
        customer_name: sForm.customer_name.trim(),
        customer_phone: sForm.customer_phone.trim() || null,
        amount: parseFloat(sForm.amount),
        mpesa_code: sForm.mpesa_code.trim().toUpperCase(),
        description: sForm.description.trim() || null,
        sales_officer_id: user!.id,
        branch_id: sForm.branch_id || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Service sale recorded!' });
      setSForm({ service_name: 'Body Preservation', customer_name: '', customer_phone: '', amount: '', mpesa_code: '', description: '', branch_id: '' });
      queryClient.invalidateQueries({ queryKey: ['my-service-sales'] });
      if (data) { setReceiptId(data.id); setReceiptType('service'); setActiveView('receipt'); }
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm">Sales</h1>
            <p className="text-[10px] text-muted-foreground">{profile?.full_name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <DailyReportReminder />
        {/* Nav */}
        <div className="flex gap-2">
          {[
            { id: 'home', label: 'Home', icon: Wallet },
            { id: 'product', label: 'Product Sale', icon: ShoppingCart },
            { id: 'service', label: 'Service Sale', icon: Briefcase },
          ].map(v => (
            <Button key={v.id} variant={activeView === v.id ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setActiveView(v.id as any)}>
              <v.icon className="h-3 w-3" />{v.label}
            </Button>
          ))}
        </div>

        {activeView === 'home' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="border"><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Today Products</p>
                <p className="text-lg font-bold font-display text-success">{fmt(todayProductRevenue)}</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Today Services</p>
                <p className="text-lg font-bold font-display text-success">{fmt(todayServiceRevenue)}</p>
              </CardContent></Card>
            </div>
            <h3 className="font-display font-semibold text-foreground text-sm">Recent Sales</h3>
            <div className="space-y-1">
              {[...(mySales || []).map(s => ({ type: 'Product', name: s.product_type, amount: s.selling_price, date: s.created_at, id: s.id })),
                ...(myServiceSales || []).map(s => ({ type: 'Service', name: s.service_name, amount: s.amount, date: s.created_at, id: s.id }))]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map(s => (
                  <Card key={s.id} className="border">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.type} • {new Date(s.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-success">{fmt(s.amount)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setReceiptId(s.id); setReceiptType(s.type === 'Product' ? 'product' : 'service'); setActiveView('receipt'); }}>
                          <Receipt className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            <DailyReportForm />
          </div>
        )}

        {activeView === 'product' && (
          <Card className="border">
            <CardContent className="p-4">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />Record Product Sale</h3>
              <form onSubmit={(e) => { e.preventDefault(); productMutation.mutate(); }} className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Select Product *</Label>
                  {(!finishedProducts || finishedProducts.length === 0) ? (
                    <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl p-3">No products available</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                      {finishedProducts.map(p => (
                        <button key={p.id} type="button" onClick={() => setPForm(f => ({ ...f, finished_product_id: p.id }))}
                          className={cn("px-3 py-2 rounded-lg text-xs border text-left", pForm.finished_product_id === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent")}>
                          {p.product_type} <span className="opacity-70">• {fmt(p.production_cost)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Customer *</Label><Input value={pForm.customer_name} onChange={e => setPForm(f => ({ ...f, customer_name: e.target.value }))} className="h-10 text-sm" required /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={pForm.customer_phone} onChange={e => setPForm(f => ({ ...f, customer_phone: e.target.value }))} className="h-10 text-sm" /></div>
                  <div><Label className="text-xs">Price (Ksh) *</Label><Input type="number" value={pForm.selling_price} onChange={e => setPForm(f => ({ ...f, selling_price: e.target.value }))} className="h-10 text-sm" required /></div>
                  <div><Label className="text-xs">MPESA Code *</Label><Input value={pForm.mpesa_code} onChange={e => setPForm(f => ({ ...f, mpesa_code: e.target.value }))} className="h-10 text-sm uppercase" required /></div>
                </div>
                <div><Label className="text-xs">Branch</Label>
                  <select value={pForm.branch_id} onChange={e => setPForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">None</option>{(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={productMutation.isPending || !pForm.finished_product_id || !pForm.customer_name || !pForm.selling_price || !pForm.mpesa_code}>
                  {productMutation.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart className="h-4 w-4" />}Complete Sale
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeView === 'service' && (
          <Card className="border">
            <CardContent className="p-4">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />Record Service Sale</h3>
              <form onSubmit={(e) => { e.preventDefault(); serviceMutation.mutate(); }} className="space-y-3">
                <div><Label className="text-xs">Service *</Label>
                  <select value={sForm.service_name} onChange={e => setSForm(f => ({ ...f, service_name: e.target.value }))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Customer *</Label><Input value={sForm.customer_name} onChange={e => setSForm(f => ({ ...f, customer_name: e.target.value }))} className="h-10 text-sm" required /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={sForm.customer_phone} onChange={e => setSForm(f => ({ ...f, customer_phone: e.target.value }))} className="h-10 text-sm" /></div>
                  <div><Label className="text-xs">Amount (Ksh) *</Label><Input type="number" value={sForm.amount} onChange={e => setSForm(f => ({ ...f, amount: e.target.value }))} className="h-10 text-sm" required /></div>
                  <div><Label className="text-xs">MPESA Code *</Label><Input value={sForm.mpesa_code} onChange={e => setSForm(f => ({ ...f, mpesa_code: e.target.value }))} className="h-10 text-sm uppercase" required /></div>
                </div>
                <div><Label className="text-xs">Description</Label><Input value={sForm.description} onChange={e => setSForm(f => ({ ...f, description: e.target.value }))} className="h-10 text-sm" /></div>
                <div><Label className="text-xs">Branch</Label>
                  <select value={sForm.branch_id} onChange={e => setSForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">None</option>{(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={serviceMutation.isPending || !sForm.customer_name || !sForm.amount || !sForm.mpesa_code}>
                  {serviceMutation.isPending ? <Loader2 className="animate-spin" /> : <Briefcase className="h-4 w-4" />}Complete Sale
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeView === 'receipt' && receiptId && (
          <div>
            <Button variant="outline" size="sm" className="mb-3" onClick={() => setActiveView('home')}>← Back</Button>
            <SaleReceipt saleId={receiptId} type={receiptType} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesDashboard;
