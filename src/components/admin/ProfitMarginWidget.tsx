import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const formatKsh = (v: number) => `Ksh ${v.toLocaleString()}`;

const ProfitMarginWidget = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['profit-margin-all-time'],
    queryFn: async () => {
      const [salesRes, serviceRes, expensesRes] = await Promise.all([
        supabase.from('sales').select('selling_price'),
        supabase.from('service_sales').select('amount'),
        supabase.from('expenses').select('amount'),
      ]);

      const productRevenue = (salesRes.data || []).reduce((s, r) => s + r.selling_price, 0);
      const serviceRevenue = (serviceRes.data || []).reduce((s, r) => s + r.amount, 0);
      const totalRevenue = productRevenue + serviceRevenue;
      const totalExpenses = (expensesRes.data || []).reduce((s, r) => s + r.amount, 0);
      const profit = totalRevenue - totalExpenses;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return { totalRevenue, totalExpenses, profit, margin };
    },
  });

  if (isLoading || !data) {
    return <div className="bg-card rounded-2xl border p-6 animate-pulse h-36" />;
  }

  const { totalRevenue, totalExpenses, profit, margin } = data;
  const isPositive = profit > 0;
  const isNeutral = profit === 0;

  return (
    <Card className={`border ${isPositive ? 'border-success/30' : isNeutral ? '' : 'border-destructive/30'}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display font-semibold text-foreground text-sm">Profit Overview</h4>
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
            isPositive ? 'bg-success/10 text-success' : isNeutral ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
          }`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : isNeutral ? <Minus className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {margin.toFixed(1)}%
          </div>
        </div>

        {/* Bar visualization */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Revenue</span>
            <span className="font-medium text-success">{formatKsh(totalRevenue)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full transition-all" style={{ width: totalRevenue > 0 ? '100%' : '0%' }} />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Expenses</span>
            <span className="font-medium text-destructive">{formatKsh(totalExpenses)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-destructive rounded-full transition-all"
              style={{ width: totalRevenue > 0 ? `${Math.min((totalExpenses / totalRevenue) * 100, 100)}%` : totalExpenses > 0 ? '100%' : '0%' }}
            />
          </div>
        </div>

        <div className={`text-center pt-3 border-t ${isPositive ? 'border-success/20' : 'border-destructive/20'}`}>
          <p className="text-xs text-muted-foreground">Net Profit</p>
          <p className={`text-lg font-bold font-display ${isPositive ? 'text-success' : isNeutral ? 'text-foreground' : 'text-destructive'}`}>
            {profit < 0 ? '-' : ''}{formatKsh(Math.abs(profit))}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitMarginWidget;
