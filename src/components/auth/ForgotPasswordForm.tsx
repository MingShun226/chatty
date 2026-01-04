
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

const ForgotPasswordForm = ({ onBackToLogin }: ForgotPasswordFormProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { toast } = useToast();
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        toast({
          title: "Reset Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setIsEmailSent(true);
        toast({
          title: "Reset Email Sent",
          description: "Check your email for password reset instructions.",
        });
      }
    } catch (error) {
      toast({
        title: "Reset Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center">
            <Mail className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Check Your Email</h2>
          <p className="text-muted-foreground text-sm">
            We've sent password reset instructions to {email}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or try again.
          </p>
          
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setIsEmailSent(false)}
          >
            Resend Email
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onBackToLogin}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

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
        <h2 className="text-xl font-semibold">Reset Password</h2>
        <p className="text-muted-foreground text-sm">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
      </div>

      {/* Reset Form */}
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

        <Button
          type="submit"
          className="w-full btn-hero"
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send Reset Instructions'}
        </Button>
      </form>

      {/* Back to Login */}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onBackToLogin}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Login
      </Button>
    </div>
  );
};

export default ForgotPasswordForm;
