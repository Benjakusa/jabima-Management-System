import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { exportCSV, printReport, fmt } from './reportUtils';
import { DateRange, filterByDateRange } from './DateRangeFilter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--primary))', 'hsl(var(--destructive))'];

const formatStage = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

interface Props { dateRange: DateRange; }

const ProductionReport = ({ dateRange }: Props) => {
  const { data: allOrders, isLoading } = useQuery({
    queryKey: ['report-production'],
    queryFn: async () => {
      const { data } = await supabase.from('production_orders').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: allFinished } = useQuery({
    queryKey: ['report-finished'],
    queryFn: async () => {
      const { data } = await supabase.from('finished_products').select('*');
      return data || [];
    },
  });

  const orders = filterByDateRange(allOrders || [], 'created_at', dateRange);
  const finished = filterByDateRange(allFinished || [], 'completed_at', dateRange);

  const inProduction = orders.filter(o => o.status === 'in_production').length;
  const completed = orders.filter(o => o.status === 'completed').length;
  const totalCost = orders.reduce((s, o) => s + (o.production_cost || 0), 0);
  const sold = finished.filter(f => f.status === 'sold').length;

  const handleCSV = () => {
    exportCSV('production-report', ['Product Type', 'Status', 'Current Stage', 'Cost', 'Started', 'Completed'],
      orders.map(o => [o.product_type, o.status, formatStage(o.current_stage), String(o.production_cost || 0),
        new Date(o.started_at).toLocaleDateString(), o.completed_at ? new Date(o.completed_at).toLocaleDateString() : '-'])
    );
  };

  const handlePrint = () => {
    const rows = orders.map(o =>
      `<tr><td>${o.product_type}</td><td>${o.status}</td><td>${formatStage(o.current_stage)}</td><td>${fmt(o.production_cost || 0)}</td><td>${new Date(o.started_at).toLocaleDateString()}</td></tr>`
    ).join('');
    printReport('Production Report', `
      <table><thead><tr><th>Product</th><th>Status</th><th>Stage</th><th>Cost</th><th>Started</th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="3">TOTAL COST</td><td>${fmt(totalCost)}</td><td></td></tr></tbody></table>
    `);
  };

  if (isLoading) return <div className="bg-card rounded-2xl border p-8 animate-pulse h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-foreground">Production Report</h3>
          <p className="text-xs text-muted-foreground">{orders.length} orders in range</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCSV}><Download className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">In Production</p><p className="text-lg font-bold font-display text-warning">{inProduction}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-lg font-bold font-display text-success">{completed}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sold</p><p className="text-lg font-bold font-display text-primary">{sold}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Cost</p><p className="text-lg font-bold font-display text-foreground">{fmt(totalCost)}</p></CardContent></Card>
      </div>

      {/* Charts */}
      {orders.length > 0 && (() => {
        const statusData = [
          { name: 'In Production', value: inProduction },
          { name: 'Completed', value: completed },
          { name: 'Sold', value: sold },
        ].filter(d => d.value > 0);

        // By product type
        const byType: Record<string, number> = {};
        orders.forEach(o => { byType[o.product_type] = (byType[o.product_type] || 0) + 1; });
        const typeData = Object.entries(byType).map(([name, count]) => ({ name, count }));

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Status Distribution</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                      {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Orders by Product Type</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={typeData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-secondary/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Stage</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Cost</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Started</th>
            </tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="p-3 font-medium text-foreground">{o.product_type}</td>
                  <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-md ${o.status === 'in_production' ? 'bg-warning/10 text-warning' : o.status === 'completed' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{o.status}</span></td>
                  <td className="p-3 text-muted-foreground">{formatStage(o.current_stage)}</td>
                  <td className="p-3 text-right text-foreground">{fmt(o.production_cost || 0)}</td>
                  <td className="p-3 text-right text-muted-foreground">{new Date(o.started_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ProductionReport;
