import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { saleAPI } from '../../services/api';
import {
  Card,
  CardContent,
  Button,
  Input,
  Select,
  Badge,
  DataTable,
  LoadingPage,
} from '../../components/ui';
import { formatCurrency, formatDate, PAYMENT_METHODS, PAYMENT_STATUSES } from '../../lib/utils';
import { Plus } from 'lucide-react';

interface Sale {
  id: string;
  customer?: { name: string };
  items?: unknown[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  invoiceDate: string;
}

const Sales = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales', { page, paymentMethod, paymentStatus, startDate, endDate }],
    queryFn: () =>
      saleAPI.getAll({
        page,
        limit: 10,
        paymentMethod: paymentMethod || undefined,
        paymentStatus: paymentStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const { data: dailyReportData } = useQuery({
    queryKey: ['daily-report'],
    queryFn: () => saleAPI.getDailyReport(),
  });

  const sales = salesData?.data?.data || [];
  const pagination = salesData?.data?.meta;
  const dailyReport = dailyReportData?.data?.data;

  const columns: { key: string; header: string; render: (sale: Sale) => React.ReactNode }[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt #',
      render: (sale: Sale) => (
        <span className="font-mono text-sm">#{sale.id.slice(-8).toUpperCase()}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (sale: Sale) => (
        <span>{sale.customer?.name || 'Walk-in'}</span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (sale: Sale) => (
        <span>{sale.items?.length || 0} items</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (sale: Sale) => (
        <span className="font-semibold">{formatCurrency(sale.totalAmount)}</span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Payment',
      render: (sale: Sale) => (
        <Badge variant="outline">
          {PAYMENT_METHODS.find((m) => m.value === sale.paymentMethod)?.label || sale.paymentMethod}
        </Badge>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      render: (sale: Sale) => {
        const variant = sale.paymentStatus === 'PAID' ? 'success' :
          sale.paymentStatus === 'PENDING' ? 'warning' : 'secondary';
        return <Badge variant={variant}>{sale.paymentStatus}</Badge>;
      },
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (sale: Sale) => formatDate(sale.invoiceDate),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground">Track and manage your sales</p>
        </div>
        <Button onClick={() => navigate('/sales/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Sale
        </Button>
      </div>

      {/* Daily Summary */}
      {dailyReport && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Today's Sales</p>
              <p className="text-2xl font-bold mt-1">{dailyReport.salesCount || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Today's Revenue</p>
              <p className="text-2xl font-bold mt-1 text-green-500">
                {formatCurrency(dailyReport.totalRevenue || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Profit</p>
              <p className="text-2xl font-bold mt-1 text-blue-500">{formatCurrency(dailyReport.totalProfit || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg. Order Value</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(dailyReport.averageOrderValue || 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Payment Methods' },
                ...PAYMENT_METHODS,
              ]}
              className="sm:w-48"
            />
            <Select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                ...PAYMENT_STATUSES,
              ]}
              className="sm:w-40"
            />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="sm:w-40"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="sm:w-40"
            />
            {(paymentMethod || paymentStatus || startDate || endDate) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setPaymentMethod('');
                  setPaymentStatus('');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      {isLoading ? (
        <LoadingPage message="Loading sales..." />
      ) : (
        <DataTable<Sale>
          columns={columns}
          data={sales as Sale[]}
          onRowClick={(sale) => navigate(`/sales/${sale.id}`)}
          emptyMessage="No sales found. Create your first sale!"
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      )}
    </div>
  );
};

export default Sales;
