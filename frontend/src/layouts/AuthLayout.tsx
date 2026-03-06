import { Outlet } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <span className="text-2xl font-bold text-white">GrowthPilot AI</span>
          </div>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            AI-Powered Retail Operating System
          </h1>
          <p className="text-lg text-white/80">
            Transform your business with intelligent inventory management, 
            smart sales tracking, and AI-driven insights that help you grow.
          </p>
          
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-3xl font-bold text-white">100+</p>
              <p className="text-white/80 text-sm">Active Merchants</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-3xl font-bold text-white">₹50L+</p>
              <p className="text-white/80 text-sm">Sales Tracked</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-3xl font-bold text-white">10K+</p>
              <p className="text-white/80 text-sm">AI Insights</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-3xl font-bold text-white">99.9%</p>
              <p className="text-white/80 text-sm">Uptime</p>
            </div>
          </div>
        </div>
        
        <p className="text-white/60 text-sm">
          © 2024 GrowthPilot AI. All rights reserved.
        </p>
      </div>
      
      {/* Right Panel - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
