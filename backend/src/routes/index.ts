import { Router } from 'express';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import productRoutes from './product.routes.js';
import saleRoutes from './sale.routes.js';
import expenseRoutes from './expense.routes.js';
import aiRoutes from './ai.routes.js';
import creditRoutes from './credit.routes.js';
import storeRoutes from './store.routes.js';
import paymentRoutes from './payment.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/products', productRoutes);
router.use('/sales', saleRoutes);
router.use('/expenses', expenseRoutes);
router.use('/ai', aiRoutes);
router.use('/credits', creditRoutes);
router.use('/stores', storeRoutes);
router.use('/payments', paymentRoutes);

export default router;
