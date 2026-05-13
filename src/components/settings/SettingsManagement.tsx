import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProfileSettings from '@/components/settings/ProfileSettings';
import SystemPreferences from '@/components/settings/SystemPreferences';
import { User, Sliders } from 'lucide-react';

const SettingsManagement = () => {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">Profile and system preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex overflow-x-auto bg-secondary/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="profile" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex-1 min-w-0 gap-1.5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
            <Sliders className="h-4 w-4 shrink-0" />
            <span className="truncate">System</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4"><ProfileSettings /></TabsContent>
        <TabsContent value="system" className="mt-4"><SystemPreferences /></TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsManagement;
