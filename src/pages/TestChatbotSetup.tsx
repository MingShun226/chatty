import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { TemplateService, ChatbotTemplate } from '@/services/templateService';
import { Loader2 } from 'lucide-react';

export default function TestChatbotSetup() {
  const { t, i18n } = useTranslation();
  const [templates, setTemplates] = useState<ChatbotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ChatbotTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await TemplateService.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('wizard.title')} - Test Page
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Testing multi-language support and template fetching
            </p>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Current Language Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Language Test
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Language</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {i18n.language}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Common.Save</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {t('common.save')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Common.Cancel</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {t('common.cancel')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Wizard.Step1</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {t('wizard.step1')}
              </p>
            </div>
          </div>
        </div>

        {/* Templates Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Industry Templates ({templates.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Loading templates...
              </span>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                No templates found. Make sure you ran the database migration.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                >
                  <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                    {TemplateService.getLocalizedName(template, i18n.language)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {TemplateService.getLocalizedDescription(template, i18n.language)}
                  </p>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                      {template.industry}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 rounded text-blue-700 dark:text-blue-300">
                      {template.supported_languages.join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Template Details */}
        {selectedTemplate && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Template Details: {TemplateService.getLocalizedName(selectedTemplate, i18n.language)}
            </h2>

            <div className="space-y-4">
              {/* Business Context */}
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Business Context
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                  {TemplateService.getLocalizedBusinessContext(selectedTemplate, i18n.language)}
                </p>
              </div>

              {/* Compliance Rules */}
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Compliance Rules
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {TemplateService.getLocalizedComplianceRules(selectedTemplate, i18n.language).map((rule, idx) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Response Guidelines */}
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Response Guidelines
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {TemplateService.getLocalizedResponseGuidelines(selectedTemplate, i18n.language).map((guideline, idx) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                      {guideline}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sample Greetings */}
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sample Greetings
                </h3>
                <div className="flex flex-wrap gap-2">
                  {TemplateService.getLocalizedGreetings(selectedTemplate, i18n.language).map((greeting, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
                      {greeting}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
