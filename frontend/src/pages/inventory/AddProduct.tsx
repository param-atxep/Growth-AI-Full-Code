import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productAPI, categoryAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Textarea,
} from '../../components/ui';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const AddProduct = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    costPrice: '',
    sellingPrice: '',
    currentStock: '',
    minStockLevel: '10',
    unit: 'pcs',
    barcode: '',
    imageUrl: '',
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryAPI.getAll(),
  });

  const categories = categoriesData?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof productAPI.create>[0]) =>
      productAPI.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-sale'] });
      const product = response?.data?.data;
      if (product?.restocked) {
        toast.success(`Stock updated! Added ${product.addedQuantity} units to "${product.name}"`);
      } else {
        toast.success('Product created successfully!');
      }
      navigate('/inventory');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to add product');
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.costPrice || !formData.sellingPrice || !formData.currentStock) {
      toast.error('Please fill in all required fields');
      return;
    }

    createMutation.mutate({
      name: formData.name,
      sku: formData.sku || undefined,
      description: formData.description || undefined,
      categoryId: formData.categoryId || undefined,
      costPrice: parseFloat(formData.costPrice),
      sellingPrice: parseFloat(formData.sellingPrice),
      stockQuantity: parseInt(formData.currentStock),
      lowStockThreshold: parseInt(formData.minStockLevel) || 10,
      unit: formData.unit || 'pcs',
      barcode: formData.barcode || undefined,
      imageUrl: formData.imageUrl || undefined,
    });
  };

  const unitOptions = [
    { value: 'pcs', label: 'Pieces' },
    { value: 'kg', label: 'Kilograms' },
    { value: 'g', label: 'Grams' },
    { value: 'l', label: 'Liters' },
    { value: 'ml', label: 'Milliliters' },
    { value: 'm', label: 'Meters' },
    { value: 'box', label: 'Box' },
    { value: 'pack', label: 'Pack' },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add New Product</h1>
          <p className="text-muted-foreground">Create a new product in your inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Product Name *"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter product name"
              />
              <Input
                label="SKU"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Stock keeping unit"
              />
            </div>

            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Product description"
              rows={3}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Select category' },
                  ...categories.map((cat: { id: string; name: string }) => ({
                    value: cat.id,
                    label: cat.name,
                  })),
                ]}
              />
              <Input
                label="Barcode"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="Product barcode"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Cost Price *"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.costPrice}
                onChange={handleChange}
                placeholder="0.00"
              />
              <Input
                label="Selling Price *"
                name="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.sellingPrice}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            {formData.costPrice && formData.sellingPrice && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Profit Margin:{' '}
                  <span className="font-medium text-green-500">
                    {(
                      ((parseFloat(formData.sellingPrice) - parseFloat(formData.costPrice)) /
                        parseFloat(formData.costPrice)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Stock Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Current Stock *"
                name="currentStock"
                type="number"
                min="0"
                value={formData.currentStock}
                onChange={handleChange}
                placeholder="0"
              />
              <Input
                label="Min Stock Level"
                name="minStockLevel"
                type="number"
                min="0"
                value={formData.minStockLevel}
                onChange={handleChange}
                placeholder="10"
              />
              <Select
                label="Unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                options={unitOptions}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Media</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              label="Image URL"
              name="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Create Product
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddProduct;
