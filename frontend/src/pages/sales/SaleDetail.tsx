import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saleAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Select,
  LoadingPage,
} from '../../components/ui';
import { formatCurrency, formatDateTime, PAYMENT_METHODS, PAYMENT_STATUSES } from '../../lib/utils';
import { ArrowLeft, Receipt, User, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const SaleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: saleData, isLoading } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => saleAPI.getById(id!),
    enabled: !!id,
  });

  const updatePaymentMutation = useMutation({
    mutationFn: (paymentStatus: string) =>
      saleAPI.updatePaymentStatus(id!, { paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', id] });
      toast.success('Payment status updated');
    },
  });

  if (isLoading) {
    return <LoadingPage message="Loading sale..." />;
  }

  const sale = saleData?.data?.data;

  if (!sale) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Sale not found</p>
        <Button className="mt-4" onClick={() => navigate('/sales')}>
          Back to Sales
        </Button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6" />
              Sale #{sale.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-muted-foreground">{formatDateTime(sale.invoiceDate)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Receipt Card */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-6 print:p-0">
          {/* Store & Customer Info */}
          <div className="flex justify-between mb-6 pb-6 border-b print:border-dashed">
            <div>
              <h3 className="font-bold text-lg">Receipt</h3>
              <p className="text-sm text-muted-foreground">#{sale.id.slice(-8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">{formatDateTime(sale.invoiceDate)}</p>
              <Badge
                variant={
                  sale.paymentStatus === 'PAID'
                    ? 'success'
                    : sale.paymentStatus === 'PENDING'
                    ? 'warning'
                    : 'secondary'
                }
              >
                {sale.paymentStatus}
              </Badge>
            </div>
          </div>

          {/* Customer */}
          {sale.customer && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{sale.customer.name}</p>
                {sale.customer.phone && (
                  <p className="text-sm text-muted-foreground">{sale.customer.phone}</p>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="space-y-3 mb-6">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Items
            </h4>
            {sale.items?.map((item: {
              id: string;
              productName: string;
              quantity: number;
              unitPrice: number;
              discount: number;
              totalPrice: number;
            }) => (
              <div key={item.id} className="flex justify-between py-2 border-b border-dashed">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                    {item.discount > 0 && ` (-${formatCurrency(item.discount)})`}
                  </p>
                </div>
                <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-500">
                <span>Discount</span>
                <span>-{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            {sale.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(sale.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="text-green-500">{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium">
                {PAYMENT_METHODS.find((m) => m.value === sale.paymentMethod)?.label ||
                  sale.paymentMethod}
              </p>
            </div>
            <div className="print:hidden">
              <Select
                value={sale.paymentStatus}
                onChange={(e) => updatePaymentMutation.mutate(e.target.value)}
                options={PAYMENT_STATUSES}
                className="w-32"
              />
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-1">{sale.notes}</p>
            </div>
          )}

          {/* Print Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground print:block hidden">
            <p>Thank you for your purchase!</p>
            <p>Powered by GrowthPilot AI</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SaleDetail;
