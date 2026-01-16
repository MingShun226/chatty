import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// KIE.AI API configuration - correct endpoints
const KIE_API_BASE = 'https://api.kie.ai';
const KIE_CREATE_TASK_ENDPOINT = '/api/v1/jobs/createTask';
const KIE_CHECK_STATUS_ENDPOINT = '/api/v1/jobs/recordInfo';

interface AdvertisingStyle {
  id: string;
  name: string;
  platform: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  strength: number;
  seriesNumber: number;
  description?: string;
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

// Size multipliers for quality settings
function getSizeMultiplier(quality: string): number {
  switch (quality) {
    case '1K': return 1.0;
    case '2K': return 2.0;
    case '4K': return 4.0;
    default: return 2.0;
  }
}

// Get KIE.AI API key (admin-assigned > user's key > platform key)
async function getKieApiKey(supabase: any, userId: string): Promise<string> {
  // First check for admin-assigned API key (platform-managed)
  const { data: adminKey } = await supabase
    .from('admin_assigned_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('service', 'kie-ai')
    .eq('is_active', true)
    .maybeSingle();

  if (adminKey?.api_key_encrypted) {
    try {
      console.log('Using admin-assigned KIE.AI API key');
      // Update last_used_at (async, don't wait)
      supabase
        .from('admin_assigned_api_keys')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('service', 'kie-ai')
        .eq('is_active', true)
        .then(() => {})
        .catch(() => {});
      return atob(adminKey.api_key_encrypted);
    } catch (e) {
      console.error('Failed to decrypt admin-assigned KIE API key');
    }
  }

  // Fall back to user's personal key
  const { data: userKey } = await supabase
    .from('user_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('service', 'kie-ai')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (userKey?.api_key_encrypted) {
    try {
      console.log('Using user personal KIE.AI API key');
      // Update last_used_at (async, don't wait)
      supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('service', 'kie-ai')
        .eq('status', 'active')
        .then(() => {})
        .catch(() => {});
      return atob(userKey.api_key_encrypted);
    } catch (e) {
      console.error('Failed to decrypt user KIE API key');
    }
  }

  // Fall back to platform key
  const platformKey = Deno.env.get('KIE_API_KEY');
  if (!platformKey) {
    throw new Error('No KIE.AI API key configured. Please contact your administrator.');
  }
  console.log('Using platform KIE.AI API key');
  return platformKey;
}

// Helper: Convert width/height to aspect ratio
function getAspectRatioFromSize(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  const ratio = `${w}:${h}`;

  // Normalize to standard ratios
  const standardRatios: Record<string, string> = {
    '1:1': '1:1',
    '4:3': '4:3',
    '3:4': '3:4',
    '16:9': '16:9',
    '9:16': '9:16',
    '3:2': '3:2',
    '2:3': '2:3',
    '5:4': '5:4',
    '4:5': '4:5',
    '21:9': '21:9',
  };

  return standardRatios[ratio] || '1:1';
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

// Generate image using KIE.AI - CORRECT FORMAT
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
  const aspectRatio = style.aspectRatio || getAspectRatioFromSize(width, height);

  // Build customized prompt
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

  console.log(`Generating image for style: ${style.name}`);
  console.log(`Aspect ratio: ${aspectRatio}, Dimensions: ${width}x${height}`);
  console.log(`Input image URL: ${inputImageUrl}`);

  // Build KIE.AI request - CORRECT FORMAT matching generate-image-unified
  const input: Record<string, any> = {
    prompt: customizedPrompt,
    image_urls: [inputImageUrl], // KIE.AI expects array of URLs
    image_size: aspectRatio,
    output_format: 'png',
  };

  // Add negative prompt if provided
  if (style.negativePrompt) {
    input.negative_prompt = style.negativePrompt;
  }

  const requestBody = {
    model: 'google/nano-banana-edit', // Correct model ID
    input,
  };

  console.log('KIE.AI request body:', JSON.stringify(requestBody, null, 2));

  // Call KIE.AI API - CORRECT ENDPOINT
  const response = await fetch(`${KIE_API_BASE}${KIE_CREATE_TASK_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('KIE.AI API error:', response.status, errorText);
    throw new Error(`KIE.AI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('KIE.AI response:', JSON.stringify(result, null, 2));

  // Check for API errors
  if (result.code !== 200) {
    const errorMsg = result.msg || result.message || result.error || 'Unknown error';
    throw new Error(`KIE.AI error (${result.code}): ${errorMsg}`);
  }

  if (!result.data?.taskId) {
    throw new Error('Invalid response from KIE.AI: Missing taskId');
  }

  return { taskId: result.data.taskId };
}

// Check task status - CORRECT ENDPOINT
async function checkTaskStatus(apiKey: string, taskId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
}> {
  const url = `${KIE_API_BASE}${KIE_CHECK_STATUS_ENDPOINT}?taskId=${taskId}`;
  console.log(`Checking task status: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error(`Status check failed: ${response.status}`);
    return { status: 'processing' };
  }

  const result = await response.json();
  console.log(`Task status response:`, JSON.stringify(result, null, 2));

  // KIE.AI unified jobs API uses state: "waiting", "success", "fail"
  if (result.code === 200 && result.data) {
    const state = result.data.state;

    if (state === 'success' && result.data.resultJson) {
      try {
        const resultData = typeof result.data.resultJson === 'string'
          ? JSON.parse(result.data.resultJson)
          : result.data.resultJson;

        const imageUrl = resultData.resultUrls?.[0];

        if (imageUrl) {
          return {
            status: 'completed',
            imageUrl,
          };
        }
      } catch (e) {
        console.error('Failed to parse resultJson:', e);
      }
    } else if (state === 'fail') {
      return {
        status: 'failed',
        error: result.data.failMsg || result.data.failCode || 'Generation failed',
      };
    }
  }

  return { status: 'processing' };
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

    let taskId = item.task_id;

    // If we already have a taskId, skip generation and just poll for results
    // This handles the case where generation succeeded but saving failed
    if (taskId) {
      console.log(`Item ${item.id} already has taskId ${taskId}, checking for existing result...`);
    } else {
      // Start new generation only if no taskId exists
      console.log(`Item ${item.id} has no taskId, starting new generation...`);
      const result = await generateImage(apiKey, inputImageUrl, style, quality, productAnalysis);
      taskId = result.taskId;

      // Save task ID
      await supabase
        .from('advertising_job_items')
        .update({ task_id: taskId })
        .eq('id', item.id);
    }

    // Poll for completion (max 45 attempts, 2 seconds each = 90 seconds)
    // Reduced from 2 minutes to avoid edge function timeout
    let attempts = 0;
    const maxAttempts = 45;

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
            negative_prompt: style.negativePrompt || null,
            image_url: status.imageUrl,
            original_image_url: inputImageUrl,
            generation_type: 'img2img', // Must match database constraint: text2img, img2img, inpaint
            provider: 'kie-ai',
            model: 'google/nano-banana-edit',
            width: ASPECT_RATIO_DIMENSIONS[style.aspectRatio]?.width || 1024,
            height: ASPECT_RATIO_DIMENSIONS[style.aspectRatio]?.height || 1024,
            parameters: {
              strength: style.strength,
              quality,
              negativePrompt: style.negativePrompt,
              styleName: style.name,
              styleDescription: style.description,
              aspectRatio: style.aspectRatio,
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
          throw new Error(`Failed to save image: ${saveError.message}`);
        }

        // Also add to image_collection_items junction table
        if (savedImage?.id && collectionId) {
          const { error: collectionItemError } = await supabase
            .from('image_collection_items')
            .insert({
              collection_id: collectionId,
              image_id: savedImage.id,
              user_id: job.user_id,
              sort_order: style.seriesNumber || 0,
            });

          if (collectionItemError) {
            console.error('Failed to add image to collection:', collectionItemError);
            // Don't throw - image was saved successfully, collection link is secondary
          } else {
            console.log(`Added image ${savedImage.id} to collection ${collectionId}`);
          }
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

    console.log(`=== Processing advertising job: ${jobId} ===`);

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

    console.log(`Job details:`, {
      userId: job.user_id,
      totalImages: job.total_images,
      quality: job.image_quality,
      inputImageUrl: job.input_image_url,
    });

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
    console.log(`Got KIE.AI API key for user ${job.user_id}`);

    // Get pending items (only pending, not processing - to avoid duplicate processing)
    const { data: items, error: itemsError } = await supabase
      .from('advertising_job_items')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (itemsError) {
      throw new Error('Failed to get job items');
    }

    // If no pending items, check if job is complete
    if (!items || items.length === 0) {
      console.log('No pending items found, checking job status...');

      // Check if there are any processing items (another invocation is handling them)
      const { data: processingItems } = await supabase
        .from('advertising_job_items')
        .select('id')
        .eq('job_id', jobId)
        .eq('status', 'processing');

      if (processingItems && processingItems.length > 0) {
        console.log(`${processingItems.length} items still processing, exiting to avoid duplicate work`);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Items already being processed by another invocation',
            jobId,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // All items done
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All items already processed',
          jobId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing ${items.length} items for job ${jobId}`);

    // Track start time for timeout management
    const startTime = Date.now();
    const maxExecutionTime = 50000; // 50 seconds - leave buffer for Supabase timeout
    let processedCount = 0;

    // Process items SEQUENTIALLY to avoid timeout issues
    // Edge functions have limited execution time, so we process one at a time
    for (const item of items) {
      // Check if we're approaching timeout
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > maxExecutionTime) {
        console.log(`Approaching timeout after ${elapsedTime}ms, processed ${processedCount}/${items.length} items`);

        // Re-invoke function for remaining items
        console.log('Re-invoking function for remaining items...');

        // Use fetch to call ourselves again (fire and forget)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        fetch(`${supabaseUrl}/functions/v1/process-advertising-job`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ jobId }),
        }).catch(err => console.error('Failed to re-invoke:', err));

        break;
      }

      await processJobItem(
        supabase,
        apiKey,
        jobId,
        item,
        job.input_image_url,
        job.selected_styles,
        job.image_quality,
        job.product_analysis,
        job.collection_id
      );

      processedCount++;
      console.log(`Completed item ${processedCount}/${items.length} (${item.style_name})`);
    }

    // Check if all items are done and update job status
    const { data: remainingItems } = await supabase
      .from('advertising_job_items')
      .select('id')
      .eq('job_id', jobId)
      .in('status', ['pending', 'processing']);

    const { data: completedItems } = await supabase
      .from('advertising_job_items')
      .select('id')
      .eq('job_id', jobId)
      .eq('status', 'completed');

    const { data: failedItems } = await supabase
      .from('advertising_job_items')
      .select('id')
      .eq('job_id', jobId)
      .eq('status', 'failed');

    const allDone = !remainingItems || remainingItems.length === 0;
    const completedCount = completedItems?.length || 0;
    const failedCount = failedItems?.length || 0;

    // Manually update job status since trigger might not fire
    if (allDone) {
      let finalStatus = 'completed';
      if (failedCount > 0 && completedCount === 0) {
        finalStatus = 'failed';
      } else if (failedCount > 0) {
        finalStatus = 'partial';
      }

      console.log(`All items done. Updating job status to: ${finalStatus}`);
      await supabase
        .from('advertising_jobs')
        .update({
          status: finalStatus,
          progress: 100,
          completed_images: completedCount,
          failed_images: failedCount,
          completed_at: new Date().toISOString(),
          error_message: null, // Clear any previous error
        })
        .eq('id', jobId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: allDone
          ? `Completed all ${items.length} items`
          : `Processed ${processedCount}/${items.length} items, continuing in background`,
        jobId,
        processedCount,
        totalItems: items.length,
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
