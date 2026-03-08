import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { subDays, format, startOfDay } from 'date-fns';

const ProductionChart = () => {
  const { data: orders } = useQuery({
    queryKey: ['production-chart-data'],
    queryFn: async () => {
      const since = subDays(new Date(), 13).toISOString();
      const { data } = await supabase
        .from('production_orders')
        .select('created_at, status, completed_at')
        .gte('created_at', since);
      return data || [];
    },
  });

  const chartData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayStart = startOfDay(date).getTime();
    const dayEnd = dayStart + 86400000;

    const started = (orders || []).filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;

    const completed = (orders || []).filter(o => {
      if (!o.completed_at) return false;
      const t = new Date(o.completed_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;

    return { date: format(date, 'MMM dd'), started, completed };
  });

  return (
    <Card className="border">
      <CardContent className="p-4">
        <h4 className="font-display font-semibold text-foreground text-sm mb-4">Production (14 days)</h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="started" name="Started" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" name="Completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ProductionChart;
