import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, Package } from 'lucide-react';
import { exportCSV, printReport, fmt } from './reportUtils';

const InventoryReport = () => {
  const { data: materials, isLoading: loadingMat } = useQuery({
    queryKey: ['report-materials'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_materials').select('*').order('name');
      return data || [];
    },
  });

  const { data: equipment, isLoading: loadingEq } = useQuery({
    queryKey: ['report-equipment'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_services').select('*').order('name');
      return data || [];
    },
  });

  const isLoading = loadingMat || loadingEq;
  const totalValue = materials?.reduce((s, m) => s + m.quantity * m.unit_cost, 0) || 0;
  const lowStock = materials?.filter(m => m.quantity <= m.min_stock_level).length || 0;

  const handleCSV = () => {
    if (!materials) return;
    exportCSV('inventory-report', ['Name', 'Category', 'Quantity', 'Unit', 'Unit Cost', 'Total Value', 'Min Stock'],
      materials.map(m => [m.name, m.category, String(m.quantity), m.unit, String(m.unit_cost), String(m.quantity * m.unit_cost), String(m.min_stock_level)])
    );
  };

  const handlePrint = () => {
    if (!materials) return;
    const rows = materials.map(m =>
      `<tr><td>${m.name}</td><td>${m.category}</td><td>${m.quantity} ${m.unit}</td><td>${fmt(m.unit_cost)}</td><td>${fmt(m.quantity * m.unit_cost)}</td></tr>`
    ).join('');
    printReport('Inventory Report', `
      <table><thead><tr><th>Name</th><th>Category</th><th>Quantity</th><th>Unit Cost</th><th>Total Value</th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="4">TOTAL</td><td>${fmt(totalValue)}</td></tr></tbody></table>
      <br/><p style="font-size:12px;color:#666">Equipment items: ${equipment?.length || 0} | Low stock alerts: ${lowStock}</p>
    `);
  };

  if (isLoading) return <div className="bg-card rounded-2xl border p-8 animate-pulse h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-foreground">Inventory Report</h3>
          <p className="text-xs text-muted-foreground">{materials?.length || 0} materials • {equipment?.length || 0} equipment • {lowStock} low stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCSV}><Download className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-lg font-bold font-display text-foreground">{fmt(totalValue)}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Materials</p><p className="text-lg font-bold font-display text-foreground">{materials?.length || 0}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-lg font-bold font-display text-warning">{lowStock}</p></CardContent></Card>
      </div>

      {/* Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-secondary/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Qty</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Unit Cost</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Value</th>
            </tr></thead>
            <tbody>
              {(materials || []).map(m => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="p-3 font-medium text-foreground">{m.name}</td>
                  <td className="p-3 text-muted-foreground">{m.category}</td>
                  <td className="p-3 text-right text-foreground">{m.quantity} {m.unit}</td>
                  <td className="p-3 text-right text-foreground">{fmt(m.unit_cost)}</td>
                  <td className="p-3 text-right font-medium text-foreground">{fmt(m.quantity * m.unit_cost)}</td>
                </tr>
              ))}
              <tr className="bg-secondary/30 font-bold">
                <td colSpan={4} className="p-3 text-foreground">Total</td>
                <td className="p-3 text-right text-foreground">{fmt(totalValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default InventoryReport;
