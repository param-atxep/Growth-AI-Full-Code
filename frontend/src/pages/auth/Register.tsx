import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../services/api';
import { Button, Input, Select } from '../../components/ui';
import { Mail, Lock, User, Phone, Store, TrendingUp } from 'lucide-react';
import { STORE_TYPES } from '../../lib/utils';
import toast from 'react-hot-toast';

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    storeName: '',
    storeType: 'RETAIL',
  });

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: (data: typeof formData) => authAPI.register({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone || undefined,
      storeName: data.storeName,
      storeType: data.storeType,
    }),
    onSuccess: (response) => {
      // Clear all cached queries from previous user session
      queryClient.clear();
      
      const { user, store, tokens } = response.data.data;
      const mappedUser = {
        ...user,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      };
      const mappedStore = {
        ...store,
        credits: store.creditBalance,
      };
      login({ 
        user: mappedUser, 
        stores: [mappedStore], 
        accessToken: tokens.accessToken, 
        refreshToken: tokens.refreshToken 
      });
      toast.success('Welcome to GrowthPilot AI! You have 100 free AI credits.');
      navigate('/dashboard');
    },
    onError: (error: unknown) => {
      console.error('Registration error:', error);
      // Error toast is handled by API interceptor
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return false;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.storeName) {
      toast.error('Please enter your store name');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      handleNext();
    } else if (validateStep2()) {
      registerMutation.mutate(formData);
    }
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
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-muted-foreground mt-1">
          {step === 1 ? 'Enter your personal details' : 'Set up your store'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 justify-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}>
          1
        </div>
        <div className={`w-16 h-1 rounded ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}>
          2
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 ? (
          <>
            <Input
              label="Full Name"
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              icon={<User className="w-4 h-4" />}
              autoComplete="name"
            />

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              icon={<Mail className="w-4 h-4" />}
              autoComplete="email"
            />

            <Input
              label="Phone (optional)"
              name="phone"
              type="tel"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={handleChange}
              icon={<Phone className="w-4 h-4" />}
              autoComplete="tel"
            />

            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Min 6 characters"
              value={formData.password}
              onChange={handleChange}
              icon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={handleChange}
              icon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Store Name"
              name="storeName"
              placeholder="My Awesome Store"
              value={formData.storeName}
              onChange={handleChange}
              icon={<Store className="w-4 h-4" />}
            />

            <Select
              label="Store Type"
              name="storeType"
              value={formData.storeType}
              onChange={handleChange}
              options={STORE_TYPES}
            />

            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium text-primary">🎉 Welcome Bonus</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll receive 100 free AI credits to get started!
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={registerMutation.isPending}
              >
                Create Account
              </Button>
            </div>
          </>
        )}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default Register;
