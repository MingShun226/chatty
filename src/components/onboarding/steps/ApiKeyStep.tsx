import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Key,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Copy
} from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import { useAuth } from '@/hooks/useAuth';
import { apiKeyService } from '@/services/apiKeyService';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const steps = [
  { number: 1, text: 'Go to platform.openai.com' },
  { number: 2, text: 'Sign in or create an account' },
  { number: 3, text: 'Navigate to API Keys section' },
  { number: 4, text: 'Click "Create new secret key"' },
  { number: 5, text: 'Copy the key and paste below' },
];

export const ApiKeyStep: React.FC<ApiKeyStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  const validateAndSaveApiKey = async () => {
    if (!data.openaiApiKey || !user) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      // Validate the API key by making a test request
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${data.openaiApiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setValidationError('Invalid API key. Please check and try again.');
        } else if (response.status === 429) {
          setValidationError('Rate limited. Please wait a moment and try again.');
        } else {
          setValidationError('Failed to validate API key. Please try again.');
        }
        setIsValid(false);
        return;
      }

      // API key is valid - save it (use 'OpenAI' to match what services expect)
      await apiKeyService.addApiKey(user.id, 'OpenAI API Key', 'OpenAI', data.openaiApiKey);

      setIsValid(true);
      updateData({ apiKeyValidated: true });

      toast({
        title: 'API Key Verified',
        description: 'Your OpenAI API key has been saved successfully.',
      });

      // Automatically proceed after a short delay
      setTimeout(() => {
        onNext();
      }, 1000);

    } catch (error) {
      console.error('Error validating API key:', error);
      setValidationError('Failed to validate API key. Please check your connection and try again.');
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyChange = (value: string) => {
    updateData({ openaiApiKey: value, apiKeyValidated: false });
    setValidationError(null);
    setIsValid(false);
  };

  const openOpenAI = () => {
    window.open('https://platform.openai.com/api-keys', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Key className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Connect Your OpenAI Account</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Chatty uses OpenAI's GPT models to power your chatbot's AI conversations.
          You'll need an OpenAI API key.
        </p>
      </div>

      {/* Instructions Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm">?</span>
            How to get your API key:
          </h3>
          <ol className="space-y-3">
            {steps.map((step) => (
              <li key={step.number} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                  {step.number}
                </span>
                <span className="text-sm pt-0.5">{step.text}</span>
              </li>
            ))}
          </ol>
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={openOpenAI}
          >
            Open OpenAI Dashboard
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* API Key Input */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">Your API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={data.openaiApiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              className={`pr-10 ${isValid ? 'border-green-500' : validationError ? 'border-red-500' : ''}`}
            />
            {isValid && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Your key is encrypted and stored securely. We never share your API key.</span>
        </div>

        {/* Validation Error */}
        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {isValid && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              API key verified successfully! Proceeding to next step...
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={validateAndSaveApiKey}
          disabled={!data.openaiApiKey || isValidating || isValid}
        >
          {isValidating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : isValid ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Verified
            </>
          ) : (
            <>
              Verify & Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ApiKeyStep;
