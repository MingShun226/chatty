
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PhoneInput } from '@/components/ui/phone-input';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

interface SignupFormProps {
  onLogin: (token: string) => void;
  onSwitchToLogin: () => void;
}

const SignupForm: React.FC<SignupFormProps> = ({ onLogin, onSwitchToLogin }) => {
  const { settings: platformSettings } = usePlatformSettings();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    countryCode: '+60',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    referrerCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();
  const { signUp } = useAuth();

  const handleGoogleSignUp = async () => {
    try {
      setGoogleLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        toast({
          title: "Google Sign-Up Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to initiate Google sign-up",
        variant: "destructive"
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    fetchTermsSettings();
  }, []);

  const fetchTermsSettings = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'terms_and_conditions')
        .maybeSingle();

      if (data?.setting_value?.enabled) {
        setTermsEnabled(true);
      }
    } catch (error) {
      console.error('Error fetching terms settings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (termsEnabled && !agreedToTerms) {
      setError('You must agree to the Terms & Conditions to create an account');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      // Combine country code and phone number
      const fullPhoneNumber = formData.phoneNumber ? 
        `${formData.countryCode}${formData.phoneNumber}` : '';

      const { data, error } = await signUp(
        formData.email,
        formData.password,
        formData.name,
        fullPhoneNumber,
        formData.referrerCode
      );

      if (error) {
        setError(error.message);
      } else {
        toast({
          title: "Account Created",
          description: "Please check your email to verify your account.",
        });
        // Don't call onLogin here - wait for email verification
      }
    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Enter your details to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <PhoneInput
              countryCode={formData.countryCode}
              phoneNumber={formData.phoneNumber}
              onCountryCodeChange={(value) => setFormData({...formData, countryCode: value})}
              onPhoneNumberChange={(value) => setFormData({...formData, phoneNumber: value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referrerCode">Referrer Code (Optional)</Label>
            <Input
              id="referrerCode"
              type="text"
              placeholder="Enter referrer's code if you have one"
              value={formData.referrerCode}
              onChange={(e) => setFormData({...formData, referrerCode: e.target.value})}
            />
          </div>

          {termsEnabled && (
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <label
                htmlFor="terms"
                className="text-sm text-muted-foreground leading-tight cursor-pointer"
              >
                I agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline" target="_blank">
                  Terms & Conditions
                </Link>
              </label>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || googleLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>

          {/* Divider */}
          <div className="relative my-4">
            <Separator />
            <div className="absolute inset-0 flex justify-center">
              <span className="bg-card px-2 text-xs text-muted-foreground">
                OR
              </span>
            </div>
          </div>

          {/* Google Sign Up */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignUp}
            disabled={isLoading || googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={onSwitchToLogin}
              className="text-sm"
            >
              Already have an account? Sign in
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SignupForm;
