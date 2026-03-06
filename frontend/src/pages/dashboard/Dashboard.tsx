import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, LoadingPage, Badge } from '../../components/ui';
import { formatCurrency, formatNumber, getPercentageChange } from '../../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
const STAT_GRADIENTS = [
  'stat-card-green',
  'stat-card-blue', 
  'stat-card-purple',
  'stat-card-orange',
];

interface CategoryRevenueItem {
  category: string;
  revenue: number;
}

const Dashboard = () => {
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => dashboardAPI.getMetrics(),
  });

  const { data: salesChartData, isLoading: chartLoading } = useQuery({
    queryKey: ['dashboard-sales-chart'],
    queryFn: () => dashboardAPI.getSalesChart({ period: 'week' }),
  });

  const { data: topProductsData } = useQuery({
    queryKey: ['dashboard-top-products'],
    queryFn: () => dashboardAPI.getTopProducts({ limit: 5 }),
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: () => dashboardAPI.getLowStockAlerts(),
  });

  const { data: categoryData } = useQuery({
    queryKey: ['dashboard-revenue-category'],
    queryFn: () => dashboardAPI.getRevenueByCategory(),
  });

  if (metricsLoading) {
    return <LoadingPage message="Loading dashboard..." />;
  }

  const metrics = metricsData?.data?.data;
  const salesChart = salesChartData?.data?.data || [];
  const topProducts = topProductsData?.data?.data || [];
  const lowStockAlerts = lowStockData?.data?.data || [];
  const categoryRevenue: CategoryRevenueItem[] = categoryData?.data?.data || [];

  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(metrics?.revenue?.total || 0),
      change: metrics?.revenue?.growth || 0,
      icon: Wallet,
      gradient: 'stat-card-green',
    },
    {
      title: 'Sales Count',
      value: formatNumber(metrics?.sales?.count || 0),
      change: metrics?.sales?.growth || 0,
      icon: ShoppingCart,
      gradient: 'stat-card-blue',
    },
    {
      title: 'Products',
      value: formatNumber(metrics?.inventory?.totalProducts || 0),
      change: null,
      icon: Package,
      gradient: 'stat-card-purple',
    },
    {
      title: 'Customers',
      value: formatNumber(metrics?.customers?.total || 0),
      change: null,
      icon: Users,
      gradient: 'stat-card-orange',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-gradient">Dashboard</span>
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse-soft" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's what's happening with your store.
          </p>
        </div>
      </div>

      {/* Stats Grid - Modern Gradient Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div 
            key={stat.title}
            className={`stat-card ${stat.gradient} animate-slide-up stagger-${index + 1}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.change !== null && (
                <div className="flex items-center gap-1.5 text-sm bg-white/20 rounded-full px-2.5 py-1 backdrop-blur-sm">
                  {stat.change >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="font-medium">{Math.abs(stat.change).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm opacity-80 font-medium">{stat.title}</p>
              <p className="text-3xl font-bold mt-1 number-display">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Chart - Premium Design */}
        <Card className="lg:col-span-2 chart-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <div>
              <CardTitle className="text-lg font-bold">Sales Overview</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Revenue performance this week</p>
            </div>
            <Link to="/reports" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors bg-primary/5 px-3 py-1.5 rounded-full hover:bg-primary/10">
              View Reports <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="h-[320px]">
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="animate-pulse-soft">Loading chart...</div>
                </div>
              ) : salesChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChart} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                        <stop offset="40%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="salesGradientSecondary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="strokeGradientMain" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="50%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#047857" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="hsl(var(--border))" 
                      strokeOpacity={0.4} 
                      vertical={false} 
                    />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(value) => `₹${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
                      dx={-5}
                      width={60}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="chart-tooltip">
                              <div className="chart-tooltip-label">{label}</div>
                              <div className="chart-tooltip-value">
                                {formatCurrency(payload[0].value as number)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">Revenue</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="url(#strokeGradientMain)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#salesGradientPrimary)"
                      filter="url(#glow)"
                      dot={false}
                      activeDot={{ 
                        r: 6, 
                        fill: '#10B981', 
                        stroke: '#fff', 
                        strokeWidth: 3,
                        filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4))'
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 opacity-50" />
                  </div>
                  <span>No sales data available</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Revenue - Donut Chart */}
        <Card className="chart-premium border-0">
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-lg font-bold">Revenue by Category</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Distribution breakdown</p>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="h-[280px] relative">
              {categoryRevenue.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {COLORS.map((color, index) => (
                          <linearGradient key={`pieGrad-${index}`} id={`pieGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={1} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.75} />
                          </linearGradient>
                        ))}
                        <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.15"/>
                        </filter>
                      </defs>
                      <Pie
                        data={categoryRevenue}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="revenue"
                        nameKey="category"
                        strokeWidth={0}
                        filter="url(#pieShadow)"
                      >
                        {categoryRevenue.map((_: CategoryRevenueItem, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#pieGrad-${index % COLORS.length})`}
                            className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                            style={{ transformOrigin: 'center' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="chart-tooltip">
                                <div className="chart-tooltip-label">{payload[0].name}</div>
                                <div className="chart-tooltip-value">
                                  {formatCurrency(payload[0].value as number)}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="donut-center">
                    <div className="donut-center-value">
                      {formatCurrency(categoryRevenue.reduce((sum: number, c: CategoryRevenueItem) => sum + c.revenue, 0))}
                    </div>
                    <div className="donut-center-label">Total</div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No category data
                </div>
              )}
            </div>
            {/* Modern Legend */}
            <div className="chart-legend">
              {categoryRevenue.slice(0, 6).map((cat: CategoryRevenueItem, index: number) => (
                <div key={cat.category} className="chart-legend-item">
                  <div
                    className="chart-legend-dot"
                    style={{ background: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate">{cat.category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold">Top Selling Products</CardTitle>
            <Link to="/inventory" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product: { id: string; name: string; unitsSold: number; revenue: number }, index: number) => (
                  <div 
                    key={product.id} 
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-all duration-200 group"
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm"
                      style={{ 
                        background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}20, ${COLORS[index % COLORS.length]}10)`,
                        color: COLORS[index % COLORS.length]
                      }}
                    >
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate group-hover:text-primary transition-colors">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">{product.unitsSold}</span> units sold
                      </p>
                    </div>
                    <p className="font-bold text-lg number-display">{formatCurrency(product.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No product data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              </div>
              Low Stock Alerts
            </CardTitle>
            <Badge variant="warning" className="px-3 py-1 font-semibold">{lowStockAlerts.length}</Badge>
          </CardHeader>
          <CardContent>
            {lowStockAlerts.length > 0 ? (
              <div className="space-y-3">
                {lowStockAlerts.slice(0, 5).map((product: { id: string; name: string; currentStock: number; minStockLevel: number }) => (
                  <div 
                    key={product.id} 
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Min stock: <span className="font-medium">{product.minStockLevel}</span> units
                      </p>
                    </div>
                    <Badge 
                      variant={product.currentStock === 0 ? 'destructive' : 'warning'}
                      className="font-bold px-3 py-1"
                    >
                      {product.currentStock} left
                    </Badge>
                  </div>
                ))}
                {lowStockAlerts.length > 5 && (
                  <Link
                    to="/inventory?lowStock=true"
                    className="block text-sm text-primary hover:underline text-center"
                  >
                    View all {lowStockAlerts.length} alerts
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                All products are well stocked!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
