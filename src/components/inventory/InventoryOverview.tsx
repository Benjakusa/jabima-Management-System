import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/cards/StatCard';
import { Package, DollarSign, AlertTriangle, TrendingDown, Truck } from 'lucide-react';

const InventoryOverview = () => {
  const { data: materials } = useQuery({
    queryKey: ['inventory-materials-overview'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_materials').select('*');
      return data || [];
    },
  });

  const { data: productRequests } = useQuery({
    queryKey: ['pending-product-requests-overview'],
    queryFn: async () => {
      const { data } = await supabase.from('product_requests').select('*').eq('status', 'pending');
      return data || [];
    },
  });

  const totalMaterialsValue = (materials || []).reduce(
    (sum, m) => sum + m.quantity * m.unit_cost, 0
  );
  const totalMaterials = materials?.length || 0;
  const lowStockItems = (materials || []).filter(m => m.quantity <= m.min_stock_level);
  const outOfStockItems = (materials || []).filter(m => m.quantity === 0);
  const pendingProductRequests = productRequests?.length || 0;

  const formatCurrency = (val: number) => `Ksh ${val.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Total Materials Value"
          value={formatCurrency(totalMaterialsValue)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Material Types"
          value={totalMaterials}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockItems.length}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          title="Out of Stock"
          value={outOfStockItems.length}
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <StatCard
          title="Product Req (Pending)"
          value={pendingProductRequests}
          icon={<Truck className="h-5 w-5" />}
          className={pendingProductRequests > 0 ? "border-primary/50 bg-primary/5" : ""}
        />
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4">
          <h3 className="font-display font-semibold text-foreground flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Low Stock Alerts
          </h3>
          <div className="space-y-2">
            {lowStockItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-card rounded-xl p-3 border">
                <div>
                  <p className="font-medium text-sm text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-destructive">
                    {item.quantity} {item.unit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Min: {item.min_stock_level} {item.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryOverview;
