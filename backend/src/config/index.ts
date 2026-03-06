import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // AI Provider (Groq)
  GROQ_API_KEY: z.string(),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  AI_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  AI_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('10'),
  
  // Frontend
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  
  // Credits
  INITIAL_FREE_CREDITS: z.string().transform(Number).default('100'),
  AI_PREDICTION_COST: z.string().transform(Number).default('4'),
  AI_CHAT_COST: z.string().transform(Number).default('4'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  
  database: {
    url: parsed.data.DATABASE_URL,
  },
  
  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },
  
  groq: {
    apiKey: parsed.data.GROQ_API_KEY,
  },
  
  email: {
    host: parsed.data.SMTP_HOST,
    port: parsed.data.SMTP_PORT,
    user: parsed.data.SMTP_USER,
    pass: parsed.data.SMTP_PASS,
    from: parsed.data.EMAIL_FROM,
  },
  
  rateLimit: {
    windowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
    maxRequests: parsed.data.RATE_LIMIT_MAX_REQUESTS,
    ai: {
      windowMs: parsed.data.AI_RATE_LIMIT_WINDOW_MS,
      maxRequests: parsed.data.AI_RATE_LIMIT_MAX_REQUESTS,
    },
  },
  
  frontend: {
    url: parsed.data.FRONTEND_URL,
  },
  
  credits: {
    initial: parsed.data.INITIAL_FREE_CREDITS,
    costs: {
      prediction: parsed.data.AI_PREDICTION_COST,
      chat: parsed.data.AI_CHAT_COST,
    },
  },
  
  stripe: {
    secretKey: parsed.data.STRIPE_SECRET_KEY || '',
    publishableKey: parsed.data.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: parsed.data.STRIPE_WEBHOOK_SECRET || '',
  },
} as const;

export type Config = typeof config;
