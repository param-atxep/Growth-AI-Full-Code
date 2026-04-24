import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { creditsAPI } from '../services/api';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  Sparkles,
  MessageSquare,
  Coins,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  TrendingUp,
  Store,
  Bell,
  User,
} from 'lucide-react';
import { cn } from '../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Sales', href: '/sales', icon: ShoppingCart },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'New Tab', href: '/reports', icon: BarChart3 },
  {
    name: 'AI Assistant',
    icon: Sparkles,
    children: [
      { name: 'AI Insights', href: '/ai/insights', icon: Sparkles },
      { name: 'AI Chat', href: '/ai/chat', icon: MessageSquare },
    ],
  },
  { name: 'Credits', href: '/credits', icon: Coins },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  
  const { user, stores, currentStore, setCurrentStore, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: creditsData } = useQuery({
    queryKey: ['credits-balance'],
    queryFn: () => creditsAPI.getBalance(),
    refetchInterval: 60000, // Refetch every minute
  });

  const credits = creditsData?.data?.data?.credits ?? creditsData?.data?.data?.creditBalance ?? currentStore?.credits ?? currentStore?.creditBalance ?? 0;

  const handleLogout = () => {
    // Clear all cached queries before logging out
    queryClient.clear();
    logout();
    navigate('/login');
  };

  const handleStoreChange = (store: typeof currentStore) => {
    if (store) {
      // Clear all cached queries when switching stores
      queryClient.clear();
      setCurrentStore(store);
      setStoreMenuOpen(false);
      window.location.reload(); // Reload to fetch new store data
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-gradient-to-b from-card via-card to-card/95 border-r transform transition-transform duration-300 lg:translate-x-0 shadow-xl lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">GrowthPilot</span>
          <button
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-muted"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Store Selector */}
        <div className="p-4 border-b">
          <div className="relative">
            <button
              onClick={() => setStoreMenuOpen(!storeMenuOpen)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-200"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold truncate">{currentStore?.name}</p>
                <p className="text-xs text-muted-foreground">{currentStore?.type}</p>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', storeMenuOpen && 'rotate-180')} />
            </button>

            {storeMenuOpen && stores.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-popover border rounded-xl shadow-xl z-10 overflow-hidden animate-slide-down">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => handleStoreChange(store)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors',
                      store.id === currentStore?.id && 'bg-primary/10'
                    )}
                  >
                    <Store className="w-4 h-4" />
                    <span className="text-sm font-medium truncate">{store.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-220px)]">
          {navigation.map((item) => {
            if (item.children) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setAiMenuOpen(!aiMenuOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1 text-left font-medium">{item.name}</span>
                    <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', aiMenuOpen && 'rotate-180')} />
                  </button>
                  {aiMenuOpen && (
                    <div className="ml-3 mt-1 space-y-1 border-l-2 border-primary/20 pl-3">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.href}
                          to={child.href}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
                              isActive
                                ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-md'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )
                          }
                        >
                          <child.icon className="w-4 h-4" />
                          <span className="text-sm font-medium">{child.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.href}
                to={item.href!}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Credits Card */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gradient-to-t from-card to-card/80">
          <div className="bg-gradient-to-br from-primary/15 via-primary/10 to-blue-500/10 rounded-2xl p-4 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <Coins className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">AI Credits</span>
            </div>
            <p className="text-3xl font-bold number-display bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">{credits.toLocaleString()}</p>
            <NavLink
              to="/credits"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium mt-2 transition-colors"
            >
              Buy more credits →
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b shadow-sm">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button className="relative p-2.5 rounded-xl hover:bg-muted transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full ring-2 ring-background" />
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="hidden sm:block text-sm font-semibold">{user?.name}</span>
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', userMenuOpen && 'rotate-180')} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-popover border rounded-2xl shadow-xl py-2 z-10 animate-slide-down">
                    <div className="px-4 py-3 border-b">
                      <p className="font-semibold">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <NavLink
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="font-medium">Settings</span>
                      </NavLink>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-destructive/10 transition-colors text-destructive"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="font-medium">Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
