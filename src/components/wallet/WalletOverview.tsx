import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Clock, CheckCircle, Banknote } from 'lucide-react';

const WalletOverview = () => {
  const { data: wallets, isLoading } = useQuery({
    queryKey: ['all-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallets').select('*');
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

  const totalPending = wallets?.reduce((s, w) => s + w.pending_earnings, 0) || 0;
  const totalApproved = wallets?.reduce((s, w) => s + w.approved_earnings, 0) || 0;
  const totalPaid = wallets?.reduce((s, w) => s + w.paid_earnings, 0) || 0;
  const totalAll = totalPending + totalApproved + totalPaid;

  const getName = (uid: string) => profiles?.find(p => p.user_id === uid)?.full_name || 'Unknown';
  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;

  const stats = [
    { label: 'Total Earnings', value: fmt(totalAll), icon: Wallet, color: 'text-primary' },
    { label: 'Pending Approval', value: fmt(totalPending), icon: Clock, color: 'text-warning' },
    { label: 'Approved', value: fmt(totalApproved), icon: CheckCircle, color: 'text-success' },
    { label: 'Paid Out', value: fmt(totalPaid), icon: Banknote, color: 'text-muted-foreground' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-lg font-bold font-display text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Worker wallets */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-3">Worker Wallets</h3>
        {(!wallets || wallets.length === 0) ? (
          <Card className="border">
            <CardContent className="p-12 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No wallets found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {wallets.map((w) => (
              <Card key={w.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">{getName(w.user_id)}</p>
                    <p className="text-sm font-bold text-foreground">{fmt(w.pending_earnings + w.approved_earnings + w.paid_earnings)}</p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-warning">Pending: {fmt(w.pending_earnings)}</span>
                    <span className="text-success">Approved: {fmt(w.approved_earnings)}</span>
                    <span className="text-muted-foreground">Paid: {fmt(w.paid_earnings)}</span>
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

export default WalletOverview;
