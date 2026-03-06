import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate a unique invoice number
 */
export const generateInvoiceNumber = (prefix: string = 'INV'): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}${month}${day}-${random}`;
};

/**
 * Generate a unique SKU
 */
export const generateSKU = (categoryPrefix: string = 'GEN'): string => {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${categoryPrefix.slice(0, 3).toUpperCase()}-${random}`;
};

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (cost: number, selling: number): number => {
  if (selling === 0) return 0;
  return Number((((selling - cost) / selling) * 100).toFixed(2));
};

/**
 * Calculate GST amount
 */
export const calculateGST = (amount: number, gstRate: number): { 
  cgst: number; 
  sgst: number; 
  igst: number; 
  total: number; 
} => {
  const totalGst = (amount * gstRate) / 100;
  const halfGst = totalGst / 2;
  return {
    cgst: Number(halfGst.toFixed(2)),
    sgst: Number(halfGst.toFixed(2)),
    igst: 0,
    total: Number(totalGst.toFixed(2)),
  };
};

/**
 * Format currency for Indian Rupees
 */
export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Parse date range for queries
 */
export const parseDateRange = (startDate?: string, endDate?: string): {
  start: Date;
  end: Date;
} => {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  
  const start = startDate 
    ? new Date(startDate) 
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
};

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

/**
 * Generate random verification code
 */
export const generateVerificationCode = (length: number = 6): string => {
  return crypto.randomInt(Math.pow(10, length - 1), Math.pow(10, length) - 1).toString();
};

/**
 * Slugify a string
 */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate a random color hex code
 */
export const generateRandomColor = (): string => {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
};

/**
 * Check if a date is within a range
 */
export const isDateInRange = (date: Date, start: Date, end: Date): boolean => {
  return date >= start && date <= end;
};

/**
 * Get fiscal year dates based on start month
 */
export const getFiscalYearDates = (fiscalYearStartMonth: number = 4): {
  start: Date;
  end: Date;
} => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  let fyStartYear = currentMonth >= fiscalYearStartMonth ? currentYear : currentYear - 1;
  
  const start = new Date(fyStartYear, fiscalYearStartMonth - 1, 1);
  const end = new Date(fyStartYear + 1, fiscalYearStartMonth - 1, 0, 23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Chunk array into smaller arrays
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Sleep utility for delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Sanitize object by removing undefined/null values
 */
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  ) as Partial<T>;
};
