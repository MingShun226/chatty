
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Mail, Lock, Chrome } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onSwitchToForgotPassword: () => void;
  onLoginSuccess: () => void;
}

const LoginForm = ({
  onSwitchToSignup,
  onSwitchToForgotPassword,
  onLoginSuccess
}: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "Successfully signed in to your account."
        });

        // Check if user is admin and has a default dashboard preference
        if (data?.user) {
          const { data: adminData } = await supabase
            .from('admin_users')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (adminData && (adminData as any).default_dashboard === 'admin') {
            // Redirect to admin panel if preference is set
            navigate('/admin');
          } else {
            // Default to user dashboard
            navigate('/dashboard');
          }
        } else {
          navigate('/dashboard');
        }

        onLoginSuccess();
      }
    } catch (error) {
      toast({
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    toast({
      title: "Google Authentication",
      description: "Google auth integration will be implemented with backend."
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <div className="w-6 h-6 bg-white rounded-full"></div>
          </div>
        </div>
        <h1 className="text-2xl font-bold">Chatty</h1>
        <p className="text-muted-foreground">AI Business Chatbots</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Welcome Back</h2>
        <p className="text-muted-foreground text-sm">
          Sign in to your account to continue
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 input-modern"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 input-modern"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <Label htmlFor="remember" className="text-sm">
              Remember me
            </Label>
          </div>
          <button
            type="button"
            onClick={onSwitchToForgotPassword}
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          className="w-full btn-hero"
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <Separator />
        <div className="absolute inset-0 flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            OR
          </span>
        </div>
      </div>

      {/* Google Auth */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleAuth}
      >
        <Chrome className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>

      {/* Switch to Signup */}
      <div className="text-center text-sm">
        <span className="text-muted-foreground">Don't have an account? </span>
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="text-primary font-medium hover:underline"
        >
          Sign up here
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
