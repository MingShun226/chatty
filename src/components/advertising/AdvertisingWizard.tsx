import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Sparkles,
  CheckCircle2,
  Settings,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { UploadStep } from './steps/UploadStep';
import { AnalysisStep } from './steps/AnalysisStep';
import { StyleSelectionStep } from './steps/StyleSelectionStep';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ProductAnalysis } from '@/services/productAnalysis';

// Extended advertising style with negativePrompt support
export interface ExtendedAdvertisingStyle {
  id: string;
  name: string;
  platform: string;
  seriesNumber: number;
  description: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  strength: number;
}

// Wizard step definitions
const WIZARD_STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload, description: 'Upload product image' },
  { id: 'analysis', label: 'Analysis', icon: Sparkles, description: 'AI analyzes your product' },
  { id: 'styles', label: 'Styles', icon: CheckCircle2, description: 'Select advertising styles' },
  { id: 'generate', label: 'Generate', icon: Rocket, description: 'Start generation' },
];

export interface StyleRecommendation {
  style: ExtendedAdvertisingStyle;
  score: number;
  reason: string;
  isRecommended: boolean;
}

export interface WizardState {
  productImage: string | null;
  productName: string;
  productDescription: string;
  additionalRequirements: string;
  productAnalysis: ProductAnalysis | null;
  recommendations: StyleRecommendation[];
  selectedStyles: ExtendedAdvertisingStyle[];
  imageQuality: '1K' | '2K' | '4K';
  groupName: string;
  isAnalyzing: boolean;
  isGenerating: boolean;
  jobId: string | null;
}

interface AdvertisingWizardProps {
  onJobStarted?: (jobId: string) => void;
  onClose?: () => void;
}

export function AdvertisingWizard({ onJobStarted, onClose }: AdvertisingWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Wizard step state
  const [currentStep, setCurrentStep] = useState(0);

  // Wizard data state
  const [wizardState, setWizardState] = useState<WizardState>({
    productImage: null,
    productName: '',
    productDescription: '',
    additionalRequirements: '',
    productAnalysis: null,
    recommendations: [],
    selectedStyles: [],
    imageQuality: '2K',
    groupName: `Product Ads - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}`,
    isAnalyzing: false,
    isGenerating: false,
    jobId: null,
  });

  // Update wizard state helper
  const updateWizardState = useCallback((updates: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation helpers
  const canGoNext = () => {
    switch (currentStep) {
      case 0: // Upload step
        return wizardState.productImage !== null;
      case 1: // Analysis step
        return wizardState.productAnalysis !== null && !wizardState.isAnalyzing;
      case 2: // Style selection step
        return wizardState.selectedStyles.length > 0;
      case 3: // Confirmation step
        return !wizardState.isGenerating;
      default:
        return false;
    }
  };

  const canGoBack = () => {
    return currentStep > 0 && !wizardState.isGenerating;
  };

  const goNext = () => {
    if (canGoNext() && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (canGoBack()) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setWizardState({
      productImage: null,
      productName: '',
      productDescription: '',
      additionalRequirements: '',
      productAnalysis: null,
      recommendations: [],
      selectedStyles: [],
      imageQuality: '2K',
      groupName: `Product Ads - ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}`,
      isAnalyzing: false,
      isGenerating: false,
      jobId: null,
    });
  };

  // Handle job creation success
  const handleJobStarted = (jobId: string) => {
    updateWizardState({ jobId, isGenerating: false });

    toast({
      title: "Generation started!",
      description: `${wizardState.selectedStyles.length} images are being generated in the background. You'll be notified when they're ready.`,
    });

    if (onJobStarted) {
      onJobStarted(jobId);
    }

    // Optionally reset or close after starting
    if (onClose) {
      onClose();
    }
  };

  // Calculate progress percentage
  const progressPercentage = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <UploadStep
            productImage={wizardState.productImage}
            productName={wizardState.productName}
            productDescription={wizardState.productDescription}
            additionalRequirements={wizardState.additionalRequirements}
            onImageChange={(image) => updateWizardState({ productImage: image })}
            onProductNameChange={(name) => updateWizardState({ productName: name })}
            onProductDescriptionChange={(desc) => updateWizardState({ productDescription: desc })}
            onAdditionalRequirementsChange={(req) => updateWizardState({ additionalRequirements: req })}
          />
        );
      case 1:
        return (
          <AnalysisStep
            productImage={wizardState.productImage!}
            productName={wizardState.productName}
            productDescription={wizardState.productDescription}
            additionalRequirements={wizardState.additionalRequirements}
            productAnalysis={wizardState.productAnalysis}
            recommendations={wizardState.recommendations}
            isAnalyzing={wizardState.isAnalyzing}
            onAnalysisComplete={(analysis, recommendations) => {
              updateWizardState({
                productAnalysis: analysis,
                recommendations: recommendations,
                selectedStyles: recommendations.filter(r => r.isRecommended).map(r => r.style),
                isAnalyzing: false,
              });
            }}
            onAnalysisStart={() => updateWizardState({ isAnalyzing: true })}
          />
        );
      case 2:
        return (
          <StyleSelectionStep
            recommendations={wizardState.recommendations}
            selectedStyles={wizardState.selectedStyles}
            onStylesChange={(styles) => updateWizardState({ selectedStyles: styles })}
          />
        );
      case 3:
        return (
          <ConfirmationStep
            wizardState={wizardState}
            onSettingsChange={(settings) => updateWizardState(settings)}
            onJobStarted={handleJobStarted}
            onError={(error) => {
              toast({
                title: "Generation failed",
                description: error,
                variant: "destructive",
              });
              updateWizardState({ isGenerating: false });
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Advertising Generator
          </CardTitle>
          {wizardState.jobId && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Job Started
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <Progress value={progressPercentage} className="h-2 mt-4" />

        {/* Step indicators */}
        <div className="flex justify-between mt-4">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const isAccessible = index <= currentStep;

            return (
              <div
                key={step.id}
                className={`flex flex-col items-center gap-1 transition-all ${
                  isAccessible ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-purple-600' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {/* Step content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={!canGoBack()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-2">
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button
                onClick={goNext}
                disabled={!canGoNext()}
                className="flex items-center gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={resetWizard}
                variant="outline"
                className="flex items-center gap-2"
              >
                Start New
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdvertisingWizard;
