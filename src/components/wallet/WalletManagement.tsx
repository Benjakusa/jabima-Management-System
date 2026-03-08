import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WalletOverview from '@/components/wallet/WalletOverview';
import PaymentApprovals from '@/components/wallet/PaymentApprovals';
import PaymentConfigs from '@/components/wallet/PaymentConfigs';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import { LayoutDashboard, CheckCircle, Settings, History } from 'lucide-react';

const WalletManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Wallet Management</h2>
        <p className="text-sm text-muted-foreground">Manage worker earnings, approve payments, and track transactions</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex overflow-x-auto bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="truncate">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">Approvals</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <History className="h-4 w-4 shrink-0" />
            <span className="truncate">History</span>
          </TabsTrigger>
          <TabsTrigger value="configs" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Settings className="h-4 w-4 shrink-0" />
            <span className="truncate">Pay Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><WalletOverview /></TabsContent>
        <TabsContent value="approvals" className="mt-4"><PaymentApprovals /></TabsContent>
        <TabsContent value="history" className="mt-4"><TransactionHistory /></TabsContent>
        <TabsContent value="configs" className="mt-4"><PaymentConfigs /></TabsContent>
      </Tabs>
    </div>
  );
};

export default WalletManagement;
