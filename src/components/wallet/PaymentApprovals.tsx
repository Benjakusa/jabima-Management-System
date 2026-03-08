import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Banknote, Loader2, X } from 'lucide-react';

const PaymentApprovals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payingWallet, setPayingWallet] = useState<any>(null);
  const [payForm, setPayForm] = useState({ payment_method: '', reference_number: '' });

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets-pending'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallets').select('*').gt('pending_earnings', 0);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: approvedWallets } = useQuery({
    queryKey: ['wallets-approved'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallets').select('*').gt('approved_earnings', 0);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['wallet-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['wallets-pending'] });
    queryClient.invalidateQueries({ queryKey: ['wallets-approved'] });
    queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
  };

  const approveMutation = useMutation({
    mutationFn: async (wallet: any) => {
      const { error } = await supabase.from('wallets').update({
        approved_earnings: wallet.approved_earnings + wallet.pending_earnings,
        pending_earnings: 0,
      }).eq('id', wallet.id);
      if (error) throw error;

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'approval',
        amount: wallet.pending_earnings,
        description: `Approved Ksh ${wallet.pending_earnings.toLocaleString()} in pending earnings`,
      });
    },
    onSuccess: () => { toast({ title: 'Earnings approved!' }); invalidateAll(); },
    onError: (err: Error) => { toast({ variant: 'destructive', title: 'Error', description: err.message }); },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payingWallet) throw new Error('No wallet selected');
      if (!payForm.payment_method) throw new Error('Payment method is required');

      const { error } = await supabase.from('wallets').update({
        paid_earnings: payingWallet.paid_earnings + payingWallet.approved_earnings,
        approved_earnings: 0,
      }).eq('id', payingWallet.id);
      if (error) throw error;

      await supabase.from('wallet_transactions').insert({
        wallet_id: payingWallet.id,
        type: 'payment',
        amount: payingWallet.approved_earnings,
        description: `Paid Ksh ${payingWallet.approved_earnings.toLocaleString()} via ${payForm.payment_method}`,
        payment_method: payForm.payment_method,
        reference_number: payForm.reference_number || null,
      } as any);
    },
    onSuccess: () => {
      toast({ title: 'Payment recorded!' });
      setPayingWallet(null);
      setPayForm({ payment_method: '', reference_number: '' });
      invalidateAll();
    },
    onError: (err: Error) => { toast({ variant: 'destructive', title: 'Error', description: err.message }); },
  });

  const getName = (uid: string) => profiles?.find(p => p.user_id === uid)?.full_name || 'Unknown';
  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending approval */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-warning" />
          Pending Approval ({wallets?.length || 0})
        </h3>
        {(!wallets || wallets.length === 0) ? (
          <Card className="border"><CardContent className="p-8 text-center"><p className="text-muted-foreground text-sm">No pending approvals</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {wallets.map((w) => (
              <Card key={w.id} className="border border-warning/20">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{getName(w.user_id)}</p>
                    <p className="text-sm font-bold text-warning">{fmt(w.pending_earnings)} pending</p>
                  </div>
                  <Button onClick={() => approveMutation.mutate(w)} disabled={approveMutation.isPending} size="sm" variant="outline" className="border-success text-success hover:bg-success/10">
                    {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    Approve
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ready to pay */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-success" />
          Ready to Pay ({approvedWallets?.length || 0})
        </h3>
        {(!approvedWallets || approvedWallets.length === 0) ? (
          <Card className="border"><CardContent className="p-8 text-center"><p className="text-muted-foreground text-sm">No approved payments ready</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {approvedWallets.map((w) => (
              <Card key={w.id} className="border border-success/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{getName(w.user_id)}</p>
                      <p className="text-sm font-bold text-success">{fmt(w.approved_earnings)} approved</p>
                    </div>
                    {payingWallet?.id === w.id ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPayingWallet(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={() => { setPayingWallet(w); setPayForm({ payment_method: '', reference_number: '' }); }} size="sm">
                        <Banknote className="h-3 w-3" /> Mark Paid
                      </Button>
                    )}
                  </div>

                  {payingWallet?.id === w.id && (
                    <form onSubmit={(e) => { e.preventDefault(); payMutation.mutate(); }} className="mt-4 space-y-3 border-t border-border pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Payment Method *</Label>
                          <select value={payForm.payment_method} onChange={(e) => setPayForm(f => ({ ...f, payment_method: e.target.value }))}
                            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" required>
                            <option value="">Select method</option>
                            <option value="M-Pesa">M-Pesa</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cash">Cash</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Reference Number</Label>
                          <Input value={payForm.reference_number} onChange={(e) => setPayForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. MPESA code" className="h-10" />
                        </div>
                      </div>
                      <Button type="submit" size="sm" className="w-full" disabled={payMutation.isPending || !payForm.payment_method}>
                        {payMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Banknote className="h-3 w-3" />}
                        Confirm Payment — {fmt(w.approved_earnings)}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentApprovals;
