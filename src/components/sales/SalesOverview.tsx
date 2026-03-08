import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/cards/StatCard';
import { DollarSign, ShoppingCart, Briefcase, TrendingUp, Calendar, Users } from 'lucide-react';

const SalesOverview = () => {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const { data: salesToday } = useQuery({
    queryKey: ['sales-today'],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('selling_price').gte('created_at', today);
      return data || [];
    },
  });

  const { data: salesWeek } = useQuery({
    queryKey: ['sales-week'],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('selling_price').gte('created_at', weekAgo);
      return data || [];
    },
  });

  const { data: salesMonth } = useQuery({
    queryKey: ['sales-month'],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('selling_price').gte('created_at', monthStart);
      return data || [];
    },
  });

  const { data: serviceSalesMonth } = useQuery({
    queryKey: ['service-sales-month'],
    queryFn: async () => {
      const { data } = await supabase.from('service_sales').select('amount').gte('created_at', monthStart);
      return data || [];
    },
  });

  const { data: recentSales } = useQuery({
    queryKey: ['recent-sales'],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: salesProfiles } = useQuery({
    queryKey: ['sales-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const revToday = (salesToday || []).reduce((s, r) => s + r.selling_price, 0);
  const revWeek = (salesWeek || []).reduce((s, r) => s + r.selling_price, 0);
  const revMonth = (salesMonth || []).reduce((s, r) => s + r.selling_price, 0);
  const serviceRevMonth = (serviceSalesMonth || []).reduce((s, r) => s + r.amount, 0);
  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;
  const getName = (id: string) => salesProfiles?.find(p => p.user_id === id)?.full_name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard title="Revenue Today" value={fmt(revToday)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Revenue This Week" value={fmt(revWeek)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Revenue This Month" value={fmt(revMonth)} icon={<Calendar className="h-5 w-5" />} />
        <StatCard title="Products Sold Today" value={salesToday?.length || 0} icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard title="Service Revenue (Month)" value={fmt(serviceRevMonth)} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Total Sales (Month)" value={(salesMonth?.length || 0) + (serviceSalesMonth?.length || 0)} icon={<Users className="h-5 w-5" />} />
      </div>

      {/* Recent sales */}
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">Recent Sales</h3>
        {recentSales && recentSales.length > 0 ? (
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <div key={sale.id} className="bg-card rounded-xl border p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{sale.product_type}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sale.customer_name} • {getName(sale.sales_officer_id)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{fmt(sale.selling_price)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl border p-8 text-center">
            <p className="text-muted-foreground text-sm">No sales recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesOverview;
