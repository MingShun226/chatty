
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Download,
  Plus,
  Trash2,
  Link,
  Unlink,
  FileText,
  Database,
  RefreshCw,
  Brain,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
  Share2,
  Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ProcessDocumentButton } from '../knowledge-base/ProcessDocumentButton';
import { RAGService } from '@/services/ragService';

interface KnowledgeFile {
  id: string;
  name: string;
  size: string;
  type: string;
  linked: boolean;
  shareable: boolean;
  uploadedAt: string;
  file?: File;
  processingStatus?: 'pending' | 'processing' | 'processed' | 'error';
  extractedText?: string;
  contentType?: string;
  filePath?: string;
}

interface KnowledgeBaseProps {
  avatarId: string;
  isTraining: boolean;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  avatarId,
  isTraining
}) => {
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<KnowledgeFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [togglingShareable, setTogglingShareable] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load files automatically when component mounts or avatarId changes
  // Use user?.id instead of user to prevent reloading when user object reference changes (e.g., on token refresh)
  useEffect(() => {
    if (avatarId && user) {
      loadKnowledgeFiles();
    }
  }, [avatarId, user?.id]);

  // Set up real-time updates for knowledge files
  // Use user?.id instead of user to prevent re-subscribing when user object reference changes
  useEffect(() => {
    if (!avatarId || !user) return;

    const channel = supabase
      .channel('knowledge-files-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avatar_knowledge_files',
          filter: `avatar_id=eq.${avatarId}`
        },
        (payload) => {
          console.log('Knowledge files updated via realtime:', payload);
          // Reload files when there are changes
          loadKnowledgeFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [avatarId, user?.id]);

  // Auto-process PDF for RAG
  const processFileForRAG = async (fileId: string, fileName: string) => {
    try {
      setProcessingFiles(prev => new Set(prev).add(fileId));

      // Update status to processing (or pending if constraint doesn't allow processing)
      try {
        await supabase
          .from('avatar_knowledge_files')
          .update({ processing_status: 'processing' })
          .eq('id', fileId);
      } catch (constraintError) {
        // If 'processing' status is not allowed, keep as 'pending'
        console.warn('Could not set processing status, keeping as pending:', constraintError);
      }

      // Extract text from PDF using our PDF extractor
      const { PDFExtractor } = await import('@/utils/pdfExtractor');

      // Get file from storage
      const { data: fileData } = await supabase
        .from('avatar_knowledge_files')
        .select('file_path')
        .eq('id', fileId)
        .single();

      if (!fileData?.file_path) {
        throw new Error('File path not found');
      }

      // Download file blob
      const { data: blob, error: downloadError } = await supabase.storage
        .from('knowledge-base')
        .download(fileData.file_path);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      // Convert blob to File object
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // Extract text
      const extractionResult = await PDFExtractor.extractTextFromFile(file);
      const extractedText = PDFExtractor.cleanExtractedText(extractionResult.text);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text could be extracted from the PDF');
      }

      // Process with RAG
      await RAGService.processDocument(
        user!.id,
        avatarId,
        fileId,
        extractedText,
        fileName
      );

      toast({
        title: "Processing Complete",
        description: `${fileName} has been processed and is now available for intelligent responses.`,
      });

      // Refresh files to show updated status
      await loadKnowledgeFiles();

    } catch (error) {
      console.error('Auto-processing error:', error);

      // Update status to error
      try {
        await supabase
          .from('avatar_knowledge_files')
          .update({ processing_status: 'error' })
          .eq('id', fileId);
      } catch (updateError) {
        console.error('Could not update status to error:', updateError);
      }

      toast({
        title: "Processing Failed",
        description: `Failed to process ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });

      // Refresh files to show updated status
      await loadKnowledgeFiles();
    } finally {
      setProcessingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const loadKnowledgeFiles = async () => {
    setIsLoading(true);
    try {
      console.log('Loading knowledge files for avatar:', avatarId);

      // Load uploaded knowledge files from database
      const { data: uploadedFiles, error: uploadedError } = await supabase
        .from('avatar_knowledge_files')
        .select('id, file_name, original_name, file_size, content_type, is_linked, shareable, uploaded_at, processing_status, extracted_text, file_path')
        .eq('avatar_id', avatarId)
        .eq('user_id', user?.id)
        .order('uploaded_at', { ascending: false });

      if (uploadedError) {
        console.error('Error loading uploaded knowledge files:', uploadedError);
      }

      // Convert uploaded files to KnowledgeFile format
      let allFiles: KnowledgeFile[] = [];
      if (uploadedFiles) {
        allFiles = uploadedFiles.map((file) => ({
          id: file.id,
          name: file.original_name || file.file_name,
          size: `${(file.file_size / (1024 * 1024)).toFixed(2)} MB`,
          type: 'PDF',
          linked: file.is_linked,
          shareable: file.shareable ?? false,
          uploadedAt: file.uploaded_at,
          processingStatus: file.processing_status || 'pending',
          extractedText: file.extracted_text,
          contentType: file.content_type,
          filePath: file.file_path
        }));
      }

      console.log('Loaded knowledge files:', allFiles);
      setKnowledgeFiles(allFiles);
    } catch (error) {
      console.error('Error loading knowledge files:', error);
      toast({
        title: "Error Loading Files",
        description: "Failed to load knowledge base files.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const pdfFiles = files.filter(file => 
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (pdfFiles.length !== files.length) {
      toast({
        title: "Invalid File Type",
        description: "Only PDF files are allowed in the knowledge base.",
        variant: "destructive"
      });
      return;
    }

    // Validate file sizes (50MB limit)
    const oversizedFiles = pdfFiles.filter(file => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File Too Large",
        description: `Files must be under 50MB. ${oversizedFiles.map(f => f.name).join(', ')} exceeded the limit.`,
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = pdfFiles.map(async (file) => {
        // Upload to Supabase storage
        const fileName = `${user?.id}/${avatarId}/${Date.now()}-${file.name}`;
        
        console.log('Uploading file to storage:', fileName);
        const { data: storageData, error: storageError } = await supabase.storage
          .from('knowledge-base')
          .upload(fileName, file);

        if (storageError) {
          console.error('Storage upload error:', storageError);
          throw new Error(`Failed to upload ${file.name}: ${storageError.message}`);
        }

        console.log('File uploaded to storage successfully:', storageData);

        // Save file metadata to database
        const insertData = {
          avatar_id: avatarId,
          user_id: user?.id,
          file_name: file.name,
          original_name: file.name,
          file_path: storageData.path,
          file_size: file.size,
          content_type: file.type || 'application/pdf',
          is_linked: true,
          processing_status: 'pending'
        };

        console.log('Inserting file metadata:', insertData);

        const { data: dbData, error: dbError } = await supabase
          .from('avatar_knowledge_files')
          .insert(insertData)
          .select()
          .single();

        if (dbError) {
          console.error('Database insert error:', dbError);
          // Try to clean up uploaded file
          await supabase.storage.from('knowledge-base').remove([fileName]);
          throw new Error(`Failed to save ${file.name} metadata: ${dbError.message}`);
        }

        console.log('File metadata saved successfully:', dbData);
        return dbData;
      });

      const results = await Promise.all(uploadPromises);

      toast({
        title: "Upload Successful",
        description: `${results.length} file(s) uploaded successfully. Auto-processing for RAG has started.`,
      });

      // Reload knowledge files to show the new uploads
      await loadKnowledgeFiles();

      // Auto-process each uploaded file for RAG
      results.forEach(async (fileData) => {
        try {
          await processFileForRAG(fileData.id, fileData.original_name || fileData.file_name);
        } catch (error) {
          console.error(`Failed to auto-process ${fileData.file_name}:`, error);
        }
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred during upload.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleLinkStatus = async (fileId: string) => {
    if (isTraining) {
      toast({
        title: "Cannot Modify During Training",
        description: "Please wait for training to complete before modifying knowledge base.",
        variant: "destructive"
      });
      return;
    }

    const file = knowledgeFiles.find(f => f.id === fileId);
    if (!file) return;

    try {
      const newLinked = !file.linked;
      
      const { error } = await supabase
        .from('avatar_knowledge_files')
        .update({ is_linked: newLinked })
        .eq('id', fileId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating link status:', error);
        toast({
          title: "Update Failed",
          description: "Failed to update file link status.",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setKnowledgeFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, linked: newLinked } : f)
      );

      toast({
        title: newLinked ? "File Linked" : "File Unlinked",
        description: newLinked
          ? `${file.name} is now available to your avatar.`
          : `${file.name} has been removed from avatar's knowledge.`,
      });
    } catch (error) {
      console.error('Error updating file:', error);
      toast({
        title: "Update Failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  const toggleShareable = async (fileId: string) => {
    if (isTraining) {
      toast({
        title: "Cannot Modify During Training",
        description: "Please wait for training to complete before modifying knowledge base.",
        variant: "destructive"
      });
      return;
    }

    const file = knowledgeFiles.find(f => f.id === fileId);
    if (!file) return;

    try {
      setTogglingShareable(prev => new Set(prev).add(fileId));
      const newShareable = !file.shareable;

      const { error } = await supabase
        .from('avatar_knowledge_files')
        .update({ shareable: newShareable })
        .eq('id', fileId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating shareable status:', error);
        toast({
          title: "Update Failed",
          description: "Failed to update document sharing status.",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setKnowledgeFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, shareable: newShareable } : f)
      );

      toast({
        title: newShareable ? "Document Shareable" : "Document Private",
        description: newShareable
          ? `${file.name} can now be shared with customers when they ask for it.`
          : `${file.name} is now private and won't be shared with customers.`,
      });
    } catch (error) {
      console.error('Error updating shareable status:', error);
      toast({
        title: "Update Failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setTogglingShareable(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const handleDownload = async (file: KnowledgeFile) => {
    try {
      // Get the file from database to find the storage path
      const { data: fileData, error } = await supabase
        .from('avatar_knowledge_files')
        .select('file_path')
        .eq('id', file.id)
        .single();

      if (error || !fileData) {
        throw new Error('File not found');
      }

      // Download from storage
      const { data: blob, error: downloadError } = await supabase.storage
        .from('knowledge-base')
        .download(fileData.file_path);

      if (downloadError) {
        throw new Error(downloadError.message);
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download the file.",
        variant: "destructive"
      });
    }
  };

  const confirmDelete = (file: KnowledgeFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handlePreview = async (file: KnowledgeFile) => {
    try {
      if (!file.filePath) {
        throw new Error('File path not found');
      }

      // Get signed URL for preview
      const { data: signedUrlData, error } = await supabase.storage
        .from('knowledge-base')
        .createSignedUrl(file.filePath, 3600); // 1 hour expiry

      if (error) {
        throw new Error(error.message);
      }

      // Open PDF in new window
      window.open(signedUrlData.signedUrl, '_blank');

    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: "Preview Failed",
        description: "Failed to open PDF preview.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!fileToDelete || isTraining) return;

    try {
      // Get file path for storage deletion
      const { data: fileData } = await supabase
        .from('avatar_knowledge_files')
        .select('file_path')
        .eq('id', fileToDelete.id)
        .single();

      // Delete from database first
      const { error: dbError } = await supabase
        .from('avatar_knowledge_files')
        .delete()
        .eq('id', fileToDelete.id)
        .eq('user_id', user?.id);

      if (dbError) {
        throw new Error(dbError.message);
      }

      // Delete from storage (ignore errors since file might not exist)
      if (fileData?.file_path) {
        await supabase.storage
          .from('knowledge-base')
          .remove([fileData.file_path]);
      }

      // Update local state
      setKnowledgeFiles(prev => prev.filter(file => file.id !== fileToDelete.id));
      
      toast({
        title: "File Deleted",
        description: `${fileToDelete.name} has been permanently removed.`,
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the file. Please try again.",
        variant: "destructive"
      });
    }
    
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  const linkedCount = knowledgeFiles.filter(file => file.linked).length;
  const totalCount = knowledgeFiles.length;

  return (
    <>
      <Card className="card-modern">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Knowledge Base
                <Badge variant="outline" className="text-xs">
                  Real-time Updates
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage PDF documents for your avatar's knowledge
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {linkedCount}/{totalCount} linked
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadKnowledgeFiles}
                disabled={isTraining || isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTraining || isUploading}
              >
                <Plus className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload PDF'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="space-y-4">
            {/* Upload Area - Show when no files */}
            {knowledgeFiles.length === 0 && !isLoading && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Upload Knowledge Documents</h3>
                <p className="text-muted-foreground mb-4">
                  Add PDF documents to give your avatar specialized knowledge
                </p>
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-hero"
                  disabled={isTraining || isUploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Choose PDF Files'}
                </Button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Loading knowledge files...</span>
              </div>
            )}

            {/* Files List */}
            {knowledgeFiles.length > 0 && !isLoading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Knowledge Documents ({knowledgeFiles.length})</h4>
                  {(isTraining || isUploading) && (
                    <Badge variant="destructive" className="text-xs">
                      {isTraining ? 'Training in progress' : 'Upload in progress'} - modifications disabled
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2">
                  {knowledgeFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge
                              variant={file.linked ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {file.linked ? "Linked" : "Not Linked"}
                            </Badge>

                            {/* Shareable Status */}
                            <Badge
                              variant={file.shareable ? "default" : "secondary"}
                              className={`text-xs gap-1 ${file.shareable ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}`}
                            >
                              {file.shareable ? (
                                <>
                                  <Share2 className="h-3 w-3" />
                                  Shareable
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3" />
                                  Private
                                </>
                              )}
                            </Badge>

                            {/* RAG Processing Status */}
                            <Badge
                              variant={
                                file.processingStatus === 'processed' ? "default" :
                                file.processingStatus === 'processing' ? "secondary" :
                                file.processingStatus === 'error' ? "destructive" : "outline"
                              }
                              className="text-xs gap-1"
                            >
                              {file.processingStatus === 'processed' ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  RAG Ready
                                </>
                              ) : file.processingStatus === 'processing' || processingFiles.has(file.id) ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Processing...
                                </>
                              ) : file.processingStatus === 'error' ? (
                                <>
                                  <AlertCircle className="h-3 w-3" />
                                  Processing Failed
                                </>
                              ) : (
                                <>
                                  <Brain className="h-3 w-3" />
                                  Queued for Processing
                                </>
                              )}
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                              {new Date(file.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(file)}
                          title="Preview PDF"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleShareable(file.id)}
                          disabled={isTraining || isUploading || togglingShareable.has(file.id)}
                          title={file.shareable ? "Make private (won't send to customers)" : "Make shareable (can send to customers)"}
                          className={file.shareable ? "text-green-600 hover:text-green-700 hover:bg-green-50" : ""}
                        >
                          {togglingShareable.has(file.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : file.shareable ? (
                            <Share2 className="h-4 w-4" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleLinkStatus(file.id)}
                          disabled={isTraining || isUploading}
                          title={file.linked ? "Unlink from knowledge base" : "Link to knowledge base"}
                        >
                          {file.linked ? (
                            <Unlink className="h-4 w-4" />
                          ) : (
                            <Link className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          title="Download file"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDelete(file)}
                          disabled={isTraining || isUploading}
                          className="text-destructive hover:text-destructive"
                          title="Delete file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Intelligent Knowledge Base</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Auto-Processing:</strong> PDFs are automatically processed with AI embeddings upon upload</li>
                <li>• <strong>Preview:</strong> View PDF content directly in your browser</li>
                <li>• <strong>Smart Linking:</strong> Link/unlink documents to control your avatar's knowledge access</li>
                <li>• <strong>RAG Ready:</strong> Processed documents enable intelligent, context-aware responses</li>
                <li>• <strong>Real-time Updates:</strong> Changes are immediately reflected in conversations</li>
                <li>• Only linked documents are accessible during avatar conversations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Knowledge File"
        description="Are you sure you want to permanently delete"
        itemName={fileToDelete?.name}
      />
    </>
  );
};
