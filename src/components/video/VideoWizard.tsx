import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload,
  Sparkles,
  CheckCircle2,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Film,
  Play,
  Clock,
  DollarSign,
  Info,
  Video,
  Camera,
  Users,
  Package,
  Star,
} from 'lucide-react';
import { MultiImageUploadBox } from '@/components/ui/multi-image-upload-box';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { analyzeProductImage, ProductAnalysis } from '@/services/productAnalysis';
import {
  generateVideoPrompts,
  VideoPrompt,
  VideoPromptGenerationResult,
  VIDEO_COST_PER_VIDEO_USD,
  VIDEO_USD_TO_MYR_RATE,
  calculateVideoCost,
} from '@/services/videoPromptGeneration';
import { generateVideo, VideoProvider } from '@/services/videoGeneration';
import { supabase } from '@/integrations/supabase/client';

// Video type icons
const VIDEO_TYPE_ICONS: Record<string, React.ReactNode> = {
  'product-showcase': <Package className="h-4 w-4" />,
  'product-demo': <Play className="h-4 w-4" />,
  'lifestyle': <Camera className="h-4 w-4" />,
  'unboxing': <Package className="h-4 w-4" />,
  'testimonial': <Users className="h-4 w-4" />,
};

// Video type colors
const VIDEO_TYPE_COLORS: Record<string, string> = {
  'product-showcase': 'bg-blue-100 border-blue-300 text-blue-800',
  'product-demo': 'bg-purple-100 border-purple-300 text-purple-800',
  'lifestyle': 'bg-green-100 border-green-300 text-green-800',
  'unboxing': 'bg-orange-100 border-orange-300 text-orange-800',
  'testimonial': 'bg-pink-100 border-pink-300 text-pink-800',
};

// Wizard steps
const WIZARD_STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload, description: 'Upload product image' },
  { id: 'analysis', label: 'Analysis', icon: Sparkles, description: 'AI analyzes your product' },
  { id: 'select', label: 'Select', icon: CheckCircle2, description: 'Choose video styles' },
  { id: 'generate', label: 'Generate', icon: Rocket, description: 'Start generation' },
];

interface VideoWizardProps {
  onJobStarted?: (jobId: string) => void;
  onClose?: () => void;
}

export function VideoWizard({ onJobStarted, onClose }: VideoWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Wizard step state
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [productAnalysis, setProductAnalysis] = useState<ProductAnalysis | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<VideoPrompt[]>([]);

  // Selection state
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

  // Calculate cost
  const { costUSD, costMYR } = calculateVideoCost(selectedVideos.length);

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!productImage;
      case 1: return productAnalysis !== null && generatedPrompts.length > 0;
      case 2: return selectedVideos.length > 0;
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1 && canProceed()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Auto-analyze when entering step 1
  useEffect(() => {
    if (currentStep === 1 && productImage && !productAnalysis && !isAnalyzing) {
      handleAnalyze();
    }
  }, [currentStep, productImage, productAnalysis, isAnalyzing]);

  // Analyze product and generate prompts
  const handleAnalyze = async () => {
    if (!productImage) return;

    setIsAnalyzing(true);
    try {
      // Analyze product image
      const analysis = await analyzeProductImage(productImage);

      // Merge with user-provided info
      const enhancedAnalysis: ProductAnalysis = {
        ...analysis,
        productName: productName.trim() || analysis.productName,
        keyFeatures: productDescription.trim()
          ? [...productDescription.split('\n').map(l => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean), ...analysis.keyFeatures]
          : analysis.keyFeatures,
      };

      setProductAnalysis(enhancedAnalysis);

      // Generate video prompts
      const result = generateVideoPrompts(enhancedAnalysis, additionalRequirements.trim());
      setGeneratedPrompts(result.prompts);

      // Auto-select all videos
      setSelectedVideos(result.prompts.map(p => p.id));

      toast({
        title: 'Product analyzed!',
        description: `Generated ${result.prompts.length} video styles for ${enhancedAnalysis.productName}`,
      });
    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast({
        title: 'Analysis failed',
        description: error.message || 'Failed to analyze product',
        variant: 'destructive',
      });

      // Use fallback
      const fallbackAnalysis: ProductAnalysis = {
        productName: productName.trim() || 'Product',
        category: 'General',
        keyFeatures: productDescription.trim() ? productDescription.split('\n').filter(Boolean) : ['Quality product'],
        colors: ['Various'],
      };
      setProductAnalysis(fallbackAnalysis);

      const result = generateVideoPrompts(fallbackAnalysis, additionalRequirements.trim());
      setGeneratedPrompts(result.prompts);
      setSelectedVideos(result.prompts.map(p => p.id));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle video selection
  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos(prev =>
      prev.includes(videoId)
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  // Upload image to storage
  const uploadImageToStorage = async (base64Image: string, imageId: string): Promise<string> => {
    if (base64Image.startsWith('http')) return base64Image;

    const base64Data = base64Image.includes('base64,')
      ? base64Image.split('base64,')[1]
      : base64Image;

    let fileType = 'png';
    if (base64Image.includes('image/jpeg')) fileType = 'jpg';
    else if (base64Image.includes('image/webp')) fileType = 'webp';

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const filename = `${user!.id}/video_input_${imageId}_${Date.now()}.${fileType}`;
    const { error } = await supabase.storage
      .from('generated-images')
      .upload(filename, bytes, { contentType: `image/${fileType}`, upsert: false });

    if (error) throw new Error(`Failed to upload image: ${error.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(filename);

    return publicUrl;
  };

  // Start video generation
  const handleGenerate = async () => {
    if (!user?.id || !productImage || selectedVideos.length === 0) return;

    setIsGenerating(true);
    setGenerationProgress({ current: 0, total: selectedVideos.length });

    try {
      // Upload input image first
      const inputImageUrl = await uploadImageToStorage(productImage, crypto.randomUUID());

      // Generate each selected video
      for (let i = 0; i < selectedVideos.length; i++) {
        const videoId = selectedVideos[i];
        const prompt = generatedPrompts.find(p => p.id === videoId);
        if (!prompt) continue;

        setGenerationProgress({ current: i + 1, total: selectedVideos.length });

        try {
          await generateVideo({
            prompt: prompt.prompt,
            provider: prompt.defaultProvider as VideoProvider,
            inputImage: inputImageUrl,
            aspectRatio: prompt.aspectRatio,
            duration: prompt.duration,
          });

          toast({
            title: `Video ${i + 1}/${selectedVideos.length} started`,
            description: `${prompt.name} is being generated...`,
          });
        } catch (error: any) {
          console.error(`Failed to generate ${prompt.name}:`, error);
          toast({
            title: `Failed: ${prompt.name}`,
            description: error.message,
            variant: 'destructive',
          });
        }
      }

      toast({
        title: 'Video generation started!',
        description: `${selectedVideos.length} videos are being generated. Check the Gallery tab for progress.`,
      });

      onJobStarted?.('video-batch');
    } catch (error: any) {
      console.error('Generation failed:', error);
      toast({
        title: 'Generation failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress({ current: 0, total: 0 });
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Product Image *</Label>
              <MultiImageUploadBox
                onImagesChange={(images) => setProductImage(images[0] || null)}
                currentImages={productImage ? [productImage] : []}
                maxImages={1}
                maxSizeMB={4}
              />
              <p className="text-xs text-muted-foreground">
                Upload a clear product photo. This will be used as the base for video generation.
              </p>
            </div>

            {/* Product Info */}
            <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-purple-600" />
                <h4 className="font-medium">Product Information (Optional)</h4>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-name">Product Name</Label>
                <Input
                  id="product-name"
                  placeholder="e.g., Wireless Earbuds, Skincare Set"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-desc">Product Description / Features</Label>
                <Textarea
                  id="product-desc"
                  placeholder="Key features, one per line:
- Noise cancellation
- 24-hour battery life
- Waterproof design"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional-req">Additional Requirements</Label>
                <Textarea
                  id="additional-req"
                  placeholder="e.g., Target Malaysian young adults, emphasize premium quality"
                  value={additionalRequirements}
                  onChange={(e) => setAdditionalRequirements(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
          </div>
        );

      case 1:
        if (isAnalyzing) {
          return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 text-purple-600 animate-spin" />
                </div>
                <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Analyzing your product...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  AI is generating professional video prompts
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {/* Product Analysis Result */}
            {productAnalysis && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold">Product Identified</h3>
                </div>
                <p className="text-xl font-bold text-purple-700">{productAnalysis.productName}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">{productAnalysis.category}</Badge>
                  {productAnalysis.colors?.slice(0, 3).map((color, i) => (
                    <Badge key={i} variant="outline">{color}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Video Styles */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                {generatedPrompts.length} Video Styles Generated
              </h4>
              {generatedPrompts.map((prompt, index) => (
                <div
                  key={prompt.id}
                  className={`p-4 rounded-lg border ${VIDEO_TYPE_COLORS[prompt.videoType]}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm">
                      <span className="font-bold">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {VIDEO_TYPE_ICONS[prompt.videoType]}
                        <h5 className="font-semibold">{prompt.name}</h5>
                        <Badge variant="outline" className="text-xs bg-white">
                          {prompt.aspectRatio} • {prompt.duration}s
                        </Badge>
                      </div>
                      <p className="text-sm opacity-90">{prompt.purpose}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {prompt.platforms.map((platform, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-white/50">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Select Videos to Generate</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedVideos.length === generatedPrompts.length) {
                    setSelectedVideos([]);
                  } else {
                    setSelectedVideos(generatedPrompts.map(p => p.id));
                  }
                }}
              >
                {selectedVideos.length === generatedPrompts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="space-y-3">
              {generatedPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedVideos.includes(prompt.id)
                      ? 'border-primary ring-2 ring-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleVideoSelection(prompt.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedVideos.includes(prompt.id)}
                      onCheckedChange={() => toggleVideoSelection(prompt.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {VIDEO_TYPE_ICONS[prompt.videoType]}
                        <h5 className="font-medium">{prompt.name}</h5>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{prompt.purpose}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{prompt.aspectRatio}</Badge>
                        <Badge variant="outline">{prompt.duration}s</Badge>
                        <span>~RM{(VIDEO_COST_PER_VIDEO_USD * VIDEO_USD_TO_MYR_RATE).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cost Summary */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium">Total Cost</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-700">
                    RM {costMYR.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ~${costUSD.toFixed(2)} USD for {selectedVideos.length} videos
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-purple-700">{selectedVideos.length}</div>
                  <div className="text-sm text-gray-600">Videos</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-700">6s</div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-orange-700">
                    ~{Math.ceil(selectedVideos.length * 2)}m
                  </div>
                  <div className="text-sm text-gray-600">Est. Time</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    RM{costMYR.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">~${costUSD.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Selected Videos */}
            <div className="space-y-2">
              <h4 className="font-medium">Selected Videos:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedVideos.map(id => {
                  const prompt = generatedPrompts.find(p => p.id === id);
                  return prompt ? (
                    <Badge key={id} variant="secondary">
                      {prompt.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>

            {/* Background Generation Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Background Generation</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Videos will be generated in the background. You can leave this page and
                    check the Gallery tab for progress.
                  </p>
                </div>
              </div>
            </div>

            {/* Cost Info */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-emerald-900">Generation Cost</h4>
                  <p className="text-sm text-emerald-800 mt-1">
                    Each video costs approximately <strong>RM {(VIDEO_COST_PER_VIDEO_USD * VIDEO_USD_TO_MYR_RATE).toFixed(2)}</strong> (${VIDEO_COST_PER_VIDEO_USD}).
                    Your selection of <strong>{selectedVideos.length} videos</strong> will cost{' '}
                    <strong>RM {costMYR.toFixed(2)}</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-14 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating {generationProgress.current}/{generationProgress.total}...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5 mr-2" />
                  Generate {selectedVideos.length} Videos
                </>
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5 text-purple-600" />
          AI Video Wizard
        </CardTitle>

        {/* Step Progress */}
        <div className="flex items-center gap-2 mt-4">
          {WIZARD_STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                className={`flex items-center gap-2 ${
                  index <= currentStep ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : index === currentStep
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-muted'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div className={`flex-1 h-1 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderStepContent()}

        {/* Navigation */}
        {currentStep < 3 && (
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isAnalyzing}
            >
              {currentStep === 2 ? 'Review & Generate' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VideoWizard;
