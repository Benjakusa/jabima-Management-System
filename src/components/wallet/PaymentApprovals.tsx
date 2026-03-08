import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Banknote, Loader2, Wallet } from 'lucide-react';

const PaymentApprovals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const approveMutation = useMutation({
    mutationFn: async (wallet: { id: string; user_id: string; pending_earnings: number; approved_earnings: number }) => {
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
    onSuccess: () => {
      toast({ title: 'Earnings approved successfully!' });
      queryClient.invalidateQueries({ queryKey: ['wallets-pending'] });
      queryClient.invalidateQueries({ queryKey: ['wallets-approved'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (wallet: { id: string; user_id: string; approved_earnings: number; paid_earnings: number }) => {
      const { error } = await supabase.from('wallets').update({
        paid_earnings: wallet.paid_earnings + wallet.approved_earnings,
        approved_earnings: 0,
      }).eq('id', wallet.id);
      if (error) throw error;

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'payment',
        amount: wallet.approved_earnings,
        description: `Paid out Ksh ${wallet.approved_earnings.toLocaleString()}`,
      });
    },
    onSuccess: () => {
      toast({ title: 'Payment recorded successfully!' });
      queryClient.invalidateQueries({ queryKey: ['wallets-pending'] });
      queryClient.invalidateQueries({ queryKey: ['wallets-approved'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
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
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{getName(w.user_id)}</p>
                    <p className="text-sm font-bold text-success">{fmt(w.approved_earnings)} approved</p>
                  </div>
                  <Button onClick={() => payMutation.mutate(w)} disabled={payMutation.isPending} size="sm">
                    {payMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Banknote className="h-3 w-3" />}
                    Mark Paid
                  </Button>
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
