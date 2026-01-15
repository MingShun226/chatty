import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Bot, CheckCircle2, Smile, Briefcase, Coffee, Sparkles } from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';

interface ChatbotPersonalityStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const tones = [
  {
    id: 'friendly',
    icon: Smile,
    label: 'Friendly & Warm',
    description: 'Casual, approachable, uses simple language',
    example: '"Hey there! How can I help you today? 😊"',
    color: 'from-yellow-400 to-orange-400',
  },
  {
    id: 'professional',
    icon: Briefcase,
    label: 'Professional',
    description: 'Formal, polished, business-appropriate',
    example: '"Good day. How may I assist you?"',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: 'casual',
    icon: Coffee,
    label: 'Casual & Fun',
    description: 'Relaxed, uses emojis, conversational',
    example: '"Hey! What\'s up? 👋 What can I do for you?"',
    color: 'from-pink-400 to-purple-500',
  },
  {
    id: 'helpful',
    icon: Sparkles,
    label: 'Helpful Expert',
    description: 'Knowledgeable, detailed, educational',
    example: '"I\'d be happy to explain that in detail..."',
    color: 'from-green-400 to-teal-500',
  },
];

const languages = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'ms', label: 'Bahasa Malaysia', flag: '🇲🇾' },
  { id: 'zh', label: 'Chinese (中文)', flag: '🇨🇳' },
  { id: 'ta', label: 'Tamil (தமிழ்)', flag: '🇮🇳' },
  { id: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { id: 'th', label: 'Thai (ภาษาไทย)', flag: '🇹🇭' },
  { id: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { id: 'ar', label: 'Arabic (العربية)', flag: '🇸🇦' },
];

const responseStyles = [
  { id: 'concise', label: 'Concise', description: 'Short, to-the-point answers' },
  { id: 'detailed', label: 'Detailed', description: 'Thorough explanations' },
  { id: 'balanced', label: 'Balanced', description: 'Mix of both based on context' },
];

export const ChatbotPersonalityStep: React.FC<ChatbotPersonalityStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const handleLanguageToggle = (langId: string) => {
    const current = data.chatbotLanguages || ['en'];
    if (current.includes(langId)) {
      // Don't allow removing all languages
      if (current.length > 1) {
        updateData({ chatbotLanguages: current.filter(l => l !== langId) });
      }
    } else {
      updateData({ chatbotLanguages: [...current, langId] });
    }
  };

  const canProceed = data.chatbotName && data.chatbotTone;

  // Generate default name based on business name
  React.useEffect(() => {
    if (!data.chatbotName && data.businessName) {
      updateData({ chatbotName: `${data.businessName} Assistant` });
    }
  }, [data.businessName]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Design Your Chatbot's Personality</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Give your chatbot a name and personality that matches your brand.
        </p>
      </div>

      {/* Chatbot Name */}
      <div className="space-y-2">
        <Label htmlFor="chatbotName">Chatbot Name *</Label>
        <Input
          id="chatbotName"
          placeholder="e.g., Maya, Support Bot, Alex"
          value={data.chatbotName}
          onChange={(e) => updateData({ chatbotName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          This is how your chatbot will introduce itself to customers
        </p>
      </div>

      {/* Tone Selection */}
      <div className="space-y-3">
        <Label>Communication Tone *</Label>
        <p className="text-sm text-muted-foreground">How should your chatbot communicate?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tones.map((tone) => {
            const isSelected = data.chatbotTone === tone.id;
            return (
              <Card
                key={tone.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                  isSelected
                    ? "ring-2 ring-primary border-primary"
                    : "hover:border-primary/50"
                )}
                onClick={() => updateData({ chatbotTone: tone.id })}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      `bg-gradient-to-br ${tone.color}`
                    )}>
                      <tone.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{tone.label}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{tone.description}</p>
                      <p className="text-xs italic bg-muted/50 p-2 rounded">
                        {tone.example}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Language Selection */}
      <div className="space-y-3">
        <Label>Languages Your Chatbot Can Speak</Label>
        <p className="text-sm text-muted-foreground">Select all languages your customers might use</p>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => {
            const isSelected = (data.chatbotLanguages || ['en']).includes(lang.id);
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => handleLanguageToggle(lang.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Response Style */}
      <div className="space-y-3">
        <Label>Response Style</Label>
        <div className="flex gap-2">
          {responseStyles.map((style) => {
            const isSelected = (data.responseStyle || 'balanced') === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => updateData({ responseStyle: style.id })}
                className={cn(
                  "flex-1 p-3 rounded-lg border text-center transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className={cn("font-medium text-sm block", isSelected && "text-primary")}>
                  {style.label}
                </span>
                <span className="text-xs text-muted-foreground">{style.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Generate AI Prompt
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default ChatbotPersonalityStep;
