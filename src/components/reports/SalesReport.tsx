import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { exportCSV, printReport, fmt } from './reportUtils';
import { DateRange, filterByDateRange } from './DateRangeFilter';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))'];

interface Props { dateRange: DateRange; }

const SalesReport = ({ dateRange }: Props) => {
  const { data: allProductSales, isLoading: l1 } = useQuery({
    queryKey: ['report-product-sales'],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: allServiceSales, isLoading: l2 } = useQuery({
    queryKey: ['report-service-sales'],
    queryFn: async () => {
      const { data } = await supabase.from('service_sales').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['report-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const productSales = filterByDateRange(allProductSales || [], 'created_at', dateRange);
  const serviceSales = filterByDateRange(allServiceSales || [], 'created_at', dateRange);

  const isLoading = l1 || l2;
  const productRevenue = productSales.reduce((s, r) => s + r.selling_price, 0);
  const serviceRevenue = serviceSales.reduce((s, r) => s + r.amount, 0);
  const totalRevenue = productRevenue + serviceRevenue;
  const getName = (uid: string) => profiles?.find(p => p.user_id === uid)?.full_name || 'Unknown';

  const allSales = [
    ...productSales.map(s => ({ type: 'Product', item: s.product_type, customer: s.customer_name, amount: s.selling_price, mpesa: s.mpesa_code, officer: getName(s.sales_officer_id), date: s.created_at })),
    ...serviceSales.map(s => ({ type: 'Service', item: s.service_name, customer: s.customer_name, amount: s.amount, mpesa: s.mpesa_code, officer: getName(s.sales_officer_id), date: s.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleCSV = () => {
    exportCSV('sales-report', ['Type', 'Item', 'Customer', 'Amount', 'MPESA', 'Officer', 'Date'],
      allSales.map(s => [s.type, s.item, s.customer, String(s.amount), s.mpesa, s.officer, new Date(s.date).toLocaleDateString()])
    );
  };

  const handlePrint = () => {
    const rows = allSales.map(s =>
      `<tr><td>${s.type}</td><td>${s.item}</td><td>${s.customer}</td><td>${fmt(s.amount)}</td><td>${s.mpesa}</td><td>${new Date(s.date).toLocaleDateString()}</td></tr>`
    ).join('');
    printReport('Sales Report', `
      <table><thead><tr><th>Type</th><th>Item</th><th>Customer</th><th>Amount</th><th>MPESA</th><th>Date</th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="3">TOTAL REVENUE</td><td>${fmt(totalRevenue)}</td><td colspan="2"></td></tr></tbody></table>
    `);
  };

  if (isLoading) return <div className="bg-card rounded-2xl border p-8 animate-pulse h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-foreground">Sales Report</h3>
          <p className="text-xs text-muted-foreground">{allSales.length} transactions in range</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCSV}><Download className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-lg font-bold font-display text-success">{fmt(totalRevenue)}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Product Sales</p><p className="text-lg font-bold font-display text-foreground">{fmt(productRevenue)}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Service Sales</p><p className="text-lg font-bold font-display text-foreground">{fmt(serviceRevenue)}</p></CardContent></Card>
      </div>

      {/* Charts */}
      {allSales.length > 0 && (() => {
        // Daily revenue trend
        const dailyMap: Record<string, { date: string; products: number; services: number }> = {};
        productSales.forEach(s => {
          const d = format(new Date(s.created_at), 'dd MMM');
          if (!dailyMap[d]) dailyMap[d] = { date: d, products: 0, services: 0 };
          dailyMap[d].products += s.selling_price;
        });
        serviceSales.forEach(s => {
          const d = format(new Date(s.created_at), 'dd MMM');
          if (!dailyMap[d]) dailyMap[d] = { date: d, products: 0, services: 0 };
          dailyMap[d].services += s.amount;
        });
        const dailyData = Object.values(dailyMap).reverse().slice(-14);
        const pieData = [
          { name: 'Products', value: productRevenue },
          { name: 'Services', value: serviceRevenue },
        ].filter(d => d.value > 0);

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Revenue Trend</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Area type="monotone" dataKey="products" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="services" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Revenue Split</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
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
              <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left p-3 font-medium text-muted-foreground">MPESA</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Date</th>
            </tr></thead>
            <tbody>
              {allSales.map((s, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-md ${s.type === 'Product' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}>{s.type}</span></td>
                  <td className="p-3 font-medium text-foreground">{s.item}</td>
                  <td className="p-3 text-muted-foreground">{s.customer}</td>
                  <td className="p-3 text-right font-medium text-success">{fmt(s.amount)}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{s.mpesa}</td>
                  <td className="p-3 text-right text-muted-foreground">{new Date(s.date).toLocaleDateString()}</td>
                </tr>
              ))}
              <tr className="bg-secondary/30 font-bold">
                <td colSpan={3} className="p-3 text-foreground">Total</td>
                <td className="p-3 text-right text-success">{fmt(totalRevenue)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SalesReport;
