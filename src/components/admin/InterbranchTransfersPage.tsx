import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const InterbranchTransfersPage = () => {
  const [search, setSearch] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const branchMap = Object.fromEntries((branches || []).map((b: any) => [b.id, b.name]));

  const { data: transfers, isLoading, error: transfersError } = useQuery({
    queryKey: ['interbranch-transfers', branchMap],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interbranch_transfers' as any)
        .select('*')
        .order('transfer_date', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        from_branch: { name: branchMap[t.from_branch_id] || 'Warehouse' },
        to_branch: { name: branchMap[t.to_branch_id] || 'Unknown' },
      }));
    },
    refetchInterval: 5000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning';
      case 'in_transit': return 'bg-blue-500/10 text-blue-600';
      case 'received': return 'bg-success/10 text-success';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Interbranch Transfers</h2>
        <p className="text-sm text-muted-foreground">View all stock transfers between branches</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transfers..."
          className="w-full h-11 rounded-lg border border-input bg-background pl-10 pr-4 text-sm" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : transfersError ? (
        <Card className="border border-destructive/30">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive font-medium mb-1">Failed to load transfers</p>
            <p className="text-xs text-muted-foreground">{(transfersError as any)?.message || 'Unknown error'}</p>
          </CardContent>
        </Card>
      ) : (!transfers || transfers.length === 0) ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No transfers yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(transfers || []).filter((t: any) =>
            (t.from_branch?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.to_branch?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.status || '').toLowerCase().includes(search.toLowerCase())
          ).map((t: any) => (
            <Card key={t.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">
                        {t.finished_products?.product_type || `Product #${t.finished_product_id?.slice(0, 8) || 'N/A'}`}
                      </p>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", getStatusColor(t.status))}>{t.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.from_branch?.name || 'Warehouse'} → {t.to_branch?.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(t.transfer_date).toLocaleDateString()}
                      {t.notes && ` • ${t.notes}`}
                    </p>
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

export default InterbranchTransfersPage;
