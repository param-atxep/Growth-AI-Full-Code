import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../services/api';
import { Button, Input } from '../../components/ui';
import { Mail, Lock, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authAPI.login(data),
    onSuccess: (response) => {
      // Clear all cached queries from previous user session
      queryClient.clear();
      
      const { user, stores, tokens } = response.data.data;
      const mappedUser = {
        ...user,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      };
      const mappedStores = stores.map((s: { creditBalance?: number; [key: string]: unknown }) => ({
        ...s,
        credits: s.creditBalance,
      }));
      login({ user: mappedUser, stores: mappedStores, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      toast.success('Welcome back!');
      navigate('/dashboard');
    },
    onError: (error: unknown) => {
      console.error('Login error:', error);
      // Error toast handled by API interceptor
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="space-y-6">
      {/* Mobile Logo */}
      <div className="flex items-center gap-3 justify-center lg:hidden mb-8">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold">GrowthPilot AI</span>
      </div>

      <div className="text-center lg:text-left">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground mt-1">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          className="w-full"
          isLoading={loginMutation.isPending}
        >
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary hover:underline font-medium">
          Create one
        </Link>
      </p>

      {/* Demo credentials hint */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground text-center">
          <span className="font-medium">Demo:</span> demo@growthpilot.com / demo123
        </p>
      </div>
    </div>
  );
};

export default Login;
