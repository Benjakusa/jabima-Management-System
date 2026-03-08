import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import StatCard from '@/components/cards/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package, Factory, CheckCircle, ShoppingCart,
  DollarSign, Clock, TrendingUp, AlertTriangle
} from 'lucide-react';

interface DashboardStats {
  totalMaterialsValue: number;
  finishedProducts: number;
  inProduction: number;
  completedToday: number;
  soldToday: number;
  revenueToday: number;
  pendingPayments: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalMaterialsValue: 0,
    finishedProducts: 0,
    inProduction: 0,
    completedToday: 0,
    soldToday: 0,
    revenueToday: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0];

      const [materialsRes, finishedRes, productionRes, completedRes, salesRes, walletsRes] =
        await Promise.all([
          supabase.from('inventory_materials').select('quantity, unit_cost'),
          supabase.from('finished_products').select('id').eq('status', 'completed'),
          supabase.from('production_orders').select('id').eq('status', 'in_production'),
          supabase.from('production_orders').select('id').eq('status', 'completed').gte('completed_at', today),
          supabase.from('sales').select('selling_price').gte('created_at', today),
          supabase.from('wallets').select('pending_earnings'),
        ]);

      const materialsValue = (materialsRes.data || []).reduce(
        (sum, m) => sum + (m.quantity * m.unit_cost), 0
      );
      const revenue = (salesRes.data || []).reduce((sum, s) => sum + s.selling_price, 0);
      const pending = (walletsRes.data || []).reduce((sum, w) => sum + w.pending_earnings, 0);

      setStats({
        totalMaterialsValue: materialsValue,
        finishedProducts: finishedRes.data?.length || 0,
        inProduction: productionRes.data?.length || 0,
        completedToday: completedRes.data?.length || 0,
        soldToday: salesRes.data?.length || 0,
        revenueToday: revenue,
        pendingPayments: pending,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  const formatCurrency = (val: number) => `Ksh ${val.toLocaleString()}`;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold text-foreground">Dashboard</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 border animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Business overview for today</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Raw Materials Value"
          value={formatCurrency(stats.totalMaterialsValue)}
          icon={<Package className="h-5 w-5" />}
          trend={{ value: 5, label: 'vs last week' }}
        />
        <StatCard
          title="Finished Products"
          value={stats.finishedProducts}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title="In Production"
          value={stats.inProduction}
          icon={<Factory className="h-5 w-5" />}
        />
        <StatCard
          title="Completed Today"
          value={stats.completedToday}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Sold Today"
          value={stats.soldToday}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title="Revenue Today"
          value={formatCurrency(stats.revenueToday)}
          icon={<DollarSign className="h-5 w-5" />}
          trend={{ value: 12, label: 'vs yesterday' }}
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(stats.pendingPayments)}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Missing Daily Reports Alert */}
      <MissingReportsAlert />

      {/* Placeholder for charts section */}
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">Analytics</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl border p-6 h-64 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Production Progress Chart</p>
          </div>
          <div className="bg-card rounded-2xl border p-6 h-64 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Sales Revenue Chart</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MissingReportsAlert = () => {
  const today = new Date().toISOString().split('T')[0];

  const { data: workers } = useQuery({
    queryKey: ['worker-roles-for-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role').in('role', ['workshop_worker', 'sales_officer']);
      return data || [];
    },
  });

  const { data: todayReports } = useQuery({
    queryKey: ['today-reports-alert', today],
    queryFn: async () => {
      const { data } = await supabase.from('daily_reports').select('user_id').eq('report_date', today);
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const submittedIds = new Set(todayReports?.map(r => r.user_id) || []);
  const missing = (workers || []).filter(w => !submittedIds.has(w.user_id));
  const getName = (uid: string) => profiles?.find(p => p.user_id === uid)?.full_name || 'Unknown';
  const formatRole = (r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (missing.length === 0) return null;

  return (
    <Card className="border border-destructive/30 bg-destructive/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="font-display font-semibold text-foreground text-sm">
            Missing Daily Reports ({missing.length})
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          The following workers haven't submitted their daily report today:
        </p>
        <div className="flex flex-wrap gap-2">
          {missing.map(w => (
            <Badge key={w.user_id} variant="destructive" className="text-xs gap-1">
              {getName(w.user_id)}
              <span className="opacity-60">• {formatRole(w.role)}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminDashboard;
