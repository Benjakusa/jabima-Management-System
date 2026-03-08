import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { exportCSV, printReport, fmt } from './reportUtils';

const formatStage = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const ProductionReport = () => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['report-production'],
    queryFn: async () => {
      const { data } = await supabase.from('production_orders').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: finished } = useQuery({
    queryKey: ['report-finished'],
    queryFn: async () => {
      const { data } = await supabase.from('finished_products').select('*');
      return data || [];
    },
  });

  const inProduction = orders?.filter(o => o.status === 'in_production').length || 0;
  const completed = orders?.filter(o => o.status === 'completed').length || 0;
  const totalCost = orders?.reduce((s, o) => s + (o.production_cost || 0), 0) || 0;
  const sold = finished?.filter(f => f.status === 'sold').length || 0;

  const handleCSV = () => {
    if (!orders) return;
    exportCSV('production-report', ['Product Type', 'Status', 'Current Stage', 'Cost', 'Started', 'Completed'],
      orders.map(o => [o.product_type, o.status, formatStage(o.current_stage), String(o.production_cost || 0),
        new Date(o.started_at).toLocaleDateString(), o.completed_at ? new Date(o.completed_at).toLocaleDateString() : '-'])
    );
  };

  const handlePrint = () => {
    if (!orders) return;
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
          <p className="text-xs text-muted-foreground">{orders?.length || 0} orders total</p>
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
              {(orders || []).map(o => (
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
