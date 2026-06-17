import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, Package, Factory, ShoppingCart,
  Wallet, FileText, Settings, LogOut, Menu, X, Receipt, ClipboardList,
  Tags, Layers, Store, Truck, GitBranch, UserCog
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: ReactNode;
  id: string;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, id: 'dashboard' },
  { label: 'Users', icon: <Users className="h-5 w-5" />, id: 'users' },
  { label: 'Inventory', icon: <Package className="h-5 w-5" />, id: 'inventory' },
  { label: 'Production', icon: <Factory className="h-5 w-5" />, id: 'production' },
  { label: 'Sales', icon: <ShoppingCart className="h-5 w-5" />, id: 'sales' },
  { label: 'Wallet', icon: <Wallet className="h-5 w-5" />, id: 'wallet' },
  { label: 'Products', icon: <Tags className="h-5 w-5" />, id: 'products' },
  { label: 'Materials', icon: <Layers className="h-5 w-5" />, id: 'materials' },
  { label: 'Shop Items', icon: <Store className="h-5 w-5" />, id: 'shop-items' },
  { label: 'Transfers', icon: <Truck className="h-5 w-5" />, id: 'transfers' },
  { label: 'Branches', icon: <GitBranch className="h-5 w-5" />, id: 'branches' },
  { label: 'Expenses', icon: <Receipt className="h-5 w-5" />, id: 'expenses' },
  { label: 'Reports', icon: <FileText className="h-5 w-5" />, id: 'reports' },
  { label: 'Daily Reports', icon: <ClipboardList className="h-5 w-5" />, id: 'daily-reports' },
  { label: 'Settings', icon: <Settings className="h-5 w-5" />, id: 'settings' },
];

interface AppShellProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const AppShell = ({ children, activeTab, onTabChange }: AppShellProps) => {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile + Tablet Header — visible below lg (< 1024px) */}
      <header className="sticky top-0 z-40 bg-card border-b px-3 py-3 flex items-center justify-between lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-display font-bold text-lg text-foreground">Jabima</h1>
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">
            {profile?.full_name?.charAt(0) || 'A'}
          </span>
        </div>
      </header>

      {/* Mobile + Tablet Sidebar Overlay — shown when sidebarOpen, hidden on lg+ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <nav
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-card border-r flex flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <span className="text-primary-foreground font-display font-bold">J</span>
                </div>
                <div>
                  <span className="font-display font-bold text-foreground block">Jabima</span>
                  <span className="text-xs text-muted-foreground">Management System</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Scrollable nav items */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 px-3 space-y-1">
              {adminNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {/* Drawer footer — user info + sign out */}
            <div className="shrink-0 border-t px-3 py-3 space-y-1">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground text-xs font-bold">
                    {profile?.full_name?.charAt(0) || 'A'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar — fixed, visible only at lg+ (≥ 1024px) */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r bg-card">
        {/* Sidebar header */}
        <div className="p-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold">J</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground">Jabima</h1>
              <p className="text-xs text-muted-foreground">Management System</p>
            </div>
          </div>
        </div>

        {/* Scrollable nav items */}
        <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="shrink-0 p-3 border-t">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xs font-bold">
                {profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content — offset by sidebar width on desktop */}
      <main className="lg:pl-64">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppShell;
