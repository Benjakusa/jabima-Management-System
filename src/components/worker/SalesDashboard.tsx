import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut, ShoppingCart, Briefcase, Loader2, Receipt, Wallet,
  LayoutDashboard, FileText, Target, Package, TrendingUp, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SaleReceipt from '@/components/sales/SaleReceipt';
import DailyReportForm from './DailyReportForm';
import DailyReportReminder from './DailyReportReminder';

const SERVICE_TYPES = ['Hearse', 'Gazebo', 'Lowering Gear', 'Tents', 'Body Preservation', 'Body Transport', 'Funeral Arrangement', 'Other'];

type View = 'home' | 'product' | 'service' | 'receipt' | 'wallet' | 'report' | 'log';

const SalesDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<View>('home');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'product' | 'service'>('product');

  const { data: mySales } = useQuery({
    queryKey: ['my-product-sales', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*').eq('sales_officer_id', user!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: myServiceSales } = useQuery({
    queryKey: ['my-service-sales', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('service_sales').select('*').eq('sales_officer_id', user!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: finishedProducts } = useQuery({
    queryKey: ['available-products'],
    queryFn: async () => {
      const { data } = await supabase.from('finished_products').select('id, product_type, production_cost, completed_at').eq('status', 'completed');
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

  const { data: myWallet } = useQuery({
    queryKey: ['my-wallet', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: walletTxns } = useQuery({
    queryKey: ['my-wallet-txns', myWallet?.id],
    queryFn: async () => {
      const { data } = await supabase.from('wallet_transactions').select('*').eq('wallet_id', myWallet!.id).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!myWallet,
  });

  const { data: paymentConfigs } = useQuery({
    queryKey: ['my-payment-config', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('payment_configs').select('*').eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;
  const today = new Date().toDateString();
  const todaySales = mySales?.filter(s => new Date(s.created_at).toDateString() === today) || [];
  const todayServiceSales = myServiceSales?.filter(s => new Date(s.created_at).toDateString() === today) || [];
  const todayProductRevenue = todaySales.reduce((sum, s) => sum + s.selling_price, 0);
  const todayServiceRevenue = todayServiceSales.reduce((sum, s) => sum + s.amount, 0);
  const todayTotal = todayProductRevenue + todayServiceRevenue;

  // Commission config
  const commissionConfig = paymentConfigs?.find(c => c.payment_type === 'commission');
  const todayCommission = commissionConfig ? (todaySales.length + todayServiceSales.length) * commissionConfig.amount : 0;

  // Product sale form
  const [pForm, setPForm] = useState({ finished_product_id: '', customer_name: '', customer_phone: '', selling_price: '', mpesa_code: '', branch_id: '', productSearch: '' });

  const productMutation = useMutation({
    mutationFn: async () => {
      const product = finishedProducts?.find(p => p.id === pForm.finished_product_id);
      if (!product) throw new Error('Select a product');
      if (!pForm.customer_name.trim()) throw new Error('Customer name required');
      if (!pForm.mpesa_code.trim()) throw new Error('MPESA code required');
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
      setPForm({ finished_product_id: '', customer_name: '', customer_phone: '', selling_price: '', mpesa_code: '', branch_id: '', productSearch: '' });
      queryClient.invalidateQueries({ queryKey: ['my-product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['available-products'] });
      if (data) { setReceiptId(data.id); setReceiptType('product'); setActiveView('receipt'); }
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  // Service sale form
  const [sForm, setSForm] = useState({ service_name: 'Hearse', customer_name: '', customer_phone: '', amount: '', mpesa_code: '', description: '', branch_id: '', event_date: '', duration: '', location: '', special_requirements: '' });

  const serviceMutation = useMutation({
    mutationFn: async () => {
      if (!sForm.customer_name.trim()) throw new Error('Customer name required');
      if (!sForm.mpesa_code.trim()) throw new Error('MPESA code required');
      // Build description with booking details
      const descParts = [sForm.description];
      if (sForm.event_date) descParts.push(`Date: ${sForm.event_date}`);
      if (sForm.duration) descParts.push(`Duration: ${sForm.duration}hrs`);
      if (sForm.location) descParts.push(`Location: ${sForm.location}`);
      if (sForm.special_requirements) descParts.push(`Notes: ${sForm.special_requirements}`);
      const fullDesc = descParts.filter(Boolean).join(' | ');

      const { data, error } = await supabase.from('service_sales').insert({
        service_name: sForm.service_name,
        customer_name: sForm.customer_name.trim(),
        customer_phone: sForm.customer_phone.trim() || null,
        amount: parseFloat(sForm.amount),
        mpesa_code: sForm.mpesa_code.trim().toUpperCase(),
        description: fullDesc || null,
        sales_officer_id: user!.id,
        branch_id: sForm.branch_id || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Service sale recorded!' });
      setSForm({ service_name: 'Hearse', customer_name: '', customer_phone: '', amount: '', mpesa_code: '', description: '', branch_id: '', event_date: '', duration: '', location: '', special_requirements: '' });
      queryClient.invalidateQueries({ queryKey: ['my-service-sales'] });
      if (data) { setReceiptId(data.id); setReceiptType('service'); setActiveView('receipt'); }
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const filteredProducts = (finishedProducts || []).filter(p =>
    !pForm.productSearch || p.product_type.toLowerCase().includes(pForm.productSearch.toLowerCase()) || p.id.includes(pForm.productSearch)
  );

  const allSales = [
    ...(todaySales || []).map(s => ({ type: 'Product' as const, name: s.product_type, amount: s.selling_price, date: s.created_at, id: s.id, customer: s.customer_name, mpesa: s.mpesa_code })),
    ...(todayServiceSales || []).map(s => ({ type: 'Service' as const, name: s.service_name, amount: s.amount, date: s.created_at, id: s.id, customer: s.customer_name, mpesa: s.mpesa_code })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const navItems = [
    { id: 'home' as View, label: 'Home', icon: LayoutDashboard },
    { id: 'product' as View, label: 'Product', icon: ShoppingCart },
    { id: 'service' as View, label: 'Service', icon: Briefcase },
    { id: 'log' as View, label: 'Sales Log', icon: FileText },
    { id: 'wallet' as View, label: 'Wallet', icon: Wallet },
    { id: 'report' as View, label: 'Report', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
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

        {/* HOME / OVERVIEW */}
        {activeView === 'home' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border"><CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Today's Sales</p>
                <p className="text-lg font-bold font-display text-success">{fmt(todayTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{todaySales.length + todayServiceSales.length} transactions</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Available Products</p>
                <p className="text-lg font-bold font-display text-primary">{finishedProducts?.length || 0}</p>
                <p className="text-[10px] text-muted-foreground">in shop</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Commission Today</p>
                <p className="text-lg font-bold font-display text-accent-foreground">{fmt(todayCommission)}</p>
                <p className="text-[10px] text-muted-foreground">{commissionConfig ? `${fmt(commissionConfig.amount)}/sale` : 'Not set'}</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Daily Target</p>
                <div className="flex items-center justify-center gap-1">
                  <Target className="h-4 w-4 text-primary" />
                  <p className="text-lg font-bold font-display text-foreground">{todaySales.length + todayServiceSales.length}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">sales today</p>
              </CardContent></Card>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setActiveView('product')} size="lg" className="h-14">
                <ShoppingCart className="h-5 w-5" />Product Sale
              </Button>
              <Button onClick={() => setActiveView('service')} variant="secondary" size="lg" className="h-14">
                <Briefcase className="h-5 w-5" />Service Sale
              </Button>
            </div>

            {/* Recent sales */}
            <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />Recent Sales
            </h3>
            <div className="space-y-1.5">
              {allSales.length === 0 && (
                <Card className="border"><CardContent className="p-6 text-center text-muted-foreground text-sm">No sales today</CardContent></Card>
              )}
              {allSales.slice(0, 8).map(s => (
                <Card key={s.id} className="border">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.customer} • {s.type} • {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-success">{fmt(s.amount)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setReceiptId(s.id); setReceiptType(s.type === 'Product' ? 'product' : 'service'); setActiveView('receipt'); }}>
                        <Receipt className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCT SALE POS */}
        {activeView === 'product' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveView('home')}>← Back</Button>
            <Card className="border">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />Point of Sale — Product
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); productMutation.mutate(); }} className="space-y-3">
                  {/* Product search & select */}
                  <div className="space-y-2">
                    <Label className="text-xs">Search Product</Label>
                    <Input placeholder="Search by name or code..." value={pForm.productSearch} onChange={e => setPForm(f => ({ ...f, productSearch: e.target.value }))} className="h-10 text-sm" />
                    {(!filteredProducts || filteredProducts.length === 0) ? (
                      <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl p-3">No products available</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                        {filteredProducts.map(p => (
                          <button key={p.id} type="button" onClick={() => setPForm(f => ({ ...f, finished_product_id: p.id }))}
                            className={cn("px-3 py-2 rounded-lg text-xs border text-left transition-colors", pForm.finished_product_id === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent")}>
                            <span className="font-medium">{p.product_type}</span>
                            <span className="opacity-70 ml-2">• {fmt(p.production_cost)} • {p.id.slice(0, 8)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Customer Name *</Label><Input value={pForm.customer_name} onChange={e => setPForm(f => ({ ...f, customer_name: e.target.value }))} className="h-10 text-sm" required /></div>
                    <div><Label className="text-xs">Phone</Label><Input value={pForm.customer_phone} onChange={e => setPForm(f => ({ ...f, customer_phone: e.target.value }))} className="h-10 text-sm" placeholder="+254..." /></div>
                    <div><Label className="text-xs">Selling Price (Ksh) *</Label><Input type="number" value={pForm.selling_price} onChange={e => setPForm(f => ({ ...f, selling_price: e.target.value }))} className="h-10 text-sm" required /></div>
                    <div><Label className="text-xs">MPESA Code *</Label><Input value={pForm.mpesa_code} onChange={e => setPForm(f => ({ ...f, mpesa_code: e.target.value }))} className="h-10 text-sm uppercase" required /></div>
                  </div>
                  <div><Label className="text-xs">Branch</Label>
                    <select value={pForm.branch_id} onChange={e => setPForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="">None</option>{(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={productMutation.isPending || !pForm.finished_product_id || !pForm.customer_name || !pForm.selling_price || !pForm.mpesa_code}>
                    {productMutation.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart className="h-4 w-4" />}Complete Sale
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SERVICE SALE */}
        {activeView === 'service' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveView('home')}>← Back</Button>
            <Card className="border">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />Service Booking & Sale
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); serviceMutation.mutate(); }} className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Service Type *</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SERVICE_TYPES.map(s => (
                        <button key={s} type="button" onClick={() => setSForm(f => ({ ...f, service_name: s }))}
                          className={cn("px-3 py-2 rounded-lg text-xs border font-medium transition-colors", sForm.service_name === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent")}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Booking details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Event Date</Label><Input type="datetime-local" value={sForm.event_date} onChange={e => setSForm(f => ({ ...f, event_date: e.target.value }))} className="h-10 text-sm" /></div>
                    <div><Label className="text-xs">Duration (hrs)</Label><Input type="number" value={sForm.duration} onChange={e => setSForm(f => ({ ...f, duration: e.target.value }))} className="h-10 text-sm" min="1" /></div>
                    <div className="col-span-2"><Label className="text-xs">Location / Address</Label><Input value={sForm.location} onChange={e => setSForm(f => ({ ...f, location: e.target.value }))} className="h-10 text-sm" /></div>
                  </div>
                  <div><Label className="text-xs">Special Requirements</Label>
                    <Textarea value={sForm.special_requirements} onChange={e => setSForm(f => ({ ...f, special_requirements: e.target.value }))} placeholder="Flowers, music, decorations..." rows={2} className="text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Client Name *</Label><Input value={sForm.customer_name} onChange={e => setSForm(f => ({ ...f, customer_name: e.target.value }))} className="h-10 text-sm" required /></div>
                    <div><Label className="text-xs">Client Phone</Label><Input value={sForm.customer_phone} onChange={e => setSForm(f => ({ ...f, customer_phone: e.target.value }))} className="h-10 text-sm" placeholder="+254..." /></div>
                    <div><Label className="text-xs">Amount (Ksh) *</Label><Input type="number" value={sForm.amount} onChange={e => setSForm(f => ({ ...f, amount: e.target.value }))} className="h-10 text-sm" required /></div>
                    <div><Label className="text-xs">MPESA Code *</Label><Input value={sForm.mpesa_code} onChange={e => setSForm(f => ({ ...f, mpesa_code: e.target.value }))} className="h-10 text-sm uppercase" required /></div>
                  </div>
                  <div><Label className="text-xs">Branch</Label>
                    <select value={sForm.branch_id} onChange={e => setSForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="">None</option>{(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={serviceMutation.isPending || !sForm.customer_name || !sForm.amount || !sForm.mpesa_code}>
                    {serviceMutation.isPending ? <Loader2 className="animate-spin" /> : <Briefcase className="h-4 w-4" />}Complete Service Sale
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* DAILY SALES LOG */}
        {activeView === 'log' && (
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-foreground text-sm">Today's Sales Log</h3>
            <div className="grid grid-cols-3 gap-2">
              <Card className="border"><CardContent className="p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Products</p>
                <p className="text-sm font-bold text-foreground">{todaySales.length}</p>
                <p className="text-[10px] text-success font-medium">{fmt(todayProductRevenue)}</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Services</p>
                <p className="text-sm font-bold text-foreground">{todayServiceSales.length}</p>
                <p className="text-[10px] text-success font-medium">{fmt(todayServiceRevenue)}</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-foreground">{todaySales.length + todayServiceSales.length}</p>
                <p className="text-[10px] text-success font-medium">{fmt(todayTotal)}</p>
              </CardContent></Card>
            </div>
            <div className="space-y-1.5">
              {allSales.length === 0 && (
                <Card className="border"><CardContent className="p-6 text-center text-sm text-muted-foreground">No sales recorded today</CardContent></Card>
              )}
              {allSales.map(s => (
                <Card key={s.id} className="border">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={s.type === 'Product' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{s.type}</Badge>
                          <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.customer} • <span className="font-mono">{s.mpesa}</span> • {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-success">{fmt(s.amount)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setReceiptId(s.id); setReceiptType(s.type === 'Product' ? 'product' : 'service'); setActiveView('receipt'); }}>
                          <Receipt className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Reconciliation */}
            {allSales.length > 0 && (
              <Card className="border border-success/20 bg-success/5">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">End-of-Day Total</p>
                  <p className="text-2xl font-bold font-display text-success">{fmt(todayTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Commission earned: {fmt(todayCommission)}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* WALLET */}
        {activeView === 'wallet' && (
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-foreground text-sm">My Wallet</h3>
            {myWallet ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Card className="border"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Pending</p>
                    <p className="text-sm font-bold text-warning">{fmt(myWallet.pending_earnings)}</p>
                  </CardContent></Card>
                  <Card className="border"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Approved</p>
                    <p className="text-sm font-bold text-primary">{fmt(myWallet.approved_earnings)}</p>
                  </CardContent></Card>
                  <Card className="border"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Paid</p>
                    <p className="text-sm font-bold text-success">{fmt(myWallet.paid_earnings)}</p>
                  </CardContent></Card>
                </div>
                {commissionConfig && (
                  <Card className="border"><CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Commission Rate</p>
                    <p className="text-sm font-medium text-foreground">{fmt(commissionConfig.amount)} per sale</p>
                  </CardContent></Card>
                )}
                <h4 className="text-xs font-medium text-muted-foreground">Transaction History</h4>
                <div className="space-y-1">
                  {(walletTxns || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>}
                  {(walletTxns || []).map(tx => (
                    <Card key={tx.id} className="border">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{tx.description || tx.type}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}{tx.payment_method ? ` • ${tx.payment_method}` : ''}{tx.reference_number ? ` • ${tx.reference_number}` : ''}</p>
                        </div>
                        <span className={cn("text-sm font-bold", tx.type === 'payout' ? 'text-success' : 'text-foreground')}>{fmt(tx.amount)}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card className="border"><CardContent className="p-6 text-center text-sm text-muted-foreground">Wallet not found</CardContent></Card>
            )}
          </div>
        )}

        {/* DAILY REPORT */}
        {activeView === 'report' && <DailyReportForm />}

        {/* RECEIPT */}
        {activeView === 'receipt' && receiptId && (
          <div>
            <Button variant="ghost" size="sm" className="mb-3" onClick={() => setActiveView('home')}>← Back</Button>
            <SaleReceipt saleId={receiptId} type={receiptType} />
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 px-2 py-1 safe-area-pb">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              className={cn("flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0",
                activeView === item.id ? "text-primary" : "text-muted-foreground")}>
              <item.icon className="h-4 w-4" />
              <span className="text-[9px] font-medium truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default SalesDashboard;
