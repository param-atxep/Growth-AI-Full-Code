import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saleAPI, productAPI, customerAPI } from '../../services/api';
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
} from '../../components/ui';
import { formatCurrency, PAYMENT_METHODS } from '../../lib/utils';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  User,
  ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  maxStock: number;
}

const NewSale = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState('');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Load all products initially, filter by search term
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-sale'],
    queryFn: () => productAPI.getAll({ limit: 500 }),
  });

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerAPI.getAll({ limit: 500 }),
  });

  const allProducts = productsData?.data?.data?.products || productsData?.data?.data || [];
  
  // Filter products based on search term
  const products = searchTerm
    ? allProducts.filter((p: { name: string; sku?: string; barcode?: string }) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allProducts;

  const customers = customersData?.data?.data?.customers || customersData?.data?.data || [];

  const createSaleMutation = useMutation({
    mutationFn: (data: Parameters<typeof saleAPI.create>[0]) => saleAPI.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-sale'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-sales-chart'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-top-products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-low-stock'] });
      toast.success('Sale completed!');
      navigate(`/sales/${response.data.data.id}`);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to create sale');
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: Parameters<typeof customerAPI.create>[0]) =>
      customerAPI.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setCustomerId(response.data.data.id);
      toast.success('Customer added');
      setCustomerDialogOpen(false);
      setNewCustomer({ name: '', phone: '', email: '' });
    },
  });

  const addToCart = (product: {
    id: string;
    name: string;
    sellingPrice: number;
    stockQuantity: number;
  }) => {
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.stockQuantity) {
        toast.error('Not enough stock');
        return;
      }
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.sellingPrice,
          discount: 0,
          maxStock: product.stockQuantity,
        },
      ]);
    }
    setSearchTerm('');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.productId !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.maxStock) {
            toast.error('Not enough stock');
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const updateItemDiscount = (productId: string, discountValue: number) => {
    setCart(
      cart.map((item) =>
        item.productId === productId ? { ...item, discount: discountValue } : item
      )
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice - item.discount,
    0
  );
  const totalDiscount = discount + cart.reduce((sum, item) => sum + item.discount, 0);
  const taxAmount = (subtotal - discount) * (tax / 100);
  const total = subtotal - discount + taxAmount;

  const handleSubmit = () => {
    if (cart.length === 0) {
      toast.error('Add items to cart');
      return;
    }

    createSaleMutation.mutate({
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      customerId: customerId || undefined,
      paymentMethod,
      discountAmount: discount,
      discountPercent: 0,
      paidAmount: total,
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Sale</h1>
          <p className="text-muted-foreground">Create a new sales transaction</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Search & Cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Input
                  placeholder="Search products by name, SKU, or barcode..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  icon={<Search className="w-4 h-4" />}
                />
                {showProductDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                    {productsLoading ? (
                      <div className="p-4 text-center text-muted-foreground">Loading products...</div>
                    ) : products.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        {searchTerm ? 'No products found' : 'No products available'}
                      </div>
                    ) : (
                      <>
                        <div className="sticky top-0 bg-muted px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                          {products.length} product{products.length !== 1 ? 's' : ''} available
                        </div>
                        {products.map((product: {
                          id: string;
                          name: string;
                          sellingPrice: number;
                          stockQuantity: number;
                          sku?: string;
                        }) => (
                          <button
                            key={product.id}
                            onClick={() => {
                              addToCart(product);
                              setShowProductDropdown(false);
                            }}
                            className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors"
                            disabled={product.stockQuantity === 0}
                          >
                            <div className="text-left">
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {product.sku && `SKU: ${product.sku} • `}
                                Stock: {product.stockQuantity}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">
                                {formatCurrency(product.sellingPrice)}
                              </span>
                              {product.stockQuantity === 0 && (
                                <Badge variant="destructive" className="ml-2">Out of Stock</Badge>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
                {/* Click outside to close dropdown */}
                {showProductDropdown && (
                  <div
                    className="fixed inset-0 z-0"
                    onClick={() => setShowProductDropdown(false)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cart Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart ({cart.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Search and add products to start
                </p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="p-4 bg-muted/50 rounded-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Stock: {item.maxStock}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                        {/* Quantity */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.productId, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <input
                              type="number"
                              min="1"
                              max={item.maxStock}
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1;
                                if (newQty > item.maxStock) {
                                  toast.error('Not enough stock');
                                  return;
                                }
                                if (newQty < 1) return;
                                setCart(
                                  cart.map((cartItem) =>
                                    cartItem.productId === item.productId
                                      ? { ...cartItem, quantity: newQty }
                                      : cartItem
                                  )
                                );
                              }}
                              className="w-14 h-8 text-center font-medium border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.productId, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Unit Price */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              setCart(
                                cart.map((cartItem) =>
                                  cartItem.productId === item.productId
                                    ? { ...cartItem, unitPrice: newPrice }
                                    : cartItem
                                )
                              );
                            }}
                            className="w-full h-8 px-2 text-center font-medium border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        {/* Item Discount */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Item Disc (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => {
                              const discountVal = parseFloat(e.target.value) || 0;
                              updateItemDiscount(item.productId, discountVal);
                            }}
                            className="w-full h-8 px-2 text-center font-medium border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="text-right">
                          <label className="text-xs text-muted-foreground mb-1 block">Subtotal</label>
                          <p className="h-8 flex items-center justify-end font-semibold text-green-600">
                            {formatCurrency(item.quantity * item.unitPrice - item.discount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomerDialogOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <p className="text-sm text-muted-foreground">Loading customers...</p>
              ) : (
                <Select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  options={[
                    { value: '', label: 'Walk-in Customer' },
                    ...customers.map((c: { id: string; name: string; phone?: string }) => ({
                      value: c.id,
                      label: `${c.name}${c.phone ? ` - ${c.phone}` : ''}`,
                    })),
                  ]}
                />
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={PAYMENT_METHODS}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Order Discount (₹)"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
                <Input
                  label="Tax (%)"
                  type="number"
                  min="0"
                  max="100"
                  value={tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                />
              </div>

              <Input
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order notes..."
              />
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-500">
                  <span>Discount</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({tax}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-green-500">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={cart.length === 0}
            isLoading={createSaleMutation.isPending}
          >
            Complete Sale
          </Button>
        </div>
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={customerDialogOpen} onClose={() => setCustomerDialogOpen(false)}>
        <DialogContent onClose={() => setCustomerDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              label="Name *"
              value={newCustomer.name}
              onChange={(e) =>
                setNewCustomer({ ...newCustomer, name: e.target.value })
              }
              placeholder="Customer name"
            />
            <Input
              label="Phone"
              value={newCustomer.phone}
              onChange={(e) =>
                setNewCustomer({ ...newCustomer, phone: e.target.value })
              }
              placeholder="+91 9876543210"
            />
            <Input
              label="Email"
              type="email"
              value={newCustomer.email}
              onChange={(e) =>
                setNewCustomer({ ...newCustomer, email: e.target.value })
              }
              placeholder="customer@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newCustomer.name) {
                  toast.error('Name is required');
                  return;
                }
                createCustomerMutation.mutate(newCustomer);
              }}
              isLoading={createCustomerMutation.isPending}
            >
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewSale;
