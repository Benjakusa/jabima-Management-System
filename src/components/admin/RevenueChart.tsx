import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { subDays, format, startOfDay } from 'date-fns';

const RevenueChart = () => {
  const { data: sales } = useQuery({
    queryKey: ['revenue-chart-sales'],
    queryFn: async () => {
      const since = subDays(new Date(), 13).toISOString();
      const { data } = await supabase
        .from('sales')
        .select('selling_price, created_at')
        .gte('created_at', since);
      return data || [];
    },
  });

  const { data: serviceSales } = useQuery({
    queryKey: ['revenue-chart-services'],
    queryFn: async () => {
      const since = subDays(new Date(), 13).toISOString();
      const { data } = await supabase
        .from('service_sales')
        .select('amount, created_at')
        .gte('created_at', since);
      return data || [];
    },
  });

  const chartData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dayStart = startOfDay(date).getTime();
    const dayEnd = dayStart + 86400000;

    const products = (sales || [])
      .filter(s => { const t = new Date(s.created_at).getTime(); return t >= dayStart && t < dayEnd; })
      .reduce((sum, s) => sum + s.selling_price, 0);

    const services = (serviceSales || [])
      .filter(s => { const t = new Date(s.created_at).getTime(); return t >= dayStart && t < dayEnd; })
      .reduce((sum, s) => sum + s.amount, 0);

    return { date: format(date, 'MMM dd'), products, services, total: products + services };
  });

  const formatKsh = (v: number) => `Ksh ${v.toLocaleString()}`;

  return (
    <Card className="border">
      <CardContent className="p-4">
        <h4 className="font-display font-semibold text-foreground text-sm mb-4">Revenue (14 days)</h4>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatKsh(value), name]}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Area type="monotone" dataKey="products" name="Products" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} />
            <Area type="monotone" dataKey="services" name="Services" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
