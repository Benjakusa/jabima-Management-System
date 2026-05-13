import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminDashboard from '@/components/admin/AdminDashboard';
import UserManagement from '@/components/admin/UserManagement';
import InventoryManagement from '@/components/inventory/InventoryManagement';
import SalesManagement from '@/components/sales/SalesManagement';
import WalletManagement from '@/components/wallet/WalletManagement';
import ReportsManagement from '@/components/reports/ReportsManagement';
import ExpenseManagement from '@/components/expenses/ExpenseManagement';
import SettingsManagement from '@/components/settings/SettingsManagement';
import DailyReportsOverview from '@/components/admin/DailyReportsOverview';
import ProductionManagement from '@/components/production/ProductionManagement';
import MaterialCategoriesPage from '@/components/admin/MaterialCategoriesPage';
import ProductsDesignsPage from '@/components/admin/ProductsDesignsPage';
import ShopItemsPage from '@/components/admin/ShopItemsPage';
import InterbranchTransfersPage from '@/components/admin/InterbranchTransfersPage';
import BranchManagementPage from '@/components/admin/BranchManagementPage';
import WorkerStageAssignmentsPage from '@/components/admin/WorkerStageAssignmentsPage';

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'users':
        return <UserManagement />;
      case 'inventory':
        return <InventoryManagement />;
      case 'production':
        return <ProductionManagement />;
      case 'sales':
        return <SalesManagement />;
      case 'wallet':
        return <WalletManagement />;
      case 'reports':
        return <ReportsManagement />;
      case 'expenses':
        return <ExpenseManagement />;
      case 'daily-reports':
        return <DailyReportsOverview />;
      case 'settings':
        return <SettingsManagement />;
      case 'materials':
        return <MaterialCategoriesPage />;
      case 'products':
        return <ProductsDesignsPage />;
      case 'shop-items':
        return <ShopItemsPage />;
      case 'transfers':
        return <InterbranchTransfersPage />;
      case 'branches':
        return <BranchManagementPage />;
      case 'workers':
        return <WorkerStageAssignmentsPage />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AppShell>
  );
};

const PlaceholderSection = ({ title, description }: { title: string; description: string }) => (
  <div className="space-y-4">
    <div>
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="bg-card rounded-2xl border p-12 flex items-center justify-center">
      <p className="text-muted-foreground">Coming soon — this module will be built next</p>
    </div>
  </div>
);

export default AdminPage;
