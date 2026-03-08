import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { exportCSV, printReport, fmt } from './reportUtils';
import { DateRange, filterByDateRange } from './DateRangeFilter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', '#8b5cf6', '#06b6d4'];

interface Props { dateRange: DateRange; }

const InventoryReport = ({ dateRange }: Props) => {
  const { data: allMaterials, isLoading: loadingMat } = useQuery({
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

  const materials = filterByDateRange(allMaterials || [], 'created_at', dateRange);
  const isLoading = loadingMat || loadingEq;
  const totalValue = materials.reduce((s, m) => s + m.quantity * m.unit_cost, 0);
  const lowStock = materials.filter(m => m.quantity <= m.min_stock_level).length;

  const handleCSV = () => {
    exportCSV('inventory-report', ['Name', 'Category', 'Quantity', 'Unit', 'Unit Cost', 'Total Value', 'Min Stock'],
      materials.map(m => [m.name, m.category, String(m.quantity), m.unit, String(m.unit_cost), String(m.quantity * m.unit_cost), String(m.min_stock_level)])
    );
  };

  const handlePrint = () => {
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
          <p className="text-xs text-muted-foreground">{materials.length} materials • {equipment?.length || 0} equipment • {lowStock} low stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCSV}><Download className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-lg font-bold font-display text-foreground">{fmt(totalValue)}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Materials</p><p className="text-lg font-bold font-display text-foreground">{materials.length}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-lg font-bold font-display text-warning">{lowStock}</p></CardContent></Card>
      </div>

      {/* Charts */}
      {materials.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Value by Category</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(materials.reduce<Record<string, number>>((acc, m) => { acc[m.category] = (acc[m.category] || 0) + m.quantity * m.unit_cost; return acc; }, {})).map(([name, value]) => ({ name, value }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Distribution by Category</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={Object.entries(materials.reduce<Record<string, number>>((acc, m) => { acc[m.category] = (acc[m.category] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }))}
                    cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                    {Object.keys(materials.reduce<Record<string, number>>((acc, m) => { acc[m.category] = 1; return acc; }, {})).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
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
              {materials.map(m => (
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
