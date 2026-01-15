import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Upload,
  File,
  FileText,
  Image,
  X,
  CheckCircle2,
  Info,
  AlertCircle
} from 'lucide-react';
import { OnboardingData, OnboardingDocument } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeBaseStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const ACCEPTED_TYPES = [
  { ext: '.pdf', mime: 'application/pdf', label: 'PDF' },
  { ext: '.doc', mime: 'application/msword', label: 'DOC' },
  { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'DOCX' },
  { ext: '.txt', mime: 'text/plain', label: 'TXT' },
  { ext: '.md', mime: 'text/markdown', label: 'MD' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const documentSuggestions = [
  { icon: FileText, title: 'FAQs', description: 'Common questions and answers' },
  { icon: FileText, title: 'Product Guides', description: 'How to use your products' },
  { icon: FileText, title: 'Policies', description: 'Return, shipping, warranty policies' },
  { icon: FileText, title: 'Price Lists', description: 'Detailed pricing information' },
  { icon: FileText, title: 'Company Info', description: 'About us, contact details' },
];

export const KnowledgeBaseStep: React.FC<KnowledgeBaseStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const documents = data.documents || [];

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return FileText;
    if (type.includes('image')) return Image;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    const isValidType = ACCEPTED_TYPES.some(type =>
      file.type === type.mime || file.name.toLowerCase().endsWith(type.ext)
    );

    if (!isValidType) {
      return `Invalid file type. Accepted: ${ACCEPTED_TYPES.map(t => t.label).join(', ')}`;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`;
    }

    // Check for duplicates
    if (documents.some(d => d.name === file.name)) {
      return 'A file with this name already exists';
    }

    return null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError(null);
    const newDocuments: OnboardingDocument[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        newDocuments.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type
        });
      }
    });

    if (newDocuments.length > 0) {
      updateData({ documents: [...documents, ...newDocuments] });
      toast({
        title: 'Documents Added',
        description: `Added ${newDocuments.length} document(s) to upload.`,
      });
    }

    if (errors.length > 0) {
      setUploadError(errors.join('\n'));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveDocument = (index: number) => {
    const updated = documents.filter((_, i) => i !== index);
    updateData({ documents: updated });
  };

  const handleSkip = () => {
    updateData({ documents: [] });
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Upload Knowledge Base</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Upload documents that your chatbot can reference to answer customer questions accurately.
          This step is optional.
        </p>
      </div>

      {/* Document Suggestions */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                What documents to upload?
              </h4>
              <div className="flex flex-wrap gap-2">
                {documentSuggestions.map((doc, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {doc.title}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className={cn(
          "w-12 h-12 mx-auto mb-4",
          isDragging ? "text-primary" : "text-muted-foreground"
        )} />
        <h3 className="font-semibold mb-2">
          {isDragging ? 'Drop files here!' : 'Drag & Drop Files'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.map(t => t.ext).join(',')}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="doc-upload"
        />
        <Button variant="outline" asChild>
          <label htmlFor="doc-upload" className="cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Select Files
          </label>
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Supported: {ACCEPTED_TYPES.map(t => t.label).join(', ')} (Max {formatFileSize(MAX_FILE_SIZE)} per file)
        </p>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
              {uploadError}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      {documents.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Documents to Upload ({documents.length})</h4>
              <Badge variant="outline" className="text-green-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ready
              </Badge>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {documents.map((doc, index) => {
                const FileIcon = getFileIcon(doc.type);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDocument(index)}
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-red-500" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSkip}>
            Skip for Now
          </Button>
          <Button onClick={onNext}>
            {documents.length > 0 ? 'Continue' : 'Skip'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseStep;
