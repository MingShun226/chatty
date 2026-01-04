import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChatbotTemplate } from '@/services/templateService';

// Import wizard steps
import { Step1IndustrySelector } from './Step1IndustrySelector';
import { Step2BasicInfo } from './Step2BasicInfo';
import { Step3KnowledgeUpload } from './Step3KnowledgeUpload';

// Import icons
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

export interface ChatbotFormData {
  // Step 1: Template Selection
  selectedTemplate: ChatbotTemplate | null;
  industry: string;

  // Step 2: Basic Information
  chatbotName: string;
  companyName: string;
  businessDescription: string;
  supportedLanguages: string[];
  defaultLanguage: string;

  // Step 3: Knowledge & Products (to be uploaded after creation)
  knowledgeFiles: File[];
  productExcelFile: File | null;
}

interface ChatbotCreationWizardProps {
  onComplete?: (chatbotId: string) => void;
}

const INITIAL_FORM_DATA: ChatbotFormData = {
  selectedTemplate: null,
  industry: '',
  chatbotName: '',
  companyName: '',
  businessDescription: '',
  supportedLanguages: ['en'],
  defaultLanguage: 'en',
  knowledgeFiles: [],
  productExcelFile: null,
};

export function ChatbotCreationWizard({ onComplete }: ChatbotCreationWizardProps = {}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ChatbotFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);

  const steps = [
    { number: 1, title: t('wizard.step1'), description: t('wizard.step1Desc') },
    { number: 2, title: t('wizard.step2'), description: t('wizard.step2Desc') },
    { number: 3, title: t('wizard.step3'), description: t('wizard.step3Desc') },
  ];

  // Update form data
  const updateFormData = (updates: Partial<ChatbotFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validation for each step
  const canProceedToStep2 = () => {
    return formData.selectedTemplate !== null && formData.industry !== '';
  };

  const canProceedToStep3 = () => {
    return (
      formData.chatbotName.trim() !== '' &&
      formData.companyName.trim() !== '' &&
      formData.businessDescription.trim() !== '' &&
      formData.supportedLanguages.length > 0
    );
  };

  const canSubmit = () => {
    return canProceedToStep2() && canProceedToStep3();
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (!canSubmit()) {
      toast({
        title: t('common.error'),
        description: t('wizard.pleaseCompleteAllSteps'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Prepare business context from template
      const businessContext = formData.selectedTemplate
        ? formData.selectedTemplate[`business_context_template_${i18n.language}` as keyof ChatbotTemplate] ||
          formData.selectedTemplate.business_context_template_en
        : formData.businessDescription;

      const businessContextWithCompany =
        typeof businessContext === 'string'
          ? businessContext.replace(/\[COMPANY_NAME\]/g, formData.companyName)
          : formData.businessDescription;

      // Get compliance rules and response guidelines from template
      const complianceRules = formData.selectedTemplate
        ? formData.selectedTemplate[`compliance_rules_${i18n.language}` as keyof ChatbotTemplate] ||
          formData.selectedTemplate.compliance_rules_en
        : [];

      const responseGuidelines = formData.selectedTemplate
        ? formData.selectedTemplate[`response_guidelines_${i18n.language}` as keyof ChatbotTemplate] ||
          formData.selectedTemplate.response_guidelines_en
        : [];

      // Create chatbot in database
      const { data: newChatbot, error: createError } = await supabase
        .from('avatars')
        .insert({
          user_id: user.id,
          name: formData.chatbotName,
          chatbot_type: 'business',
          industry: formData.industry,
          company_name: formData.companyName,
          business_context: businessContextWithCompany,
          compliance_rules: Array.isArray(complianceRules) ? complianceRules : [],
          response_guidelines: Array.isArray(responseGuidelines) ? responseGuidelines : [],
          supported_languages: formData.supportedLanguages,
          default_language: formData.defaultLanguage,
          tone_settings: formData.selectedTemplate?.tone_settings || {},
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      toast({
        title: t('common.success'),
        description: t('wizard.chatbotCreatedSuccess'),
      });

      // Call onComplete callback if provided, otherwise navigate
      if (onComplete) {
        onComplete(newChatbot.id);
      } else {
        // Navigate to chatbot studio for further configuration
        navigate(`/chatbot-studio?id=${newChatbot.id}`);
      }
    } catch (error: any) {
      console.error('Error creating chatbot:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('wizard.chatbotCreationFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('wizard.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('wizard.subtitle')}</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      currentStep > step.number
                        ? 'bg-green-500 text-white'
                        : currentStep === step.number
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
                  </div>
                  <div className="mt-2 text-center">
                    <p
                      className={`text-sm font-medium ${
                        currentStep === step.number
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 rounded transition-colors ${
                      currentStep > step.number
                        ? 'bg-green-500'
                        : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-6">
          {currentStep === 1 && (
            <Step1IndustrySelector
              formData={formData}
              updateFormData={updateFormData}
              language={i18n.language}
            />
          )}

          {currentStep === 2 && (
            <Step2BasicInfo
              formData={formData}
              updateFormData={updateFormData}
              language={i18n.language}
            />
          )}

          {currentStep === 3 && (
            <Step3KnowledgeUpload
              formData={formData}
              updateFormData={updateFormData}
              language={i18n.language}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousStep}
            disabled={currentStep === 1}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              currentStep === 1
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            {t('common.back')}
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('common.cancel')}
            </button>

            {currentStep < 3 ? (
              <button
                onClick={goToNextStep}
                disabled={
                  (currentStep === 1 && !canProceedToStep2()) ||
                  (currentStep === 2 && !canProceedToStep3())
                }
                className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                  (currentStep === 1 && !canProceedToStep2()) ||
                  (currentStep === 2 && !canProceedToStep3())
                    ? 'bg-blue-300 dark:bg-blue-800 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {t('common.next')}
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit() || loading}
                className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                  !canSubmit() || loading
                    ? 'bg-blue-300 dark:bg-blue-800 text-white cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {loading ? t('common.creating') : t('wizard.createChatbot')}
                {loading && <div className="ml-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
