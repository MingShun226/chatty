import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Key, UserCog, CheckCircle2, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ApiKeyStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

type ApiKeyChoice = 'own' | 'request' | null;

export const ApiKeyStep: React.FC<ApiKeyStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const { user } = useAuth();
  const [choice, setChoice] = useState<ApiKeyChoice>(
    data.apiKeyRequested ? 'request' : data.openaiApiKey ? 'own' : null
  );
  const [apiKey, setApiKey] = useState(data.openaiApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(data.apiKeyValidated || false);

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key');
      return false;
    }

    if (!apiKey.startsWith('sk-')) {
      setError('Invalid API key format. OpenAI keys start with "sk-"');
      return false;
    }

    setValidating(true);
    setError('');

    try {
      // Simple validation by making a test request to OpenAI
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        setValidated(true);
        return true;
      } else {
        const data = await response.json();
        setError(data.error?.message || 'Invalid API key');
        return false;
      }
    } catch (err) {
      setError('Failed to validate API key. Please check your connection.');
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleContinue = async () => {
    if (choice === 'own') {
      const isValid = validated || await validateApiKey();
      if (!isValid) return;

      // Save the API key to user_api_keys table (base64 encoded)
      if (user) {
        try {
          const encodedKey = btoa(apiKey);
          await supabase
            .from('user_api_keys')
            .upsert({
              user_id: user.id,
              service: 'openai',
              api_key_encrypted: encodedKey,
              status: 'active',
            }, {
              onConflict: 'user_id,service'
            });
        } catch (err) {
          console.error('Error saving API key:', err);
        }
      }

      updateData({
        openaiApiKey: apiKey,
        apiKeyValidated: true,
        apiKeyRequested: false,
      });
    } else if (choice === 'request') {
      // Mark that user requested API key from admin
      if (user) {
        try {
          await supabase
            .from('profiles')
            .update({
              api_key_requested: true,
              api_key_requested_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        } catch (err) {
          console.error('Error updating profile:', err);
        }
      }

      updateData({
        openaiApiKey: '',
        apiKeyValidated: false,
        apiKeyRequested: true,
      });
    }

    onNext();
  };

  const canProceed = choice === 'request' || (choice === 'own' && apiKey.trim());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Key className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">OpenAI API Key</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your chatbot uses OpenAI's GPT to generate intelligent responses. Choose how you'd like to set this up.
        </p>
      </div>

      {/* Options */}
      <div className="grid gap-4 max-w-lg mx-auto">
        {/* Option 1: Use own API key */}
        <Card
          className={cn(
            "cursor-pointer transition-all",
            choice === 'own'
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/50"
          )}
          onClick={() => setChoice('own')}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                choice === 'own' ? "bg-primary text-white" : "bg-muted"
              )}>
                <Key className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Use My Own API Key</h3>
                  {choice === 'own' && <CheckCircle2 className="w-5 h-5 text-primary" />}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  I have an OpenAI API key and want to use it directly
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li>• You control your API usage and billing</li>
                  <li>• Get started immediately after validation</li>
                  <li>• Manage your key from OpenAI dashboard</li>
                </ul>
              </div>
            </div>

            {/* API Key Input (shown when selected) */}
            {choice === 'own' && (
              <div className="mt-4 pt-4 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                <Label htmlFor="apiKey">OpenAI API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setValidated(false);
                      setError('');
                    }}
                    className={cn(
                      "pr-20",
                      error && "border-destructive",
                      validated && "border-green-500"
                    )}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                )}
                {validated && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    API key validated successfully!
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Get your key from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Option 2: Request from admin */}
        <Card
          className={cn(
            "cursor-pointer transition-all",
            choice === 'request'
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/50"
          )}
          onClick={() => setChoice('request')}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                choice === 'request' ? "bg-primary text-white" : "bg-muted"
              )}>
                <UserCog className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Request from Admin</h3>
                  {choice === 'request' && <CheckCircle2 className="w-5 h-5 text-primary" />}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  I don't have an API key - please assign one for me
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li>• Admin will assign an API key to your account</li>
                  <li>• No OpenAI account needed</li>
                  <li>• Chatbot will work once admin activates it</li>
                </ul>
              </div>
            </div>

            {/* Request confirmation message */}
            {choice === 'request' && (
              <div className="mt-4 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> Your chatbot features will be limited until an admin assigns an API key to your account.
                    You can still set up your chatbot content in the meantime.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canProceed || validating}>
          {validating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ApiKeyStep;
