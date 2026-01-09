import React, { useState } from 'react';
import { Rocket, Settings, Image, Clock, Sparkles, Loader2, CheckCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WizardState } from '../AdvertisingWizard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Helper function to upload base64 image to storage and get public URL
async function uploadImageToStorage(
  userId: string,
  base64Image: string,
  imageId: string
): Promise<string> {
  // If it's already an HTTP URL, return it directly
  if (base64Image.startsWith('http')) {
    return base64Image;
  }

  // Extract image data from base64
  const base64Data = base64Image.includes('base64,')
    ? base64Image.split('base64,')[1]
    : base64Image;

  // Determine file type from data URL
  let fileType = 'png';
  if (base64Image.includes('image/jpeg') || base64Image.includes('image/jpg')) {
    fileType = 'jpg';
  } else if (base64Image.includes('image/webp')) {
    fileType = 'webp';
  }

  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Generate filename
  const timestamp = Date.now();
  const filename = `${userId}/advertising_input_${imageId}_${timestamp}.${fileType}`;

  // Upload to storage
  const { data, error } = await supabase.storage
    .from('generated-images')
    .upload(filename, bytes, {
      contentType: `image/${fileType}`,
      upsert: false
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('generated-images')
    .getPublicUrl(filename);

  console.log('Input image uploaded to storage:', publicUrl);
  return publicUrl;
}

interface ConfirmationStepProps {
  wizardState: WizardState;
  onSettingsChange: (settings: Partial<WizardState>) => void;
  onJobStarted: (jobId: string) => void;
  onError: (error: string) => void;
}

export function ConfirmationStep({
  wizardState,
  onSettingsChange,
  onJobStarted,
  onError,
}: ConfirmationStepProps) {
  const { user } = useAuth();
  const [isStarting, setIsStarting] = useState(false);

  // Calculate totals
  const totalImages = wizardState.selectedStyles.length;

  // Group by platform for summary
  const platformCounts: Record<string, number> = {};
  wizardState.selectedStyles.forEach(style => {
    const platform = style.platform;
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  });

  // Estimate generation time (rough: 10-15 seconds per image)
  const estimatedMinutes = Math.ceil((totalImages * 12) / 60);

  // Start background job
  const handleStartGeneration = async () => {
    if (!user?.id) {
      onError('Please log in to generate images');
      return;
    }

    if (totalImages === 0) {
      onError('Please select at least one style');
      return;
    }

    setIsStarting(true);

    try {
      // First, upload the input image to storage to get HTTP URL
      // KIE.AI requires HTTP URLs, not base64 data URLs
      console.log('Uploading input image to storage...');
      const jobId = crypto.randomUUID();
      const inputImageUrl = await uploadImageToStorage(
        user.id,
        wizardState.productImage!,
        jobId
      );
      console.log('Input image uploaded:', inputImageUrl);

      // Create collection first
      const { data: collection, error: collectionError } = await supabase
        .from('image_collections')
        .insert({
          user_id: user.id,
          name: wizardState.groupName,
          description: `Generated advertising images for ${wizardState.productAnalysis?.productName || 'product'}`,
        })
        .select('id')
        .single();

      if (collectionError) {
        throw new Error('Failed to create collection: ' + collectionError.message);
      }

      // Create the advertising job with the uploaded image URL
      const { data: job, error: jobError } = await supabase
        .from('advertising_jobs')
        .insert({
          user_id: user.id,
          collection_id: collection.id,
          status: 'pending',
          total_images: totalImages,
          input_image_url: inputImageUrl, // Use HTTP URL, not base64
          product_analysis: wizardState.productAnalysis,
          recommended_styles: wizardState.recommendations.filter(r => r.isRecommended).map(r => ({
            styleId: r.style.id,
            score: r.score,
            reason: r.reason,
          })),
          selected_styles: wizardState.selectedStyles.map(s => ({
            id: s.id,
            name: s.name,
            platform: s.platform,
            prompt: s.prompt,
            negativePrompt: s.negativePrompt,
            aspectRatio: s.aspectRatio,
            strength: s.strength,
            seriesNumber: s.seriesNumber,
            description: s.description,
          })),
          image_quality: wizardState.imageQuality,
          group_name: wizardState.groupName,
        })
        .select('id')
        .single();

      if (jobError) {
        throw new Error('Failed to create job: ' + jobError.message);
      }

      // Create job items for each selected style
      const jobItems = wizardState.selectedStyles.map(style => ({
        job_id: job.id,
        style_id: style.id,
        style_name: style.name,
        platform: style.platform,
        series_number: style.seriesNumber,
        status: 'pending',
      }));

      const { error: itemsError } = await supabase
        .from('advertising_job_items')
        .insert(jobItems);

      if (itemsError) {
        throw new Error('Failed to create job items: ' + itemsError.message);
      }

      // Call edge function to start processing
      const { error: processError } = await supabase.functions.invoke(
        'process-advertising-job',
        {
          body: { jobId: job.id },
        }
      );

      // Note: We don't wait for processing to complete
      // The edge function will handle it in the background
      if (processError) {
        console.warn('Failed to start processing:', processError);
        // Update job status to indicate it needs manual processing
        await supabase
          .from('advertising_jobs')
          .update({ status: 'pending', error_message: 'Processing will start shortly' })
          .eq('id', job.id);
      }

      // Success!
      onJobStarted(job.id);
    } catch (error: any) {
      console.error('Failed to start job:', error);
      onError(error.message || 'Failed to start image generation');
    } finally {
      setIsStarting(false);
    }
  };

  if (wizardState.jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-semibold text-green-800">Generation Started!</h3>
          <p className="text-muted-foreground mt-2">
            Your {totalImages} images are being generated in the background.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            You'll receive a notification when they're ready.
          </p>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-800 px-4 py-2">
          Job ID: {wizardState.jobId.slice(0, 8)}...
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">Ready to Generate</h3>
        <p className="text-sm text-muted-foreground">
          Review your settings and start background generation
        </p>
      </div>

      {/* Generation Summary */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-purple-700">{totalImages}</div>
            <div className="text-sm text-gray-600">Images</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-700">
              {Object.keys(platformCounts).length}
            </div>
            <div className="text-sm text-gray-600">Platforms</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-700">{wizardState.imageQuality}</div>
            <div className="text-sm text-gray-600">Quality</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-700">~{estimatedMinutes}m</div>
            <div className="text-sm text-gray-600">Est. Time</div>
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="mt-4 pt-4 border-t border-purple-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Platforms:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(platformCounts).map(([platform, count]) => (
              <Badge key={platform} variant="secondary" className="bg-white">
                {platform}: {count} {count === 1 ? 'image' : 'images'}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </h4>

        {/* Group Name */}
        <div className="space-y-2">
          <Label htmlFor="group-name">Collection Name</Label>
          <Input
            id="group-name"
            value={wizardState.groupName}
            onChange={(e) => onSettingsChange({ groupName: e.target.value })}
            placeholder="Enter a name for this collection"
          />
          <p className="text-xs text-muted-foreground">
            Images will be saved to this collection in your gallery
          </p>
        </div>

        {/* Image Quality */}
        <div className="space-y-2">
          <Label>Image Quality</Label>
          <RadioGroup
            value={wizardState.imageQuality}
            onValueChange={(value) =>
              onSettingsChange({ imageQuality: value as '1K' | '2K' | '4K' })
            }
            className="flex gap-4"
          >
            {[
              { value: '1K', label: '1K', desc: 'Fast, lower quality' },
              { value: '2K', label: '2K', desc: 'Balanced (Recommended)' },
              { value: '4K', label: '4K', desc: 'High quality, slower' },
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`quality-${option.value}`} />
                <Label
                  htmlFor={`quality-${option.value}`}
                  className="flex flex-col cursor-pointer"
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.desc}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Background Generation Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Background Generation</h4>
            <p className="text-sm text-blue-800 mt-1">
              Images will be generated in the background. You can leave this page and
              continue using the app. We'll notify you when all images are ready in
              your gallery.
            </p>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={handleStartGeneration}
          disabled={isStarting || totalImages === 0}
          className="px-8 py-6 text-lg"
        >
          {isStarting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5 mr-2" />
              Generate {totalImages} Images in Background
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ConfirmationStep;
