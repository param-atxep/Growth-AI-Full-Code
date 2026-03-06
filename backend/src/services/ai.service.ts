import OpenAI from 'openai';
import { config } from '../config/index.js';
import prisma from '../config/database.js';
import { AIFeature } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { deductCredits, logAIUsage } from '../middlewares/credits.js';

// Using Groq API (OpenAI-compatible)
const groq = new OpenAI({
  apiKey: config.groq.apiKey,
  baseURL: 'https://api.groq.com/openai/v1',
});

export interface AIResponse {
  content: string;
  tokensUsed: number;
  latencyMs: number;
}

/**
 * Get store context for AI prompts
 */
export const getStoreContext = async (storeId: string): Promise<string> => {
  const [store, products, recentSales, expenses] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        name: true,
        businessType: true,
        city: true,
        state: true,
      },
    }),
    prisma.product.findMany({
      where: { storeId, isActive: true },
      select: {
        name: true,
        categoryId: true,
        sellingPrice: true,
        costPrice: true,
        stockQuantity: true,
        lowStockThreshold: true,
        totalSold: true,
      },
      take: 100,
    }),
    prisma.sale.findMany({
      where: { storeId },
      select: {
        totalAmount: true,
        profit: true,
        invoiceDate: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            totalPrice: true,
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 50,
    }),
    prisma.expense.aggregate({
      where: {
        storeId,
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _sum: { amount: true },
    }),
  ]);

  // Calculate metrics
  const totalRevenue = recentSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const totalProfit = recentSales.reduce((sum, s) => sum + Number(s.profit), 0);
  const lowStockProducts = products.filter(p => p.stockQuantity <= p.lowStockThreshold);
  const topProducts = [...products].sort((a, b) => b.totalSold - a.totalSold).slice(0, 10);

  return `
Store Information:
- Name: ${store?.name}
- Business Type: ${store?.businessType || 'Retail'}
- Location: ${store?.city}, ${store?.state}

Inventory Summary:
- Total Products: ${products.length}
- Low Stock Items: ${lowStockProducts.length}
- Products: ${products.map(p => `${p.name} (Stock: ${p.stockQuantity}, Sold: ${p.totalSold})`).slice(0, 20).join(', ')}

Recent Sales (Last 50):
- Total Revenue: ₹${totalRevenue.toFixed(2)}
- Total Profit: ₹${totalProfit.toFixed(2)}
- Sales Count: ${recentSales.length}

Top Selling Products:
${topProducts.map(p => `- ${p.name}: ${p.totalSold} units sold`).join('\n')}

Low Stock Alerts:
${lowStockProducts.map(p => `- ${p.name}: ${p.stockQuantity} units remaining (threshold: ${p.lowStockThreshold})`).join('\n')}

Monthly Expenses: ₹${Number(expenses._sum.amount || 0).toFixed(2)}
  `.trim();
};

/**
 * AI Chat Assistant
 */
export const aiChatAssistant = async (
  storeId: string,
  message: string,
  includeContext: boolean = true
): Promise<AIResponse> => {
  const startTime = Date.now();
  
  try {
    let systemPrompt = `You are GrowthPilot AI, an intelligent business assistant for retail merchants in India. 
You help shop owners understand their business data, make decisions, and grow their business.
Always provide actionable, specific advice based on the data provided.
Use Indian Rupees (₹) for all monetary values.
Be concise but helpful. Format responses with clear sections if needed.`;

    if (includeContext) {
      const context = await getStoreContext(storeId);
      systemPrompt += `\n\nStore Context:\n${context}`;
    }

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || 'Unable to generate response';
    const tokensUsed = response.usage?.total_tokens || 0;

    // Deduct credits after successful response
    await deductCredits(storeId, 'CHAT_ASSISTANT', `AI Chat: ${message.substring(0, 50)}...`);

    // Log usage
    await logAIUsage(
      storeId,
      'CHAT_ASSISTANT',
      config.credits.costs.chat,
      message,
      content,
      tokensUsed,
      latencyMs,
      true
    );

    return { content, tokensUsed, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log the full error for debugging
    logger.error('AI Chat Error:', { error: errorMessage, storeId });
    
    await logAIUsage(
      storeId,
      'CHAT_ASSISTANT',
      0,
      message,
      undefined,
      undefined,
      latencyMs,
      false,
      errorMessage
    );

    // Provide user-friendly error messages for common errors
    if (errorMessage.includes('exceeded your current quota') || errorMessage.includes('429')) {
      const quotaError = new Error('AI service is temporarily unavailable due to high demand. Please try again later.');
      (quotaError as any).code = 'AI_QUOTA_EXCEEDED';
      throw quotaError;
    }
    if (errorMessage.includes('401') || errorMessage.includes('authentication') || errorMessage.includes('Invalid API Key')) {
      const authError = new Error('AI service configuration error. Please contact support.');
      (authError as any).code = 'AI_CONFIG_ERROR';
      throw authError;
    }

    throw error;
  }
};

/**
 * AI Sales Prediction
 */
export const aiSalesPrediction = async (
  storeId: string,
  days: number = 30
): Promise<AIResponse> => {
  const startTime = Date.now();

  try {
    const context = await getStoreContext(storeId);

    // Get historical sales data
    const historicalSales = await prisma.sale.findMany({
      where: {
        storeId,
        invoiceDate: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        totalAmount: true,
        profit: true,
        invoiceDate: true,
      },
      orderBy: { invoiceDate: 'asc' },
    });

    const salesByDate = historicalSales.reduce((acc, sale) => {
      const date = sale.invoiceDate.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = { revenue: 0, profit: 0, count: 0 };
      acc[date].revenue += Number(sale.totalAmount);
      acc[date].profit += Number(sale.profit);
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { revenue: number; profit: number; count: number }>);

    const prompt = `Based on the following store data and sales history, provide a ${days}-day revenue forecast with:
1. Predicted total revenue for the next ${days} days
2. Day-by-day prediction (summarized weekly if more than 14 days)
3. Confidence level (low/medium/high)
4. Key factors affecting the prediction
5. Recommendations to improve sales

Store Context:
${context}

Historical Daily Sales (Last 90 days):
${Object.entries(salesByDate).map(([date, data]) => 
  `${date}: Revenue: ₹${data.revenue.toFixed(2)}, Profit: ₹${data.profit.toFixed(2)}, Transactions: ${data.count}`
).join('\n')}`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a retail analytics AI specialized in sales forecasting for Indian small businesses.
Provide accurate, data-driven predictions with clear reasoning.
Use Indian Rupees (₹) for all monetary values.
Structure your response clearly with sections for prediction, analysis, and recommendations.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || 'Unable to generate prediction';
    const tokensUsed = response.usage?.total_tokens || 0;

    await deductCredits(storeId, 'SALES_PREDICTION', `Sales Prediction: ${days} days forecast`);
    await logAIUsage(storeId, 'SALES_PREDICTION', config.credits.costs.prediction, prompt, content, tokensUsed, latencyMs, true);

    return { content, tokensUsed, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logAIUsage(storeId, 'SALES_PREDICTION', 0, undefined, undefined, undefined, latencyMs, false, errorMessage);
    throw error;
  }
};

/**
 * AI Restock Recommendations
 */
export const aiRestockRecommendations = async (storeId: string): Promise<AIResponse> => {
  const startTime = Date.now();

  try {
    const products = await prisma.product.findMany({
      where: { storeId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        reorderQuantity: true,
        costPrice: true,
        totalSold: true,
        lastSoldAt: true,
        lastRestockedAt: true,
        category: { select: { name: true } },
      },
    });

    const salesVelocity = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          storeId,
          invoiceDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      _sum: { quantity: true },
    });

    const velocityMap = new Map(salesVelocity.map(v => [v.productId, v._sum.quantity || 0]));

    const productData = products.map(p => ({
      ...p,
      monthlySales: velocityMap.get(p.id) || 0,
      daysOfStock: velocityMap.get(p.id) ? Math.floor(p.stockQuantity / (velocityMap.get(p.id)! / 30)) : 999,
    }));

    const prompt = `Analyze this inventory data and provide restock recommendations:

Products:
${productData.map(p => `
- ${p.name} (${p.sku})
  Category: ${p.category?.name || 'Uncategorized'}
  Current Stock: ${p.stockQuantity}
  Low Stock Threshold: ${p.lowStockThreshold}
  Monthly Sales: ${p.monthlySales}
  Days of Stock Left: ${p.daysOfStock === 999 ? 'No recent sales' : p.daysOfStock}
  Cost Price: ₹${Number(p.costPrice)}
  Last Sold: ${p.lastSoldAt?.toISOString().split('T')[0] || 'Never'}
`).join('\n')}

Provide:
1. Urgent restocks needed (will run out within 7 days)
2. Suggested restock quantities based on sales velocity
3. Dead stock identification (no sales in 60+ days)
4. Total investment needed for recommended restocks
5. Priority ranking for restocking`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an inventory management AI for Indian retail businesses.
Provide actionable restock recommendations based on sales velocity and stock levels.
Consider cash flow by prioritizing high-velocity items.
Use ₹ for currency.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || 'Unable to generate recommendations';
    const tokensUsed = response.usage?.total_tokens || 0;

    await deductCredits(storeId, 'RESTOCK_RECOMMENDATION', 'Restock recommendations');
    await logAIUsage(storeId, 'RESTOCK_RECOMMENDATION', config.credits.costs.prediction, undefined, content, tokensUsed, latencyMs, true);

    return { content, tokensUsed, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logAIUsage(storeId, 'RESTOCK_RECOMMENDATION', 0, undefined, undefined, undefined, latencyMs, false, errorMessage);
    throw error;
  }
};

/**
 * AI Marketing Suggestions
 */
export const aiMarketingSuggestions = async (storeId: string): Promise<AIResponse> => {
  const startTime = Date.now();

  try {
    const context = await getStoreContext(storeId);

    const prompt = `Based on this store's data, provide marketing suggestions:

${context}

Generate:
1. 3 promotional campaign ideas relevant to current inventory
2. Best products to feature in promotions
3. Optimal discount strategies
4. Social media post ideas
5. Local marketing tactics for Indian market
6. Seasonal opportunities based on Indian calendar`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a marketing AI for Indian retail businesses.
Generate creative, practical marketing ideas appropriate for small Indian shops.
Consider local festivals, seasons, and budget constraints.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || 'Unable to generate suggestions';
    const tokensUsed = response.usage?.total_tokens || 0;

    await deductCredits(storeId, 'MARKETING_SUGGESTION', 'Marketing suggestions');
    await logAIUsage(storeId, 'MARKETING_SUGGESTION', config.credits.costs.prediction, undefined, content, tokensUsed, latencyMs, true);

    return { content, tokensUsed, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logAIUsage(storeId, 'MARKETING_SUGGESTION', 0, undefined, undefined, undefined, latencyMs, false, errorMessage);
    throw error;
  }
};

/**
 * AI Growth Insights
 */
export const aiGrowthInsights = async (storeId: string): Promise<AIResponse> => {
  const startTime = Date.now();

  try {
    const context = await getStoreContext(storeId);

    // Get month-over-month metrics
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const [thisMonthSales, lastMonthSales, categoryBreakdown] = await Promise.all([
      prisma.sale.aggregate({
        where: { storeId, invoiceDate: { gte: thisMonth } },
        _sum: { totalAmount: true, profit: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { storeId, invoiceDate: { gte: lastMonth, lt: thisMonth } },
        _sum: { totalAmount: true, profit: true },
        _count: true,
      }),
      prisma.product.groupBy({
        by: ['categoryId'],
        where: { storeId },
        _sum: { totalSold: true },
      }),
    ]);

    const prompt = `Analyze this business data and provide growth insights:

${context}

Monthly Comparison:
- This Month: Revenue ₹${Number(thisMonthSales._sum.totalAmount || 0)}, Profit ₹${Number(thisMonthSales._sum.profit || 0)}, Transactions: ${thisMonthSales._count}
- Last Month: Revenue ₹${Number(lastMonthSales._sum.totalAmount || 0)}, Profit ₹${Number(lastMonthSales._sum.profit || 0)}, Transactions: ${lastMonthSales._count}

Provide:
1. Business health score (1-10)
2. Key growth opportunities
3. Areas of concern
4. Quick wins for next 30 days
5. Long-term strategic recommendations
6. Comparison with similar retail businesses (general benchmarks)`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a retail business consultant AI specializing in growth strategy for Indian small businesses.
Provide insightful, actionable advice based on data analysis.
Be specific and practical, considering the constraints of small retail operations.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    });

    const latencyMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || 'Unable to generate insights';
    const tokensUsed = response.usage?.total_tokens || 0;

    await deductCredits(storeId, 'GROWTH_INSIGHTS', 'Growth insights');
    await logAIUsage(storeId, 'GROWTH_INSIGHTS', config.credits.costs.prediction, undefined, content, tokensUsed, latencyMs, true);

    return { content, tokensUsed, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logAIUsage(storeId, 'GROWTH_INSIGHTS', 0, undefined, undefined, undefined, latencyMs, false, errorMessage);
    throw error;
  }
};


