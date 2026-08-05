import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import StatCard from '@/components/cards/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ProductionChart from './ProductionChart';
import RevenueChart from './RevenueChart';
import ExpenseCharts from './ExpenseCharts';
import ProfitMarginWidget from './ProfitMarginWidget';
import StockByBranchPanel from './StockByBranchPanel';
import InstalmentOverview from './InstalmentOverview';
import WorkshopEmployerOverview from './WorkshopEmployerOverview';
import {
  Package, Factory, CheckCircle, ShoppingCart,
  DollarSign, Clock, TrendingUp, PartyPopper, Building2, RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

const AdminDashboard = () => {
  const today = new Date().toISOString().split('T')[0];
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['recently-completed-orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin-workshop-live'] });
    queryClient.invalidateQueries({ queryKey: ['admin-workshop-completed-today'] });
    queryClient.invalidateQueries({ queryKey: ['admin-workshop-total-completed'] });
    queryClient.invalidateQueries({ queryKey: ['stock-by-branch'] });
    queryClient.invalidateQueries({ queryKey: ['instalment-overview'] });
    queryClient.invalidateQueries({ queryKey: ['revenue-chart'] });
    queryClient.invalidateQueries({ queryKey: ['production-chart'] });
  };

  useEffect(() => {
    const channel = supabase.channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_materials' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finished_products' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['recently-completed-orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats', today],
    queryFn: async () => {
      const [materialsRes, finishedRes, productionRes, salesRes, staffEarningsRes, paymentsRes] =
        await Promise.all([
          supabase.from('product_material_usage').select('quantity_used, inventory_materials(unit_cost)').gte('created_at', today),
          supabase.from('finished_products').select('id').eq('status', 'completed').gte('completed_at', today),
          supabase.from('production_orders').select('id').eq('status', 'in_production').gte('started_at', today),
          supabase.from('sales').select('selling_price').gte('created_at', today),
          supabase.from('wallet_transactions').select('amount').eq('type', 'earned').gte('created_at', today),
          supabase.from('wallet_transactions').select('amount').eq('type', 'paid').gte('created_at', today),
        ]);

      const materialsValue = (materialsRes.data || []).reduce((sum, m: any) => sum + (m.quantity_used * (m.inventory_materials?.unit_cost || 0)), 0);
      const revenue = (salesRes.data || []).reduce((sum, s) => sum + s.selling_price, 0);
      const staffEarnings = (staffEarningsRes.data || []).reduce((sum, s) => sum + s.amount, 0);
      const payments = (paymentsRes.data || []).reduce((sum, p) => sum + p.amount, 0);

      return {
        totalMaterialCosts: materialsValue,
        finishedProducts: finishedRes.data?.length || 0,
        inProduction: productionRes.data?.length || 0,
        salesToday: revenue,
        staffEarningsToday: staffEarnings,
        paymentsToday: payments,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-foreground">Dashboard</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 border animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Business overview for today</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Total Material Costs (Today)"
          value={formatCurrency(stats.totalMaterialCosts)}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          title="Finished Products (Today)"
          value={stats.finishedProducts}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title="Products in Production"
          value={stats.inProduction}
          icon={<Factory className="h-5 w-5" />}
        />
        <StatCard
          title="Total Sales (Today)"
          value={formatCurrency(stats.salesToday)}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title="Total Staff Earnings"
          value={formatCurrency(stats.staffEarningsToday)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Total Payments (Today)"
          value={formatCurrency(stats.paymentsToday)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Recently Completed Orders */}
      <RecentlyCompletedOrders />

      {/* Stock by Branch */}
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Stock by Branch
        </h3>
        <StockByBranchPanel />
      </div>

      {/* Instalment Overview */}
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">Instalment Plans</h3>
        <InstalmentOverview />
      </div>

      {/* Workshop Employer Overview */}
      <WorkshopEmployerOverview />

      {/* Analytics Charts */}
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">Analytics</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProfitMarginWidget />
          <ProductionChart />
          <RevenueChart />
          <ExpenseCharts />
        </div>
      </div>
    </div>
  );
};


const RecentlyCompletedOrders = () => {
  const today = new Date().toISOString().split('T')[0];

  const { data: recentCompleted } = useQuery({
    queryKey: ['recently-completed-orders', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('finished_products')
        .select('id, product_type, production_cost, completed_at, production_order_id')
        .gte('completed_at', today)
        .order('completed_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  if (!recentCompleted || recentCompleted.length === 0) return null;

  return (
    <Card className="border border-success/30 bg-success/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <PartyPopper className="h-5 w-5 text-success" />
          <h3 className="font-display font-semibold text-foreground text-sm">
            Completed Today ({recentCompleted.length})
          </h3>
        </div>
        <div className="space-y-2">
          {recentCompleted.map(fp => (
            <div key={fp.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <div>
                  <p className="text-sm font-medium text-foreground">{fp.product_type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(fp.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' • '}Cost: {formatCurrency(fp.production_cost)}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-success/20">
                Finished
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminDashboard;
