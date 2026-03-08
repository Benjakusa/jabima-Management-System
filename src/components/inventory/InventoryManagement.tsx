import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RawMaterialsList from '@/components/inventory/RawMaterialsList';
import ServiceEquipmentList from '@/components/inventory/ServiceEquipmentList';
import SuppliersList from '@/components/inventory/SuppliersList';
import StockAlerts from '@/components/inventory/StockAlerts';
import InventoryOverview from '@/components/inventory/InventoryOverview';
import { Package, Wrench, AlertTriangle, Users, LayoutDashboard } from 'lucide-react';

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Inventory Management</h2>
        <p className="text-sm text-muted-foreground">Manage raw materials, service equipment, and suppliers</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex overflow-x-auto bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="truncate">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">Materials</span>
          </TabsTrigger>
          <TabsTrigger value="equipment" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Wrench className="h-4 w-4 shrink-0" />
            <span className="truncate">Equipment</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">Suppliers</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="truncate">Alerts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <InventoryOverview />
        </TabsContent>
        <TabsContent value="materials" className="mt-4">
          <RawMaterialsList />
        </TabsContent>
        <TabsContent value="equipment" className="mt-4">
          <ServiceEquipmentList />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          <SuppliersList />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <StockAlerts />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryManagement;
