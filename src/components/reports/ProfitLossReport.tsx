import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { exportCSV, printReport, fmt } from './reportUtils';
import { DateRange, filterByDateRange } from './DateRangeFilter';

interface Props { dateRange: DateRange; }

const ProfitLossReport = ({ dateRange }: Props) => {
  const { data: allProductSales } = useQuery({
    queryKey: ['report-product-sales'],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*');
      return data || [];
    },
  });

  const { data: allServiceSales } = useQuery({
    queryKey: ['report-service-sales'],
    queryFn: async () => {
      const { data } = await supabase.from('service_sales').select('*');
      return data || [];
    },
  });

  const { data: allExpenses } = useQuery({
    queryKey: ['report-expenses'],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('*');
      return data || [];
    },
  });

  const { data: allOrders } = useQuery({
    queryKey: ['report-production'],
    queryFn: async () => {
      const { data } = await supabase.from('production_orders').select('*');
      return data || [];
    },
  });

  const { data: wallets } = useQuery({
    queryKey: ['report-wallets'],
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*');
      return data || [];
    },
  });

  const productSales = filterByDateRange(allProductSales || [], 'created_at', dateRange);
  const serviceSales = filterByDateRange(allServiceSales || [], 'created_at', dateRange);
  const expenses = filterByDateRange(allExpenses || [], 'date', dateRange);
  const orders = filterByDateRange(allOrders || [], 'created_at', dateRange);

  const productRevenue = productSales.reduce((s, r) => s + r.selling_price, 0);
  const serviceRevenue = serviceSales.reduce((s, r) => s + r.amount, 0);
  const totalRevenue = productRevenue + serviceRevenue;

  const productionCost = orders.reduce((s, o) => s + (o.production_cost || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  // Wallets are cumulative, not date-filterable
  const totalWages = wallets?.reduce((s, w) => s + w.paid_earnings, 0) || 0;

  const totalCosts = productionCost + totalExpenses + totalWages;
  const netProfit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

  const lineItems = [
    { label: 'Product Sales Revenue', amount: productRevenue, type: 'revenue' },
    { label: 'Service Sales Revenue', amount: serviceRevenue, type: 'revenue' },
    { label: 'Production Costs', amount: productionCost, type: 'expense' },
    { label: 'Business Expenses', amount: totalExpenses, type: 'expense' },
    { label: 'Worker Wages Paid', amount: totalWages, type: 'expense' },
  ];

  const handleCSV = () => {
    exportCSV('profit-loss-report', ['Category', 'Amount', 'Type'],
      [...lineItems.map(l => [l.label, String(l.amount), l.type]),
        ['Total Revenue', String(totalRevenue), 'revenue'],
        ['Total Costs', String(totalCosts), 'expense'],
        ['Net Profit', String(netProfit), netProfit >= 0 ? 'profit' : 'loss']]
    );
  };

  const handlePrint = () => {
    const rows = lineItems.map(l =>
      `<tr><td>${l.label}</td><td style="text-align:right;color:${l.type === 'revenue' ? '#16a34a' : '#dc2626'}">${l.type === 'expense' ? '-' : ''}${fmt(l.amount)}</td></tr>`
    ).join('');
    printReport('Profit & Loss Report', `
      <table><thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}
      <tr class="total-row"><td>Total Revenue</td><td style="text-align:right;color:#16a34a">${fmt(totalRevenue)}</td></tr>
      <tr class="total-row"><td>Total Costs</td><td style="text-align:right;color:#dc2626">-${fmt(totalCosts)}</td></tr>
      <tr class="total-row" style="font-size:14px"><td>NET ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}</td><td style="text-align:right;color:${netProfit >= 0 ? '#16a34a' : '#dc2626'}">${fmt(Math.abs(netProfit))}</td></tr>
      </tbody></table>
    `);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-foreground">Profit & Loss</h3>
          <p className="text-xs text-muted-foreground">Business performance summary</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCSV}><Download className="h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg font-bold font-display text-success">{fmt(totalRevenue)}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Costs</p><p className="text-lg font-bold font-display text-destructive">{fmt(totalCosts)}</p></CardContent></Card>
        <Card className="border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
          <div className="flex items-center gap-1">
            {netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            <p className={`text-lg font-bold font-display ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(Math.abs(netProfit))}</p>
          </div>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Margin</p><p className={`text-lg font-bold font-display ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{margin}%</p></CardContent></Card>
      </div>

      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-secondary/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
            </tr></thead>
            <tbody>
              <tr className="bg-success/5 border-b"><td className="p-3 font-semibold text-foreground" colSpan={2}>Revenue</td></tr>
              <tr className="border-b"><td className="p-3 pl-6 text-foreground">Product Sales</td><td className="p-3 text-right text-success font-medium">{fmt(productRevenue)}</td></tr>
              <tr className="border-b"><td className="p-3 pl-6 text-foreground">Service Sales</td><td className="p-3 text-right text-success font-medium">{fmt(serviceRevenue)}</td></tr>
              <tr className="border-b bg-secondary/30 font-bold"><td className="p-3 text-foreground">Total Revenue</td><td className="p-3 text-right text-success">{fmt(totalRevenue)}</td></tr>

              <tr className="bg-destructive/5 border-b"><td className="p-3 font-semibold text-foreground" colSpan={2}>Costs</td></tr>
              <tr className="border-b"><td className="p-3 pl-6 text-foreground">Production Costs</td><td className="p-3 text-right text-destructive font-medium">-{fmt(productionCost)}</td></tr>
              <tr className="border-b"><td className="p-3 pl-6 text-foreground">Business Expenses</td><td className="p-3 text-right text-destructive font-medium">-{fmt(totalExpenses)}</td></tr>
              <tr className="border-b"><td className="p-3 pl-6 text-foreground">Worker Wages</td><td className="p-3 text-right text-destructive font-medium">-{fmt(totalWages)}</td></tr>
              <tr className="border-b bg-secondary/30 font-bold"><td className="p-3 text-foreground">Total Costs</td><td className="p-3 text-right text-destructive">-{fmt(totalCosts)}</td></tr>

              <tr className="font-bold text-base">
                <td className="p-4 text-foreground">NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}</td>
                <td className={`p-4 text-right ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{netProfit < 0 ? '-' : ''}{fmt(Math.abs(netProfit))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ProfitLossReport;
