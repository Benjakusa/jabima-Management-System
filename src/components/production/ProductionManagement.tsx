import { useState } from 'react';
import ProductionOrdersList from '@/components/production/ProductionOrdersList';
import ProductionOrderDetail from '@/components/production/ProductionOrderDetail';

const ProductionManagement = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(() => {
    return localStorage.getItem('selected_production_order_id');
  });

  const handleSelectOrder = (id: string | null) => {
    setSelectedOrderId(id);
    if (id) {
      localStorage.setItem('selected_production_order_id', id);
    } else {
      localStorage.removeItem('selected_production_order_id');
    }
  };

  return (
    <div className="space-y-6">
      {!selectedOrderId && (
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Workshop Production</h2>
          <p className="text-sm text-muted-foreground">Active production orders queue and management</p>
        </div>
      )}

      {selectedOrderId ? (
        <ProductionOrderDetail
          orderId={selectedOrderId}
          onBack={() => handleSelectOrder(null)}
        />
      ) : (
        <ProductionOrdersList onViewProduct={handleSelectOrder} />
      )}
    </div>
  );
};

export default ProductionManagement;
