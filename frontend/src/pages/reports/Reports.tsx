import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI, expenseAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  LoadingPage,
} from '../../components/ui';
import { formatCurrency, formatNumber } from '../../lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

const Reports = () => {
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['report-metrics', { startDate, endDate }],
    queryFn: () =>
      dashboardAPI.getMetrics({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const { data: salesChartData, isLoading: chartLoading } = useQuery({
    queryKey: ['report-sales-chart', period],
    queryFn: () => dashboardAPI.getSalesChart({ period }),
  });

  const { data: categoryData } = useQuery({
    queryKey: ['report-revenue-category'],
    queryFn: () => dashboardAPI.getRevenueByCategory(),
  });

  const { data: expenseData } = useQuery({
    queryKey: ['report-expense-breakdown'],
    queryFn: () => dashboardAPI.getExpenseBreakdown(),
  });

  const { data: topProductsData } = useQuery({
    queryKey: ['report-top-products'],
    queryFn: () => dashboardAPI.getTopProducts({ limit: 10 }),
  });

  const { data: fastMovingData } = useQuery({
    queryKey: ['report-fast-moving'],
    queryFn: () => dashboardAPI.getFastMoving({ limit: 10 }),
  });

  if (metricsLoading) {
    return <LoadingPage message="Loading reports..." />;
  }

  const metrics = metricsData?.data?.data;
  const salesChart = salesChartData?.data?.data || [];
  const categoryRevenue = categoryData?.data?.data || [];
  const expenseBreakdown = expenseData?.data?.data || [];
  const topProducts = topProductsData?.data?.data || [];
  const fastMoving = fastMovingData?.data?.data || [];

  // Extract values from nested structure
  const totalRevenue = metrics?.revenue?.total || 0;
  const totalExpenses = metrics?.expenses?.total || 0;
  const totalOrders = metrics?.sales?.count || 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <BarChart3 className="w-6 h-6" />
            </div>
            <span className="text-gradient">Reports & Analytics</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive business performance insights
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Key Metrics - Modern Gradient Style */}
      <div className="grid gap-5 md:grid-cols-4">
        <div className="stat-card stat-card-green animate-slide-up stagger-1">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm opacity-80 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold number-display">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-pink animate-slide-up stagger-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <TrendingDown className="w-6 h-6" />
              </div>
              <div>
              <p className="text-sm opacity-80 font-medium">Total Expenses</p>
              <p className="text-2xl font-bold number-display">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-blue animate-slide-up stagger-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm opacity-80 font-medium">Net Profit</p>
              <p className="text-2xl font-bold number-display">
                {formatCurrency(netProfit)}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-purple animate-slide-up stagger-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm opacity-80 font-medium">Total Orders</p>
              <p className="text-2xl font-bold number-display">
                {formatNumber(totalOrders)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Trend */}
        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Sales Trend</CardTitle>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: 'week', label: 'Last 7 Days' },
                { value: 'month', label: 'Last 30 Days' },
                { value: 'quarter', label: 'Last 3 Months' },
              ]}
              className="w-36"
            />
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="animate-pulse-soft">Loading chart...</div>
                </div>
              ) : salesChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesChart} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lineGradientReport" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="50%" stopColor="#06B6D4" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                      <linearGradient id="areaGradientReport" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <filter id="lineGlow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
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
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="url(#lineGradientReport)"
                      strokeWidth={3}
                      dot={{ fill: '#10B981', stroke: '#fff', strokeWidth: 3, r: 5 }}
                      activeDot={{ 
                        r: 8, 
                        fill: '#10B981', 
                        stroke: '#fff', 
                        strokeWidth: 3,
                        filter: 'drop-shadow(0 2px 8px rgba(16, 185, 129, 0.5))'
                      }}
                      filter="url(#lineGlow)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 opacity-50" />
                  </div>
                  <span>No data available</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Category - Donut */}
        <Card className="chart-premium border-0">
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-lg font-bold">Revenue by Category</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Category performance breakdown</p>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="h-[280px] relative">
              {categoryRevenue.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {COLORS.map((color, index) => (
                          <linearGradient key={`catGrad-${index}`} id={`catGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={1} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                        <filter id="catShadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.15"/>
                        </filter>
                      </defs>
                      <Pie
                        data={categoryRevenue}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="revenue"
                        nameKey="category"
                        strokeWidth={0}
                        filter="url(#catShadow)"
                      >
                        {categoryRevenue.map((_: unknown, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#catGrad-${index % COLORS.length})`}
                            className="transition-all duration-300 hover:opacity-90 cursor-pointer"
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
                    <div className="text-lg font-bold text-foreground">
                      {categoryRevenue.length}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Categories</div>
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
              {categoryRevenue.slice(0, 6).map((cat: { category: string }, index: number) => (
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

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products - Horizontal Bar */}
        <Card className="chart-premium border-0">
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-lg font-bold">Top Selling Products</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Best performers by revenue</p>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="h-[320px]">
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts.slice(0, 5)} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <defs>
                      <linearGradient id="barGradientBlue" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                      </linearGradient>
                      <filter id="barShadow">
                        <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="#3B82F6" floodOpacity="0.3"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
                    <XAxis 
                      type="number" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(value) => `₹${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="chart-tooltip">
                              <div className="chart-tooltip-label">{payload[0].payload.name}</div>
                              <div className="chart-tooltip-value">
                                {formatCurrency(payload[0].value as number)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {payload[0].payload.unitsSold} units sold
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="url(#barGradientBlue)" 
                      radius={[0, 8, 8, 0]}
                      filter="url(#barShadow)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Package className="w-12 h-12 opacity-30" />
                  <span>No product data</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown - Donut */}
        <Card className="chart-premium border-0">
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-lg font-bold">Expense Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Where your money goes</p>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="h-[280px] relative">
              {expenseBreakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {['#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#06B6D4'].map((color, index) => (
                          <linearGradient key={`expGrad-${index}`} id={`expGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={1} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                        <filter id="expShadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.15"/>
                        </filter>
                      </defs>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="amount"
                        nameKey="category"
                        strokeWidth={0}
                        filter="url(#expShadow)"
                      >
                        {expenseBreakdown.map((_: unknown, index: number) => (
                          <Cell 
                            key={`exp-${index}`} 
                            fill={`url(#expGrad-${index % 6})`}
                            className="transition-all duration-300 hover:opacity-90 cursor-pointer"
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
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrency(expenseBreakdown.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0))}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Total</div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No expense data
                </div>
              )}
            </div>
            {/* Modern Legend */}
            <div className="chart-legend">
              {expenseBreakdown.slice(0, 6).map((exp: { category: string }, index: number) => (
                <div key={exp.category} className="chart-legend-item">
                  <div
                    className="chart-legend-dot"
                    style={{ background: ['#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#06B6D4'][index % 6] }}
                  />
                  <span className="truncate">{exp.category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fast Moving Products - Premium Grid */}
      <Card className="chart-premium border-0">
        <CardHeader className="pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Fast Moving Products</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Highest velocity items</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {fastMoving.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {fastMoving.map((product: { id: string; name: string; unitsSold: number; revenue: number }, index: number) => (
                <div 
                  key={product.id} 
                  className="relative p-4 rounded-2xl bg-gradient-to-br from-card to-muted/30 border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group overflow-hidden"
                >
                  {/* Rank Badge */}
                  <div 
                    className="absolute -top-1 -right-1 w-8 h-8 rounded-bl-xl flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}, ${COLORS[index % COLORS.length]}CC)` }}
                  >
                    #{index + 1}
                  </div>
                  <div className="pr-6">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors mb-2">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">{product.unitsSold}</span> units
                    </p>
                    <p className="text-xl font-bold mt-2 number-display" style={{ color: COLORS[index % COLORS.length] }}>
                      {formatCurrency(product.revenue)}
                    </p>
                  </div>
                  {/* Hover Glow */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ 
                      background: `radial-gradient(circle at top right, ${COLORS[index % COLORS.length]}10, transparent 70%)` 
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
