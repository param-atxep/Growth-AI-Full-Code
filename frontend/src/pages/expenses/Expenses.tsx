import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseAPI } from '../../services/api';
import {
  Card,
  CardContent,
  Button,
  Input,
  Select,
  Badge,
  DataTable,
  LoadingPage,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
} from '../../components/ui';
import { formatCurrency, formatDate, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../lib/utils';
import { Plus, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Expense {
  id: string;
  description: string;
  vendor?: string;
  category: string;
  amount: number;
  paymentMethod: string;
  date: string;
}

const Expenses = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Other',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    vendor: '',
    notes: '',
  });

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', { page, category, startDate, endDate }],
    queryFn: () =>
      expenseAPI.getAll({
        page,
        limit: 10,
        category: category || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['expenses-summary', { startDate, endDate }],
    queryFn: () =>
      expenseAPI.getSummary({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const expenses = expensesData?.data?.data?.expenses || [];
  const pagination = expensesData?.data?.data?.pagination;
  const summary = summaryData?.data?.data;

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof expenseAPI.create>[0]) =>
      expenseAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Expense added');
      setDialogOpen(false);
      setFormData({
        description: '',
        amount: '',
        category: 'Other',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
        vendor: '',
        notes: '',
      });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to add expense');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      toast.success('Expense deleted');
    },
  });

  const handleSubmit = () => {
    if (!formData.description || !formData.amount) {
      toast.error('Please fill required fields');
      return;
    }
    createMutation.mutate({
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      vendor: formData.vendor || undefined,
      notes: formData.notes || undefined,
    });
  };

  const columns: { key: string; header: string; render: (expense: Expense) => React.ReactNode }[] = [
    {
      key: 'description',
      header: 'Description',
      render: (expense: Expense) => (
        <div>
          <p className="font-medium">{expense.description}</p>
          {expense.vendor && (
            <p className="text-sm text-muted-foreground">{expense.vendor}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (expense: Expense) => (
        <Badge variant="outline">{expense.category}</Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (expense: Expense) => (
        <span className="font-semibold text-red-500">
          -{formatCurrency(expense.amount)}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Payment',
      render: (expense: Expense) => (
        <span className="text-muted-foreground">
          {PAYMENT_METHODS.find((m) => m.value === expense.paymentMethod)?.label ||
            expense.paymentMethod}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (expense: Expense) => formatDate(expense.date),
    },
    {
      key: 'actions',
      header: '',
      render: (expense: Expense) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (confirm('Delete this expense?')) {
              deleteMutation.mutate(expense.id);
            }
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track your business expenses</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(summary.total || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.thisMonth || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Average/Day</p>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.avgPerDay || 0)}
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
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Categories' },
                ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
              className="sm:w-48"
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
            {(category || startDate || endDate) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCategory('');
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

      {/* Expenses Table */}
      {isLoading ? (
        <LoadingPage message="Loading expenses..." />
      ) : (
        <DataTable<Expense>
          columns={columns}
          data={expenses as Expense[]}
          emptyMessage="No expenses found. Add your first expense!"
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

      {/* Add Expense Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              label="Description *"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="What was the expense for?"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount *"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
              />
              <Input
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
              <Select
                label="Payment Method"
                value={formData.paymentMethod}
                onChange={(e) =>
                  setFormData({ ...formData, paymentMethod: e.target.value })
                }
                options={PAYMENT_METHODS}
              />
            </div>
            <Input
              label="Vendor"
              value={formData.vendor}
              onChange={(e) =>
                setFormData({ ...formData, vendor: e.target.value })
              }
              placeholder="Vendor name"
            />
            <Textarea
              label="Notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={createMutation.isPending}>
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
