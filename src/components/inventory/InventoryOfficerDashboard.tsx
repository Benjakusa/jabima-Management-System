import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Package, Wrench, Users, AlertTriangle, ClipboardList, RotateCcw, Wallet, FileText } from 'lucide-react';
import InventoryOverview from './InventoryOverview';
import RawMaterialsList from './RawMaterialsList';
import ServiceEquipmentList from './ServiceEquipmentList';
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
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'materials' | 'finished' | 'equipment' | 'suppliers' | 'alerts' | 'requests' | 'product_requests' | 'returns' | 'product_returns' | 'wallet' | 'report';

const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'materials', label: 'Materials', icon: Package },
  { id: 'finished', label: 'Finished', icon: Package },
  { id: 'equipment', label: 'Services', icon: Wrench },
  { id: 'requests', label: 'Material Req', icon: ClipboardList },
  { id: 'returns', label: 'Material Ret', icon: RotateCcw },
];

const secondaryTabs: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: 'product_requests', label: 'Product Requests', icon: ClipboardList },
  { id: 'product_returns', label: 'Product Returns', icon: RotateCcw },
  { id: 'suppliers', label: 'Suppliers', icon: Users },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'report', label: 'Report', icon: FileText },
];

const InventoryOfficerDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const allTabs = [...tabs, ...secondaryTabs];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm">Inventory</h1>
            <p className="text-[10px] text-muted-foreground">{profile?.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {secondaryTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("p-2 rounded-lg transition-colors",
                activeTab === tab.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}>
              <tab.icon className="h-4 w-4" />
            </button>
          ))}
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <DailyReportReminder />

        {activeTab === 'overview' && <InventoryOverview />}
        {activeTab === 'materials' && <RawMaterialsList />}
        {activeTab === 'finished' && <FinishedProductsList />}
        {activeTab === 'equipment' && <ServiceEquipmentList />}
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
        {activeTab === 'wallet' && <WorkshopWallet />}
        {activeTab === 'report' && <DailyReportForm />}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 px-2 py-1 safe-area-pb">
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
