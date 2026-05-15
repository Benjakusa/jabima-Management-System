import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SalesOverview from '@/components/sales/SalesOverview';
import ProductSalesList from '@/components/sales/ProductSalesList';
import ServiceSalesList from '@/components/sales/ServiceSalesList';
import ServiceCatalogueManager from '@/components/sales/ServiceCatalogueManager';
import SaleReceipt from '@/components/sales/SaleReceipt';
import ProductUpgradeSection from '@/components/admin/ProductUpgradeSection';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutDashboard, ShoppingCart, Briefcase, Receipt, List, ArrowUpCircle, Truck, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const SalesManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<'product' | 'service'>('product');

  const handleViewReceipt = (saleId: string, type: 'product' | 'service') => {
    setReceiptSaleId(saleId);
    setReceiptType(type);
    setActiveTab('receipt');
  };

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data || [];
    },
  });

  const branchMap = Object.fromEntries((branches || []).map((b: any) => [b.id, b.name]));

  const { data: stockReturns, isLoading: loadingReturns } = useQuery({
    queryKey: ['admin-stock-returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_returns' as any)
        .select('*, finished_products(id, product_type, batch_number)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: interbranchTransfers, isLoading: loadingTransfers } = useQuery({
    queryKey: ['admin-interbranch-transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interbranch_transfers' as any)
        .select('*')
        .order('transfer_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        from_branch: { name: branchMap[t.from_branch_id] || 'Warehouse' },
        to_branch: { name: branchMap[t.to_branch_id] || 'Unknown' },
      })) as any[];
    },
    enabled: Object.keys(branchMap).length > 0,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning';
      case 'accepted':
      case 'received':
      case 'processed': return 'bg-success/10 text-success';
      case 'rejected':
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      case 'in_transit': return 'bg-blue-500/10 text-blue-600';
      default: return 'bg-muted text-muted-foreground';
    }
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
          <TabsTrigger value="catalogue" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <List className="h-4 w-4 shrink-0" />
            <span className="truncate">Catalogue</span>
          </TabsTrigger>
          <TabsTrigger value="upgrades" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <ArrowUpCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">Upgrades</span>
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Truck className="h-4 w-4 shrink-0" />
            <span className="truncate">Transfers</span>
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
        <TabsContent value="catalogue" className="mt-4"><ServiceCatalogueManager /></TabsContent>
        <TabsContent value="upgrades" className="mt-4"><ProductUpgradeSection /></TabsContent>
        <TabsContent value="transfers" className="mt-4">
          <div className="space-y-6">
            <Card className="border">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2 mb-3">
                  <RotateCcw className="h-4 w-4 text-primary" /> Stock Returns (Sales Officers)
                </h3>
                {loadingReturns ? (
                  <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 bg-accent animate-pulse rounded-xl" />)}</div>
                ) : !stockReturns || stockReturns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No stock returns yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {stockReturns.map((ret: any) => (
                      <div key={ret.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/30 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{ret.finished_products?.product_type || 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(ret.created_at).toLocaleDateString()}
                            {ret.destination_branch_id && ` → ${branchMap[ret.destination_branch_id] || 'Branch'}`}
                          </p>
                        </div>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", getStatusColor(ret.status))}>
                          {ret.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-primary" /> Interbranch Transfers
                </h3>
                {loadingTransfers ? (
                  <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 bg-accent animate-pulse rounded-xl" />)}</div>
                ) : !interbranchTransfers || interbranchTransfers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No interbranch transfers yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {interbranchTransfers.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/30 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{t.finished_products?.product_type || `Product #${(t.finished_product_id || '').slice(0, 8)}`}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {t.from_branch?.name} → {t.to_branch?.name} • {new Date(t.transfer_date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", getStatusColor(t.status))}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
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
