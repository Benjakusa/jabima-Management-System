import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductionPipeline from '@/components/production/ProductionPipeline';
import ProductionOrdersList from '@/components/production/ProductionOrdersList';
import ProductDetail from '@/components/production/ProductDetail';
import { Factory, List, Eye } from 'lucide-react';

const ProductionManagement = () => {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const handleViewProduct = (id: string) => {
    setSelectedProductId(id);
    setActiveTab('detail');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Workshop Production</h2>
        <p className="text-sm text-muted-foreground">Monitor production pipeline and manage orders</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== 'detail') setSelectedProductId(null); }}>
        <TabsList className="w-full flex overflow-x-auto bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="pipeline" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Factory className="h-4 w-4 shrink-0" />
            <span className="truncate">Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <List className="h-4 w-4 shrink-0" />
            <span className="truncate">Orders</span>
          </TabsTrigger>
          {selectedProductId && (
            <TabsTrigger value="detail" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Eye className="h-4 w-4 shrink-0" />
              <span className="truncate">Detail</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <ProductionPipeline onViewProduct={handleViewProduct} />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <ProductionOrdersList onViewProduct={handleViewProduct} />
        </TabsContent>
        {selectedProductId && (
          <TabsContent value="detail" className="mt-4">
            <ProductDetail productId={selectedProductId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ProductionManagement;
