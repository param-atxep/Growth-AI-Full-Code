import { useQuery } from '@tanstack/react-query';
import { aiAPI, creditsAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  LoadingPage,
} from '../../components/ui';
import { formatCurrency } from '../../lib/utils';
import {
  Sparkles,
  TrendingUp,
  Package,
  Megaphone,
  Lightbulb,
  Coins,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const AIInsights = () => {
  const { currentStore, updateCredits } = useAuthStore();

  const { data: creditsData } = useQuery({
    queryKey: ['credits-balance'],
    queryFn: () => creditsAPI.getBalance(),
  });

  const {
    data: predictionsData,
    isLoading: predictionsLoading,
    refetch: refetchPredictions,
    isFetching: predictionsFetching,
  } = useQuery({
    queryKey: ['ai-predictions'],
    queryFn: async () => {
      const response = await aiAPI.getSalesPrediction({ days: 7 });
      if (response.data?.data?.remainingCredits !== undefined) {
        updateCredits(response.data.data.remainingCredits);
      }
      return response;
    },
    enabled: false,
  });

  const {
    data: restockData,
    isLoading: restockLoading,
    refetch: refetchRestock,
    isFetching: restockFetching,
  } = useQuery({
    queryKey: ['ai-restock'],
    queryFn: async () => {
      const response = await aiAPI.getRestockRecommendations();
      if (response.data?.data?.remainingCredits !== undefined) {
        updateCredits(response.data.data.remainingCredits);
      }
      return response;
    },
    enabled: false,
  });

  const {
    data: marketingData,
    isLoading: marketingLoading,
    refetch: refetchMarketing,
    isFetching: marketingFetching,
  } = useQuery({
    queryKey: ['ai-marketing'],
    queryFn: async () => {
      const response = await aiAPI.getMarketingSuggestions();
      if (response.data?.data?.remainingCredits !== undefined) {
        updateCredits(response.data.data.remainingCredits);
      }
      return response;
    },
    enabled: false,
  });

  const {
    data: growthData,
    isLoading: growthLoading,
    refetch: refetchGrowth,
    isFetching: growthFetching,
  } = useQuery({
    queryKey: ['ai-growth'],
    queryFn: async () => {
      const response = await aiAPI.getGrowthInsights();
      if (response.data?.data?.remainingCredits !== undefined) {
        updateCredits(response.data.data.remainingCredits);
      }
      return response;
    },
    enabled: false,
  });

  const credits = creditsData?.data?.data?.credits ?? currentStore?.credits ?? 0;
  const predictions = predictionsData?.data?.data?.response;
  const restock = restockData?.data?.data?.response;
  const marketing = marketingData?.data?.data?.response;
  const growth = growthData?.data?.data?.response;

  const insightCards = [
    {
      title: 'Sales Predictions',
      description: 'AI-powered 7-day sales forecast based on historical data',
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      data: predictions,
      loading: predictionsLoading || predictionsFetching,
      refetch: refetchPredictions,
    },
    {
      title: 'Restock Recommendations',
      description: 'Smart inventory suggestions to prevent stockouts',
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      data: restock,
      loading: restockLoading || restockFetching,
      refetch: refetchRestock,
    },
    {
      title: 'Marketing Suggestions',
      description: 'Personalized marketing ideas to boost sales',
      icon: Megaphone,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      data: marketing,
      loading: marketingLoading || marketingFetching,
      refetch: refetchMarketing,
    },
    {
      title: 'Growth Insights',
      description: 'Strategic recommendations for business growth',
      icon: Lightbulb,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      data: growth,
      loading: growthLoading || growthFetching,
      refetch: refetchGrowth,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Insights
          </h1>
          <p className="text-muted-foreground">
            Intelligent recommendations powered by GPT-4
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
            <Coins className="w-5 h-5 text-primary" />
            <span className="font-semibold">{credits} credits</span>
          </div>
          <Link to="/credits">
            <Button variant="outline" size="sm">
              Buy Credits
            </Button>
          </Link>
        </div>
      </div>

      {/* Credit Notice */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Each AI insight costs 4 credits</p>
              <p className="text-sm text-muted-foreground">
                Get accurate, personalized recommendations for your business
              </p>
            </div>
          </div>
          <Link to="/ai/chat">
            <Button>
              AI Chat <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Insight Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {insightCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              </div>
              <Badge variant="outline">4 credits</Badge>
            </CardHeader>
            <CardContent>
              {card.data ? (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="whitespace-pre-wrap text-sm">{card.data}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Click to generate AI-powered insights
                  </p>
                  <Button
                    onClick={() => card.refetch()}
                    disabled={card.loading || credits < 4}
                    isLoading={card.loading}
                  >
                    {card.loading ? (
                      'Generating...'
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Generate Insight
                      </>
                    )}
                  </Button>
                  {credits < 4 && (
                    <p className="text-sm text-destructive mt-2">
                      Insufficient credits
                    </p>
                  )}
                </div>
              )}
              {card.data && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => card.refetch()}
                    disabled={card.loading || credits < 4}
                    isLoading={card.loading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AIInsights;
