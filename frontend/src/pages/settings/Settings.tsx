import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI, storeAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Select,
  Badge,
} from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import {
  Settings as SettingsIcon,
  User,
  Store,
  Bell,
  Shield,
  Palette,
  Save,
  Plus,
  Trash2,
  Download,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CURRENCY_OPTIONS = [
  { value: 'INR', label: '₹ Indian Rupee (INR)' },
  { value: 'USD', label: '$ US Dollar (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ British Pound (GBP)' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
];

// Theme utility functions
const getStoredTheme = (): 'light' | 'dark' | 'system' => {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'light';
};

const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', systemDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
  
  localStorage.setItem('theme', theme);
};

const Settings = () => {
  const { user, stores, currentStore, setCurrentStore } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'store' | 'preferences'>('profile');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(getStoredTheme());
  const [isExporting, setIsExporting] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch current store details
  const { data: storeData, isLoading: storeLoading } = useQuery({
    queryKey: ['store-current', currentStore?.id],
    queryFn: () => storeAPI.getCurrent(),
    enabled: !!currentStore?.id,
  });

  const currentStoreData = storeData?.data?.data;

  // Store form state
  const [storeForm, setStoreForm] = useState({
    name: '',
    businessType: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstin: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    lowStockThreshold: 10,
  });

  // Preference state
  const [preferences, setPreferences] = useState({
    enableNotifications: true,
    enableWeeklyReport: true,
    dailyReports: false,
    lowStockAlerts: true,
  });

  // Update form when store data loads
  useEffect(() => {
    if (currentStoreData) {
      setStoreForm({
        name: currentStoreData.name || '',
        businessType: currentStoreData.businessType || '',
        address: currentStoreData.address || '',
        city: currentStoreData.city || '',
        state: currentStoreData.state || '',
        pincode: currentStoreData.pincode || '',
        phone: currentStoreData.phone || '',
        email: currentStoreData.email || '',
        gstin: currentStoreData.gstin || '',
        currency: currentStoreData.currency || 'INR',
        timezone: currentStoreData.timezone || 'Asia/Kolkata',
        lowStockThreshold: currentStoreData.lowStockThreshold || 10,
      });
      setPreferences({
        enableNotifications: currentStoreData.enableNotifications ?? true,
        enableWeeklyReport: currentStoreData.enableWeeklyReport ?? true,
        dailyReports: false, // Not in schema yet
        lowStockAlerts: currentStoreData.enableNotifications ?? true,
      });
      // Apply theme from store if darkMode is set
      if (currentStoreData.darkMode !== undefined) {
        const storeTheme = currentStoreData.darkMode ? 'dark' : 'light';
        setTheme(storeTheme);
        applyTheme(storeTheme);
      }
    }
  }, [currentStoreData]);

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authAPI.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setProfileForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to change password');
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: (data: typeof storeForm) =>
      storeAPI.update(currentStore?.id || '', data),
    onSuccess: () => {
      toast.success('Store settings updated');
      queryClient.invalidateQueries({ queryKey: ['store-current'] });
    },
    onError: () => {
      toast.error('Failed to update store settings');
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: {
      enableNotifications?: boolean;
      enableWeeklyReport?: boolean;
      darkMode?: boolean;
    }) => storeAPI.updatePreferences(currentStore?.id || '', data),
    onSuccess: () => {
      toast.success('Preferences saved');
      queryClient.invalidateQueries({ queryKey: ['store-current'] });
    },
    onError: () => {
      toast.error('Failed to save preferences');
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.currentPassword || !profileForm.newPassword) {
      toast.error('Please fill in both password fields');
      return;
    }
    if (profileForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (profileForm.newPassword !== profileForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: profileForm.currentPassword,
      newPassword: profileForm.newPassword,
    });
  };

  const handleStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id) {
      toast.error('No store selected');
      return;
    }
    updateStoreMutation.mutate(storeForm);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    applyTheme(newTheme);
    // Save to backend
    if (currentStore?.id) {
      updatePreferencesMutation.mutate({
        darkMode: newTheme === 'dark',
      });
    }
  };

  const handlePreferencesSave = () => {
    if (!currentStore?.id) {
      toast.error('No store selected');
      return;
    }
    updatePreferencesMutation.mutate({
      enableNotifications: preferences.enableNotifications,
      enableWeeklyReport: preferences.enableWeeklyReport,
    });
  };

  const handleExportData = async () => {
    if (!currentStore?.id) {
      toast.error('No store selected');
      return;
    }
    
    setIsExporting(true);
    try {
      const response = await storeAPI.exportData(currentStore.id);
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `store-export-${currentStore.name?.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'store', label: 'Store', icon: Store },
    { id: 'preferences', label: 'Preferences', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and store settings
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="md:w-64">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Full Name"
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      disabled
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      disabled
                    />
                  </div>

                  <form onSubmit={handlePasswordSubmit} className="border-t pt-6">
                    <h3 className="font-medium mb-4">Change Password</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Input
                        label="Current Password"
                        type="password"
                        value={profileForm.currentPassword}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            currentPassword: e.target.value,
                          }))
                        }
                      />
                      <Input
                        label="New Password"
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        value={profileForm.confirmPassword}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button type="submit" isLoading={changePasswordMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        Change Password
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Store Tab */}
          {activeTab === 'store' && (
            <div className="space-y-6">
              {/* Store Selector */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Stores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {stores.map((store) => (
                      <div
                        key={store.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          currentStore?.id === store.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => setCurrentStore(store)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {store.businessType || store.type}
                            </p>
                          </div>
                          {currentStore?.id === store.id && (
                            <Badge variant="success" className="text-xs">Active</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    <button 
                      className="p-4 rounded-lg border border-dashed flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      onClick={() => toast('Multi-store support coming soon!', { icon: 'ℹ️' })}
                    >
                      <Plus className="w-4 h-4" />
                      Add New Store
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Store Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Store Settings - {currentStore?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {storeLoading ? (
                    <div className="py-8 text-center text-muted-foreground">
                      Loading store settings...
                    </div>
                  ) : (
                    <form onSubmit={handleStoreSubmit} className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Input
                          label="Store Name"
                          value={storeForm.name}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                        />
                        <Input
                          label="Business Type"
                          value={storeForm.businessType}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, businessType: e.target.value }))
                          }
                        />
                        <Input
                          label="Phone"
                          value={storeForm.phone}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, phone: e.target.value }))
                          }
                        />
                        <Input
                          label="Email"
                          type="email"
                          value={storeForm.email}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                        />
                        <Input
                          label="GSTIN / Tax ID"
                          value={storeForm.gstin}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, gstin: e.target.value }))
                          }
                        />
                        <Select
                          label="Currency"
                          options={CURRENCY_OPTIONS}
                          value={storeForm.currency}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, currency: e.target.value }))
                          }
                        />
                        <Input
                          label="City"
                          value={storeForm.city}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, city: e.target.value }))
                          }
                        />
                        <Input
                          label="State"
                          value={storeForm.state}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, state: e.target.value }))
                          }
                        />
                        <Input
                          label="Pincode"
                          value={storeForm.pincode}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, pincode: e.target.value }))
                          }
                        />
                        <Input
                          label="Low Stock Threshold"
                          type="number"
                          value={storeForm.lowStockThreshold}
                          onChange={(e) =>
                            setStoreForm((prev) => ({ ...prev, lowStockThreshold: parseInt(e.target.value) || 10 }))
                          }
                        />
                      </div>

                      <Textarea
                        label="Address"
                        value={storeForm.address}
                        onChange={(e) =>
                          setStoreForm((prev) => ({ ...prev, address: e.target.value }))
                        }
                        rows={3}
                      />

                      <div className="flex justify-between">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="text-destructive"
                          onClick={() => toast.error('Delete store is not available. Contact support.')}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Store
                        </Button>
                        <Button type="submit" isLoading={updateStoreMutation.isPending}>
                          <Save className="w-4 h-4 mr-2" />
                          Save Store Settings
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive updates and alerts via email
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.enableNotifications}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            enableNotifications: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Low Stock Alerts</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when products run low
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.lowStockAlerts}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            lowStockAlerts: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Daily Reports</p>
                      <p className="text-sm text-muted-foreground">
                        Receive daily sales summary
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.dailyReports}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            dailyReports: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Weekly Reports</p>
                      <p className="text-sm text-muted-foreground">
                        Receive weekly business analytics
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.enableWeeklyReport}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            enableWeeklyReport: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Appearance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleThemeChange('light')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                        theme === 'light'
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted/50 hover:border-muted'
                      }`}
                    >
                      <div className="w-full h-20 rounded bg-white border mb-2 flex items-center justify-center">
                        <Sun className="w-8 h-8 text-yellow-500" />
                      </div>
                      <p className="font-medium">Light</p>
                    </button>
                    <button
                      onClick={() => handleThemeChange('dark')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted/50 hover:border-muted'
                      }`}
                    >
                      <div className="w-full h-20 rounded bg-gray-900 border mb-2 flex items-center justify-center">
                        <Moon className="w-8 h-8 text-blue-400" />
                      </div>
                      <p className="font-medium">Dark</p>
                    </button>
                    <button
                      onClick={() => handleThemeChange('system')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                        theme === 'system'
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted/50 hover:border-muted'
                      }`}
                    >
                      <div className="w-full h-20 rounded bg-gradient-to-r from-white to-gray-900 border mb-2 flex items-center justify-center">
                        <Monitor className="w-8 h-8 text-gray-500" />
                      </div>
                      <p className="font-medium">System</p>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toast('Two-Factor Authentication coming soon!', { icon: 'ℹ️' })}
                    >
                      Enable
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Active Sessions</p>
                      <p className="text-sm text-muted-foreground">
                        Manage your active login sessions
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toast('Session management coming soon!', { icon: 'ℹ️' })}
                    >
                      View
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Export Data</p>
                      <p className="text-sm text-muted-foreground">
                        Download all your store data
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleExportData}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        'Exporting...'
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button 
                  onClick={handlePreferencesSave}
                  isLoading={updatePreferencesMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
