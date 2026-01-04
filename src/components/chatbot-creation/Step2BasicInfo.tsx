import { useTranslation } from 'react-i18next';
import { ChatbotFormData } from './ChatbotCreationWizard';
import { Info } from 'lucide-react';

interface Step2Props {
  formData: ChatbotFormData;
  updateFormData: (updates: Partial<ChatbotFormData>) => void;
  language: string;
}

export function Step2BasicInfo({ formData, updateFormData, language }: Step2Props) {
  const { t } = useTranslation();

  const handleLanguageToggle = (lang: string) => {
    const currentLanguages = formData.supportedLanguages;
    if (currentLanguages.includes(lang)) {
      // Don't allow removing the default language
      if (lang === formData.defaultLanguage) {
        return;
      }
      updateFormData({
        supportedLanguages: currentLanguages.filter((l) => l !== lang),
      });
    } else {
      updateFormData({
        supportedLanguages: [...currentLanguages, lang],
      });
    }
  };

  const handleDefaultLanguageChange = (lang: string) => {
    // Make sure the language is in supported languages
    if (!formData.supportedLanguages.includes(lang)) {
      updateFormData({
        supportedLanguages: [...formData.supportedLanguages, lang],
        defaultLanguage: lang,
      });
    } else {
      updateFormData({
        defaultLanguage: lang,
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('wizard.step2Title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">{t('wizard.step2Description')}</p>
      </div>

      <div className="space-y-6">
        {/* Chatbot Name */}
        <div>
          <label
            htmlFor="chatbotName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t('wizard.chatbotName')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="chatbotName"
            value={formData.chatbotName}
            onChange={(e) => updateFormData({ chatbotName: e.target.value })}
            placeholder={t('wizard.chatbotNamePlaceholder')}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('wizard.chatbotNameHelp')}
          </p>
        </div>

        {/* Company Name */}
        <div>
          <label
            htmlFor="companyName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t('wizard.companyName')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="companyName"
            value={formData.companyName}
            onChange={(e) => updateFormData({ companyName: e.target.value })}
            placeholder={t('wizard.companyNamePlaceholder')}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          />
        </div>

        {/* Business Description */}
        <div>
          <label
            htmlFor="businessDescription"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t('wizard.businessDescription')} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="businessDescription"
            value={formData.businessDescription}
            onChange={(e) => updateFormData({ businessDescription: e.target.value })}
            placeholder={t('wizard.businessDescriptionPlaceholder')}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            required
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('wizard.businessDescriptionHelp')}
          </p>
        </div>

        {/* Language Support */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('wizard.supportedLanguages')} <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {t('wizard.supportedLanguagesHelp')}
            </p>
          </div>

          {/* Language Checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { code: 'en', label: 'English', flag: '🇬🇧' },
              { code: 'ms', label: 'Bahasa Malaysia', flag: '🇲🇾' },
              { code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
            ].map((lang) => (
              <div
                key={lang.code}
                onClick={() => handleLanguageToggle(lang.code)}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.supportedLanguages.includes(lang.code)
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.supportedLanguages.includes(lang.code)}
                  onChange={() => {}}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mr-3"
                  disabled={lang.code === formData.defaultLanguage}
                />
                <span className="text-2xl mr-3">{lang.flag}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {lang.label}
                </span>
              </div>
            ))}
          </div>

          {/* Default Language Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('wizard.defaultLanguage')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.defaultLanguage}
              onChange={(e) => handleDefaultLanguageChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {formData.supportedLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'en' && 'English'}
                  {lang === 'ms' && 'Bahasa Malaysia'}
                  {lang === 'zh' && '中文 (Chinese)'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('wizard.defaultLanguageHelp')}
            </p>
          </div>
        </div>

        {/* Template Info Box */}
        {formData.selectedTemplate && (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {t('wizard.templateApplied')}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('wizard.templateAppliedDesc')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
