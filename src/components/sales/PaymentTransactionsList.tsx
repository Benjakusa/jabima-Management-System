import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, DollarSign, CreditCard, Building2, Landmark } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface Props {
  saleId: string;
  totalAmount: number;
  onPaymentUpdate?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: DollarSign },
  { value: 'mpesa', label: 'M-Pesa', icon: CreditCard },
  { value: 'bank', label: 'Bank Transfer', icon: Landmark },
  { value: 'credit', label: 'Credit', icon: Building2 },
];

const PaymentTransactionsList = ({ saleId, totalAmount, onPaymentUpdate }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', payment_method: 'cash', reference_number: '', notes: '' });

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['payment-transactions', saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_transactions' as any)
        .select('*')
        .eq('sale_id', saleId)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const paidSoFar = (transactions || []).reduce((sum: number, t: any) => sum + t.amount, 0);
  const outstanding = totalAmount - paidSoFar;

  const addPayment = useMutation({
    mutationFn: async () => {
      if (!form.amount || parseFloat(form.amount) <= 0) throw new Error('Enter a valid amount');
      if (parseFloat(form.amount) > outstanding) throw new Error('Amount exceeds outstanding balance');

      const { error: txnError } = await supabase.from('payment_transactions' as any).insert({
        sale_id: saleId,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        reference_number: form.reference_number.trim() || null,
        recorded_by: user?.id,
        notes: form.notes.trim() || null,
      });
      if (txnError) throw txnError;

      const newPaid = paidSoFar + parseFloat(form.amount);
      const newStatus = newPaid >= totalAmount ? 'paid' : 'partial';

      const { error: updateError } = await supabase
        .from('sales' as any)
        .update({ amount_paid: newPaid, payment_status: newStatus })
        .eq('id', saleId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({ title: 'Payment recorded' });
      setForm({ amount: '', payment_method: 'cash', reference_number: '', notes: '' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['payment-transactions', saleId] });
      if (onPaymentUpdate) onPaymentUpdate();
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const getPaymentIcon = (method: string) => {
    const m = PAYMENT_METHODS.find(pm => pm.value === method);
    return m ? <m.icon className="h-3.5 w-3.5" /> : null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Payments
        </h4>
        {outstanding > 0 && (
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showForm ? 'Cancel' : 'Add Payment'}
          </Button>
        )}
      </div>

      {/* Balance bar */}
      <div className="flex gap-2 text-xs">
        <Badge variant="outline" className="text-success">Paid: {formatCurrency(paidSoFar)}</Badge>
        {outstanding > 0 && <Badge variant="outline" className="text-warning">Due: {formatCurrency(outstanding)}</Badge>}
      </div>

      {/* Add payment form */}
      {showForm && (
        <Card className="border-primary/20 bg-accent/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button key={pm.value} type="button" onClick={() => setForm(f => ({ ...f, payment_method: pm.value }))}
                  className={cn("flex-1 py-2 rounded-lg text-[10px] font-medium border transition-colors flex items-center justify-center gap-1",
                    form.payment_method === pm.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                  )}>
                  <pm.icon className="h-3 w-3" />
                  {pm.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Amount (Ksh)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="h-9 text-sm" min="0" step="0.01" placeholder="0" />
              </div>
              <div>
                <Label className="text-[10px]">Reference (optional)</Label>
                <Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))}
                  className="h-9 text-sm" placeholder="M-Pesa code / Bank ref" />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="h-9 text-sm" placeholder="Optional note" />
            </div>
            <Button size="sm" className="w-full text-xs" onClick={() => addPayment.mutate()}
              disabled={addPayment.isPending || !form.amount || parseFloat(form.amount) <= 0}>
              {addPayment.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
              Record Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction list */}
      {isLoading ? (
        <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
      ) : (transactions || []).length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">No payments recorded yet</p>
      ) : (
        <div className="space-y-1">
          {(transactions || []).map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-accent/20 text-xs">
              <div className="flex items-center gap-2">
                {getPaymentIcon(tx.payment_method)}
                <span className="capitalize">{tx.payment_method}</span>
                {tx.reference_number && <span className="font-mono text-[9px] text-muted-foreground">{tx.reference_number}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-success">{formatCurrency(tx.amount)}</span>
                <span className="text-[9px] text-muted-foreground">{new Date(tx.paid_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentTransactionsList;
