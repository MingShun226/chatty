import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper: Upload base64 image to Supabase Storage
async function uploadToStorage(
  supabase: any,
  userId: string,
  base64Image: string,
  imageId: string
): Promise<string> {
  const base64Data = base64Image.includes('base64,')
    ? base64Image.split('base64,')[1]
    : base64Image;

  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  const timestamp = Date.now();
  const filename = `${userId}/${imageId}_${timestamp}.png`;

  const { data, error } = await supabase.storage
    .from('generated-images')
    .upload(filename, binaryData, {
      contentType: 'image/png',
      upsert: false
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('generated-images')
    .getPublicUrl(filename);

  console.log('Image uploaded to storage:', publicUrl);
  return publicUrl;
}

// Helper function to get API key (admin-assigned > user's key > platform key)
async function getApiKey(
  supabase: any,
  userId: string,
  provider: string,
  platformKey: string | undefined
): Promise<string> {
  console.log(`Getting API key for provider: ${provider}, user: ${userId}`);

  // First check for admin-assigned API key (platform-managed)
  const { data: adminKey } = await supabase
    .from('admin_assigned_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('service', provider)
    .eq('is_active', true)
    .maybeSingle();

  if (adminKey?.api_key_encrypted) {
    console.log(`Using admin-assigned ${provider} API key`);

    // Update last_used_at (async, don't wait)
    supabase
      .from('admin_assigned_api_keys')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('service', provider)
      .eq('is_active', true)
      .then(() => {})
      .catch(() => {});

    try {
      return atob(adminKey.api_key_encrypted);
    } catch (e) {
      console.error('Failed to decrypt admin-assigned API key:', e);
    }
  }

  // Fall back to user's personal API key
  const { data: userKey, error } = await supabase
    .from('user_api_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .eq('service', provider)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && userKey?.api_key_encrypted) {
    console.log(`Using user's personal ${provider} API key`);

    // Update last_used_at (async, don't wait)
    supabase
      .from('user_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('service', provider)
      .eq('status', 'active')
      .then(() => {})
      .catch(() => {});

    try {
      return atob(userKey.api_key_encrypted);
    } catch (e) {
      console.error('Failed to decrypt user API key:', e);
      throw new Error(`Failed to decrypt ${provider} API key. Please re-add your API key in Settings > API Management.`);
    }
  }

  // Fall back to platform key
  if (platformKey) {
    console.log(`Using platform ${provider} API key`);
    return platformKey;
  }

  const providerNames: Record<string, string> = {
    'kie-ai': 'KIE.AI'
  };

  const providerName = providerNames[provider] || provider;
  const errorMessage = `No ${providerName} API key configured. Please contact your administrator.`;

  console.error(errorMessage);
  throw new Error(errorMessage);
}

// KIE.AI Unified Jobs API for Video Generation
async function generateVideoWithKie(
  modelId: string,
  modelName: string,
  prompt: string,
  parameters: any,
  apiKey: string,
  inputImage?: string,
  inputImages?: string[]
) {
  console.log(`Generating video with KIE.AI ${modelName}:`, { modelId, prompt, parameters, hasInputImage: !!inputImage, hasInputImages: !!inputImages });

  const input: any = {
    prompt,
  };

  // Get parameters
  const aspectRatio = parameters.aspect_ratio || '16:9';
  const duration = parameters.duration || 5;

  console.log(`Video parameters: aspectRatio=${aspectRatio}, duration=${duration}`);

  // Model-specific parameters
  if (modelId === 'sora-2-pro-text-to-video') {
    // Sora 2 Pro - text-to-video only
    // Convert aspect ratio to portrait/landscape
    input.aspect_ratio = aspectRatio === '9:16' ? 'portrait' : 'landscape';

    // Convert duration to n_frames (10s or 15s only)
    input.n_frames = duration >= 15 ? '15' : '10';

    // Size quality
    input.size = 'high'; // or 'standard'

    // Remove watermark
    input.remove_watermark = true;

    console.log(`Sora 2 Pro Text2Vid: aspect_ratio=${input.aspect_ratio}, n_frames=${input.n_frames}s, size=${input.size}`);
  } else if (modelId === 'sora-2-pro-image-to-video') {
    // Sora 2 Pro - image-to-video (supports multiple images)
    if (!inputImages || inputImages.length === 0) {
      throw new Error(`${modelName} requires at least one input image`);
    }

    input.image_urls = inputImages; // Multiple images support
    input.aspect_ratio = aspectRatio === '9:16' ? 'portrait' : 'landscape';
    input.n_frames = duration >= 15 ? '15' : '10';
    input.size = 'high';
    input.remove_watermark = true;

    console.log(`Sora 2 Pro Img2Vid: ${inputImages.length} images, aspect_ratio=${input.aspect_ratio}, n_frames=${input.n_frames}s`);
  } else if (modelId === 'veo3_fast' || modelId === 'veo3') {
    // Veo 3.1 - supports both text2vid and img2vid
    if (inputImage) {
      input.image_url = inputImage; // For img2vid
    }
    input.aspect_ratio = aspectRatio;
    input.duration = Math.min(duration, 8); // Max 8 seconds
    input.include_audio = true;
    console.log(`Veo 3.1: aspect_ratio=${aspectRatio}, duration=${input.duration}s, img2vid=${!!inputImage}`);
  } else if (modelId === 'hailuo/2-3-image-to-video-standard' || modelId === 'hailuo/2-3-image-to-video-pro') {
    // Hailuo 2.3 - image-to-video only (supports both Standard and Pro)
    if (!inputImage) {
      throw new Error(`${modelName} requires an input image`);
    }
    input.image_url = inputImage;
    input.aspect_ratio = aspectRatio;
    input.duration = String(Math.min(duration, 6)); // Max 6 seconds - must be string!
    console.log(`${modelName}: aspect_ratio=${aspectRatio}, duration=${input.duration}s`);
  }

  const requestBody = {
    model: modelId,
    input,
  };

  console.log('KIE.AI video request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`KIE.AI ${modelName} error:`, response.status, errorText);
    throw new Error(`KIE.AI ${modelName} error: ${errorText}`);
  }

  const result = await response.json();
  console.log(`KIE.AI ${modelName} response:`, JSON.stringify(result, null, 2));

  if (!result || typeof result !== 'object') {
    console.error('Invalid KIE.AI response - not an object:', result);
    throw new Error(`Invalid response from KIE.AI ${modelName}: Response is not a valid JSON object`);
  }

  if (result.code !== 200) {
    console.error(`KIE.AI ${modelName} returned error code:`, result.code);
    console.error('Full error response:', JSON.stringify(result, null, 2));
    const errorMsg = result.msg || result.message || result.error || 'Unknown error';
    throw new Error(`KIE.AI ${modelName} error (${result.code}): ${errorMsg}`);
  }

  if (!result.data?.taskId) {
    console.error('KIE.AI response missing taskId:', JSON.stringify(result, null, 2));
    throw new Error(`Invalid response from KIE.AI ${modelName}: Missing taskId in response data`);
  }

  return {
    taskId: result.data.taskId,
    model: modelId,
    status: 'processing',
  };
}

// Veo 3.1 Specific API for Video Generation
async function generateVideoWithVeo(
  model: 'veo3' | 'veo3_fast',
  modelName: string,
  prompt: string,
  parameters: any,
  apiKey: string,
  inputImage?: string
) {
  console.log(`Generating video with Veo 3.1 ${modelName}:`, { model, prompt, parameters, hasInputImage: !!inputImage });

  let aspectRatio = parameters.aspect_ratio || '16:9';

  // Veo only supports 16:9 and 9:16, convert 1:1 to 16:9
  if (aspectRatio === '1:1') {
    console.log('Veo does not support 1:1 aspect ratio, converting to 16:9');
    aspectRatio = '16:9';
  }

  // Validate aspect ratio
  if (!['16:9', '9:16'].includes(aspectRatio)) {
    console.error(`Invalid aspect ratio for Veo: ${aspectRatio}`);
    throw new Error(`Veo only supports 16:9 or 9:16 aspect ratios. Got: ${aspectRatio}`);
  }

  const duration = parameters.duration || 5;

  const requestBody: any = {
    prompt,
    model,
    aspectRatio,
    enableTranslation: true,
  };

  // Determine generation type and add image if needed
  if (inputImage) {
    requestBody.imageUrls = [inputImage];
    requestBody.generationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO';
    console.log(`Veo ${modelName} image-to-video mode with image`);
  } else {
    requestBody.generationType = 'TEXT_2_VIDEO';
    console.log(`Veo ${modelName} text-to-video mode`);
  }

  console.log('Veo API request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Veo ${modelName} error:`, response.status, errorText);
    throw new Error(`Veo ${modelName} error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log(`Veo ${modelName} response:`, JSON.stringify(result, null, 2));

  if (!result || typeof result !== 'object') {
    console.error('Invalid Veo response - not an object:', result);
    throw new Error(`Invalid response from Veo ${modelName}: Response is not a valid JSON object`);
  }

  if (result.code !== 200) {
    console.error(`Veo ${modelName} returned error code:`, result.code);
    console.error('Full error response:', JSON.stringify(result, null, 2));
    const errorMsg = result.msg || result.message || result.error || 'Unknown error';
    throw new Error(`Veo ${modelName} error (${result.code}): ${errorMsg}`);
  }

  if (!result.data?.taskId) {
    console.error('Veo response missing taskId:', JSON.stringify(result, null, 2));
    throw new Error(`Invalid response from Veo ${modelName}: Missing taskId in response data`);
  }

  return {
    taskId: result.data.taskId,
    model,
    status: 'processing',
  };
}

// Check Veo 3.1 video progress
async function checkVeoVideoProgress(taskId: string, apiKey: string, provider: string) {
  const endpoint = `/api/v1/veo/record-info?task_id=${taskId}`;

  console.log(`Checking Veo video progress for ${provider} at ${endpoint}`);

  const response = await fetch(`https://api.kie.ai${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Veo progress check failed for ${provider}:`, response.status, errorText);
    return {
      status: 'processing',
      progress: 50,
    };
  }

  const result = await response.json();
  console.log(`Veo progress result for ${provider}:`, JSON.stringify(result, null, 2));

  if (result.code === 200 && result.data) {
    const status = result.data.status;

    // Check for completion
    if (status === 'completed' || status === 'success') {
      const videoUrl = result.data.video_url || result.data.videoUrl || result.data.output_video_url;

      if (videoUrl) {
        return {
          status: 'completed',
          progress: 100,
          videoUrl,
        };
      }
    } else if (status === 'failed' || status === 'error') {
      return {
        status: 'failed',
        progress: 0,
        error: result.data.error_message || result.data.errorMessage || 'Video generation failed',
      };
    } else {
      // Still processing
      return {
        status: 'processing',
        progress: 50,
      };
    }
  }

  return {
    status: 'processing',
    progress: 50,
  };
}

async function checkKieVideoProgress(taskId: string, apiKey: string, provider: string) {
  const endpoint = `/api/v1/jobs/recordInfo?taskId=${taskId}`;

  console.log(`Checking KIE.AI video progress for ${provider} at ${endpoint}`);

  const response = await fetch(`https://api.kie.ai${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Progress check failed for ${provider}:`, response.status, errorText);
    return {
      status: 'processing',
      progress: 50,
    };
  }

  const result = await response.json();
  console.log(`Progress result for ${provider}:`, JSON.stringify(result, null, 2));

  if (result.code === 200 && result.data) {
    const state = result.data.state;

    if (state === 'success' && result.data.resultJson) {
      try {
        const resultData = typeof result.data.resultJson === 'string'
          ? JSON.parse(result.data.resultJson)
          : result.data.resultJson;

        const videoUrl = resultData.resultUrls?.[0] || resultData.videoUrl;

        if (videoUrl) {
          return {
            status: 'completed',
            progress: 100,
            videoUrl,
          };
        }
      } catch (e) {
        console.error('Failed to parse resultJson:', e);
      }
    } else if (state === 'fail') {
      return {
        status: 'failed',
        progress: 0,
        error: result.data.failMsg || result.data.failCode || 'Video generation failed',
      };
    } else {
      return {
        status: 'processing',
        progress: 50,
      };
    }
  }

  return {
    status: 'processing',
    progress: 50,
  };
}

serve(async (req) => {
  console.log('=== VIDEO GENERATION EDGE FUNCTION ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('Request body received:', JSON.stringify({
      provider: requestBody.provider,
      hasPrompt: !!requestBody.prompt,
      hasInputImage: !!requestBody.inputImage,
      checkProgress: requestBody.checkProgress,
      taskId: requestBody.taskId,
    }, null, 2));

    const { prompt, provider = 'kie-veo3-fast', parameters = {}, checkProgress = false, taskId, inputImage, inputImages } = requestBody;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle progress check
    if (checkProgress && taskId) {
      console.log('Checking progress for task:', taskId, 'provider:', provider);

      if (provider.startsWith('kie-')) {
        const kieApiKey = await getApiKey(
          supabase,
          user.id,
          'kie-ai',
          Deno.env.get('KIE_AI_API_KEY')
        );

        let progress;

        // Use Veo-specific progress check for Veo providers
        if (provider === 'kie-veo3-fast' || provider === 'kie-veo3-quality') {
          progress = await checkVeoVideoProgress(taskId, kieApiKey, provider);
        } else {
          // Use generic KIE progress check for other providers
          progress = await checkKieVideoProgress(taskId, kieApiKey, provider);
        }

        return new Response(
          JSON.stringify(progress),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ status: 'processing', progress: 50 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate prompt
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating video with provider: ${provider}`);

    let result;

    const kieKey = await getApiKey(
      supabase,
      user.id,
      'kie-ai',
      Deno.env.get('KIE_AI_API_KEY')
    );

    // Upload input image(s) to storage if needed (KIE.AI needs HTTP URLs)
    let processedInputImage: string | undefined = undefined;
    let processedInputImages: string[] | undefined = undefined;

    // Handle multiple images (for Sora img2vid)
    if (inputImages && Array.isArray(inputImages) && inputImages.length > 0) {
      console.log(`Processing ${inputImages.length} input images...`);
      processedInputImages = [];

      for (let i = 0; i < inputImages.length; i++) {
        const img = inputImages[i];
        if (img.startsWith('data:image')) {
          console.log(`Uploading input image ${i + 1} to storage...`);
          const inputImageId = `video_input_${crypto.randomUUID()}`;
          const uploadedUrl = await uploadToStorage(supabase, user.id, img, inputImageId);
          processedInputImages.push(uploadedUrl);
          console.log(`Input image ${i + 1} uploaded:`, uploadedUrl);
        } else if (img.startsWith('http')) {
          processedInputImages.push(img);
          console.log(`Using existing HTTP URL for input image ${i + 1}:`, img);
        }
      }
    }
    // Handle single image (for other img2vid models)
    else if (inputImage) {
      if (inputImage.startsWith('data:image')) {
        console.log('Uploading input image to storage for KIE.AI...');
        const inputImageId = `video_input_${crypto.randomUUID()}`;
        processedInputImage = await uploadToStorage(supabase, user.id, inputImage, inputImageId);
        console.log('Input image uploaded:', processedInputImage);
      } else if (inputImage.startsWith('http')) {
        processedInputImage = inputImage;
        console.log('Using existing HTTP URL for input image:', processedInputImage);
      }
    }

    switch (provider) {
      case 'kie-sora-2-pro-text2vid': {
        result = await generateVideoWithKie(
          'sora-2-pro-text-to-video',
          'Sora 2 Pro (Text)',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-sora-2-pro-img2vid': {
        result = await generateVideoWithKie(
          'sora-2-pro-image-to-video',
          'Sora 2 Pro (Image)',
          prompt,
          parameters,
          kieKey,
          undefined,
          processedInputImages
        );
        break;
      }

      case 'kie-veo3-fast': {
        result = await generateVideoWithVeo(
          'veo3_fast',
          'Fast',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-veo3-quality': {
        result = await generateVideoWithVeo(
          'veo3',
          'Quality',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-hailuo-standard-img2vid': {
        result = await generateVideoWithKie(
          'hailuo/2-3-image-to-video-standard',
          'Hailuo 2.3 Standard Image-to-Video',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-hailuo-pro-img2vid': {
        result = await generateVideoWithKie(
          'hailuo/2-3-image-to-video-pro',
          'Hailuo 2.3 Pro Image-to-Video',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported provider: ${provider}. Only KIE.AI providers are supported.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        taskId: result.taskId,
        status: result.status,
        model: result.model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== VIDEO GENERATION ERROR ===');
    console.error('Unexpected error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('==============================');

    const errorResponse = {
      error: error.message || 'Internal server error',
      details: error.message,
      stack: error.stack,
      type: error.constructor?.name || 'Unknown',
      timestamp: new Date().toISOString(),
    };

    console.error('Returning error response:', JSON.stringify(errorResponse, null, 2));

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
