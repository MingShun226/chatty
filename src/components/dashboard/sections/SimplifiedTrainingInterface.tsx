/**
 * Simplified Training Interface
 * Clear, step-by-step workflow for training avatars
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { Alert, AlertDescription } from '../../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Info
} from 'lucide-react';

import { TrainingService } from '../../../services/trainingService';
import { FineTuneService } from '../../../services/fineTuneService';
import { PromptModificationInterface } from './PromptModificationInterface';
import { WhatsAppParserService, WhatsAppParseResult } from '../../../services/whatsappParserService';

interface SimplifiedTrainingInterfaceProps {
  avatarId: string;
  avatarName: string;
  userId: string;
  onTrainingComplete?: () => void;
  onlyFineTuning?: boolean; // If true, skip training type selection and go directly to fine-tuning
}

export function SimplifiedTrainingInterface({
  avatarId,
  avatarName,
  userId,
  onTrainingComplete,
  onlyFineTuning = false
}: SimplifiedTrainingInterfaceProps) {
  const { toast } = useToast();

  // Step 0: Training Type Selection (skip if onlyFineTuning is true)
  const [trainingType, setTrainingType] = useState<'prompt' | 'finetune' | null>(onlyFineTuning ? 'finetune' : null);

  // Step 1: Upload files
  const [files, setFiles] = useState<File[]>([]);
  const [textInput, setTextInput] = useState('');
  const [instructions, setInstructions] = useState('');

  // WhatsApp parsing
  const [whatsappParseResult, setWhatsappParseResult] = useState<WhatsAppParseResult | null>(null);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);

  // Step 2: Process and extract
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [trainingSessionId, setTrainingSessionId] = useState<string | null>(null);
  const [extractedExamples, setExtractedExamples] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Step 3: Training options
  const [trainingMethod, setTrainingMethod] = useState<'quick' | 'deep' | null>(null);
  const [trainingStrategy, setTrainingStrategy] = useState<'standard-mini' | 'standard-4o' | 'distillation' | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini-2024-07-18');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);

  // Training jobs tracking
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  useEffect(() => {
    loadStats();
    loadActiveJobs();
  }, [avatarId, userId]);

  // Poll active jobs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeJobs.length > 0) {
        loadActiveJobs();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [activeJobs, avatarId, userId]);

  const loadStats = async () => {
    try {
      const [statistics, eligibilityData] = await Promise.all([
        FineTuneService.getExamplesStatistics(avatarId, userId),
        FineTuneService.checkFineTuneEligibility(avatarId, userId)
      ]);
      setStats(statistics);
      setEligibility(eligibilityData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadActiveJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const jobs = await FineTuneService.getActiveJobs(avatarId, userId);
      setActiveJobs(jobs);

      // Check for newly completed jobs and notify
      jobs.forEach(job => {
        if (job.status === 'succeeded' && job.just_completed) {
          toast({
            title: "Fine-Tuning Complete!",
            description: `Your model ${job.fine_tuned_model} is ready to use.`,
          });
        } else if (job.status === 'failed') {
          toast({
            title: "Fine-Tuning Failed",
            description: job.error_message || "The training job failed. Please try again.",
            variant: "destructive"
          });
        }
      });
    } catch (error) {
      console.error('Error loading active jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);

      // Auto-detect and parse WhatsApp exports
      for (const file of newFiles) {
        if (file.name.toLowerCase().includes('whatsapp') || file.name.endsWith('.txt')) {
          try {
            const text = await file.text();
            if (WhatsAppParserService.isValidWhatsAppExport(text)) {
              const result = WhatsAppParserService.parseWhatsAppExport(text);
              setWhatsappParseResult(result);
              setShowWhatsAppPreview(true);

              toast({
                title: "WhatsApp Chat Detected!",
                description: `Found ${result.conversations.length} conversation pairs. Click to review and import.`,
              });

              break; // Only parse first WhatsApp file
            }
          } catch (error) {
            console.error('Error parsing WhatsApp file:', error);
          }
        }
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessData = async () => {
    if (files.length === 0 && !textInput.trim()) {
      toast({
        title: "No Data",
        description: "Please upload files or enter conversation text",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Creating training session...');
    setProcessingProgress(10);

    try {
      // Create training session
      const trainingData = await TrainingService.createTrainingSession({
        user_id: userId,
        avatar_id: avatarId,
        training_type: files.length > 0 ? 'file_upload' : 'conversation_analysis',
        training_instructions: instructions || textInput,
        status: 'pending'
      });

      // Don't set trainingSessionId yet - wait until stats are ready
      const tempSessionId = trainingData.id;
      setProcessingProgress(20);

      // Upload files if any
      if (files.length > 0) {
        setProcessingStep(`Uploading ${files.length} file(s)...`);
        for (let i = 0; i < files.length; i++) {
          await TrainingService.uploadTrainingFile(
            tempSessionId,
            userId,
            files[i]
          );
          setProcessingProgress(20 + (30 * (i + 1) / files.length));
        }
      }

      // Analyze conversations ONLY (don't train yet)
      setProcessingStep('Analyzing conversations...');
      setProcessingProgress(50);

      const result = await TrainingService.analyzeConversationsOnly(
        tempSessionId,
        userId,
        avatarId,
        (step, percentage) => {
          setProcessingStep(step);
          setProcessingProgress(50 + (percentage / 2));
        }
      );

      // Now load statistics
      setProcessingStep('Loading statistics...');
      setProcessingProgress(95);
      setIsLoadingStats(true);

      // Wait for database to update
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Reload stats to get updated counts
      const newStats = await FineTuneService.getExamplesStatistics(avatarId, userId);
      const newEligibility = await FineTuneService.checkFineTuneEligibility(avatarId, userId);

      setStats(newStats);
      setEligibility(newEligibility);
      setExtractedExamples(result.examplesCount || newStats.total);
      setIsLoadingStats(false);

      setProcessingProgress(100);
      setProcessingStep('Analysis complete!');

      // Now set session ID to move to Step 2
      setTrainingSessionId(tempSessionId);

      // Show success message with extracted count
      const extractedCount = result.examplesCount || 0;

      toast({
        title: "Analysis Complete!",
        description: `Extracted ${extractedCount} conversation examples. ${newEligibility.eligible ? 'You can now choose Deep Training!' : 'Add more examples to unlock Deep Training.'}`
      });

    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process training data",
        variant: "destructive"
      });
      setTrainingSessionId(null);
      setIsLoadingStats(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickTraining = async () => {
    if (!trainingSessionId) {
      toast({
        title: "No Data",
        description: "Please process your data first",
        variant: "destructive"
      });
      return;
    }

    setTrainingMethod('quick');
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      setProcessingStep('Starting Quick Training...');

      // Run the actual training (prompt engineering)
      await TrainingService.processTrainingData(
        trainingSessionId,
        userId,
        avatarId,
        (step, percentage) => {
          setProcessingStep(step);
          setTrainingProgress(percentage);
        }
      );

      toast({
        title: "Quick Training Complete!",
        description: "Your avatar's prompt has been enhanced with conversation examples"
      });

      // Reset
      setFiles([]);
      setTextInput('');
      setInstructions('');
      setTrainingSessionId(null);
      setExtractedExamples(0);
      await loadStats();
      onTrainingComplete?.();

    } catch (error: any) {
      toast({
        title: "Training Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTraining(false);
      setTrainingMethod(null);
    }
  };

  const handleDeepTraining = async () => {
    if (!trainingSessionId) {
      toast({
        title: "No Data",
        description: "Please process your data first",
        variant: "destructive"
      });
      return;
    }

    if (!eligibility?.eligible) {
      toast({
        title: "Not Eligible",
        description: eligibility?.recommendation || "Need at least 10 examples",
        variant: "destructive"
      });
      return;
    }

    // Show cost confirmation for expensive models
    if (selectedModel.includes('gpt-4o') && !selectedModel.includes('mini') && costEstimate) {
      const confirmMessage =
        `⚠️ COST WARNING\n\n` +
        `This will cost approximately $${costEstimate.estimatedLow}-$${costEstimate.estimatedHigh} for training.\n\n` +
        `Model: ${selectedModel}\n` +
        `Examples: ${eligibility.currentExamples}\n\n` +
        `💡 TIP: Consider using gpt-4o-mini instead:\n` +
        `• 8x cheaper ($${(costEstimate.estimatedLow / 8).toFixed(2)}-$${(costEstimate.estimatedHigh / 8).toFixed(2)})\n` +
        `• Works great for conversation style\n` +
        `• Same training quality\n\n` +
        `Continue with ${selectedModel}?`;

      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setTrainingMethod('deep');
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      await FineTuneService.createFineTuneJob(
        trainingSessionId,
        userId,
        avatarId,
        { baseModel: selectedModel as any },
        (step, percentage) => {
          setProcessingStep(step);
          setTrainingProgress(percentage);
        }
      );

      toast({
        title: "Deep Training Started!",
        description: "Training will take 10-60 minutes. You'll be notified when complete."
      });

      // Reset
      setFiles([]);
      setTextInput('');
      setInstructions('');
      setTrainingSessionId(null);
      setExtractedExamples(0);
      await loadStats();

    } catch (error: any) {
      toast({
        title: "Deep Training Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTraining(false);
      setTrainingMethod(null);
      setTrainingProgress(0);
    }
  };

  const costEstimate = eligibility ? FineTuneService.estimateFineTuningCost(
    eligibility.currentExamples,
    selectedModel,
    3
  ) : null;

  // Current step calculation
  const currentStep = !trainingType ? 0 : !trainingSessionId ? 1 : 2;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">Train {avatarName}</h2>
        <p className="text-gray-600 mt-1 text-sm">
          {currentStep === 0 && !onlyFineTuning
            ? 'Choose your training method'
            : 'Upload conversation examples to train your custom AI model'}
        </p>
      </div>

      {/* Progress Indicator */}
      {currentStep > 0 && (
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
            </div>
            <span className="font-medium">Upload & Process</span>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              2
            </div>
            <span className="font-medium">
              {trainingType === 'prompt' ? 'Apply Changes' : 'Choose Training'}
            </span>
          </div>
        </div>
      )}

      {/* Step 0: Training Type Selection */}
      {currentStep === 0 && !onlyFineTuning && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Prompt-Based Training */}
          <Card
            className="border-2 hover:border-blue-500 transition-all cursor-pointer transform hover:scale-105"
            onClick={() => setTrainingType('prompt')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Zap className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Prompt-Based Training</CardTitle>
                    <Badge variant="secondary" className="mt-1">Quick & Free</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Improve your chatbot by enhancing its system prompt with conversation examples and instructions.
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Instant results (30 seconds)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Completely free - no costs</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Good for testing & quick improvements</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>Moderate quality improvement (30-50% style match)</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>Works with any number of examples</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-900 text-sm mb-2">Best for:</p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Quick personality adjustments</li>
                  <li>Testing different conversation styles</li>
                  <li>Adding specific instructions or rules</li>
                  <li>When you have limited training data</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Fine-Tuning Training */}
          <Card
            className="border-2 hover:border-purple-500 transition-all cursor-pointer transform hover:scale-105"
            onClick={() => setTrainingType('finetune')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Fine-Tuning Training</CardTitle>
                    <Badge className="mt-1 bg-purple-600">Premium</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Train a custom AI model that deeply learns your conversation style and personality on OpenAI's servers.
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Best quality results (70-90% style match)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Real machine learning model training</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Production-ready, consistent responses</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>Takes 10-60 minutes to complete</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>Costs $3-$20 (depending on model & data)</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>Requires at least 10 training examples</span>
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-medium text-purple-900 text-sm mb-2">Best for:</p>
                <ul className="text-xs text-purple-700 space-y-1 list-disc list-inside">
                  <li>Production chatbots with consistent style</li>
                  <li>Complex personality replication</li>
                  <li>When you have 10+ quality examples</li>
                  <li>Maximum quality and authenticity</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Prompt-Based Training - Direct Modification Interface */}
      {trainingType === 'prompt' && (
        <PromptModificationInterface
          avatarId={avatarId}
          avatarName={avatarName}
          userId={userId}
          onModificationComplete={onTrainingComplete}
        />
      )}

      {/* Fine-Tuning Training - Upload & Process Flow */}
      {trainingType === 'finetune' && currentStep === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Step 1: Upload Your Conversation Examples
              </CardTitle>
              {!onlyFineTuning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTrainingType(null)}
                >
                  Change Training Type
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Provide conversation examples showing how you want your chatbot to respond
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Model Strategy Selection */}
            {!trainingStrategy && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">Choose Your Training Strategy</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the approach that best fits your quality needs and budget
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* Budget Option - GPT-4o-mini */}
                  <Card
                    className="cursor-pointer hover:border-green-400 transition-all hover:shadow-md border-2"
                    onClick={() => {
                      setTrainingStrategy('standard-mini');
                      setSelectedModel('gpt-4o-mini-2024-07-18');
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="text-3xl mb-2">💰</div>
                      <CardTitle className="text-lg">Budget</CardTitle>
                      <p className="text-xs text-muted-foreground">GPT-4o-mini Direct</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Training:</span>
                          <span className="font-semibold">~$9</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Per 10K chats:</span>
                          <span className="font-semibold">~$2.70</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          ✅ Most affordable
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ✅ Good for simple tasks
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ⚠️ Basic quality
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Distillation - Recommended */}
                  <Card
                    className="cursor-pointer hover:border-purple-400 transition-all hover:shadow-lg border-2 border-purple-300 relative"
                    onClick={() => {
                      setTrainingStrategy('distillation');
                      setSelectedModel('gpt-4o-mini-2024-07-18'); // Will be trained with GPT-4o data
                    }}
                  >
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        RECOMMENDED
                      </Badge>
                    </div>
                    <CardHeader className="pb-3">
                      <div className="text-3xl mb-2">✨</div>
                      <CardTitle className="text-lg">Smart Distillation</CardTitle>
                      <p className="text-xs text-muted-foreground">GPT-4o Quality, Mini Price</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Training:</span>
                          <span className="font-semibold">~$30-40</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Per 10K chats:</span>
                          <span className="font-semibold">~$2.70</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-green-700 font-medium">
                          ⭐ Best value overall
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ✅ Premium quality
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ✅ Budget pricing
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Premium Option - GPT-4o */}
                  <Card
                    className="cursor-pointer hover:border-blue-400 transition-all hover:shadow-md border-2"
                    onClick={() => {
                      setTrainingStrategy('standard-4o');
                      setSelectedModel('gpt-4o-2024-08-06');
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="text-3xl mb-2">🚀</div>
                      <CardTitle className="text-lg">Premium</CardTitle>
                      <p className="text-xs text-muted-foreground">GPT-4o Direct</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Training:</span>
                          <span className="font-semibold">~$75</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Per 10K chats:</span>
                          <span className="font-semibold text-orange-600">~$34</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          ✅ Highest quality
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ✅ Best performance
                        </p>
                        <p className="text-xs text-orange-600">
                          ⚠️ 12x more expensive
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Show selected strategy and allow change */}
            {trainingStrategy && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-purple-900">
                      Selected Strategy: {
                        trainingStrategy === 'distillation' ? '✨ Smart Distillation' :
                        trainingStrategy === 'standard-4o' ? '🚀 Premium (GPT-4o)' :
                        '💰 Budget (GPT-4o-mini)'
                      }
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      {trainingStrategy === 'distillation'
                        ? 'GPT-4o quality at mini pricing'
                        : trainingStrategy === 'standard-4o'
                        ? 'Highest quality, premium pricing'
                        : 'Most affordable option'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTrainingStrategy(null)}
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}

            {/* Helpful Tips - Only show after strategy is selected */}
            {trainingStrategy && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  💡 What makes good training data?
                </h3>
                <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
                  <li><strong>Real conversations</strong> - Use actual chat histories that show your desired style</li>
                  <li><strong>Quality over quantity</strong> - 10-20 well-written examples work great</li>
                  <li><strong>Consistent tone</strong> - Examples should match the personality you want</li>
                  <li><strong>Clear format</strong> - Each conversation should have User and Assistant messages</li>
                </ul>
              </div>
            )}

            {/* File Upload Area - Only show after strategy is selected */}
            {trainingStrategy && (
            <>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold">
                  📁 Option 1: Upload Files
                </label>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const template = `User: Hello! How are you today?
Assistant: Hi there! I'm doing great, thanks for asking! How can I help you today?

User: I'm looking for information about your products
Assistant: I'd be happy to help! We have a wide range of products. Could you tell me what specific category you're interested in?

User: I need a new laptop
Assistant: Great choice! We have several excellent laptops. What's your budget and what will you mainly use it for?`;
                    const blob = new Blob([template], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'conversation_template.txt';
                    a.click();
                  }}
                >
                  ⬇️ Download Template
                </Button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer bg-gradient-to-b from-white to-gray-50">
                <input
                  type="file"
                  multiple
                  accept="image/*,.txt,.pdf,.json,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex justify-center mb-3">
                    <ImageIcon className="w-12 h-12 text-purple-400" />
                    <FileText className="w-12 h-12 text-blue-400 -ml-3" />
                  </div>
                  <p className="text-lg font-semibold text-gray-700">
                    Click to upload or drag files here
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    <span className="font-medium">Supported formats:</span> WhatsApp exports (.txt), Screenshots (.png/.jpg),
                    Chat logs (.txt), JSON (.json), CSV (.csv)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Multiple files supported • Max 10MB per file
                  </p>
                </label>
              </div>

              {/* Uploaded Files List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Uploaded Files ({files.length}):
                  </p>
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(idx)}
                        disabled={isProcessing}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* WhatsApp Parse Results */}
              {whatsappParseResult && showWhatsAppPreview && (
                <div className="mt-4 p-4 border-2 border-green-300 bg-green-50 rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-600">WhatsApp Chat Detected</Badge>
                        {(() => {
                          const quality = WhatsAppParserService.getQualityScore(whatsappParseResult);
                          const colorClass =
                            quality.rating === 'excellent' ? 'bg-green-600' :
                            quality.rating === 'good' ? 'bg-blue-600' :
                            quality.rating === 'fair' ? 'bg-yellow-600' : 'bg-orange-600';
                          return <Badge className={colorClass}>{quality.rating.toUpperCase()} ({quality.score}/100)</Badge>;
                        })()}
                      </div>

                      <h4 className="font-semibold text-green-900 mb-1">
                        📱 Parsed {whatsappParseResult.conversations.length} Conversation Pairs
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-green-800 mb-2">
                        <div>👤 {whatsappParseResult.stats.userMessages} user messages</div>
                        <div>🤖 {whatsappParseResult.stats.assistantMessages} assistant messages</div>
                        <div>🗑️ {whatsappParseResult.stats.systemMessages} system messages filtered</div>
                        <div>🔇 {whatsappParseResult.stats.audioMessages} media messages skipped</div>
                      </div>

                      {whatsappParseResult.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {whatsappParseResult.warnings.map((warning, idx) => (
                            <p key={idx} className="text-xs text-yellow-700 flex items-start gap-1">
                              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const converted = WhatsAppParserService.convertToTrainingFormat(
                              whatsappParseResult.conversations
                            );
                            setTextInput(converted);
                            setShowWhatsAppPreview(false);
                            toast({
                              title: "Import Successful!",
                              description: `${whatsappParseResult.conversations.length} conversations imported to text input.`
                            });
                          }}
                        >
                          ✅ Import to Text Input
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Show first 3 conversations as preview
                            const preview = whatsappParseResult.conversations
                              .slice(0, 3)
                              .map(c => `User: ${c.userMessage}\nAssistant: ${c.assistantMessage}`)
                              .join('\n\n');
                            alert(`Preview (first 3 conversations):\n\n${preview}\n\n... and ${whatsappParseResult.conversations.length - 3} more`);
                          }}
                        >
                          👁️ Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setWhatsappParseResult(null);
                            setShowWhatsAppPreview(false);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              {/* Text Input */}
              <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold">
                  ✍️ Option 2: Paste or Type Conversations
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const example1 = `User: What are your business hours?
Assistant: We're open Monday to Friday, 9 AM to 6 PM, and Saturday 10 AM to 4 PM. We're closed on Sundays and public holidays.

User: Do you offer delivery?
Assistant: Yes! We offer free delivery for orders over $50 within the city. For orders below $50, there's a flat $5 delivery fee.

User: How long does delivery take?
Assistant: Standard delivery takes 2-3 business days. We also offer express delivery (next day) for an additional $10.`;
                      setTextInput(example1);
                    }}
                    disabled={isProcessing}
                  >
                    📋 Example 1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const example2 = `User: Hi! I'm interested in your services
Assistant: Hello! Welcome! I'd be delighted to help you learn about our services. What specific area are you interested in?

User: What makes you different from competitors?
Assistant: Great question! Our key differentiators are: 1) 24/7 customer support, 2) Money-back guarantee, 3) Certified experts with 10+ years experience, and 4) Custom solutions tailored to your needs.

User: That sounds good. How do I get started?
Assistant: It's easy! Just fill out our quick online form (takes 2 minutes), and one of our specialists will contact you within 24 hours to discuss your specific needs and create a custom plan.`;
                      setTextInput(example2);
                    }}
                    disabled={isProcessing}
                  >
                    📋 Example 2
                  </Button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-3">
                <div className="flex items-start gap-2">
                  <div className="text-sm text-purple-900 flex-1">
                    <p className="font-semibold mb-1">📝 Format Guide:</p>
                    <ul className="space-y-1 text-xs ml-4 list-disc">
                      <li><code className="bg-white px-1 rounded">User: [customer message]</code></li>
                      <li><code className="bg-white px-1 rounded">Assistant: [your response]</code></li>
                      <li>Leave a blank line between conversation pairs</li>
                      <li>Include 3-5 conversation exchanges for best results</li>
                    </ul>
                  </div>
                </div>
              </div>

              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="User: Hello! How can I contact customer service?
Assistant: Hi! You can reach our customer service team via email at support@company.com, phone at +1-234-567-8900, or live chat on our website. We're here 24/7 to help!

User: What's your return policy?
Assistant: We offer a 30-day money-back guarantee on all products. If you're not satisfied, simply return the item in its original condition for a full refund. Return shipping is free!

User: That's great, thank you!
Assistant: You're welcome! If you have any other questions, feel free to ask. Happy to help! 😊"
                className="w-full h-48 p-4 border-2 border-gray-300 rounded-lg resize-none font-mono text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Click "Example 1" or "Example 2" above to see sample formats, or type your own conversations
              </p>
              </div>

              {/* Optional Instructions */}
              <div>
                <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  Additional Training Instructions (Optional)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Add specific style or behavior instructions...

Examples:
• Be more casual and friendly, use emojis when appropriate
• Speak like a professional consultant with formal language
• Use Malaysian English and local phrases
• Always mention our 24/7 customer support in responses
• Keep responses under 3 sentences for brevity"
                  className="w-full h-32 p-4 border-2 border-gray-300 rounded-lg resize-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
                  disabled={isProcessing}
                />
                <p className="text-xs text-gray-500 mt-2">
                  These instructions will guide the AI's behavior during training
                </p>
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-900">{processingStep}</span>
                    <span className="font-medium text-blue-600">{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} className="h-2" />
                </div>
              )}

              {/* Process Button */}
              <Button
                onClick={handleProcessData}
                disabled={isProcessing || (files.length === 0 && !textInput.trim())}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing... {processingProgress}%
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5 mr-2" />
                    Process Data & Extract Examples
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-gray-500">
                This will analyze your conversations and extract training examples
              </p>
            </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Training Actions (Fine-Tuning Only) */}
      {trainingType === 'finetune' && currentStep === 2 && (
        <>
          {/* Success Message */}
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              Successfully extracted <strong>{stats?.total || extractedExamples} conversation examples</strong>!
              <br />
              {trainingType === 'prompt'
                ? 'Ready to apply prompt-based improvements.'
                : 'Now choose your fine-tuning options below.'}
            </AlertDescription>
          </Alert>

          {/* Show selected training type */}
          <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Training Type:</span>
            <Badge className={trainingType === 'prompt' ? 'bg-blue-600' : 'bg-purple-600'}>
              {trainingType === 'prompt' ? (
                <><Zap className="w-3 h-3 mr-1 inline" /> Prompt-Based Training</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1 inline" /> Fine-Tuning Training</>
              )}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTrainingType(null);
                setTrainingSessionId(null);
                setExtractedExamples(0);
                setFiles([]);
                setTextInput('');
                setInstructions('');
              }}
              className="ml-2 text-xs"
            >
              Change Type
            </Button>
          </div>

          {/* Active Training Jobs */}
          {activeJobs.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  Active Training Jobs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeJobs.map(job => (
                  <div key={job.id} className="bg-white p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{job.base_model}</p>
                        <p className="text-xs text-gray-500">
                          Training {job.training_examples_count} examples
                        </p>
                      </div>
                      <Badge variant={
                        job.status === 'running' ? 'default' :
                        job.status === 'queued' ? 'secondary' :
                        'outline'
                      }>
                        {job.status}
                      </Badge>
                    </div>

                    {job.status === 'running' && job.estimated_finish_at && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600">
                          Estimated completion: {new Date(job.estimated_finish_at).toLocaleTimeString()}
                        </p>
                        <Progress value={50} className="mt-2" />
                      </div>
                    )}

                    {job.status === 'queued' && (
                      <p className="text-xs text-gray-600 mt-2">
                        Waiting in queue... Usually starts within 5-10 minutes
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => FineTuneService.checkFineTuneStatus(job.openai_job_id, userId).then(loadActiveJobs)}
                      >
                        Refresh Status
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Current Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                {isLoadingStats ? (
                  <>
                    <Loader2 className="w-8 h-8 mx-auto text-blue-600 animate-spin" />
                    <p className="text-sm text-gray-500 mt-2">Loading...</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-blue-600">{stats?.total || 0}</p>
                    <p className="text-sm text-gray-600 mt-1">Total Examples</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                {isLoadingStats ? (
                  <>
                    <Loader2 className="w-8 h-8 mx-auto text-green-600 animate-spin" />
                    <p className="text-sm text-gray-500 mt-2">Loading...</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-green-600">
                      {stats ? Math.round(stats.averageQuality * 100) : 0}%
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Quality Score</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                {isLoadingStats ? (
                  <>
                    <Loader2 className="w-8 h-8 mx-auto text-purple-600 animate-spin" />
                    <p className="text-sm text-gray-500 mt-2">Loading...</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-purple-600">
                      {eligibility?.eligible ? 'Ready' : 'Need More'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Deep Training</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Training Options - Different based on training type */}
          {trainingType === 'prompt' ? (
            /* Prompt-Based Training - Single Option */
            <Card className="border-2 border-blue-400">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-6 h-6 text-blue-500" />
                    <CardTitle>Apply Prompt-Based Training</CardTitle>
                  </div>
                  <Badge variant="secondary">Free & Instant</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg text-sm">
                  <p className="font-medium text-blue-900 mb-2">What will happen:</p>
                  <ul className="text-blue-700 space-y-1 list-disc list-inside">
                    <li>Your {extractedExamples || stats?.total || 0} conversation examples will be analyzed</li>
                    <li>An enhanced system prompt will be created</li>
                    <li>The prompt will include conversation style guidelines</li>
                    <li>Your chatbot will reference these examples</li>
                  </ul>
                </div>

                {isTraining && trainingMethod === 'quick' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{processingStep}</span>
                      <span className="font-medium">{trainingProgress}%</span>
                    </div>
                    <Progress value={trainingProgress} />
                  </div>
                )}

                <Button
                  onClick={handleQuickTraining}
                  disabled={isTraining}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  {isTraining && trainingMethod === 'quick' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Applying Training... {trainingProgress}%
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Apply Prompt Training Now
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-gray-500">
                  This will update your avatar's system prompt with enhanced instructions
                </p>
              </CardContent>
            </Card>
          ) : (
            /* Fine-Tuning Training - Two Options */
            <div className="grid md:grid-cols-2 gap-6">
              {/* Quick Training for Fine-tune Type */}
              <Card className="border-2 hover:border-yellow-400 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-6 h-6 text-yellow-500" />
                      <CardTitle>Quick Training</CardTitle>
                    </div>
                    <Badge variant="secondary">Free</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>Instant results (30 seconds)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>No cost</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>Good for testing first</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <span>Moderate quality (30-50% match)</span>
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                    <p className="font-medium text-yellow-900">How it works:</p>
                    <p className="text-yellow-700 mt-1">
                      Updates your chatbot's prompt with conversation examples.
                      Try this first before paying for fine-tuning!
                    </p>
                  </div>

                  {isTraining && trainingMethod === 'quick' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{processingStep}</span>
                        <span className="font-medium">{trainingProgress}%</span>
                      </div>
                      <Progress value={trainingProgress} />
                    </div>
                  )}

                  <Button
                    onClick={handleQuickTraining}
                    disabled={isTraining}
                    className="w-full bg-yellow-500 hover:bg-yellow-600"
                    size="lg"
                  >
                    {isTraining && trainingMethod === 'quick' ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Training...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Try Quick Training First
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Deep Training */}
              <Card className={`border-2 transition-colors ${
              eligibility?.eligible
                ? 'hover:border-purple-400 cursor-pointer'
                : 'opacity-60 cursor-not-allowed'
            }`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-purple-500" />
                    <CardTitle>Deep Training</CardTitle>
                  </div>
                  <Badge>Premium</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {eligibility?.eligible ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Best quality (70-90% match)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Real ML model training</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Production-ready results</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <span>Takes 10-60 minutes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <span>Costs $3-20</span>
                      </div>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-lg text-sm">
                      <p className="font-medium text-purple-900">How it works:</p>
                      <p className="text-purple-700 mt-1">
                        Trains a custom AI model on OpenAI that deeply learns your style.
                        Much better than instructions!
                      </p>
                    </div>

                    {/* Model Selector */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Model:</label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o-mini-2024-07-18">
                            GPT-4o Mini ($3-5) ⭐
                          </SelectItem>
                          <SelectItem value="gpt-4o-2024-08-06">
                            GPT-4o ($10-20)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cost with Warning */}
                    {costEstimate && (
                      <div className="space-y-2">
                        <div className={`p-3 rounded-lg ${
                          selectedModel.includes('gpt-4o-mini') ? 'bg-green-50' : 'bg-orange-50'
                        }`}>
                          <p className={`text-sm ${
                            selectedModel.includes('gpt-4o-mini') ? 'text-green-900' : 'text-orange-900'
                          }`}>
                            Estimated Cost: <strong className="text-lg">${costEstimate.estimatedLow} - ${costEstimate.estimatedHigh}</strong>
                          </p>
                          <p className="text-xs mt-1 opacity-75">
                            Range depends on your example length. Average: ${costEstimate.totalEstimate}
                          </p>
                        </div>

                        {costEstimate.warning && (
                          <Alert className={selectedModel.includes('gpt-4o-mini') ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}>
                            <AlertCircle className={`h-4 w-4 ${selectedModel.includes('gpt-4o-mini') ? 'text-green-600' : 'text-orange-600'}`} />
                            <AlertDescription className={selectedModel.includes('gpt-4o-mini') ? 'text-green-900' : 'text-orange-900'}>
                              {costEstimate.warning}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}

                    {/* Progress */}
                    {isTraining && trainingMethod === 'deep' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{processingStep}</span>
                          <span className="font-medium">{trainingProgress}%</span>
                        </div>
                        <Progress value={trainingProgress} />
                      </div>
                    )}

                    <Button
                      onClick={handleDeepTraining}
                      disabled={isTraining}
                      className="w-full bg-purple-500 hover:bg-purple-600"
                      size="lg"
                    >
                      {isTraining && trainingMethod === 'deep' ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Start Deep Training
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <Alert className="bg-orange-50 border-orange-200">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-900">
                        {eligibility?.recommendation}
                      </AlertDescription>
                    </Alert>
                    <Button disabled className="w-full" size="lg">
                      Not Eligible Yet
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                      Upload more conversations to unlock Deep Training
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          )}

          {/* Replace Training Data Button */}
          <div className="text-center space-y-3">
            <Button
              variant="outline"
              onClick={() => {
                // Go back to Step 1 to upload new training data
                // Note: Next upload will replace current examples
                setTrainingSessionId(null);
                setExtractedExamples(0);
                setIsProcessing(false);
                setFiles([]);
                setTextInput('');
                setInstructions('');
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Different Training Data
            </Button>
            <p className="text-xs text-gray-500">
              Current: {stats?.total || 0} examples. Next upload will replace these.
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
