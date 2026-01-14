import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ms', label: 'Bahasa', flag: '🇲🇾' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
  ];

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <Globe className="w-4 h-4" />
        <span className="text-sm font-medium">
          {languages.find(lang => lang.code === i18n.language)?.label || 'English'}
        </span>
      </button>
  
      {/* Dropdown */}
      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors first:rounded-t-lg last:rounded-b-lg ${
              i18n.language === lang.code
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="text-xl">{lang.flag}</span>
            <span>{lang.label}</span>
            {i18n.language === lang.code && (
              <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
