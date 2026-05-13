import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const StockByBranchPanel = () => {
  const { data: branches } = useQuery({
    queryKey: ['branches-list-stock'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: finishedProducts, isLoading } = useQuery({
    queryKey: ['finished-products-branch-summary'],
    queryFn: async () => {
      const { data } = await supabase
        .from('finished_products')
        .select('id, product_type, branch_id, status, location')
        .in('status', ['completed', 'transferred'])
        .eq('is_active', true);
      return data || [];
    },
  });

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  const branchIds = (branches || []).map((b: any) => b.id);
  const branchNames = Object.fromEntries((branches || []).map((b: any) => [b.id, b.name]));

  const stockMap: Record<string, Record<string, number>> = {};
  const allProductTypes = [...new Set((finishedProducts || []).map((p: any) => p.product_type))].sort();

  (finishedProducts || []).forEach((p: any) => {
    const bid = p.branch_id || 'warehouse';
    if (!stockMap[bid]) stockMap[bid] = {};
    stockMap[bid][p.product_type] = (stockMap[bid][p.product_type] || 0) + 1;
  });

  if (!branches || branches.length === 0 || allProductTypes.length === 0) {
    return (
      <Card className="border">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Stock data will appear once products are added and branches exist</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-2 font-medium text-muted-foreground sticky left-0 bg-background">Product</th>
            {branches.map((b: any) => (
              <th key={b.id} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[80px]">{b.name}</th>
            ))}
            <th className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[80px]">Warehouse</th>
          </tr>
        </thead>
        <tbody>
          {allProductTypes.map(pt => (
            <tr key={pt} className="border-b last:border-b-0 hover:bg-accent/30">
              <td className="py-2 px-2 font-medium sticky left-0 bg-background">{pt}</td>
              {branches.map((b: any) => {
                const qty = stockMap[b.id]?.[pt] || 0;
                return (
                  <td key={b.id} className={cn("text-center py-2 px-2", qty === 0 ? "text-destructive/40" : "text-foreground")}>
                    <span className={cn("inline-block px-2 py-0.5 rounded", qty === 0 ? "bg-destructive/5" : "bg-success/10")}>
                      {qty || '—'}
                    </span>
                  </td>
                );
              })}
              <td className="text-center py-2 px-2">
                {stockMap['warehouse']?.[pt] || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockByBranchPanel;
