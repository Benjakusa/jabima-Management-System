import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Factory, Package, RotateCcw, Wallet, FileText, RefreshCw } from 'lucide-react';
import WorkshopOverview from './WorkshopOverview';
import WorkshopTasks from './WorkshopTasks';
import WorkshopMaterialRequests from './WorkshopMaterialRequests';
import WorkshopMaterialReturns from './WorkshopMaterialReturns';
import WorkshopWallet from './WorkshopWallet';

import DailyReportForm from './DailyReportForm';
import DailyReportReminder from './DailyReportReminder';
import ProductionManagement from '@/components/production/ProductionManagement';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'mystages' | 'requests' | 'returns' | 'production' | 'wallet' | 'report';

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'requests', label: 'Materials', icon: Package },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'report', label: 'Reports', icon: FileText },
];

const WorkerDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['my-stage-orders'] });
    queryClient.invalidateQueries({ queryKey: ['my-stage-logs'] });
    queryClient.invalidateQueries({ queryKey: ['my-pending-requests'] });
    queryClient.invalidateQueries({ queryKey: ['workshop-wallet'] });
    queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-4">
      {/* Header - responsive */}
      <header className="sticky top-0 z-50 bg-card border-b px-3 py-3 flex items-center justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 lg:w-11 lg:h-11 bg-primary rounded-xl flex items-center justify-center">
            <Factory className="h-5 w-5 lg:h-6 lg:w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm lg:text-base">Workshop</h1>
            <p className="text-[10px] lg:text-xs text-muted-foreground hidden xs:block">{profile?.full_name}</p>
            <p className="text-[10px] lg:text-xs text-muted-foreground xs:hidden">{profile?.full_name?.split(' ')[0]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh dashboard data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content - responsive container */}
      <div className="p-3 lg:p-6 mx-auto max-w-5xl space-y-4 lg:space-y-6">
        <DailyReportReminder />

        {activeTab === 'overview' && <WorkshopOverview />}

        {activeTab === 'requests' && <WorkshopMaterialRequests />}
        {activeTab === 'returns' && <WorkshopMaterialReturns />}
        {activeTab === 'production' && <ProductionManagement />}
        {activeTab === 'wallet' && <WorkshopWallet />}
        {activeTab === 'report' && <DailyReportForm />}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 px-2 py-1 safe-area-pb">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0",
                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-[9px] font-medium truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default WorkerDashboard;
