import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExpenseOverview from '@/components/expenses/ExpenseOverview';
import ExpenseList from '@/components/expenses/ExpenseList';
import { LayoutDashboard, List } from 'lucide-react';

const ExpenseManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Expense Management</h2>
        <p className="text-sm text-muted-foreground">Track and manage business expenses</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex overflow-x-auto bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="truncate">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="list" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <List className="h-4 w-4 shrink-0" />
            <span className="truncate">All Expenses</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><ExpenseOverview /></TabsContent>
        <TabsContent value="list" className="mt-4"><ExpenseList /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ExpenseManagement;
