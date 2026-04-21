import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Clock, CheckCircle, Banknote } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const WorkshopWallet = () => {
  const { user } = useAuth();

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['my-wallet', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions } = useQuery({
    queryKey: ['my-wallet-transactions', user?.id],
    queryFn: async () => {
      if (!wallet) return [];
      const { data } = await supabase.from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!wallet,
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>;
  }

  if (!wallet) {
    return (
      <Card className="border"><CardContent className="p-8 text-center">
        <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Wallet not found. Contact admin.</p>
      </CardContent></Card>
    );
  }

  const totalEarnings = wallet.pending_earnings + wallet.approved_earnings + wallet.paid_earnings;

  const stats = [
    { label: 'Total Earnings', value: formatCurrency(totalEarnings), icon: Wallet, color: 'text-primary' },
    { label: 'Pending', value: formatCurrency(wallet.pending_earnings), icon: Clock, color: 'text-warning' },
    { label: 'Approved', value: formatCurrency(wallet.approved_earnings), icon: CheckCircle, color: 'text-success' },
    { label: 'Paid Out', value: formatCurrency(wallet.paid_earnings), icon: Banknote, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-display font-semibold text-foreground text-sm">My Wallet</h2>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-lg font-bold font-display text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-2 text-sm">Transaction History</h3>
        {(!transactions || transactions.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-1">
            {transactions.map(txn => (
              <Card key={txn.id} className="border">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{txn.type}</p>
                    {txn.description && <p className="text-[10px] text-muted-foreground">{txn.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${txn.type === 'payment' ? 'text-success' : 'text-foreground'}`}>
                      {formatCurrency(txn.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(txn.created_at).toLocaleDateString()}</p>
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

export default WorkshopWallet;
