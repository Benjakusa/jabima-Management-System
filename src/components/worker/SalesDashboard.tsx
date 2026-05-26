import { useState, useEffect } from 'react';
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
  LayoutDashboard, Target, Package, TrendingUp, Clock,
  ClipboardList, RotateCcw, Wrench, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { useMpesaPoll } from '@/hooks/useMpesaPoll';
import { cn, formatCurrency } from '@/lib/utils';
import SaleReceipt from '@/components/sales/SaleReceipt';
import PaymentTransactionsList from '@/components/sales/PaymentTransactionsList';
import DailyReportForm from './DailyReportForm';
import DailyReportReminder from './DailyReportReminder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import ProductRequests from './ProductRequests';
import ProductReturns from './ProductReturns';
import ServiceManagement from './ServiceManagement';

type View = 'home' | 'product' | 'service' | 'receipt' | 'wallet' | 'report' | 'log' | 'requests' | 'returns' | 'my_services';

const SalesDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<View>('home');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'product' | 'service'>('product');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');

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

  const { data: finishedProducts, isError: productsError } = useQuery({
    queryKey: ['available-products', profile?.branch_id],
    queryFn: async () => {
      const branchId = profile?.branch_id;

      // If officer has a branch, show products ONLY from shop_inventory (fulfilled to their branch)
      if (branchId) {
        const { data: shopItems } = await supabase
          .from('shop_inventory')
          .select('finished_product_id, finished_products(id, product_type, production_cost, completed_at, batch_number)')
          .eq('branch_id', branchId);

        if (shopItems && shopItems.length > 0) {
          const seen = new Set<string>();
          return shopItems.map((s: any) => s.finished_products).filter((p: any) => {
            if (!p || seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        }
        return [];
      }

      // No branch - show all completed products from main warehouse
      const { data, error } = await supabase
        .from('finished_products')
        .select('id, product_type, production_cost, completed_at, branch_id, batch_number')
        .eq('status', 'completed')
        .is('branch_id', null)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error loading products:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!profile,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: myServices } = useQuery({
    queryKey: ['available-services-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_services')
        .select('name, category, base_price')
        .gte('quantity', 1)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: myWallet } = useQuery({
    queryKey: ['my-wallet', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(requestAmount);
      if (!myWallet || myWallet.pending_earnings <= 0) throw new Error('No pending earnings');
      if (isNaN(amount) || amount <= 0 || amount > myWallet.pending_earnings) throw new Error('Invalid amount');

      const { error } = await supabase.rpc('request_wallet_payout', { p_amount: amount });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Payout requested successfully!' });
      setIsRequesting(false);
      setRequestAmount('');
      queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['my-wallet-txns'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
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

  const { data: instalmentSchedules } = useQuery({
    queryKey: ['instalment-schedules', receiptId],
    queryFn: async () => {
      if (!receiptId) return [];
      const { data } = await supabase.from('instalment_schedule' as any).select('*').eq('sale_id', receiptId).order('due_date');
      return data || [];
    },
    enabled: !!receiptId,
  });



  const fmt = formatCurrency;
  const today = new Date().toDateString();
  const todaySales = mySales?.filter(s => new Date(s.created_at).toDateString() === today) || [];
  const todayServiceSales = myServiceSales?.filter(s => new Date(s.created_at).toDateString() === today) || [];
  const todayProductRevenue = todaySales.reduce((sum, s) => sum + s.selling_price, 0);
  const todayServiceRevenue = todayServiceSales.reduce((sum, s) => sum + s.amount, 0);
  const todayTotal = todayProductRevenue + todayServiceRevenue;

  // Commission config
  const commissionConfig = paymentConfigs?.find(c => c.payment_type === 'commission');
  const todayCommission = commissionConfig ? (todaySales.length + todayServiceSales.length) * commissionConfig.amount : 0;

  // Payment mode: Full Payment or Lipa Pole Pole
  const [paymentMode, setPaymentMode] = useState<'full' | 'lipa'>('full');

  // Split payment: cash + mpesa work independently
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [isMpesaProcessing, setIsMpesaProcessing] = useState(false);

  // Lipa Pole Pole / Instalment plan
  const [enableInstalments, setEnableInstalments] = useState(false);
  const [instalmentConfig, setInstalmentConfig] = useState({ deposit: '', frequency: 'monthly', num_instalments: '3' });

  // M-Pesa STK tracking
  const [checkoutRequestID, setCheckoutRequestID] = useState('');
  const [mpesaOverrides, setMpesaOverrides] = useState({ businessShortCode: '', partyB: '' });
  const [showAdvancedMpesa, setShowAdvancedMpesa] = useState(false);

  // M-Pesa polling for auto-populating receipt number
  const { mpesaReceiptNumber, pollStatus, isPollActive, startPolling, stopPolling } = useMpesaPoll();

  // Auto-populate mpesaCode when receipt number is fetched
  useEffect(() => {
    if (mpesaReceiptNumber && pollStatus === 'confirmed') {
      setMpesaCode(mpesaReceiptNumber);
    }
  }, [mpesaReceiptNumber, pollStatus]);

  // Product sale form
  const [pForm, setPForm] = useState({ finished_product_id: '', customer_name: '', customer_phone: '', selling_price: '', mpesa_code: '', branch_id: '', productSearch: '' });

  const productMutation = useMutation({
    mutationFn: async () => {
      const product = finishedProducts?.find(p => p.id === pForm.finished_product_id);
      if (!product) throw new Error('Select a product');
      if (!pForm.customer_name.trim()) throw new Error('Customer name required');

      const sellingPrice = parseFloat(pForm.selling_price);
      const totalReceived = (parseFloat(cashAmount) || 0) + (parseFloat(mpesaAmount) || 0);

      if (paymentMode === 'lipa') {
        const deposit = parseFloat(instalmentConfig.deposit) || 0;
        if (deposit > sellingPrice) throw new Error('Deposit cannot exceed selling price');
        if (totalReceived < deposit) throw new Error('Total payment is less than deposit');
      } else {
        if (totalReceived < sellingPrice) throw new Error('Total payment is less than selling price');
      }

      const isLipa = paymentMode === 'lipa';
      const totalPaid = isLipa ? (parseFloat(instalmentConfig.deposit) || 0) : totalReceived;
      const mpesaRef = mpesaAmount && parseFloat(mpesaAmount) > 0
        ? (mpesaCode.trim() || `MPESA-${Date.now().toString().slice(-6)}`)
        : `CASH-${Date.now().toString().slice(-6)}`;

      const { data, error } = await supabase.from('sales').insert({
        finished_product_id: pForm.finished_product_id,
        product_type: product.product_type,
        customer_name: pForm.customer_name.trim(),
        customer_phone: pForm.customer_phone.trim() || null,
        selling_price: sellingPrice,
        amount_paid: totalPaid,
        payment_status: isLipa ? (totalPaid > 0 ? 'partial' : 'unpaid') : 'paid',
        is_lipa_pole_pole: isLipa,
        instalment_plan: isLipa ? instalmentConfig.frequency : null,
        mpesa_code: mpesaRef,
        sales_officer_id: user!.id,
        branch_id: pForm.branch_id || profile?.branch_id || null,
      } as any).select().single();
      if (error) throw error;

      // Record split payment transactions
      const paymentTxns: any[] = [];
      if (parseFloat(cashAmount) > 0) {
        paymentTxns.push({ sale_id: data.id, amount: parseFloat(cashAmount), payment_method: 'cash', reference_number: `CASH-${Date.now().toString().slice(-6)}`, recorded_by: user?.id });
      }
      if (parseFloat(mpesaAmount) > 0) {
        paymentTxns.push({ sale_id: data.id, amount: parseFloat(mpesaAmount), payment_method: 'mpesa', reference_number: mpesaCode.trim() || `MPESA-${Date.now().toString().slice(-6)}`, recorded_by: user?.id });
      }
      if (paymentTxns.length > 0) {
        const { error: txnErr } = await supabase.from('payment_transactions' as any).insert(paymentTxns);
        if (txnErr) throw txnErr;
      }

      // Generate instalment schedule when Lipa Pole Pole is enabled
      if (isLipa) {
        const deposit = parseFloat(instalmentConfig.deposit) || 0;
        const num = parseInt(instalmentConfig.num_instalments) || 1;
        const remaining = sellingPrice - deposit;
        const perInstallment = remaining / num;
        const startDate = new Date();
        const rows = [];
        for (let i = 0; i < num; i++) {
          const due = new Date(startDate);
          if (instalmentConfig.frequency === 'weekly') due.setDate(due.getDate() + (i + 1) * 7);
          else if (instalmentConfig.frequency === 'monthly') due.setMonth(due.getMonth() + (i + 1));
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

      // Link M-Pesa transaction to sale if we have a CheckoutRequestID
      if (checkoutRequestID) {
        await supabase.from('mpesa_transactions' as any)
          .update({ sale_id: data.id })
          .eq('checkout_request_id', checkoutRequestID);
      }

      await supabase.from('finished_products').update({ status: 'sold' as const }).eq('id', pForm.finished_product_id);
      if (product.shop_inventory_id) {
        await supabase.from('shop_inventory').delete().eq('id', product.shop_inventory_id);
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: paymentMode === 'lipa' ? 'Sale with instalment plan created!' : 'Sale recorded!' });
      setPForm({ finished_product_id: '', customer_name: '', customer_phone: '', selling_price: '', mpesa_code: '', branch_id: '', productSearch: '' });
      setCashAmount('');
      setMpesaAmount('');
      setMpesaCode('');
      setPaymentMode('full');
      setInstalmentConfig({ deposit: '', frequency: 'monthly', num_instalments: '3' });
      setCheckoutRequestID('');
      queryClient.invalidateQueries({ queryKey: ['my-product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['available-products'] });
      queryClient.invalidateQueries({ queryKey: ['instalment-schedules'] });
      if (data) { setReceiptId(data.id); setReceiptType('product'); setActiveView('receipt'); }
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  // Service sale form
  const [sForm, setSForm] = useState({ service_name: 'Hearse', customer_name: '', customer_phone: '', amount: '', mpesa_code: '', description: '', branch_id: '', event_date: '', duration: '', location: '', special_requirements: '' });

  const serviceMutation = useMutation({
    mutationFn: async () => {
      if (!sForm.customer_name.trim()) throw new Error('Customer name required');

      const amount = parseFloat(sForm.amount);
      const totalReceived = (parseFloat(cashAmount) || 0) + (parseFloat(mpesaAmount) || 0);
      if (totalReceived < amount) throw new Error('Total payment is less than amount');

      const mpesaRef = mpesaAmount && parseFloat(mpesaAmount) > 0
        ? (mpesaCode.trim() || `MPESA-${Date.now().toString().slice(-6)}`)
        : `CASH-${Date.now().toString().slice(-6)}`;

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
        amount: amount,
        mpesa_code: mpesaRef,
        description: fullDesc || null,
        sales_officer_id: user!.id,
        branch_id: sForm.branch_id || profile?.branch_id || null,
      } as any).select().single();
      if (error) throw error;

      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Service sale recorded!' });
      setSForm({ service_name: 'Hearse', customer_name: '', customer_phone: '', amount: '', mpesa_code: '', description: '', branch_id: '', event_date: '', duration: '', location: '', special_requirements: '' });
      setCashAmount('');
      setMpesaAmount('');
      setMpesaCode('');
      queryClient.invalidateQueries({ queryKey: ['my-service-sales'] });
      if (data) { setReceiptId(data.id); setReceiptType('service'); setActiveView('receipt'); }
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const handleMpesaStkPush = async (amount: string, phone: string, type: 'product' | 'service', options?: { businessShortCode?: string, partyB?: string }) => {
    if (!phone) { toast({ variant: 'destructive', title: 'Phone required' }); return; }
    if (!amount || parseFloat(amount) <= 0) { toast({ variant: 'destructive', title: 'Valid amount required' }); return; }
    setIsMpesaProcessing(true);
    toast({ title: 'Sending STK Push...', description: `Check phone ${phone}` });

    try {
      const invokeResult = await supabase.functions.invoke('mpesa-stk', {
        body: {
          phone,
          amount,
          accountReference: 'JABIMA',
          transactionDesc: type === 'product' ? 'Product Sale' : 'Service Payment',
          transactionType: 'CustomerBuyGoodsOnline', // It is Buy Goods (Till Number)
          ...options
        },
      }) as any;
      const { data, error } = invokeResult;

      console.log('M-Pesa FULL response data:', JSON.stringify(data, null, 2));
      console.log('M-Pesa error:', error);

      if (error) {
        console.error('M-Pesa invoke error details:', error);
        // FunctionsHttpError has a context with the response body
        let bodyError = error.message;
        try {
          const errContext = await (error as any).context?.json?.();
          console.error('M-Pesa error body:', errContext);
          bodyError = errContext?.message || errContext?.error || error.message;
        } catch (_) { /* ignore json parse errors */ }
        throw new Error(bodyError || `Edge Function error`);
      }

      // Log the response code and description from Safaricom
      console.log(`Safaricom ResponseCode: "${data?.ResponseCode}", ResponseDescription: "${data?.ResponseDescription}", CustomerMessage: "${data?.CustomerMessage}"`);

      if (data?.ResponseCode === "0") {
        setCheckoutRequestID(data.CheckoutRequestID);
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

  const filteredProducts = (finishedProducts || []).filter(p =>
    !pForm.productSearch || p.product_type.toLowerCase().includes(pForm.productSearch.toLowerCase()) || p.id.includes(pForm.productSearch)
  );

  const allSales = [
    ...(todaySales || []).map(s => ({ type: 'Product' as const, name: s.product_type, amount: s.selling_price, date: s.created_at, id: s.id, customer: s.customer_name, mpesa: s.mpesa_code, payment_status: (s as any).payment_status, amount_paid: (s as any).amount_paid, is_lipa: (s as any).is_lipa_pole_pole })),
    ...(todayServiceSales || []).map(s => ({ type: 'Service' as const, name: s.service_name, amount: s.amount, date: s.created_at, id: s.id, customer: s.customer_name, mpesa: s.mpesa_code, payment_status: undefined, amount_paid: undefined, is_lipa: undefined })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allHistoricalSales = [
    ...(mySales || []).map(s => ({ type: 'Product' as const, name: s.product_type, amount: s.selling_price, date: s.created_at, id: s.id, customer: s.customer_name, mpesa: s.mpesa_code, payment_status: (s as any).payment_status, amount_paid: (s as any).amount_paid, is_lipa: (s as any).is_lipa_pole_pole })),
    ...(myServiceSales || []).map(s => ({ type: 'Service' as const, name: s.service_name, amount: s.amount, date: s.created_at, id: s.id, customer: s.customer_name, mpesa: s.mpesa_code, payment_status: undefined, amount_paid: undefined, is_lipa: undefined })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const navItems = [
    { id: 'home' as View, label: 'Home', icon: LayoutDashboard },
    { id: 'product' as View, label: 'POS', icon: ShoppingCart },
    { id: 'service' as View, label: 'Service', icon: Briefcase },
    { id: 'log' as View, label: 'History', icon: Clock },
    { id: 'requests' as View, label: 'Req', icon: ClipboardList },
    { id: 'returns' as View, label: 'Ret', icon: RotateCcw },
    { id: 'wallet' as View, label: 'Wallet', icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-4">
      <header className="sticky top-0 z-50 bg-card border-b px-3 py-3 flex items-center justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 lg:w-11 lg:h-11 bg-primary rounded-xl flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 lg:h-6 lg:w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm lg:text-base">Sales</h1>
            <p className="text-[10px] lg:text-xs text-muted-foreground hidden xs:block">{profile?.full_name}</p>
            <p className="text-[10px] lg:text-xs text-muted-foreground xs:hidden">{profile?.full_name?.split(' ')[0]}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </header>

      <div className="p-3 lg:p-6 mx-auto max-w-5xl space-y-4 lg:space-y-6">
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
              <Button variant="outline" className="w-full text-xs mt-2" onClick={() => setActiveView('log')}>
                View All Sales History
              </Button>
            </div>
          </div>
        )}

        {/* PRODUCT SALE POS */}
        {activeView === 'product' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveView('home')}>← Back</Button>

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentMode('full')}
                className={cn("p-4 rounded-xl border-2 text-center transition-all", paymentMode === 'full' ? "border-success bg-success/5" : "border-border hover:border-success/30")}>
                <ShoppingCart className={cn("h-6 w-6 mx-auto mb-1", paymentMode === 'full' ? "text-success" : "text-muted-foreground")} />
                <p className={cn("text-sm font-bold", paymentMode === 'full' ? "text-success" : "text-foreground")}>Full Payment</p>
                <p className="text-[10px] text-muted-foreground">Pay in full now</p>
              </button>
              <button type="button" onClick={() => setPaymentMode('lipa')}
                className={cn("p-4 rounded-xl border-2 text-center transition-all", paymentMode === 'lipa' ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                <TrendingUp className={cn("h-6 w-6 mx-auto mb-1", paymentMode === 'lipa' ? "text-primary" : "text-muted-foreground")} />
                <p className={cn("text-sm font-bold", paymentMode === 'lipa' ? "text-primary" : "text-foreground")}>Lipa Pole Pole</p>
                <p className="text-[10px] text-muted-foreground">Instalment plan</p>
              </button>
            </div>

            <Card className="border">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />Product Sale
                  {paymentMode === 'lipa' && <Badge variant="outline" className="text-[9px]">Lipa Pole Pole</Badge>}
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); productMutation.mutate(); }} className="space-y-4">
                  {/* Available Products List */}
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                      <Package className="h-3.5 w-3.5" />
                      Pick Product *
                    </Label>
                    {(!finishedProducts || finishedProducts.length === 0) ? (
                      <div className="text-center py-8 border border-dashed rounded-xl bg-accent/20">
                        <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No products currently available at this branch</p>
                        {productsError && <p className="text-[10px] text-destructive mt-1">Error loading products</p>}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                        {finishedProducts.map(p => {
                          const batchNum = p.batch_number || 'No Batch';
                          const isSelected = pForm.finished_product_id === p.id;
                          return (
                            <button key={p.id} type="button" onClick={() => setPForm(f => ({ ...f, finished_product_id: p.id, selling_price: pForm.selling_price || p.production_cost?.toString() || '' }))}
                              className={cn("px-4 py-3 rounded-xl border text-left transition-all relative overflow-hidden group", isSelected ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card border-border hover:border-primary/50 hover:bg-accent/5")}>
                              <div className="flex items-start justify-between mb-1">
                                <div className="space-y-0.5">
                                  <p className={cn("font-bold text-sm", isSelected ? "text-primary-foreground" : "text-foreground")}>{p.product_type}</p>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border", isSelected ? "bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground" : "bg-accent border-border text-muted-foreground")}>
                                      {batchNum}
                                    </span>
                                    <span className={cn("text-[9px]", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                      ID: {p.id.slice(0, 8)}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={cn("text-xs font-bold", isSelected ? "text-primary-foreground" : "text-success")}>{fmt(p.production_cost || 0)}</span>
                                  <p className={cn("text-[8px] opacity-60", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>Rec. Price</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Customer Name *</Label><Input value={pForm.customer_name} onChange={e => setPForm(f => ({ ...f, customer_name: e.target.value }))} className="h-10 text-sm" required /></div>
                    <div><Label className="text-xs">Phone</Label><Input value={pForm.customer_phone} onChange={e => setPForm(f => ({ ...f, customer_phone: e.target.value }))} className="h-10 text-sm" placeholder="+254..." /></div>
                    <div><Label className="text-xs">Selling Price (Ksh) *</Label><Input type="number" value={pForm.selling_price} onChange={e => setPForm(f => ({ ...f, selling_price: e.target.value }))} className="h-10 text-sm" required /></div>
                  </div>

                  {/* Lipa Pole Pole Config */}
                  {paymentMode === 'lipa' && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> Instalment Plan
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px]">Deposit (Ksh)</Label>
                          <Input type="number" value={instalmentConfig.deposit} onChange={e => setInstalmentConfig(f => ({ ...f, deposit: e.target.value }))} className="h-8 text-sm" placeholder="0" min="0" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Frequency</Label>
                          <select value={instalmentConfig.frequency} onChange={e => setInstalmentConfig(f => ({ ...f, frequency: e.target.value }))}
                            className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs">
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Instalments</Label>
                          <Input type="number" min="1" max="24" value={instalmentConfig.num_instalments} onChange={e => setInstalmentConfig(f => ({ ...f, num_instalments: e.target.value }))} className="h-8 text-sm" />
                        </div>
                      </div>
                      {parseFloat(instalmentConfig.deposit) > 0 && parseFloat(pForm.selling_price) > 0 && (
                        <div className="text-xs text-muted-foreground bg-background/50 rounded px-2 py-1.5">
                          Balance: {fmt(parseFloat(pForm.selling_price) - parseFloat(instalmentConfig.deposit))} in {instalmentConfig.num_instalments} instalments of {fmt((parseFloat(pForm.selling_price) - parseFloat(instalmentConfig.deposit)) / parseInt(instalmentConfig.num_instalments))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Split Payment */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-semibold">Payment</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-accent/30 p-3 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-success" />
                          <Label className="text-[10px] font-medium">Cash Amount (Ksh)</Label>
                        </div>
                        <Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} className="h-9 text-sm" placeholder="0" min="0" />
                      </div>
                      <div className="bg-accent/30 p-3 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                          <Label className="text-[10px] font-medium">M-Pesa Amount (Ksh)</Label>
                        </div>
                        <Input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} className="h-9 text-sm" placeholder="0" min="0" />
                      </div>
                    </div>
                    <div className="bg-accent/30 p-3 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px]">M-Pesa Reference</Label>
                        <button type="button" onClick={() => setShowAdvancedMpesa(!showAdvancedMpesa)} className="text-[9px] text-primary hover:underline">
                          {showAdvancedMpesa ? 'Hide Settings' : 'Till Configuration'}
                        </button>
                      </div>

                      {showAdvancedMpesa && (
                        <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border/50 mb-2">
                          <div>
                            <Label className="text-[9px]">Store Number</Label>
                            <Input value={mpesaOverrides.businessShortCode} onChange={e => setMpesaOverrides(f => ({ ...f, businessShortCode: e.target.value }))} className="h-7 text-[10px]" placeholder="Required for Till" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Till Number</Label>
                            <Input value={mpesaOverrides.partyB} onChange={e => setMpesaOverrides(f => ({ ...f, partyB: e.target.value }))} className="h-7 text-[10px]" placeholder="Required for Till" />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} className={cn("h-9 text-sm uppercase font-mono flex-1", pollStatus === 'confirmed' && "border-success bg-success/5")} placeholder="Auto-filled after STK push" readOnly={isPollActive || pollStatus === 'confirmed'} />
                        <Button type="button" onClick={() => handleMpesaStkPush(paymentMode === 'lipa' ? (instalmentConfig.deposit || '0') : pForm.selling_price, pForm.customer_phone, 'product', mpesaOverrides)}
                          disabled={isMpesaProcessing || isPollActive || !pForm.customer_phone}
                          className="h-9 bg-success hover:bg-success/90 text-xs gap-1 shrink-0">
                          {isMpesaProcessing || isPollActive ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
                          STK
                        </Button>
                      </div>
                      <MpesaPollStatusBadge />
                    </div>
                    {(cashAmount || mpesaAmount) && pForm.selling_price && (
                      <div className="flex justify-between items-center text-xs px-1">
                        <span className="text-muted-foreground">Total received:</span>
                        <span className="font-bold text-success">{fmt((parseFloat(cashAmount) || 0) + (parseFloat(mpesaAmount) || 0))}</span>
                        {paymentMode === 'full' && (
                          <>
                            <span className="text-muted-foreground">Change:</span>
                            <span className="font-bold">{fmt(Math.max(0, (parseFloat(cashAmount) || 0) + (parseFloat(mpesaAmount) || 0) - parseFloat(pForm.selling_price)))}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full" size="lg"
                    disabled={productMutation.isPending || isMpesaProcessing || !pForm.finished_product_id || !pForm.customer_name || !pForm.selling_price || (!cashAmount && !mpesaAmount)}>
                    {productMutation.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                    {paymentMode === 'lipa' ? 'Complete with Instalment Plan' : 'Complete Full Payment'}
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

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentMode('full')}
                className={cn("p-4 rounded-xl border-2 text-center transition-all", paymentMode === 'full' ? "border-success bg-success/5" : "border-border hover:border-success/30")}>
                <Briefcase className={cn("h-6 w-6 mx-auto mb-1", paymentMode === 'full' ? "text-success" : "text-muted-foreground")} />
                <p className={cn("text-sm font-bold", paymentMode === 'full' ? "text-success" : "text-foreground")}>Full Payment</p>
                <p className="text-[10px] text-muted-foreground">Pay in full now</p>
              </button>
              <button type="button" onClick={() => setPaymentMode('lipa')}
                className={cn("p-4 rounded-xl border-2 text-center transition-all", paymentMode === 'lipa' ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                <TrendingUp className={cn("h-6 w-6 mx-auto mb-1", paymentMode === 'lipa' ? "text-primary" : "text-muted-foreground")} />
                <p className={cn("text-sm font-bold", paymentMode === 'lipa' ? "text-primary" : "text-foreground")}>Lipa Pole Pole</p>
                <p className="text-[10px] text-muted-foreground">Instalment plan</p>
              </button>
            </div>

            <Card className="border">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />Service Sale
                  {paymentMode === 'lipa' && <Badge variant="outline" className="text-[9px]">Lipa Pole Pole</Badge>}
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); serviceMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Service Type *</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(myServices || []).map((s: any) => (
                        <button key={s.name} type="button" onClick={() => setSForm(f => ({ ...f, service_name: s.name, amount: f.amount || s.base_price?.toString() || '' }))}
                          className={cn("px-3 py-2 rounded-lg text-xs border font-medium transition-colors text-center", sForm.service_name === s.name ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent")}>
                          {s.name}
                        </button>
                      ))}
                      {(myServices || []).length === 0 && (
                        <div className="col-span-2 p-4 text-center border border-dashed rounded-xl">
                          <p className="text-[10px] text-muted-foreground">No services available in inventory</p>
                        </div>
                      )}
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
                  </div>

                  {/* Lipa Pole Pole Config */}
                  {paymentMode === 'lipa' && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> Instalment Plan
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px]">Deposit (Ksh)</Label>
                          <Input type="number" value={instalmentConfig.deposit} onChange={e => setInstalmentConfig(f => ({ ...f, deposit: e.target.value }))} className="h-8 text-sm" placeholder="0" min="0" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Frequency</Label>
                          <select value={instalmentConfig.frequency} onChange={e => setInstalmentConfig(f => ({ ...f, frequency: e.target.value }))}
                            className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs">
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Instalments</Label>
                          <Input type="number" min="1" max="24" value={instalmentConfig.num_instalments} onChange={e => setInstalmentConfig(f => ({ ...f, num_instalments: e.target.value }))} className="h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Split Payment */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-semibold">Payment</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-accent/30 p-3 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-success" />
                          <Label className="text-[10px] font-medium">Cash Amount (Ksh)</Label>
                        </div>
                        <Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} className="h-9 text-sm" placeholder="0" min="0" />
                      </div>
                      <div className="bg-accent/30 p-3 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                          <Label className="text-[10px] font-medium">M-Pesa Amount (Ksh)</Label>
                        </div>
                        <Input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} className="h-9 text-sm" placeholder="0" min="0" />
                      </div>
                    </div>
                    <div className="bg-accent/30 p-3 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px]">M-Pesa Reference</Label>
                        <button type="button" onClick={() => setShowAdvancedMpesa(!showAdvancedMpesa)} className="text-[9px] text-primary hover:underline">
                          {showAdvancedMpesa ? 'Hide Settings' : 'Till Configuration'}
                        </button>
                      </div>

                      {showAdvancedMpesa && (
                        <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border/50 mb-2">
                          <div>
                            <Label className="text-[9px]">Store Number</Label>
                            <Input value={mpesaOverrides.businessShortCode} onChange={e => setMpesaOverrides(f => ({ ...f, businessShortCode: e.target.value }))} className="h-7 text-[10px]" placeholder="Required for Till" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Till Number</Label>
                            <Input value={mpesaOverrides.partyB} onChange={e => setMpesaOverrides(f => ({ ...f, partyB: e.target.value }))} className="h-7 text-[10px]" placeholder="Required for Till" />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} className={cn("h-9 text-sm uppercase font-mono flex-1", pollStatus === 'confirmed' && "border-success bg-success/5")} placeholder="Auto-filled after STK push" readOnly={isPollActive || pollStatus === 'confirmed'} />
                        <Button type="button" onClick={() => handleMpesaStkPush(sForm.amount, sForm.customer_phone, 'service', mpesaOverrides)}
                          disabled={isMpesaProcessing || isPollActive || !sForm.customer_phone}
                          className="h-9 bg-success hover:bg-success/90 text-xs gap-1 shrink-0">
                          {isMpesaProcessing || isPollActive ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
                          STK
                        </Button>
                      </div>
                      <MpesaPollStatusBadge />
                    </div>
                    {(cashAmount || mpesaAmount) && sForm.amount && (
                      <div className="flex justify-between items-center text-xs px-1">
                        <span className="text-muted-foreground">Total received:</span>
                        <span className="font-bold text-success">{fmt((parseFloat(cashAmount) || 0) + (parseFloat(mpesaAmount) || 0))}</span>
                        <span className="text-muted-foreground">Change:</span>
                        <span className="font-bold">{fmt(Math.max(0, (parseFloat(cashAmount) || 0) + (parseFloat(mpesaAmount) || 0) - parseFloat(sForm.amount)))}</span>
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full" size="lg"
                    disabled={serviceMutation.isPending || isMpesaProcessing || !sForm.customer_name || !sForm.amount || (!cashAmount && !mpesaAmount)}>
                    {serviceMutation.isPending ? <Loader2 className="animate-spin" /> : <Briefcase className="h-4 w-4" />}
                    Complete Service Sale
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}



        {/* NEW VIEWS */}
        {activeView === 'requests' && <ProductRequests />}
        {activeView === 'returns' && <ProductReturns />}
        {activeView === 'my_services' && <ServiceManagement />}

        {/* DAILY SALES LOG / HISTORY */}
        {activeView === 'log' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveView('home')}>← Back</Button>
            <h3 className="font-display font-semibold text-foreground text-sm">Sales History</h3>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-secondary/50 p-1 rounded-xl">
                <TabsTrigger value="all" className="text-xs rounded-lg data-[state=active]:bg-card">All Sales</TabsTrigger>
                <TabsTrigger value="full" className="text-xs rounded-lg data-[state=active]:bg-card text-success data-[state=active]:text-success">Full Payments</TabsTrigger>
                <TabsTrigger value="lipa" className="text-xs rounded-lg data-[state=active]:bg-card text-primary data-[state=active]:text-primary">Lipa Pole Pole</TabsTrigger>
              </TabsList>

              {[
                { value: 'all', data: allHistoricalSales },
                { value: 'full', data: allHistoricalSales.filter(s => !s.is_lipa) },
                { value: 'lipa', data: allHistoricalSales.filter(s => s.is_lipa) }
              ].map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="mt-4 space-y-1.5 focus-visible:outline-none">
                  {tab.data.length === 0 && (
                    <Card className="border"><CardContent className="p-6 text-center text-sm text-muted-foreground">No records found</CardContent></Card>
                  )}
                  {tab.data.map((s: any) => (
                    <Card key={s.id} className="border">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={s.type === 'Product' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{s.type}</Badge>
                              <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                              {s.payment_status && s.payment_status !== 'paid' && (
                                <Badge variant={s.payment_status === 'overdue' ? 'destructive' : 'outline'} className="text-[9px] px-1 py-0 shadow-sm border-warning/30 bg-warning/10 text-warning">
                                  {s.is_lipa ? 'Lipa Pole Pole' : s.payment_status}
                                </Badge>
                              )}
                              {!s.is_lipa && s.type === 'Product' && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 shadow-sm border-success/30 bg-success/10 text-success">
                                  Full
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{s.customer} • <span className="font-mono">{s.mpesa}</span> • {new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            {s.payment_status && s.payment_status !== 'paid' && s.amount_paid !== undefined && (
                              <p className="text-[9px] text-warning mt-0.5 font-medium">Paid {fmt(s.amount_paid)} of {fmt(s.amount)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold text-success">{fmt(s.amount)}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 bg-muted/50" onClick={() => { setReceiptId(s.id); setReceiptType(s.type === 'Product' ? 'product' : 'service'); setActiveView('receipt'); }}>
                              <Receipt className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* WALLET */}
        {activeView === 'wallet' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm">My Wallet</h3>
              <div className="flex items-center gap-2">
                {myWallet && (myWallet as any).pending_earnings > 0 && !(myWallet as any).payout_requested && (
                  isRequesting ? (
                    <div className="flex items-center gap-1 bg-accent/50 p-1 rounded-lg pr-1">
                      <Input
                        type="number"
                        value={requestAmount}
                        onChange={e => setRequestAmount(e.target.value)}
                        placeholder="Ksh..."
                        className="h-8 w-24 text-xs"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => requestPayoutMutation.mutate()}
                        disabled={requestPayoutMutation.isPending || !requestAmount}
                        className="h-8 text-xs px-2"
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsRequesting(false)} className="h-8 px-2 text-xs">X</Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setIsRequesting(true); setRequestAmount(String((myWallet as any).pending_earnings)); }}
                      className="h-8 border-primary text-primary hover:bg-primary/10"
                    >
                      Request Payout
                    </Button>
                  )
                )}
                {myWallet && (myWallet as any).payout_requested && (
                  <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-1 rounded-full flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Requested {formatCurrency((myWallet as any).payout_request_amount || 0)}
                  </span>
                )}
              </div>
            </div>
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

            {/* Get sale info for payment status display */}
            {(() => {
              const sale = receiptType === 'product'
                ? (mySales || []).find((s: any) => s.id === receiptId) as any
                : null;
              return (
                <>
                  {sale && (
                    <div className="mb-3 flex items-center gap-2">
                      {sale.is_lipa_pole_pole ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" /> Lipa Pole Pole
                        </Badge>
                      ) : (
                        <Badge className="bg-success/10 text-success border-success/20 text-xs">
                          <ShoppingCart className="h-3 w-3 mr-1" /> Fully Paid
                        </Badge>
                      )}
                      {sale.payment_status === 'partial' && (
                        <Badge variant="outline" className="text-xs">Partial — Paid {fmt(sale.amount_paid)} of {fmt(sale.selling_price)}</Badge>
                      )}
                      {sale.payment_status === 'unpaid' && (
                        <Badge variant="destructive" className="text-xs">No Deposit</Badge>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            <SaleReceipt saleId={receiptId} type={receiptType} />

            {/* Payment Transactions */}
            <Card className="border mt-4">
              <CardContent className="p-4">
                <PaymentTransactionsList
                  saleId={receiptId}
                  totalAmount={(() => {
                    const sale = (mySales || []).find((s: any) => s.id === receiptId);
                    return sale ? (sale as any).selling_price || 0 : 0;
                  })()}
                  onPaymentUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['my-product-sales'] });
                  }}
                />
              </CardContent>
            </Card>

            {/* Lipa Pole Pole: Instalment Schedule + Pay Next Instalment */}
            {receiptType === 'product' && (() => {
              const sale = (mySales || []).find((s: any) => s.id === receiptId) as any;
              if (!sale?.is_lipa_pole_pole) return null;
              return <InstalmentPaymentSection saleId={receiptId} sale={sale} />;
            })()}
          </div>
        )}
      </div>

      {/* Bottom nav - hidden on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 px-2 py-1 safe-area-pb lg:hidden">
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

/* Instalment Payment Section — shows schedule and allows paying next instalment */
function InstalmentPaymentSection({ saleId, sale }: { saleId: string; sale: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: instalments, isLoading } = useQuery({
    queryKey: ['instalment-schedule-view', saleId],
    queryFn: async () => {
      const { data } = await supabase.from('instalment_schedule' as any).select('*').eq('sale_id', saleId).order('due_date');
      return (data || []) as any[];
    },
  });

  const [payAmount, setPayAmount] = useState('');

  const list: any[] = instalments || [];
  const nextDue = list.find((i: any) => i.status === 'pending');
  const paidCount = list.filter((i: any) => i.status === 'paid').length;
  const totalDue = list.reduce((s: number, i: any) => s + (i.amount_due || 0), 0);
  const totalPaid = list.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0);

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!nextDue) throw new Error('No pending instalments');
      const amount = parseFloat(payAmount) || (nextDue.amount_due || 0);
      if (amount <= 0) throw new Error('Invalid payment amount');
      if (amount > (nextDue.amount_due || 0)) throw new Error('Amount exceeds instalment due');

      const { error: updateError } = await supabase
        .from('instalment_schedule' as any)
        .update({ amount_paid: amount, status: amount >= (nextDue.amount_due || 0) ? 'paid' : 'partial', paid_at: new Date().toISOString() })
        .eq('id', nextDue.id);
      if (updateError) throw updateError;

      const newTotalPaid = totalPaid + amount;
      const paymentStatus = newTotalPaid >= totalDue ? 'paid' : 'partial';

      await supabase.from('sales' as any).update({
        amount_paid: (sale.amount_paid || 0) + amount,
        payment_status: paymentStatus,
      }).eq('id', saleId);

      await supabase.from('payment_transactions' as any).insert({
        sale_id: saleId,
        amount,
        payment_method: 'cash',
        reference_number: `INSTALMENT-${Date.now().toString().slice(-8)}`,
        recorded_by: user?.id,
        notes: `Instalment payment for ${nextDue.due_date}`,
      });
    },
    onSuccess: () => {
      toast({ title: 'Instalment recorded!' });
      setPayAmount('');
      queryClient.invalidateQueries({ queryKey: ['instalment-schedule-view'] });
      queryClient.invalidateQueries({ queryKey: ['my-product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['instalment-schedules'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  return (
    <Card className="border border-primary/20 mt-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Instalment Plan</span>
          <Badge variant="outline" className="text-[10px]">{formatCurrency(sale.selling_price)}</Badge>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-accent/30 rounded-lg p-2">
            <p className="text-muted-foreground">Total</p>
            <p className="font-bold text-foreground">{formatCurrency(totalDue)}</p>
          </div>
          <div className="bg-success/5 rounded-lg p-2">
            <p className="text-muted-foreground">Paid</p>
            <p className="font-bold text-success">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-warning/5 rounded-lg p-2">
            <p className="text-muted-foreground">Remaining</p>
            <p className="font-bold text-warning">{formatCurrency(Math.max(0, totalDue - totalPaid))}</p>
          </div>
        </div>

        {/* Schedule */}
        {isLoading ? (
          <div className="space-y-1">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-accent animate-pulse rounded" />)}</div>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No instalment schedule found</p>
        ) : (
          <div className="space-y-1">
            {list.map((inst: any) => {
              const isDue = inst.id === nextDue?.id;
              return (
                <div key={inst.id} className={cn("flex items-center justify-between py-1.5 px-2 rounded text-xs",
                  inst.status === 'paid' ? "bg-success/5" : isDue ? "bg-primary/5 border border-primary/20" : "bg-accent/30"
                )}>
                  <span className={cn("font-medium", inst.status === 'paid' ? "text-success" : isDue ? "text-primary" : "text-foreground")}>
                    {new Date(inst.due_date).toLocaleDateString()}
                  </span>
                  <span className="font-bold">{formatCurrency(inst.amount_due)}</span>
                  {inst.status === 'paid' ? (
                    <Badge className="text-[8px] bg-success/10 text-success border-success/30">Paid</Badge>
                  ) : inst.status === 'partial' ? (
                    <Badge className="text-[8px] bg-warning/10 text-warning border-warning/30">Partial</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[8px]">Pending</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pay Next Instalment */}
        {nextDue && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium">Pay Next Instalment (due {new Date(nextDue.due_date).toLocaleDateString()})</p>
            <div className="flex gap-2">
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={String(nextDue.amount_due)} className="h-10 text-sm" min="0" step="0.01" />
              <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending} className="h-10 shrink-0">
                {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay'}
              </Button>
              <Button variant="outline" onClick={() => { setPayAmount(String(nextDue.amount_due)); }} className="h-10 text-xs shrink-0">
                Full
              </Button>
            </div>
          </div>
        )}

        {!nextDue && paidCount > 0 && (
          <div className="text-center text-xs text-success font-medium py-2 bg-success/5 rounded-lg">
            All instalments paid! Fully settled ✓
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SalesDashboard;
