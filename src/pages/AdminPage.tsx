import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminDashboard from '@/components/admin/AdminDashboard';
import UserManagement from '@/components/admin/UserManagement';
import InventoryManagement from '@/components/inventory/InventoryManagement';
import ProductionManagement from '@/components/production/ProductionManagement';
import SalesManagement from '@/components/sales/SalesManagement';

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
        return <PlaceholderSection title="Wallet Management" description="Manage worker payments and approvals" />;
      case 'reports':
        return <PlaceholderSection title="Reports" description="Generate and export business reports" />;
      case 'settings':
        return <PlaceholderSection title="Settings" description="System configuration and preferences" />;
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
