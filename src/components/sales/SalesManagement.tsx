import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SalesOverview from '@/components/sales/SalesOverview';
import ProductSalesList from '@/components/sales/ProductSalesList';
import ServiceSalesList from '@/components/sales/ServiceSalesList';
import SaleReceipt from '@/components/sales/SaleReceipt';
import { LayoutDashboard, ShoppingCart, Briefcase, Receipt } from 'lucide-react';

const SalesManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'product' | 'service'>('product');

  const handleViewReceipt = (saleId: string, type: 'product' | 'service') => {
    setReceiptSaleId(saleId);
    setReceiptType(type);
    setActiveTab('receipt');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Sales Management</h2>
        <p className="text-sm text-muted-foreground">Record sales, manage customers, and generate receipts</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== 'receipt') setReceiptSaleId(null); }}>
        <TabsList className="w-full flex overflow-x-auto bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="truncate">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span className="truncate">Products</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Briefcase className="h-4 w-4 shrink-0" />
            <span className="truncate">Services</span>
          </TabsTrigger>
          {receiptSaleId && (
            <TabsTrigger value="receipt" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Receipt className="h-4 w-4 shrink-0" />
              <span className="truncate">Receipt</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-4"><SalesOverview /></TabsContent>
        <TabsContent value="products" className="mt-4"><ProductSalesList onViewReceipt={(id) => handleViewReceipt(id, 'product')} /></TabsContent>
        <TabsContent value="services" className="mt-4"><ServiceSalesList onViewReceipt={(id) => handleViewReceipt(id, 'service')} /></TabsContent>
        {receiptSaleId && (
          <TabsContent value="receipt" className="mt-4">
            <SaleReceipt saleId={receiptSaleId} type={receiptType} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default SalesManagement;
