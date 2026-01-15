import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  ArrowLeft,
  Wand2,
  Eye,
  Edit3,
  RefreshCw,
  CheckCircle2,
  Info,
  Shield
} from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import { generateSystemPrompt, generateDefaultHiddenRules, getPromptSummary } from '../utils/promptGenerator';
import { cn } from '@/lib/utils';

interface PromptPreviewStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const PromptPreviewStep: React.FC<PromptPreviewStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [isEditing, setIsEditing] = useState(false);

  // Generate prompt on mount or when dependencies change
  useEffect(() => {
    if (!data.generatedPrompt) {
      const prompt = generateSystemPrompt(data);
      const hiddenRules = generateDefaultHiddenRules(data);
      updateData({
        generatedPrompt: prompt,
        hiddenRules: hiddenRules
      });
    }
  }, []);

  const handleRegenerate = () => {
    const prompt = generateSystemPrompt(data);
    updateData({ generatedPrompt: prompt });
  };

  const summary = getPromptSummary(data);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Wand2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Your AI Prompt is Ready!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          We've created a customized prompt based on your business. Review it below or customize it further.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Bot Name</p>
            <p className="font-semibold text-sm truncate">{summary.chatbotName}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Business</p>
            <p className="font-semibold text-sm truncate">{summary.businessName}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Tone</p>
            <p className="font-semibold text-sm truncate">{summary.tone}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Languages</p>
            <p className="font-semibold text-sm truncate">{summary.languages.length} selected</p>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="edit" className="flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            Edit Prompt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Auto-Generated
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Regenerate
                </Button>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground/80">
                  {data.generatedPrompt}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Hidden Rules Info */}
          <Card className="mt-4 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">
                    Safety Rules Auto-Applied
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    We've automatically added compliance and safety guidelines to protect your business.
                    These include data protection rules, escalation triggers, and content restrictions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Feel free to customize the prompt. You can always regenerate it later.
                </p>
              </div>
              <Textarea
                value={data.generatedPrompt || ''}
                onChange={(e) => updateData({ generatedPrompt: e.target.value })}
                placeholder="Your chatbot's system prompt..."
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="flex justify-end mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset to Generated
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* What's Next Info */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">
                What's Next?
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                After this step, you can optionally add your products, upload knowledge documents,
                and set up promotions. All these steps are optional - you can skip them and add content later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Continue to Products
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default PromptPreviewStep;
