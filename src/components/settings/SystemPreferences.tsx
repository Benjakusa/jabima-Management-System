import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Users, Package, Factory, ShoppingCart, Database } from 'lucide-react';

const SystemPreferences = () => {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const [profiles, materials, orders, sales, serviceSales, expenses] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('inventory_materials').select('id', { count: 'exact', head: true }),
        supabase.from('production_orders').select('id', { count: 'exact', head: true }),
        supabase.from('sales').select('id', { count: 'exact', head: true }),
        supabase.from('service_sales').select('id', { count: 'exact', head: true }),
        supabase.from('expenses').select('id', { count: 'exact', head: true }),
      ]);
      return {
        users: profiles.count || 0,
        materials: materials.count || 0,
        orders: orders.count || 0,
        sales: (sales.count || 0) + (serviceSales.count || 0),
        expenses: expenses.count || 0,
      };
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['my-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user!.id);
      return data?.map(r => r.role) || [];
    },
    enabled: !!user,
  });

  const systemInfo = [
    { label: 'Users', value: stats?.users || 0, icon: Users },
    { label: 'Materials', value: stats?.materials || 0, icon: Package },
    { label: 'Production Orders', value: stats?.orders || 0, icon: Factory },
    { label: 'Total Sales', value: stats?.sales || 0, icon: ShoppingCart },
    { label: 'Expenses', value: stats?.expenses || 0, icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Roles */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Your Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(roles || []).map(r => (
              <Badge key={r} variant="secondary" className="capitalize text-sm py-1 px-3">
                {r.replace(/_/g, ' ')}
              </Badge>
            ))}
            {(!roles || roles.length === 0) && <p className="text-sm text-muted-foreground">No roles assigned</p>}
          </div>
        </CardContent>
      </Card>

      {/* System stats */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-3">
            {systemInfo.map(s => (
              <div key={s.label} className="bg-secondary/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-lg font-bold font-display text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* App info */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Application</span>
            <span className="font-medium text-foreground">Jabima Management System</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium text-foreground">1.0.0</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium text-foreground">Opendesk Cloud</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemPreferences;
