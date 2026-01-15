import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  PartyPopper,
  Smartphone,
  Settings,
  MessageSquare,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Bot,
  Package,
  FileText,
  Tag,
  Key
} from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import confetti from 'canvas-confetti';

interface CompletionStepProps {
  data: OnboardingData;
  onComplete: () => void;
  isSubmitting: boolean;
}

const nextSteps = [
  {
    icon: Smartphone,
    title: 'Connect WhatsApp',
    description: 'Link your WhatsApp to start receiving messages',
    href: '/chatbot/whatsapp',
  },
  {
    icon: Settings,
    title: 'Fine-tune Settings',
    description: 'Customize your chatbot\'s behavior',
    href: '/chatbot/ai-studio',
  },
  {
    icon: MessageSquare,
    title: 'Test Your Chatbot',
    description: 'Try chatting with your bot before going live',
    href: '/chatbot/ai-studio',
  },
];

export const CompletionStep: React.FC<CompletionStepProps> = ({
  data,
  onComplete,
  isSubmitting
}) => {
  // Trigger confetti on mount
  React.useEffect(() => {
    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const hasProducts = data.products && data.products.length > 0;
  const hasDocuments = data.documents && data.documents.length > 0;
  const hasPromotions = data.promotions && data.promotions.length > 0;

  return (
    <div className="space-y-8 text-center">
      {/* Success Icon */}
      <div className="space-y-4">
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
          <PartyPopper className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold">You're All Set!</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your AI chatbot <span className="font-semibold text-foreground">"{data.chatbotName}"</span> is ready for {data.businessName}!
        </p>
      </div>

      {/* Summary */}
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 max-w-lg mx-auto">
        <CardContent className="p-5">
          <h3 className="font-semibold mb-4 text-green-800 dark:text-green-200 text-lg">Setup Summary</h3>
          <div className="space-y-3 text-left">
            {data.apiKeyValidated && (
              <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-300">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <span>OpenAI API key configured</span>
              </div>
            )}

            {data.chatbotName && (
              <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-300">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium">{data.chatbotName}</span>
                  <span className="text-green-600 dark:text-green-400"> - AI chatbot created</span>
                </div>
              </div>
            )}

            {data.generatedPrompt && (
              <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-300">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>Custom AI prompt generated</span>
              </div>
            )}

            {hasProducts && (
              <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-300">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <span>{data.products.length} product{data.products.length > 1 ? 's' : ''} added</span>
              </div>
            )}

            {hasDocuments && (
              <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-300">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span>{data.documents.length} document{data.documents.length > 1 ? 's' : ''} uploaded</span>
              </div>
            )}

            {hasPromotions && (
              <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-300">
                <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <span>{data.promotions.length} promotion{data.promotions.length > 1 ? 's' : ''} added</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">What's Next?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {nextSteps.map((step) => (
            <Card key={step.title} className="text-left hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="pt-4">
        <Button size="lg" onClick={onComplete} disabled={isSubmitting} className="px-8">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating your chatbot...
            </>
          ) : (
            <>
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default CompletionStep;
