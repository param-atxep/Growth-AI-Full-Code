import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { creditsAPI, paymentAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DataTable,
  LoadingPage,
} from '../../components/ui';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  Coins,
  Sparkles,
  CreditCard,
  TrendingUp,
  Check,
  Zap,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
}

const CREDIT_PLANS = [
  {
    id: 'plan_basic',
    name: 'Starter',
    credits: 2000,
    price: 499,
    popular: false,
    features: ['2,000 AI Credits', '500 AI queries', 'Basic analytics'],
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    credits: 10000,
    price: 2999,
    popular: true,
    features: ['10,000 AI Credits', '2,500 AI queries', 'Priority support', 'Advanced insights'],
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    credits: 50000,
    price: 9999,
    popular: false,
    features: ['50,000 AI Credits', '12,500 AI queries', 'Dedicated support', 'Custom reports', 'API access'],
  },
];

const Credits = () => {
  const { currentStore } = useAuthStore();
  const queryClient = useQueryClient();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['credits-balance'],
    queryFn: () => creditsAPI.getBalance(),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['credits-history'],
    queryFn: () => creditsAPI.getHistory({ limit: 20 }),
  });

  const { data: usageData } = useQuery({
    queryKey: ['credits-usage'],
    queryFn: () => creditsAPI.getUsageStats(),
  });

  // Create checkout session mutation
  const createCheckoutMutation = useMutation({
    mutationFn: (planId: string) => paymentAPI.createCheckout({ planId }),
  });

  // Verify payment mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: (sessionId: string) => paymentAPI.verifyPayment({ sessionId }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      queryClient.invalidateQueries({ queryKey: ['credits-history'] });
      if (response.data?.data?.success) {
        toast.success(`Payment successful! ${response.data?.data?.credits} credits added to your account.`);
      }
    },
  });

  // Handle successful payment return from Stripe
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');

    if (success === 'true' && sessionId) {
      // Verify the payment
      verifyPaymentMutation.mutate(sessionId);
      // Clean up URL
      setSearchParams({});
    } else if (canceled === 'true') {
      toast.error('Payment was canceled');
      setSearchParams({});
    }
  }, [searchParams]);

  const credits = balanceData?.data?.data?.balance ?? currentStore?.credits ?? 0;
  const history = historyData?.data?.data?.transactions || [];
  const usage = usageData?.data?.data;

  const handlePurchase = async (plan: typeof CREDIT_PLANS[0]) => {
    setProcessingPlan(plan.id);

    try {
      // Create Stripe Checkout session
      const response = await createCheckoutMutation.mutateAsync(plan.id);
      const checkoutData = response.data?.data;

      if (!checkoutData?.url) {
        toast.error('Failed to create checkout session');
        setProcessingPlan(null);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = checkoutData.url;
    } catch {
      toast.error('Failed to initiate payment. Please try again.');
      setProcessingPlan(null);
    }
  };

  const historyColumns: { key: string; header: string; render?: (tx: CreditTransaction) => React.ReactNode }[] = [
    {
      key: 'type',
      header: 'Type',
      render: (tx: CreditTransaction) => (
        <Badge variant={tx.type === 'CREDIT' ? 'success' : 'secondary'}>
          {tx.type}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (tx: CreditTransaction) => (
        <span className={tx.type === 'CREDIT' ? 'text-green-500' : 'text-red-500'}>
          {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (tx: CreditTransaction) => formatDateTime(tx.createdAt),
    },
  ];

  if (balanceLoading) {
    return <LoadingPage message="Loading credits..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="w-6 h-6 text-primary" />
          AI Credits
        </h1>
        <p className="text-muted-foreground">
          Manage your AI credits and purchase more
        </p>
      </div>

      {/* Current Balance */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-primary-foreground/80">Current Balance</p>
              <p className="text-4xl font-bold">{credits.toLocaleString()} credits</p>
              <p className="text-sm text-primary-foreground/70 mt-1">
                ≈ {Math.floor(credits / 4)} AI operations remaining
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-12 h-12 text-primary-foreground/30" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      {usage && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credits Used (30d)</p>
                  <p className="text-2xl font-bold">{usage.usedThisMonth || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Zap className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI Queries</p>
                  <p className="text-2xl font-bold">{usage.totalQueries || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Usage/Day</p>
                  <p className="text-2xl font-bold">{usage.avgPerDay || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Credit Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Buy Credits</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {CREDIT_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={plan.popular ? 'border-primary shadow-lg relative' : ''}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  <Coins className="w-5 h-5 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold">{formatCurrency(plan.price)}</p>
                  <p className="text-muted-foreground">
                    {plan.credits.toLocaleString()} credits
                  </p>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handlePurchase(plan)}
                  disabled={processingPlan !== null}
                >
                  {processingPlan === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Purchase
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading history...
            </div>
          ) : (
            <DataTable<CreditTransaction>
              columns={historyColumns}
              data={history as CreditTransaction[]}
              emptyMessage="No transactions yet"
            />
          )}
        </CardContent>
      </Card>

      {/* Credit Info */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-3">How Credits Work</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
              Each AI operation (chat, insights, predictions) costs 4 credits
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
              New users receive 100 free credits to get started
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
              Credits never expire and are shared across all your stores
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
              Larger credit packs offer better value per credit
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Credits;
