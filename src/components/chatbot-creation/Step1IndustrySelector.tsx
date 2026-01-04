import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TemplateService, ChatbotTemplate } from '@/services/templateService';
import { Loader2, Briefcase, ShoppingCart, Home, Calendar, Check } from 'lucide-react';
import { ChatbotFormData } from './ChatbotCreationWizard';

interface Step1Props {
  formData: ChatbotFormData;
  updateFormData: (updates: Partial<ChatbotFormData>) => void;
  language: string;
}

const industryIcons: Record<string, any> = {
  customer_service: Briefcase,
  ecommerce: ShoppingCart,
  real_estate: Home,
  appointment: Calendar,
};

export function Step1IndustrySelector({ formData, updateFormData, language }: Step1Props) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<ChatbotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TemplateService.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: ChatbotTemplate) => {
    updateFormData({
      selectedTemplate: template,
      industry: template.industry,
      supportedLanguages: template.supported_languages,
      defaultLanguage: template.default_language,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{t('wizard.loadingTemplates')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-4">
          <p className="text-red-700 dark:text-red-400 font-medium mb-2">{t('common.error')}</p>
          <p className="text-red-600 dark:text-red-500 text-sm">{error}</p>
        </div>
        <button
          onClick={loadTemplates}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('common.tryAgain')}
        </button>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('wizard.noTemplatesFound')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          {t('wizard.checkDatabaseMigration')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('wizard.step1Title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">{t('wizard.step1Description')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => {
          const Icon = industryIcons[template.industry] || Briefcase;
          const isSelected = formData.selectedTemplate?.id === template.id;

          return (
            <div
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
              }`}
            >
              {/* Selected Badge */}
              {isSelected && (
                <div className="absolute top-4 right-4 bg-blue-600 text-white rounded-full p-1">
                  <Check className="w-4 h-4" />
                </div>
              )}

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {TemplateService.getLocalizedName(template, language)}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {TemplateService.getLocalizedDescription(template, language)}
              </p>

              {/* Languages Supported */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                  {template.industry}
                </span>
                {template.supported_languages.map((lang) => (
                  <span
                    key={lang}
                    className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-700 dark:text-purple-300"
                  >
                    {lang.toUpperCase()}
                  </span>
                ))}
              </div>

              {/* Sample Greetings Preview */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                  {t('wizard.sampleGreeting')}:
                </p>
                <p className="text-sm italic text-gray-700 dark:text-gray-300">
                  "{TemplateService.getLocalizedGreetings(template, language)[0]}"
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Template Details */}
      {formData.selectedTemplate && (
        <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            {t('wizard.selectedTemplateDetails')}
          </h3>

          <div className="space-y-3">
            {/* Compliance Rules */}
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                {t('wizard.complianceRules')}:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {TemplateService.getLocalizedComplianceRules(
                  formData.selectedTemplate,
                  language
                )
                  .slice(0, 2)
                  .map((rule, idx) => (
                    <li key={idx} className="text-sm text-blue-700 dark:text-blue-300">
                      {rule}
                    </li>
                  ))}
              </ul>
              {TemplateService.getLocalizedComplianceRules(
                formData.selectedTemplate,
                language
              ).length > 2 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  +{' '}
                  {TemplateService.getLocalizedComplianceRules(
                    formData.selectedTemplate,
                    language
                  ).length - 2}{' '}
                  {t('common.more')}
                </p>
              )}
            </div>

            {/* Response Guidelines */}
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                {t('wizard.responseGuidelines')}:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {TemplateService.getLocalizedResponseGuidelines(
                  formData.selectedTemplate,
                  language
                )
                  .slice(0, 2)
                  .map((guideline, idx) => (
                    <li key={idx} className="text-sm text-blue-700 dark:text-blue-300">
                      {guideline}
                    </li>
                  ))}
              </ul>
              {TemplateService.getLocalizedResponseGuidelines(
                formData.selectedTemplate,
                language
              ).length > 2 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  +{' '}
                  {TemplateService.getLocalizedResponseGuidelines(
                    formData.selectedTemplate,
                    language
                  ).length - 2}{' '}
                  {t('common.more')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
