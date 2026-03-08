import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const TransactionHistory = () => {
  const [search, setSearch] = useState('');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallet_transactions').select('*, wallets(user_id)').order('created_at', { ascending: false });
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

  const getName = (txn: any) => {
    const uid = txn.wallets?.user_id;
    return profiles?.find(p => p.user_id === uid)?.full_name || 'Unknown';
  };

  const filtered = (transactions || []).filter(t =>
    getName(t).toLowerCase().includes(search.toLowerCase()) ||
    t.type.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-16" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..." className="pl-10 h-11" />
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <Card className="border">
          <CardContent className="p-12 text-center">
            <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No transactions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((txn) => (
            <Card key={txn.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      txn.type === 'payment' ? "bg-success/10" : txn.type === 'approval' ? "bg-primary/10" : "bg-warning/10"
                    )}>
                      {txn.type === 'payment' ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{getName(txn)}</p>
                      <p className="text-xs text-muted-foreground">{txn.description || txn.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold text-sm", txn.type === 'payment' ? "text-success" : "text-foreground")}>
                      {fmt(txn.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(txn.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
