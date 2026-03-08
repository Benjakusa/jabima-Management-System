import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { subDays, format, startOfDay } from 'date-fns';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(210 60% 50%)',
  'hsl(280 60% 50%)',
  'hsl(30 80% 55%)',
  'hsl(160 50% 45%)',
];

const formatKsh = (v: number) => `Ksh ${v.toLocaleString()}`;

const ExpenseCharts = () => {
  const { data: expenses } = useQuery({
    queryKey: ['expense-charts-data'],
    queryFn: async () => {
      const since = subDays(new Date(), 29).toISOString().split('T')[0];
      const { data } = await supabase
        .from('expenses')
        .select('amount, category, date')
        .gte('date', since);
      return data || [];
    },
  });

  // Daily spending trend (last 14 days)
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dayStr = format(date, 'yyyy-MM-dd');
    const total = (expenses || [])
      .filter(e => e.date === dayStr)
      .reduce((sum, e) => sum + e.amount, 0);
    return { date: format(date, 'MMM dd'), amount: total };
  });

  // By category (last 30 days)
  const categoryMap = new Map<string, number>();
  (expenses || []).forEach(e => {
    categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + e.amount);
  });
  const categoryData = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <Card className="border">
        <CardContent className="p-4">
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Expenses (14 days)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => [formatKsh(value), 'Spent']}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="amount" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border">
        <CardContent className="p-4">
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Spending by Category (30 days)</h4>
          {categoryData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No expense data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {categoryData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatKsh(value)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ExpenseCharts;
