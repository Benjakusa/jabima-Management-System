import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Factory, Package, RotateCcw, Wallet, FileText } from 'lucide-react';
import WorkshopOverview from './WorkshopOverview';
import WorkshopTasks from './WorkshopTasks';
import WorkshopMaterialRequests from './WorkshopMaterialRequests';
import WorkshopMaterialReturns from './WorkshopMaterialReturns';
import WorkshopWallet from './WorkshopWallet';
import DailyReportForm from './DailyReportForm';
import DailyReportReminder from './DailyReportReminder';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'tasks' | 'requests' | 'returns' | 'wallet' | 'report';

const tabs: { id: Tab; label: string; icon: typeof Factory }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: Factory },
  { id: 'requests', label: 'Materials', icon: Package },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'report', label: 'Report', icon: FileText },
];

const WorkerDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Factory className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm">Workshop</h1>
            <p className="text-[10px] text-muted-foreground">{profile?.full_name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <DailyReportReminder />
        
        {activeTab === 'overview' && <WorkshopOverview />}
        {activeTab === 'tasks' && <WorkshopTasks />}
        {activeTab === 'requests' && <WorkshopMaterialRequests />}
        {activeTab === 'returns' && <WorkshopMaterialReturns />}
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
