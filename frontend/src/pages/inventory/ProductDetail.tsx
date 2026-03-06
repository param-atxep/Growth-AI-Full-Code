import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  LoadingPage,
} from '../../components/ui';
import { formatCurrency, formatDate, formatNumber } from '../../lib/utils';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState({
    type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: '',
    reason: '',
  });

  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productAPI.getById(id!),
    enabled: !!id,
  });

  const { data: stockHistoryData } = useQuery({
    queryKey: ['product-stock-history', id],
    queryFn: () => productAPI.getStockHistory(id!, { limit: 10 }),
    enabled: !!id,
  });

  const adjustStockMutation = useMutation({
    mutationFn: (data: Parameters<typeof productAPI.adjustStock>[1]) =>
      productAPI.adjustStock(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['product-stock-history', id] });
      toast.success('Stock updated successfully');
      setStockDialogOpen(false);
      setStockAdjustment({ type: 'IN', quantity: '', reason: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => productAPI.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
      navigate('/inventory');
    },
  });

  if (isLoading) {
    return <LoadingPage message="Loading product..." />;
  }

  const product = productData?.data?.data;
  const stockHistory = stockHistoryData?.data?.data?.movements || [];

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Product not found</p>
        <Button className="mt-4" onClick={() => navigate('/inventory')}>
          Back to Inventory
        </Button>
      </div>
    );
  }

  const isLowStock = product.stockQuantity <= product.lowStockThreshold;
  const profitMargin = ((product.sellingPrice - product.costPrice) / product.costPrice) * 100;

  const handleStockSubmit = () => {
    if (!stockAdjustment.quantity) {
      toast.error('Please enter quantity');
      return;
    }
    adjustStockMutation.mutate({
      type: stockAdjustment.type,
      quantity: parseInt(stockAdjustment.quantity),
      reason: stockAdjustment.reason || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            {product.sku && (
              <p className="text-muted-foreground">SKU: {product.sku}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStockDialogOpen(true)}>
            <Package className="w-4 h-4 mr-2" />
            Adjust Stock
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/inventory/${id}/edit`)}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Current Stock</p>
              {isLowStock && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
            </div>
            <p className={`text-2xl font-bold mt-1 ${isLowStock ? 'text-red-500' : ''}`}>
              {formatNumber(product.stockQuantity)} {product.unit}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cost Price</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(product.costPrice)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Selling Price</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(product.sellingPrice)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Profit Margin</p>
            <p className={`text-2xl font-bold mt-1 ${profitMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {profitMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium">{product.category?.name || 'Uncategorized'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={product.isActive ? 'success' : 'secondary'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Min Stock Level</p>
                <p className="font-medium">{product.minStockLevel} {product.unit}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Barcode</p>
                <p className="font-medium">{product.barcode || '-'}</p>
              </div>
            </div>
            {product.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1">{product.description}</p>
              </div>
            )}
            <div className="pt-4 border-t">
              <div className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
                <p>Created: {formatDate(product.createdAt)}</p>
                <p>Last updated: {formatDate(product.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock History */}
        <Card>
          <CardHeader>
            <CardTitle>Stock History</CardTitle>
          </CardHeader>
          <CardContent>
            {stockHistory.length > 0 ? (
              <div className="space-y-3">
                {stockHistory.map((movement: {
                  id: string;
                  type: string;
                  quantity: number;
                  reason?: string;
                  createdAt: string;
                }) => (
                  <div
                    key={movement.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <div className={`p-1.5 rounded-full ${
                      movement.type === 'IN' ? 'bg-green-500/10' :
                      movement.type === 'OUT' ? 'bg-red-500/10' : 'bg-blue-500/10'
                    }`}>
                      {movement.type === 'IN' ? (
                        <Plus className="w-3 h-3 text-green-500" />
                      ) : movement.type === 'OUT' ? (
                        <Minus className="w-3 h-3 text-red-500" />
                      ) : (
                        <TrendingUp className="w-3 h-3 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : '±'}
                        {movement.quantity} {product.unit}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {movement.reason || movement.type}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(movement.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground text-sm">
                No stock movements yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockDialogOpen} onClose={() => setStockDialogOpen(false)}>
        <DialogContent onClose={() => setStockDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              label="Adjustment Type"
              value={stockAdjustment.type}
              onChange={(e) =>
                setStockAdjustment({
                  ...stockAdjustment,
                  type: e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT',
                })
              }
              options={[
                { value: 'IN', label: 'Stock In (Add)' },
                { value: 'OUT', label: 'Stock Out (Remove)' },
                { value: 'ADJUSTMENT', label: 'Adjustment (Set)' },
              ]}
            />
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={stockAdjustment.quantity}
              onChange={(e) =>
                setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })
              }
              placeholder="Enter quantity"
            />
            <Input
              label="Reason (optional)"
              value={stockAdjustment.reason}
              onChange={(e) =>
                setStockAdjustment({ ...stockAdjustment, reason: e.target.value })
              }
              placeholder="e.g., Received shipment, Damaged goods"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStockSubmit}
              isLoading={adjustStockMutation.isPending}
            >
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogContent onClose={() => setDeleteDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-muted-foreground">
            Are you sure you want to delete <strong>{product.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductDetail;
