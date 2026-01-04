import { useTranslation } from 'react-i18next';
import { ChatbotFormData } from './ChatbotCreationWizard';
import { FileText, Upload, X, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface Step3Props {
  formData: ChatbotFormData;
  updateFormData: (updates: Partial<ChatbotFormData>) => void;
  language: string;
}

export function Step3KnowledgeUpload({ formData, updateFormData, language }: Step3Props) {
  const { t } = useTranslation();

  const handleKnowledgeFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      updateFormData({
        knowledgeFiles: [...formData.knowledgeFiles, ...newFiles],
      });
    }
  };

  const handleRemoveKnowledgeFile = (index: number) => {
    const updatedFiles = formData.knowledgeFiles.filter((_, i) => i !== index);
    updateFormData({ knowledgeFiles: updatedFiles });
  };

  const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      updateFormData({ productExcelFile: e.target.files[0] });
    }
  };

  const handleRemoveProductFile = () => {
    updateFormData({ productExcelFile: null });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('wizard.step3Title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">{t('wizard.step3Description')}</p>
      </div>

      <div className="space-y-8">
        {/* Knowledge Base Files Section */}
        <div>
          <div className="flex items-center mb-4">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('wizard.knowledgeBase')}
            </h3>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <div className="text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {t('wizard.uploadKnowledgeFiles')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                {t('wizard.supportedFormats')}: PDF, TXT, DOCX, MD
              </p>
              <label
                htmlFor="knowledgeFiles"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                {t('wizard.selectFiles')}
              </label>
              <input
                type="file"
                id="knowledgeFiles"
                multiple
                accept=".pdf,.txt,.docx,.md"
                onChange={handleKnowledgeFilesChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Knowledge Files List */}
          {formData.knowledgeFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('wizard.uploadedFiles')} ({formData.knowledgeFiles.length})
              </p>
              {formData.knowledgeFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveKnowledgeFile(index)}
                    className="ml-4 p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {t('wizard.knowledgeOptional')}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('wizard.knowledgeOptionalDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Product Catalog Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <div className="flex items-center mb-4">
            <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('wizard.productCatalog')}
            </h3>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            {!formData.productExcelFile ? (
              <div className="text-center">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('wizard.uploadProductExcel')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                  {t('wizard.excelFormat')}: .xlsx, .xls
                </p>
                <label
                  htmlFor="productExcel"
                  className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors"
                >
                  {t('wizard.selectExcelFile')}
                </label>
                <input
                  type="file"
                  id="productExcel"
                  accept=".xlsx,.xls"
                  onChange={handleProductFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center flex-1 min-w-0">
                  <FileSpreadsheet className="w-6 h-6 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {formData.productExcelFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(formData.productExcelFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveProductFile}
                  className="ml-4 p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Excel Template Download */}
          <div className="mt-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                  {t('wizard.excelTemplateAvailable')}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                  {t('wizard.excelTemplateDesc')}
                </p>
                <button className="text-sm text-green-700 dark:text-green-300 underline hover:text-green-800 dark:hover:text-green-200">
                  {t('wizard.downloadTemplate')}
                </button>
              </div>
            </div>
          </div>

          {/* Product Upload Info */}
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2 font-medium">{t('wizard.requiredColumns')}:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>SKU - {t('wizard.uniqueProductCode')}</li>
              <li>Product Name - {t('wizard.productName')}</li>
              <li>Description - {t('wizard.productDescription')}</li>
              <li>Price - {t('wizard.productPrice')}</li>
              <li>Category - {t('wizard.productCategory')}</li>
              <li>Stock - {t('wizard.stockQuantity')} ({t('wizard.optional')})</li>
              <li>Image URL - {t('wizard.productImage')} ({t('wizard.optional')})</li>
            </ul>
          </div>
        </div>

        {/* Summary Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('wizard.readyToCreate')}
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('wizard.industry')}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formData.selectedTemplate?.industry || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('wizard.chatbotName')}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formData.chatbotName || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('wizard.companyName')}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formData.companyName || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('wizard.languages')}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formData.supportedLanguages.map((l) => l.toUpperCase()).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('wizard.knowledgeFiles')}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formData.knowledgeFiles.length} {t('wizard.files')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('wizard.productCatalog')}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formData.productExcelFile ? t('wizard.uploaded') : t('wizard.notUploaded')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
