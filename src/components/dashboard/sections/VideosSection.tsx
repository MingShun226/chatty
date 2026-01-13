import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Video,
  Sparkles,
  Download,
  Loader2,
  Film,
  Play,
  Zap,
  AlertCircle,
  ExternalLink,
  Settings,
  Languages,
  Layers,
  Rocket,
  Wrench
} from 'lucide-react';
import { MultiImageUploadBox } from '@/components/ui/multi-image-upload-box';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { KIE_VIDEO_SERVICES } from '@/config/kieAIConfig';
import { generateVideo, VideoProvider } from '@/services/videoGeneration';
import VideoGallery from './VideoGallery';
import TemplateLibrary from '@/components/templates/TemplateLibrary';
import { VideoTemplate } from '@/config/templates';
import { VideoWizard } from '@/components/video/VideoWizard';

// Build video service providers from KIE.AI config
const VIDEO_SERVICES = KIE_VIDEO_SERVICES.map(service => ({
  value: service.id,
  label: service.name,
  description: service.description,
  icon: Film,
  cost: service.costInUSD,
  credits: service.costPerGeneration,
  estimatedTime: service.estimatedTime,
  features: service.features,
  supportsText2Vid: service.supportsText2Vid || false,
  supportsImg2Vid: service.supportsImg2Img || false,
  supportedAspectRatios: service.supportedAspectRatios || ['16:9', '9:16', '1:1'],
  maxDuration: service.maxDuration || 8,
}));

const VideosSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State for Video Generation
  const [generationMode, setGenerationMode] = useState<'text2vid' | 'img2vid'>('text2vid');
  const [prompt, setPrompt] = useState('');
  const [selectedService, setSelectedService] = useState(VIDEO_SERVICES[0]?.value || '');
  const [inputImage, setInputImage] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const currentService = VIDEO_SERVICES.find(s => s.value === selectedService);

  // Auto-adjust duration when service changes
  useEffect(() => {
    if (currentService && duration > currentService.maxDuration) {
      setDuration(currentService.maxDuration);
    }
  }, [selectedService, currentService, duration]);

  // Auto-adjust aspect ratio when service changes
  useEffect(() => {
    if (currentService) {
      const supportedRatios = currentService.supportedAspectRatios;
      if (!supportedRatios.includes(aspectRatio)) {
        // Current aspect ratio not supported, reset to first supported
        setAspectRatio(supportedRatios[0]);
      }
    }
  }, [selectedService, currentService, aspectRatio]);

  // Auto-switch service when changing generation mode
  useEffect(() => {
    // Filter services based on generation mode
    const availableServices = VIDEO_SERVICES.filter(s => {
      if (generationMode === 'text2vid') {
        // Text-to-video: Show services that support text2vid
        return s.supportsText2Vid;
      } else {
        // Image-to-video: Show services that support img2vid
        return s.supportsImg2Vid;
      }
    });

    const currentServiceValid = availableServices.some(s => s.value === selectedService);

    if (!currentServiceValid && availableServices.length > 0) {
      // Current service not valid for this mode, switch to first available
      const firstService = availableServices[0];
      setSelectedService(firstService.value);

      toast({
        title: "Service switched",
        description: `Switched to ${firstService.label} for ${generationMode === 'img2vid' ? 'image-to-video' : 'text-to-video'}`,
      });
    }

    // Clear input image when switching to text2vid
    if (generationMode === 'text2vid' && inputImage.length > 0) {
      setInputImage([]);
    }
  }, [generationMode]);

  const handleSelectTemplate = (template: VideoTemplate) => {
    // Apply template settings to form
    setGenerationMode(template.generationMode);

    // Set prompt
    setPrompt(template.prompt);

    // Set aspect ratio
    setAspectRatio(template.aspectRatio);

    // Set duration
    setDuration(template.duration);

    // Set provider if specified and valid
    if (template.defaultProvider && VIDEO_SERVICES.some(s => s.value === template.defaultProvider)) {
      setSelectedService(template.defaultProvider);
    }

    toast({
      title: "Template loaded",
      description: `${template.name} template applied. Don't forget to replace [PRODUCT] with your product name!`,
    });

    // Switch to generate tab
    const generateTab = document.querySelector('[value="generate"]') as HTMLElement;
    generateTab?.click();
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt to generate a video",
        variant: "destructive",
      });
      return;
    }

    // Validate img2vid requirements
    if (generationMode === 'img2vid' && inputImage.length === 0) {
      toast({
        title: "Error",
        description: "Please upload an image for image-to-video generation",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      toast({
        title: "Starting video generation...",
        description: `Using ${currentService?.label}. You can check progress in the Gallery tab.`,
      });

      // Start video generation (saves to database immediately)
      const response = await generateVideo({
        prompt,
        provider: selectedService as VideoProvider,
        inputImage: generationMode === 'img2vid' && inputImage.length > 0 && selectedService !== 'kie-sora-2-pro-img2vid' ? inputImage[0] : undefined,
        inputImages: selectedService === 'kie-sora-2-pro-img2vid' && inputImage.length > 0 ? inputImage : undefined,
        aspectRatio,
        duration,
      });

      const { videoId, taskId, provider: usedProvider } = response;

      console.log('Video generation started:', { videoId, taskId, provider: usedProvider });

      toast({
        title: "Video generation started!",
        description: "Your video is being generated in the background. Check the Gallery tab to see progress.",
        duration: 5000,
      });

      // Reset form
      setPrompt('');
      setInputImage([]);

      // Note: Video is already saved to database with 'processing' status
      // Background polling will update the status automatically

    } catch (error: any) {
      console.error('Error generating video:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Film className="h-8 w-8" />
          Promotional Videos
        </h1>
        <p className="text-muted-foreground mt-2">
          Create engaging promotional videos for social media and advertising campaigns
        </p>
      </div>

      <Tabs defaultValue="ai-wizard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="ai-wizard" className="flex items-center gap-1">
            <Rocket className="h-3 w-3" />
            AI Wizard
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            Manual
          </TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
        </TabsList>

        {/* AI Wizard Tab */}
        <TabsContent value="ai-wizard" className="space-y-6">
          <VideoWizard />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <TemplateLibrary type="video" onSelectTemplate={handleSelectTemplate} />
        </TabsContent>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Create New Video
              </CardTitle>
              <CardDescription>
                Transform your ideas or images into dynamic videos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Generation Mode Toggle */}
              <div className="space-y-2">
                <Label>Generation Mode</Label>
                <Tabs value={generationMode} onValueChange={(value) => setGenerationMode(value as 'text2vid' | 'img2vid')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="text2vid">Text-to-Video</TabsTrigger>
                    <TabsTrigger value="img2vid">Image-to-Video</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  {generationMode === 'text2vid'
                    ? 'Generate videos from text descriptions'
                    : 'Animate your images with AI'}
                </p>
              </div>

              {/* Service Selection */}
              <div className="space-y-2">
                <Label>Video Service</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {currentService && (
                        <div className="flex items-center justify-between w-full">
                          <span>{currentService.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ${currentService.cost} / {currentService.credits} credits
                          </span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_SERVICES
                      .filter(s => generationMode === 'text2vid' ? s.supportsText2Vid : s.supportsImg2Vid)
                      .map((service) => (
                        <SelectItem key={service.value} value={service.value}>
                          <div className="flex flex-col py-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium">{service.label}</span>
                              <span className="text-xs text-muted-foreground">
                                ${service.cost}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {service.description}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {service.maxDuration}s max
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {service.supportedAspectRatios.join(', ')}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                ~{Math.round(service.estimatedTime / 60)}min
                              </Badge>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {currentService && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="text-sm font-medium">Features:</div>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {currentService.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Image Upload for img2vid */}
              {generationMode === 'img2vid' && (
                <div className="space-y-2">
                  <Label>
                    Input Image{selectedService === 'kie-sora-2-pro-img2vid' ? '(s)' : ''} *
                  </Label>
                  <MultiImageUploadBox
                    onImagesChange={(images) => setInputImage(images)}
                    currentImages={inputImage}
                    maxImages={selectedService === 'kie-sora-2-pro-img2vid' ? 5 : 1}
                    maxSizeMB={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedService === 'kie-sora-2-pro-img2vid'
                      ? 'Upload 1-5 images to animate. Sora will create a dynamic video blending all images (e.g., influencer + product).'
                      : 'Upload an image to animate. The AI will bring it to life based on your prompt.'}
                  </p>
                </div>
              )}

              {/* Aspect Ratio Selection */}
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentService?.supportedAspectRatios.map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ratio} {ratio === '16:9' && '(Landscape)'}
                        {ratio === '9:16' && '(Portrait)'}
                        {ratio === '1:1' && '(Square)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {currentService?.supportedAspectRatios.length} aspect ratio{currentService?.supportedAspectRatios.length !== 1 ? 's' : ''} available for {currentService?.label}
                </p>
              </div>

              {/* Duration Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Duration</Label>
                  <span className="text-sm font-medium">{duration}s</span>
                </div>
                <Slider
                  value={[duration]}
                  onValueChange={(values) => setDuration(values[0])}
                  min={3}
                  max={currentService?.maxDuration || 8}
                  step={1}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">3s (min)</span>
                  <span className="text-muted-foreground">{currentService?.maxDuration || 8}s (max for {currentService?.label})</span>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt *</Label>
                <Textarea
                  id="prompt"
                  placeholder={
                    generationMode === 'text2vid'
                      ? "A cinematic drone shot flying through a futuristic city at sunset, with neon lights reflecting off glass buildings..."
                      : "Camera slowly zooms in, person turns head and smiles, hair gently flowing in the wind..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] resize-none"
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  {generationMode === 'text2vid'
                    ? 'Describe the video scene, camera movement, and action in detail'
                    : 'Describe the motion, camera movement, and how you want to animate the image'}
                </p>
              </div>

              {/* Progress */}
              {isGenerating && generationProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Generating video...</span>
                    <span className="font-medium">{Math.round(generationProgress)}%</span>
                  </div>
                  <Progress value={generationProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Estimated time: ~{Math.round((currentService?.estimatedTime || 120) / 60)} minutes
                  </p>
                </div>
              )}

              {/* Cost Estimate */}
              {currentService && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Estimated Cost</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">${currentService.cost}</div>
                      <div className="text-xs text-muted-foreground">
                        {currentService.credits} credits
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Video...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Generate Video
                  </>
                )}
              </Button>

              {/* Info Note */}
              <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                <strong>Note:</strong> Video generation requires a KIE.AI API key.
                Please add your API key in Settings → API Management before generating videos.
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Gallery Tab */}
        <TabsContent value="gallery" className="space-y-4">
          <VideoGallery />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VideosSection;
