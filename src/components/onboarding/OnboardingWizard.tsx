import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { WelcomeStep } from './steps/WelcomeStep';
import { ApiKeyStep } from './steps/ApiKeyStep';
import { BusinessInfoStep } from './steps/BusinessInfoStep';
import { ChatbotPersonalityStep } from './steps/ChatbotPersonalityStep';
import { CompletionStep } from './steps/CompletionStep';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateDefaultHiddenRules } from './utils/promptGenerator';
import { createPlatformApiKey } from '@/services/platformApiKeyService';

// Product type for onboarding
export interface OnboardingProduct {
  product_name: string;
  sku: string;
  price: number;
  category: string;
  description: string;
  in_stock: boolean;
}

// Document type for onboarding
export interface OnboardingDocument {
  file: File;
  name: string;
  size: number;
  type: string;
}

// Promotion type for onboarding
export interface OnboardingPromotion {
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed' | 'none';
  discount_value: number;
  promo_code: string;
  end_date: string;
}

export interface OnboardingData {
  // API Key
  openaiApiKey: string;
  apiKeyValidated: boolean;
  apiKeyRequested: boolean;

  // Business Info
  businessName: string;
  businessDescription: string;
  industry: string;
  companySize: string;

  // Chatbot Personality
  chatbotName: string;
  chatbotTone: string;
  chatbotLanguages: string[];
  responseStyle: string;

  // Generated Prompt
  generatedPrompt: string;
  hiddenRules: string;

  // Products (optional)
  products: OnboardingProduct[];

  // Documents (optional)
  documents: OnboardingDocument[];

  // Promotions (optional)
  promotions: OnboardingPromotion[];

  // Legacy fields for compatibility
  useCase: string;
  chatbotTemplate: string;
  createChatbot: boolean;
}

const INITIAL_DATA: OnboardingData = {
  openaiApiKey: '',
  apiKeyValidated: false,
  apiKeyRequested: false,
  businessName: '',
  businessDescription: '',
  industry: '',
  companySize: '',
  chatbotName: '',
  chatbotTone: 'friendly',
  chatbotLanguages: ['en'],
  responseStyle: 'balanced',
  generatedPrompt: '',
  hiddenRules: '',
  products: [],
  documents: [],
  promotions: [],
  useCase: '',
  chatbotTemplate: '',
  createChatbot: true,
};

const STEPS = [
  { id: 'welcome', label: 'Welcome', component: WelcomeStep },
  { id: 'api-key', label: 'API Key', component: ApiKeyStep },
  { id: 'business-info', label: 'Business Info', component: BusinessInfoStep },
  { id: 'personality', label: 'Personality', component: ChatbotPersonalityStep },
  { id: 'complete', label: 'Complete', component: CompletionStep },
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdChatbotId, setCreatedChatbotId] = useState<string | null>(null);

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  const goToNextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipOnboarding = async () => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_skipped: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      onComplete();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      toast({
        title: 'Error',
        description: 'Failed to skip onboarding. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const uploadDocuments = async (chatbotId: string) => {
    if (!user || data.documents.length === 0) return;

    for (const doc of data.documents) {
      try {
        // Upload file to storage
        const filePath = `${user.id}/${chatbotId}/${Date.now()}_${doc.name}`;
        const { error: uploadError } = await supabase.storage
          .from('knowledge-base')
          .upload(filePath, doc.file);

        if (uploadError) {
          console.error('Error uploading document:', uploadError);
          continue;
        }

        // Create knowledge file record
        await supabase.from('avatar_knowledge_files').insert({
          user_id: user.id,
          avatar_id: chatbotId,
          file_name: doc.name,
          original_name: doc.name,
          file_path: filePath,
          file_size: doc.size,
          content_type: doc.type,
          status: 'active',
          is_linked: true,
          processing_status: 'pending',
        });
      } catch (err) {
        console.error('Error processing document:', err);
      }
    }
  };

  const createProducts = async (chatbotId: string) => {
    if (!user || data.products.length === 0) return;

    for (const product of data.products) {
      try {
        await supabase.from('chatbot_products').insert({
          chatbot_id: chatbotId,
          user_id: user.id,
          product_name: product.product_name,
          sku: product.sku || `SKU-${Date.now()}`,
          price: product.price,
          category: product.category || 'General',
          description: product.description || '',
          in_stock: product.in_stock,
          currency: 'MYR',
          is_active: true,
        });
      } catch (err) {
        console.error('Error creating product:', err);
      }
    }
  };

  const createPromotions = async (chatbotId: string) => {
    if (!user || data.promotions.length === 0) return;

    for (const promo of data.promotions) {
      try {
        await supabase.from('chatbot_promotions').insert({
          chatbot_id: chatbotId,
          title: promo.title,
          description: promo.description || '',
          discount_type: promo.discount_type === 'none' ? null : promo.discount_type,
          discount_value: promo.discount_value || null,
          promo_code: promo.promo_code || null,
          start_date: new Date().toISOString(),
          end_date: promo.end_date ? new Date(promo.end_date).toISOString() : null,
          is_active: true,
        });
      } catch (err) {
        console.error('Error creating promotion:', err);
      }
    }
  };

  const completeOnboarding = async () => {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Update profile with onboarding data
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          industry: data.industry || null,
          company_size: data.companySize || null,
          use_case: data.useCase || null,
        })
        .eq('id', user.id);

      // Create chatbot with the generated prompt
      if (data.chatbotName) {
        const hiddenRules = data.hiddenRules || generateDefaultHiddenRules(data);

        // Map onboarding template to chatbot_type
        const getChatbotType = (template: string): string => {
          switch (template) {
            case 'sales': return 'ecommerce';
            case 'booking': return 'appointment';
            case 'support': return 'support';
            default: return 'ecommerce'; // Default to ecommerce
          }
        };

        const chatbotType = getChatbotType(data.chatbotTemplate);

        // Default compliance rules
        const defaultComplianceRules = [
          'Never ask for sensitive data such as passwords, credit card numbers, or SSN',
          'Comply with data privacy regulations (PDPA, GDPR)',
          'No discriminatory language or bias',
          'No political opinions or controversial statements',
          'No medical diagnoses or legal advice',
          'No financial investment recommendations',
        ];

        // Default response guidelines
        const defaultResponseGuidelines = [
          'Maximum response length: 500 words unless customer requests more detail',
          'If unable to help after 3 attempts, suggest human support',
          'Never argue with customers',
          'Only state facts that are in your knowledge base',
          'Use phrases like "Based on my information..." when providing details',
          'Be empathetic when customers express frustration',
        ];

        const { data: chatbotData, error: chatbotError } = await supabase
          .from('avatars')
          .insert({
            user_id: user.id,
            name: data.chatbotName,
            description: `${data.businessName} AI Assistant - Created during onboarding`,
            status: 'active',
            chatbot_type: chatbotType, // Set the mapped chatbot type
            activation_status: 'draft', // Start as draft until user requests setup
            // system_prompt will be generated by admin later
            hidden_rules: hiddenRules,
            primary_language: data.chatbotLanguages[0] || 'en',
            secondary_languages: data.chatbotLanguages.slice(1),
            personality_traits: [data.chatbotTone],
            // Additional chatbot settings
            company_name: data.businessName || null,
            industry: data.industry || null,
            business_context: data.businessDescription || null,
            compliance_rules: defaultComplianceRules,
            response_guidelines: defaultResponseGuidelines,
            supported_languages: data.chatbotLanguages || ['en'],
            default_language: data.chatbotLanguages[0] || 'en',
          })
          .select('id')
          .single();

        if (chatbotError) {
          console.error('Error creating chatbot:', chatbotError);
          throw chatbotError;
        }

        const chatbotId = chatbotData.id;
        setCreatedChatbotId(chatbotId);

        // Note: AI prompt will be generated by admin after user adds content and requests setup

        // Auto-generate platform API key for n8n integration
        try {
          const apiKeyResult = await createPlatformApiKey(
            user.id,
            chatbotId,
            data.chatbotName
          );
          if (apiKeyResult.success) {
            console.log('Platform API key auto-generated for chatbot:', chatbotId);
          } else {
            console.warn('Failed to auto-generate platform API key:', apiKeyResult.error);
          }
        } catch (apiKeyError) {
          console.error('Error creating platform API key:', apiKeyError);
          // Non-critical error, continue with onboarding
        }

        // Upload documents, create products and promotions in parallel
        await Promise.all([
          uploadDocuments(chatbotId),
          createProducts(chatbotId),
          createPromotions(chatbotId),
        ]);
      }

      toast({
        title: 'Welcome aboard!',
        description: 'Your chatbot is ready. Let\'s get started!',
      });

      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete setup. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate progress - exclude welcome and complete steps
  const mainSteps = STEPS.slice(1, -1); // Steps between welcome and complete
  const progress = currentStep === 0 ? 0 : currentStep >= STEPS.length - 1 ? 100 : ((currentStep - 1) / (mainSteps.length - 1)) * 100;

  const CurrentStepComponent = STEPS[currentStep].component;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-background overflow-auto">
      <div className="min-h-screen flex flex-col">
        {/* Progress Bar - Hidden on welcome and completion */}
        {currentStep > 0 && currentStep < STEPS.length - 1 && (
          <div className="sticky top-0 bg-white dark:bg-background border-b z-10">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Step {currentStep} of {mainSteps.length}
                </span>
                <span className="text-sm font-medium">
                  {STEPS[currentStep].label}
                </span>
              </div>
              <Progress value={progress} className="h-2" />

              {/* Step indicators */}
              <div className="flex justify-between mt-4 overflow-x-auto gap-1">
                {mainSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center ${index < mainSteps.length - 1 ? 'flex-1' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors flex-shrink-0 ${
                        index + 1 < currentStep
                          ? 'bg-green-500 text-white'
                          : index + 1 === currentStep
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1 < currentStep ? '✓' : index + 1}
                    </div>
                    {index < mainSteps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-1 min-w-4 ${
                          index + 1 < currentStep ? 'bg-green-500' : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-3xl"
            >
              <CurrentStepComponent
                data={data}
                updateData={updateData}
                onNext={goToNextStep}
                onPrevious={goToPreviousStep}
                onSkip={skipOnboarding}
                onComplete={completeOnboarding}
                isSubmitting={isSubmitting}
                currentStep={currentStep}
                totalSteps={STEPS.length}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
