import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Bot, MessageSquare, ShoppingCart, Calendar, CheckCircle2 } from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';

interface ChatbotSetupStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const templates = [
  {
    id: 'support',
    icon: MessageSquare,
    title: 'Customer Support',
    description: 'Answer FAQs, help users, resolve issues',
    color: 'from-blue-400 to-blue-600',
  },
  {
    id: 'sales',
    icon: ShoppingCart,
    title: 'Sales Agent',
    description: 'Product recommendations, order assistance',
    color: 'from-green-400 to-green-600',
  },
  {
    id: 'booking',
    icon: Calendar,
    title: 'Booking Assistant',
    description: 'Schedule appointments, manage reservations',
    color: 'from-purple-400 to-purple-600',
  },
];

export const ChatbotSetupStep: React.FC<ChatbotSetupStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const handleTemplateSelect = (templateId: string) => {
    updateData({
      chatbotTemplate: templateId,
      createChatbot: true,
      chatbotName: data.chatbotName || getDefaultName(templateId),
    });
  };

  const getDefaultName = (templateId: string) => {
    switch (templateId) {
      case 'support':
        return 'My Support Bot';
      case 'sales':
        return 'My Sales Bot';
      case 'booking':
        return 'My Booking Bot';
      default:
        return 'My Chatbot';
    }
  };

  const handleSkip = () => {
    updateData({ createChatbot: false, chatbotName: '', chatbotTemplate: '' });
    onNext();
  };

  const canProceed = data.createChatbot && data.chatbotName && data.chatbotTemplate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Create Your First Chatbot</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Let's create a simple chatbot to get you started. You can customize it later.
        </p>
      </div>

      {/* Chatbot Name */}
      <div className="space-y-2">
        <Label htmlFor="chatbotName">Chatbot Name</Label>
        <Input
          id="chatbotName"
          placeholder="e.g., My Support Bot"
          value={data.chatbotName}
          onChange={(e) => updateData({ chatbotName: e.target.value, createChatbot: true })}
        />
      </div>

      {/* Template Selection */}
      <div className="space-y-3">
        <Label>Choose a template</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((template) => {
            const isSelected = data.chatbotTemplate === template.id;
            return (
              <Card
                key={template.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                  isSelected
                    ? "ring-2 ring-primary border-primary"
                    : "hover:border-primary/50"
                )}
                onClick={() => handleTemplateSelect(template.id)}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                )}
                <CardContent className="p-4 text-center">
                  <div className={cn(
                    "w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3",
                    `bg-gradient-to-br ${template.color}`
                  )}>
                    <template.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-1">{template.title}</h3>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* What's included */}
      {data.chatbotTemplate && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h4 className="font-medium mb-2">What's included:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Pre-configured AI personality
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Ready-to-use conversation templates
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Customizable settings
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSkip}>
            Skip - I'll create later
          </Button>
          <Button onClick={onNext} disabled={!canProceed}>
            {data.createChatbot ? 'Create Chatbot' : 'Continue'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotSetupStep;
