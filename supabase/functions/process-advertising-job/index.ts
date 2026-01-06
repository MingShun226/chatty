import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// KIE.AI API configuration
const KIE_API_URL = 'https://api.kie.ai/v1';

interface AdvertisingStyle {
  id: string;
  name: string;
  platform: string;
  prompt: string;
  aspectRatio: string;
  strength: number;
  seriesNumber: number;
}

interface JobItem {
  id: string;
  job_id: string;
  style_id: string;
  style_name: string;
  platform: string;
  series_number: number;
  status: string;
  task_id: string | null;
}

// Aspect ratio to dimensions mapping
const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '4:5': { width: 1024, height: 1280 },
  '5:4': { width: 1280, height: 1024 },
};

// Size multipliers for quality settings
function getSizeMultiplier(quality: string): number {
  switch (quality) {
    case '1K': return 1.0;
    case '2K': return 2.0;
    case '4K': return 4.0;
    default: return 2.0;
  }
}

// Get KIE.AI API key
async function getKieApiKey(supabase: any, userId: string): Promise<string> {
  // Try user's personal key first
  const { data: userKey } = await supabase
    .from('user_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('service', 'kie-ai')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (userKey?.api_key_encrypted) {
    try {
      return atob(userKey.api_key_encrypted);
    } catch (e) {
      console.error('Failed to decrypt user KIE API key');
    }
  }

  // Fall back to platform key
  const platformKey = Deno.env.get('KIE_API_KEY');
  if (!platformKey) {
    throw new Error('No KIE.AI API key available. Please add your API key in Settings.');
  }
  return platformKey;
}

// Generate image using KIE.AI
async function generateImage(
  apiKey: string,
  inputImageUrl: string,
  style: AdvertisingStyle,
  quality: string,
  productAnalysis: any
): Promise<{ taskId: string }> {
  // Get dimensions
  const baseDimensions = ASPECT_RATIO_DIMENSIONS[style.aspectRatio] || { width: 1024, height: 1024 };
  const multiplier = getSizeMultiplier(quality);
  const width = Math.round(baseDimensions.width * multiplier);
  const height = Math.round(baseDimensions.height * multiplier);

  // Customize prompt with product info
  let customizedPrompt = style.prompt;
  if (productAnalysis) {
    const productName = productAnalysis.productName || 'product';
    const colors = productAnalysis.colors?.join(', ') || '';
    const features = productAnalysis.keyFeatures?.join(', ') || '';

    customizedPrompt = customizedPrompt
      .replace(/product/gi, productName)
      .replace(/\{product\}/gi, productName);

    if (colors) {
      customizedPrompt += ` Product colors: ${colors}.`;
    }
    if (features) {
      customizedPrompt += ` Key features: ${features}.`;
    }
  }

  console.log(`Generating image for style: ${style.name}, dimensions: ${width}x${height}`);

  // Call KIE.AI API
  const response = await fetch(`${KIE_API_URL}/images/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'nano-banana-edit', // img2img model
      prompt: customizedPrompt,
      input_image: inputImageUrl,
      width,
      height,
      strength: style.strength,
      num_images: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`KIE.AI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return { taskId: result.task_id || result.id };
}

// Check task status
async function checkTaskStatus(apiKey: string, taskId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
}> {
  const response = await fetch(`${KIE_API_URL}/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    return { status: 'failed', error: `Failed to check status: ${response.status}` };
  }

  const result = await response.json();

  if (result.status === 'succeeded' || result.status === 'completed') {
    return {
      status: 'completed',
      imageUrl: result.output?.images?.[0] || result.images?.[0] || result.image_url,
    };
  } else if (result.status === 'failed' || result.status === 'error') {
    return { status: 'failed', error: result.error || 'Generation failed' };
  } else {
    return { status: 'processing' };
  }
}

// Process a single job item
async function processJobItem(
  supabase: any,
  apiKey: string,
  jobId: string,
  item: JobItem,
  inputImageUrl: string,
  selectedStyles: AdvertisingStyle[],
  quality: string,
  productAnalysis: any,
  collectionId: string
): Promise<void> {
  const style = selectedStyles.find(s => s.id === item.style_id);
  if (!style) {
    console.error(`Style not found: ${item.style_id}`);
    await supabase
      .from('advertising_job_items')
      .update({ status: 'failed', error_message: 'Style not found' })
      .eq('id', item.id);
    return;
  }

  try {
    // Update status to processing
    await supabase
      .from('advertising_job_items')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', item.id);

    // Start generation
    const { taskId } = await generateImage(apiKey, inputImageUrl, style, quality, productAnalysis);

    // Save task ID
    await supabase
      .from('advertising_job_items')
      .update({ task_id: taskId })
      .eq('id', item.id);

    // Poll for completion (max 60 attempts, 2 seconds each = 2 minutes)
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const status = await checkTaskStatus(apiKey, taskId);

      if (status.status === 'completed' && status.imageUrl) {
        // Get job user_id for saving image
        const { data: job } = await supabase
          .from('advertising_jobs')
          .select('user_id')
          .eq('id', jobId)
          .single();

        // Save to generated_images
        const { data: savedImage, error: saveError } = await supabase
          .from('generated_images')
          .insert({
            user_id: job.user_id,
            prompt: style.prompt,
            image_url: status.imageUrl,
            original_image_url: inputImageUrl,
            generation_type: 'image-to-image',
            provider: 'kie-ai',
            model: 'nano-banana-edit',
            parameters: {
              width: ASPECT_RATIO_DIMENSIONS[style.aspectRatio]?.width || 1024,
              height: ASPECT_RATIO_DIMENSIONS[style.aspectRatio]?.height || 1024,
              strength: style.strength,
              quality,
            },
            job_id: jobId,
            collection_id: collectionId,
            style_id: style.id,
            platform: style.platform,
          })
          .select('id')
          .single();

        if (saveError) {
          console.error('Failed to save image:', saveError);
        }

        // Update item as completed
        await supabase
          .from('advertising_job_items')
          .update({
            status: 'completed',
            generated_image_id: savedImage?.id,
            image_url: status.imageUrl,
            completed_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        console.log(`Completed item ${item.id} for style ${style.name}`);
        return;
      } else if (status.status === 'failed') {
        throw new Error(status.error || 'Generation failed');
      }
    }

    // Timeout
    throw new Error('Generation timed out after 2 minutes');
  } catch (error: any) {
    console.error(`Failed to process item ${item.id}:`, error);

    // Check if we should retry
    const { data: currentItem } = await supabase
      .from('advertising_job_items')
      .select('retry_count')
      .eq('id', item.id)
      .single();

    const retryCount = (currentItem?.retry_count || 0) + 1;

    if (retryCount < 3) {
      // Mark for retry
      await supabase
        .from('advertising_job_items')
        .update({
          status: 'pending',
          retry_count: retryCount,
          error_message: error.message,
        })
        .eq('id', item.id);
    } else {
      // Mark as failed
      await supabase
        .from('advertising_job_items')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    }
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      throw new Error('Job ID is required');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('advertising_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // Update job status to generating
    await supabase
      .from('advertising_jobs')
      .update({
        status: 'generating',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Get API key
    const apiKey = await getKieApiKey(supabase, job.user_id);

    // Get pending items
    const { data: items, error: itemsError } = await supabase
      .from('advertising_job_items')
      .select('*')
      .eq('job_id', jobId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true });

    if (itemsError) {
      throw new Error('Failed to get job items');
    }

    console.log(`Processing ${items.length} items for job ${jobId}`);

    // Process items in batches of 5 (for rate limiting)
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Process batch concurrently
      await Promise.all(
        batch.map(item =>
          processJobItem(
            supabase,
            apiKey,
            jobId,
            item,
            job.input_image_url,
            job.selected_styles,
            job.image_quality,
            job.product_analysis,
            job.collection_id
          )
        )
      );

      console.log(`Completed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(items.length / batchSize)}`);
    }

    // Job status will be updated by the database trigger

    return new Response(
      JSON.stringify({
        success: true,
        message: `Started processing ${items.length} items`,
        jobId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error processing job:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process job',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
