import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Search, Briefcase, Receipt, TrendingUp, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useMpesaPoll } from '@/hooks/useMpesaPoll';
import { cn } from '@/lib/utils';

interface ServiceForm {
  service_name: string;
  description: string;
  amount: string;
  customer_name: string;
  customer_phone: string;
  mpesa_code: string;
  branch_id: string;
}

const emptyForm: ServiceForm = {
  service_name: '', description: '', amount: '', customer_name: '', customer_phone: '', mpesa_code: '', branch_id: '',
};

// serviceTypes will now be fetched dynamically from inventory_services

interface Props {
  onViewReceipt: (saleId: string) => void;
}

const ServiceSalesList = ({ onViewReceipt }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // M-Pesa polling for auto-populating receipt number
  const { mpesaReceiptNumber, pollStatus, isPollActive, startPolling, stopPolling } = useMpesaPoll();
  const [isMpesaProcessing, setIsMpesaProcessing] = useState(false);

  // Auto-populate mpesaCode when receipt number is fetched
  useEffect(() => {
    if (mpesaReceiptNumber && pollStatus === 'confirmed') {
      setForm(f => ({ ...f, mpesa_code: mpesaReceiptNumber }));
    }
  }, [mpesaReceiptNumber, pollStatus]);

  const handleMpesaStkPush = async () => {
    const amount = form.amount;
    const phone = form.customer_phone;

    if (!phone) { toast({ variant: 'destructive', title: 'Customer phone required' }); return; }
    if (!amount || parseFloat(amount) <= 0) { toast({ variant: 'destructive', title: 'Valid amount required' }); return; }
    if (!form.customer_name) { toast({ variant: 'destructive', title: 'Customer name required' }); return; }

    setIsMpesaProcessing(true);
    toast({ title: 'Sending STK Push...', description: `Check phone ${phone}` });

    try {
      const invokeResult = await supabase.functions.invoke('mpesa-stk', {
        body: {
          phone,
          amount,
          accountReference: 'JABIMA',
          transactionDesc: 'Service Payment',
          transactionType: 'CustomerBuyGoodsOnline'
        },
      }) as any;
      const { data, error } = invokeResult;

      if (error) {
        let bodyError = error.message;
        try {
          const errContext = await (error as any).context?.json?.();
          bodyError = errContext?.message || errContext?.error || error.message;
        } catch (_) { }
        throw new Error(bodyError || `Edge Function error`);
      }

      if (data?.ResponseCode === "0") {
        startPolling(data.CheckoutRequestID);
        toast({
          title: 'STK Push Sent! ✅',
          description: `Check your phone ${phone} for payment prompt. Waiting for confirmation...`
        });
      } else if (data?.error) {
        throw new Error(data.details || data.error);
      } else {
        throw new Error(data?.ResponseDescription || data?.message || `Safaricom error code: ${data?.ResponseCode}`);
      }
    } catch (err: any) {
      console.error('M-Pesa Error:', err);
      const errorMsg = err?.data?.message || err?.data?.details || err?.data?.error || err?.message || err?.toString() || 'Unknown error';
      toast({ variant: 'destructive', title: 'M-Pesa Error', description: errorMsg });
    } finally {
      setIsMpesaProcessing(false);
    }
  };

  const { data: sales, isLoading } = useQuery({
    queryKey: ['service-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('service_sales').select('*').order('created_at', { ascending: false });
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

  const { data: serviceTypes } = useQuery({
    queryKey: ['inventory-services-types'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_services').select('name, base_price').order('name');
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['service-sales-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.service_name || !form.customer_name.trim() || !form.amount || !form.mpesa_code.trim()) {
        throw new Error('Please fill all required fields');
      }
      const { data, error } = await supabase.from('service_sales').insert({
        service_name: form.service_name,
        description: form.description.trim() || null,
        amount: parseFloat(form.amount),
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        mpesa_code: form.mpesa_code.trim().toUpperCase(),
        sales_officer_id: user!.id,
        branch_id: form.branch_id || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Service sale recorded!' });
      setShowForm(false);
      setForm(emptyForm);
      stopPolling();
      queryClient.invalidateQueries({ queryKey: ['service-sales'] });
      queryClient.invalidateQueries({ queryKey: ['service-sales-month'] });
      if (data) onViewReceipt(data.id);
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const filtered = (sales || []).filter(s =>
    s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    s.service_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.mpesa_code && s.mpesa_code.toLowerCase().includes(search.toLowerCase()))
  );

  // M-Pesa poll status indicator component
  const MpesaPollStatusBadge = () => {
    if (pollStatus === 'polling') return (
      <div className="flex items-center gap-1.5 text-[10px] text-primary animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Waiting for M-Pesa confirmation...</span>
      </div>
    );
    if (pollStatus === 'confirmed') return (
      <div className="flex items-center gap-1.5 text-[10px] text-success">
        <CheckCircle2 className="h-3 w-3" />
        <span>Payment confirmed: {mpesaReceiptNumber}</span>
      </div>
    );
    if (pollStatus === 'failed') return (
      <div className="flex items-center gap-1.5 text-[10px] text-destructive">
        <XCircle className="h-3 w-3" />
        <span>Payment failed — enter code manually</span>
      </div>
    );
    if (pollStatus === 'timeout') return (
      <div className="flex items-center gap-1.5 text-[10px] text-warning">
        <AlertTriangle className="h-3 w-3" />
        <span>Timed out — enter code manually</span>
      </div>
    );
    return null;
  };

  const getName = (id: string) => profiles?.find(p => p.user_id === id)?.full_name || 'Unknown';
  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} service sale{filtered.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { setForm(emptyForm); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Service Sale'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Record Service Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Service Type *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(serviceTypes || []).map((s: any) => (
                    <button key={s.name} type="button"
                      onClick={() => setForm(f => ({ ...f, service_name: s.name, amount: String(s.base_price || '') }))}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors text-center ${form.service_name === s.name ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                        }`}>{s.name}</button>
                  ))}
                  {(serviceTypes || []).length === 0 && <p className="text-xs text-muted-foreground col-span-4 py-4 text-center">No services in catalogue — go to the <strong>Catalogue</strong> tab to add services first</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the service..." rows={2} />
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
                  <Label>Amount (Ksh) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-12" min="0" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label>MPESA Transaction Code *</Label>
                  <div className="flex gap-2">
                    <Input value={form.mpesa_code} onChange={(e) => setForm(f => ({ ...f, mpesa_code: e.target.value }))} placeholder="e.g. SHK7Y2X9RQ" className={cn("h-12 uppercase", pollStatus === 'confirmed' && "border-success bg-success/5")} required readOnly={isPollActive || pollStatus === 'confirmed'} />
                    <Button type="button" onClick={handleMpesaStkPush}
                      disabled={isMpesaProcessing || isPollActive || !form.customer_phone}
                      className="h-12 bg-success hover:bg-success/90 shrink-0 px-3">
                      {isMpesaProcessing || isPollActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                      STK Push
                    </Button>
                  </div>
                  <MpesaPollStatusBadge />
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

              <Button type="submit" size="lg" className="w-full"
                disabled={createMutation.isPending || isMpesaProcessing || isPollActive || !form.service_name || !form.customer_name || !form.amount || !form.mpesa_code}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Briefcase className="h-4 w-4" />}
                Complete Service Sale & Generate Receipt
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer, service, or MPESA code..." className="pl-10 h-11" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No service sales recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sale) => (
            <Card key={sale.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">{sale.service_name}</p>
                      <span className="text-xs font-bold text-success">{fmt(sale.amount)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{sale.customer_name}</span>
                      <span className="bg-secondary px-2 py-0.5 rounded-md font-mono">{sale.mpesa_code}</span>
                      <span>{getName(sale.sales_officer_id)}</span>
                      <span>{new Date(sale.created_at).toLocaleDateString()}</span>
                    </div>
                    {sale.description && <p className="text-xs text-muted-foreground mt-1">{sale.description}</p>}
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

export default ServiceSalesList;
