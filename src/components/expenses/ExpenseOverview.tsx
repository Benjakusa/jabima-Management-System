import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Fuel, Truck, Wrench, Receipt, TrendingUp } from 'lucide-react';

const CATEGORY_META: Record<string, { icon: typeof Fuel; color: string }> = {
  Transport: { icon: Truck, color: 'text-primary' },
  Fuel: { icon: Fuel, color: 'text-warning' },
  Repairs: { icon: Wrench, color: 'text-destructive' },
  Supplies: { icon: Receipt, color: 'text-success' },
};

const ExpenseOverview = () => {
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;

  const total = expenses?.reduce((s, e) => s + e.amount, 0) || 0;

  const now = new Date();
  const thisMonth = expenses?.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }) || [];
  const monthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);

  const today = now.toISOString().slice(0, 10);
  const todayTotal = expenses?.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0) || 0;

  // Group by category
  const byCategory: Record<string, number> = {};
  (expenses || []).forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  if (isLoading) {
    return <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />)}</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="border"><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Total Expenses</span></div>
          <p className="text-lg font-bold font-display text-foreground">{fmt(total)}</p>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><Receipt className="h-4 w-4 text-warning" /><span className="text-xs text-muted-foreground">This Month</span></div>
          <p className="text-lg font-bold font-display text-foreground">{fmt(monthTotal)}</p>
        </CardContent></Card>
        <Card className="border col-span-2 lg:col-span-1"><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2"><Receipt className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Today</span></div>
          <p className="text-lg font-bold font-display text-foreground">{fmt(todayTotal)}</p>
        </CardContent></Card>
      </div>

      {/* By category */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-3">By Category</h3>
        {categories.length === 0 ? (
          <Card className="border"><CardContent className="p-8 text-center"><p className="text-muted-foreground text-sm">No expenses recorded yet</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {categories.map(([cat, amount]) => {
              const meta = CATEGORY_META[cat] || { icon: Receipt, color: 'text-muted-foreground' };
              const Icon = meta.icon;
              const pct = total > 0 ? ((amount / total) * 100).toFixed(0) : '0';
              return (
                <Card key={cat} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <span className="font-medium text-foreground text-sm">{cat}</span>
                      </div>
                      <span className="font-bold text-foreground text-sm">{fmt(amount)}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{pct}% of total</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-3">Recent Expenses</h3>
        <div className="space-y-2">
          {(expenses || []).slice(0, 5).map(e => (
            <Card key={e.id} className="border">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">{e.description || e.category}</p>
                  <p className="text-xs text-muted-foreground">{e.category} • {new Date(e.date).toLocaleDateString()}</p>
                </div>
                <span className="font-bold text-destructive text-sm">{fmt(e.amount)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExpenseOverview;
