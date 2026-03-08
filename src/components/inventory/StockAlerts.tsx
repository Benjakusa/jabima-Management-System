import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, PackageX, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const StockAlerts = () => {
  const { data: materials, isLoading } = useQuery({
    queryKey: ['inventory-materials-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_materials')
        .select('*, suppliers(name)')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const outOfStock = (materials || []).filter(m => m.quantity === 0);
  const lowStock = (materials || []).filter(m => m.quantity > 0 && m.quantity <= m.min_stock_level);
  const healthy = (materials || []).filter(m => m.quantity > m.min_stock_level);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 text-center">
          <PackageX className="h-6 w-6 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold font-display text-destructive">{outOfStock.length}</p>
          <p className="text-xs text-muted-foreground">Out of Stock</p>
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 text-center">
          <TrendingDown className="h-6 w-6 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold font-display text-warning">{lowStock.length}</p>
          <p className="text-xs text-muted-foreground">Low Stock</p>
        </div>
        <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center">
          <AlertTriangle className="h-6 w-6 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold font-display text-success">{healthy.length}</p>
          <p className="text-xs text-muted-foreground">Healthy</p>
        </div>
      </div>

      {/* Out of stock */}
      {outOfStock.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <PackageX className="h-5 w-5 text-destructive" />
            Out of Stock ({outOfStock.length})
          </h3>
          <div className="space-y-2">
            {outOfStock.map((m) => (
              <Card key={m.id} className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.category} • Min: {m.min_stock_level} {m.unit}
                      {(m as any).suppliers?.name && ` • ${(m as any).suppliers.name}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-destructive">0 {m.unit}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-warning" />
            Low Stock ({lowStock.length})
          </h3>
          <div className="space-y-2">
            {lowStock.map((m) => {
              const pct = m.min_stock_level > 0 ? Math.round((m.quantity / m.min_stock_level) * 100) : 0;
              return (
                <Card key={m.id} className="border-warning/30 bg-warning/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.category} • Min: {m.min_stock_level} {m.unit}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-warning">{m.quantity} {m.unit}</span>
                    </div>
                    <div className="w-full h-2 bg-warning/20 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", pct < 50 ? "bg-destructive" : "bg-warning")}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {outOfStock.length === 0 && lowStock.length === 0 && (
        <div className="bg-success/5 border border-success/20 rounded-2xl p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-success mx-auto mb-3" />
          <p className="font-medium text-foreground">All stock levels are healthy!</p>
          <p className="text-sm text-muted-foreground mt-1">No alerts at this time</p>
        </div>
      )}
    </div>
  );
};

export default StockAlerts;
