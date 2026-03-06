import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productAPI, categoryAPI } from '../../services/api';
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
import { formatCurrency, formatDate } from '../../lib/utils';
import { Plus, Search, Package, AlertTriangle } from 'lucide-react';

const Inventory = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');
  const [lowStock, setLowStock] = useState(searchParams.get('lowStock') === 'true');
  const [page, setPage] = useState(1);

  interface Product {
    id: string;
    name: string;
    sku?: string;
    imageUrl?: string;
    category?: { name: string };
    stockQuantity: number;
    lowStockThreshold: number;
    costPrice: number;
    sellingPrice: number;
    isActive: boolean;
    updatedAt: string;
  }

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', { page, search, categoryId, lowStock }],
    queryFn: () =>
      productAPI.getAll({
        page,
        limit: 10,
        search: search || undefined,
        categoryId: categoryId || undefined,
        lowStock: lowStock || undefined,
      }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryAPI.getAll(),
  });

  const products = productsData?.data?.data?.products || [];
  const pagination = productsData?.data?.data?.pagination;
  const categories = categoriesData?.data?.data || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    if (lowStock) params.set('lowStock', 'true');
    setSearchParams(params);
  };

  const columns: { key: string; header: string; render: (product: Product) => React.ReactNode }[] = [
    {
      key: 'name',
      header: 'Product',
      render: (product: Product) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <Package className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium">{product.name}</p>
            {product.sku && <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'category.name',
      header: 'Category',
      render: (product: Product) => (
        <span className="text-muted-foreground">{product.category?.name || '-'}</span>
      ),
    },
    {
      key: 'stockQuantity',
      header: 'Stock',
      render: (product: Product) => {
        const isLow = product.stockQuantity <= product.lowStockThreshold;
        return (
          <div className="flex items-center gap-2">
            <span className={isLow ? 'text-red-500 font-medium' : ''}>{product.stockQuantity}</span>
            {isLow && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
          </div>
        );
      },
    },
    {
      key: 'costPrice',
      header: 'Cost',
      render: (product: Product) => formatCurrency(product.costPrice),
    },
    {
      key: 'sellingPrice',
      header: 'Selling',
      render: (product: Product) => formatCurrency(product.sellingPrice),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (product: Product) => (
        <Badge variant={product.isActive ? 'success' : 'secondary'}>
          {product.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (product: Product) => formatDate(product.updatedAt),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Manage your products and stock levels
          </p>
        </div>
        <Button onClick={() => navigate('/inventory/add')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((cat: { id: string; name: string }) => ({
                  value: cat.id,
                  label: cat.name,
                })),
              ]}
              className="w-full sm:w-48"
            />
            <Button
              type="button"
              variant={lowStock ? 'default' : 'outline'}
              onClick={() => {
                setLowStock(!lowStock);
                setPage(1);
              }}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Low Stock
            </Button>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Products Table */}
      {isLoading ? (
        <LoadingPage message="Loading products..." />
      ) : (
        <DataTable<Product>
          columns={columns}
          data={products as Product[]}
          onRowClick={(product) => navigate(`/inventory/${product.id}`)}
          emptyMessage="No products found. Add your first product!"
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

export default Inventory;
