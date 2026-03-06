import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import Inventory from './pages/inventory/Inventory';
import ProductDetail from './pages/inventory/ProductDetail';
import AddProduct from './pages/inventory/AddProduct';
import Sales from './pages/sales/Sales';
import NewSale from './pages/sales/NewSale';
import SaleDetail from './pages/sales/SaleDetail';
import Expenses from './pages/expenses/Expenses';
import Reports from './pages/reports/Reports';
import AIInsights from './pages/ai/AIInsights';
import AIChat from './pages/ai/AIChat';
import Credits from './pages/credits/Credits';
import Settings from './pages/settings/Settings';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Public Route Component (redirects if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />
      </Route>

      {/* Dashboard Routes */}
      <Route 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Inventory */}
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/add" element={<AddProduct />} />
        <Route path="/inventory/:id" element={<ProductDetail />} />
        
        {/* Sales */}
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/new" element={<NewSale />} />
        <Route path="/sales/:id" element={<SaleDetail />} />
        
        {/* Expenses */}
        <Route path="/expenses" element={<Expenses />} />
        
        {/* Reports */}
        <Route path="/reports" element={<Reports />} />
        
        {/* AI */}
        <Route path="/ai/insights" element={<AIInsights />} />
        <Route path="/ai/chat" element={<AIChat />} />
        
        {/* Credits */}
        <Route path="/credits" element={<Credits />} />
        
        {/* Settings */}
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Redirect root to dashboard or login */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* 404 Page */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
