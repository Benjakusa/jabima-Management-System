import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InventoryReport from '@/components/reports/InventoryReport';
import ProductionReport from '@/components/reports/ProductionReport';
import SalesReport from '@/components/reports/SalesReport';
import ProfitLossReport from '@/components/reports/ProfitLossReport';
import DateRangeFilter, { DateRange } from '@/components/reports/DateRangeFilter';
import { Package, Factory, ShoppingCart, TrendingUp } from 'lucide-react';

const ReportsManagement = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground">Generate and export business reports</p>
      </div>

      <DateRangeFilter dateRange={dateRange} onChange={setDateRange} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex overflow-x-auto bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="inventory" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="production" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Factory className="h-4 w-4 shrink-0" />
            <span className="truncate">Production</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span className="truncate">Sales</span>
          </TabsTrigger>
          <TabsTrigger value="pnl" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span className="truncate">Profit/Loss</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4"><InventoryReport dateRange={dateRange} /></TabsContent>
        <TabsContent value="production" className="mt-4"><ProductionReport dateRange={dateRange} /></TabsContent>
        <TabsContent value="sales" className="mt-4"><SalesReport dateRange={dateRange} /></TabsContent>
        <TabsContent value="pnl" className="mt-4"><ProfitLossReport dateRange={dateRange} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsManagement;
