import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Package, Users, AlertTriangle, ClipboardList, RotateCcw, Wallet, FileText, Truck, RotateCw, ArrowLeftRight, Factory } from 'lucide-react';
import InventoryOverview from './InventoryOverview';
import RawMaterialsList from './RawMaterialsList';
import SuppliersList from './SuppliersList';
import StockAlerts from './StockAlerts';
import InventoryRequestProcessing from './InventoryRequestProcessing';
import InventoryReturnProcessing from './InventoryReturnProcessing';
import WorkshopWallet from '@/components/worker/WorkshopWallet';
import DailyReportForm from '@/components/worker/DailyReportForm';
import DailyReportReminder from '@/components/worker/DailyReportReminder';
import FinishedProductsList from './FinishedProductsList';
import ProductRequestProcessing from './ProductRequestProcessing';
import ProductReturnProcessing from './ProductReturnProcessing';
import InterbranchTransfersPage from '@/components/admin/InterbranchTransfersPage';
import ProductionManagement from '@/components/production/ProductionManagement';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'materials' | 'finished' | 'suppliers' | 'alerts' | 'requests' | 'product_requests' | 'returns' | 'product_returns' | 'transfers' | 'production' | 'wallet' | 'report';

const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'materials', label: 'Materials', icon: Package },
  { id: 'finished', label: 'Finished', icon: Package },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'requests', label: 'Material Req', icon: ClipboardList },
  { id: 'returns', label: 'Material Ret', icon: RotateCcw },
];

const secondaryTabs: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: 'product_requests', label: 'Product Requests', icon: Truck },
  { id: 'product_returns', label: 'Product Returns', icon: RotateCw },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
  { id: 'suppliers', label: 'Suppliers', icon: Users },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'report', label: 'Report', icon: FileText },
];

const InventoryOfficerDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const allTabs = [...tabs, ...secondaryTabs];

  const { data: pendingCount } = useQuery({
    queryKey: ['pending-product-requests-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('product_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 10000,
  });

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-4">
      <header className="sticky top-0 z-50 bg-card border-b px-3 py-3 flex items-center justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 lg:w-11 lg:h-11 bg-primary rounded-xl flex items-center justify-center">
            <Package className="h-5 w-5 lg:h-6 lg:w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm lg:text-base">Inventory</h1>
            <p className="text-[10px] lg:text-xs text-muted-foreground hidden xs:block">{profile?.full_name}</p>
            <p className="text-[10px] lg:text-xs text-muted-foreground xs:hidden">{profile?.full_name?.split(' ')[0]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {secondaryTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("p-2 rounded-lg transition-colors relative group",
                activeTab === tab.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )} title={tab.label}>
              <tab.icon className="h-4 w-4" />
              {tab.id === 'product_requests' && (pendingCount || 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[9px] px-1.5 py-0.5 rounded border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[100]">
                {tab.label}
              </span>
            </button>
          ))}
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="p-3 lg:p-6 mx-auto max-w-5xl space-y-4 lg:space-y-6">
        <DailyReportReminder />

        {activeTab === 'overview' && <InventoryOverview />}
        {activeTab === 'materials' && <RawMaterialsList />}
        {activeTab === 'finished' && <FinishedProductsList />}
        {activeTab === 'suppliers' && <SuppliersList />}
        {activeTab === 'alerts' && <StockAlerts />}
        {activeTab === 'requests' && (
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-1">Material Requests</h2>
            <p className="text-xs text-muted-foreground mb-4">Process material requests from workshop workers</p>
            <InventoryRequestProcessing />
          </div>
        )}
        {activeTab === 'product_requests' && (
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-1">Product Requests</h2>
            <p className="text-xs text-muted-foreground mb-4">Process product requests from sales agents</p>
            <ProductRequestProcessing />
          </div>
        )}
        {activeTab === 'returns' && (
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-1">Material Returns</h2>
            <p className="text-xs text-muted-foreground mb-4">Inspect and process returned materials</p>
            <InventoryReturnProcessing />
          </div>
        )}
        {activeTab === 'product_returns' && (
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-1">Product Returns</h2>
            <p className="text-xs text-muted-foreground mb-4">Process product returns from sales agents</p>
            <ProductReturnProcessing />
          </div>
        )}
        {activeTab === 'transfers' && (
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-1">Interbranch Transfers</h2>
            <p className="text-xs text-muted-foreground mb-4">Transfer stock between branches</p>
            <InterbranchTransfersPage />
          </div>
        )}
        {activeTab === 'production' && <ProductionManagement />}
        {activeTab === 'wallet' && <WorkshopWallet />}
        {activeTab === 'report' && <DailyReportForm />}
      </div>

      {/* Bottom navigation - hidden on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 px-2 py-1 safe-area-pb lg:hidden">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0",
                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              )}>
              <tab.icon className="h-4 w-4" />
              <span className="text-[9px] font-medium truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default InventoryOfficerDashboard;
