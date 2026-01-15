import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Users, Zap, Package, ArrowRight } from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';

interface WelcomeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

const features = [
  {
    icon: MessageSquare,
    title: 'WhatsApp Integration',
    description: 'Connect via Web or Business API',
  },
  {
    icon: Zap,
    title: 'AI-Powered Conversations',
    description: 'GPT-4 powered intelligent responses',
  },
  {
    icon: Users,
    title: 'Smart Follow-ups',
    description: 'AI tagging & automated messages',
  },
  {
    icon: Package,
    title: 'Product Catalog',
    description: 'Manage products & promotions',
  },
];

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="text-center space-y-8">
      {/* Logo/Brand */}
      <div className="space-y-4">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-lg">
          <MessageSquare className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to Chatty!
        </h1>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          Build AI-powered WhatsApp chatbots in minutes
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        {features.map((feature) => (
          <Card key={feature.title} className="text-left">
            <CardContent className="p-4">
              <feature.icon className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-semibold text-sm">{feature.title}</h3>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <div className="space-y-4 pt-4">
        <p className="text-muted-foreground">
          Let's get you set up in just a few steps!
        </p>
        <Button size="lg" onClick={onNext} className="px-8">
          Get Started
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default WelcomeStep;
