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
  // Extract image data from base64
  const base64Data = base64Image.includes('base64,')
    ? base64Image.split('base64,')[1]
    : base64Image;

  // Convert base64 to binary
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // Generate filename with timestamp
  const timestamp = Date.now();
  const filename = `${userId}/${imageId}_${timestamp}.png`;

  // Upload to storage
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

  // Get public URL
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

    // Update last_used_at
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

  // Fallback to platform key
  if (platformKey) {
    console.log(`Using platform ${provider} API key`);
    return platformKey;
  }

  // Provider-specific error messages
  const providerNames: Record<string, string> = {
    'openai': 'OpenAI',
    'stability': 'Stability AI',
    'google': 'Google AI (Gemini)',
    'kie-ai': 'KIE.AI'
  };

  const providerName = providerNames[provider] || provider;
  const errorMessage = `No ${providerName} API key configured. Please contact your administrator.`;

  console.error(errorMessage);
  throw new Error(errorMessage);
}

// Provider adapters
async function generateWithOpenAI(prompt: string, parameters: any, apiKey: string) {
  console.log('Generating with OpenAI DALL-E 3:', { prompt, parameters });

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: `${parameters.width || 1024}x${parameters.height || 1024}`,
      quality: parameters.quality || 'standard',
      style: parameters.style || 'vivid',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const result = await response.json();
  console.log('OpenAI response:', result);

  return {
    imageUrl: result.data[0].url,
    model: 'dall-e-3',
    status: 'completed',
  };
}

async function generateWithStability(prompt: string, parameters: any, apiKey: string) {
  console.log('Generating with Stability AI:', { prompt, parameters });

  const formData = new FormData();
  formData.append('prompt', prompt);
  if (parameters.negative_prompt) {
    formData.append('negative_prompt', parameters.negative_prompt);
  }
  formData.append('output_format', 'png');
  formData.append('aspect_ratio', '1:1');

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'image/*',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Stability API error:', response.status, errorText);
    throw new Error(`Stability API error: ${errorText}`);
  }

  // Stability returns the image directly
  const imageBlob = await response.blob();
  const arrayBuffer = await imageBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const imageUrl = `data:image/png;base64,${base64}`;

  return {
    imageUrl,
    model: 'stable-diffusion-core',
    status: 'completed',
  };
}

// Helper: Convert width/height to aspect ratio
function getAspectRatioFromSize(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;

  // Map to common aspect ratios
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

// Helper: Convert width/height to Qwen size format
function getQwenSize(width: number, height: number): string {
  // Qwen uses specific named sizes
  if (width === 1024 && height === 1024) return 'square_hd';
  if (width === 512 && height === 512) return 'square';
  if (width === 1024 && height === 768) return 'landscape_4_3';
  if (width === 1024 && height === 576) return 'landscape_16_9';
  if (width === 768 && height === 1024) return 'portrait_4_3';
  if (width === 576 && height === 1024) return 'portrait_16_9';

  // Fallback based on aspect ratio
  const ratio = width / height;
  if (ratio === 1) return 'square_hd';
  if (ratio > 1.5) return 'landscape_16_9';
  if (ratio > 1) return 'landscape_4_3';
  if (ratio < 0.7) return 'portrait_16_9';
  return 'portrait_4_3';
}

// KIE.AI Unified Jobs API
// All KIE models use the same endpoint with different model identifiers
async function generateWithKieUnified(
  modelId: string,
  modelName: string,
  prompt: string,
  parameters: any,
  apiKey: string,
  inputImage?: string
) {
  console.log(`Generating with KIE.AI ${modelName}:`, { modelId, prompt, parameters, hasInputImage: !!inputImage });

  // Build input object based on model type
  const input: any = {
    prompt,
  };

  // Get size from parameters
  const width = parameters.width || 1024;
  const height = parameters.height || 1024;
  const aspectRatio = getAspectRatioFromSize(width, height);

  console.log(`Size parameters: width=${width}, height=${height}, aspectRatio=${aspectRatio}`);

  // Model-specific parameters
  if (modelId === 'google/nano-banana') {
    input.output_format = parameters.output_format || 'png';
    input.image_size = aspectRatio;
    console.log(`Nano Banana: image_size=${aspectRatio}`);
  } else if (modelId === 'google/nano-banana-edit') {
    // Nano Banana Edit - image-to-image editing
    if (!inputImage) {
      throw new Error('Nano Banana Edit requires an input image');
    }

    // Log input image format for debugging
    const imageType = inputImage.startsWith('data:') ? 'base64 data URL' :
                      inputImage.startsWith('http') ? 'HTTP URL' : 'unknown format';
    const imageLength = inputImage.length;
    console.log(`Nano Banana Edit input image: type=${imageType}, length=${imageLength}`);

    // Nano Banana Edit expects image_urls as an array
    input.image_urls = [inputImage];
    input.image_size = aspectRatio;
    input.output_format = parameters.output_format || 'png';
    console.log(`Nano Banana Edit: image_size=${aspectRatio}`);
  } else if (modelId === 'qwen/text-to-image') {
    input.image_size = getQwenSize(width, height);
    input.num_inference_steps = parameters.steps || 30;
    input.guidance_scale = parameters.guidance_scale || 2.5;
    input.output_format = parameters.output_format || 'png';
    if (parameters.negative_prompt) {
      input.negative_prompt = parameters.negative_prompt;
    }
    console.log(`Qwen Text-to-Image: image_size=${input.image_size}`);
  } else if (modelId === 'qwen/image-to-image') {
    if (!inputImage) {
      throw new Error('Image-to-image requires an input image');
    }
    // For Qwen img2img, use image_urls as array (KIE.AI standard for img2img)
    input.image_urls = [inputImage];
    input.image_size = getQwenSize(width, height);
    input.strength = parameters.strength || 0.8;
    input.num_inference_steps = parameters.steps || 30;
    input.guidance_scale = parameters.guidance_scale || 2.5;
    input.output_format = parameters.output_format || 'png';
    if (parameters.negative_prompt) {
      input.negative_prompt = parameters.negative_prompt;
    }
    console.log(`Qwen Image-to-Image: image_size=${input.image_size}, strength=${input.strength}`);
  } else if (modelId === 'bytedance/seedream-v4-edit') {
    // Seedream V4 Edit - instruction-based image editing
    if (!inputImage) {
      throw new Error('Seedream V4 Edit requires an input image');
    }
    // Try image_urls as array first, fallback to image_url if needed
    input.image_urls = [inputImage];
    input.aspect_ratio = aspectRatio;
    input.output_format = parameters.output_format || 'png';
    console.log(`Seedream V4 Edit: aspect_ratio=${aspectRatio}`);
  } else if (modelId === 'recraft/remove-background') {
    // Recraft Remove Background - automatic background removal
    if (!inputImage) {
      throw new Error('Recraft Remove Background requires an input image');
    }
    // Try image_urls as array first, fallback to image_url if needed
    input.image_urls = [inputImage];
    input.output_format = parameters.output_format || 'png';
    console.log(`Recraft Remove Background: removing background from image`);
  } else if (modelId.startsWith('google/imagen4')) {
    // Imagen 4 family: imagen4-ultra, imagen4, imagen4-fast, imagen4-edit
    if (modelId === 'google/imagen4-edit') {
      // Imagen 4 Edit - image-to-image editing
      if (!inputImage) {
        throw new Error('Imagen 4 Edit requires an input image');
      }
      // Try image_urls as array first, fallback to image_url if needed
      input.image_urls = [inputImage];
    }
    input.aspect_ratio = aspectRatio;
    if (parameters.negative_prompt) {
      input.negative_prompt = parameters.negative_prompt;
    }
    if (parameters.seed) {
      input.seed = parameters.seed;
    }
    console.log(`Imagen 4: aspect_ratio=${aspectRatio}`);
  } else if (modelId === 'grok-imagine/text-to-image') {
    input.aspect_ratio = aspectRatio;
    input.mode = parameters.mode || 'standard'; // standard, fun, spicy
    console.log(`Grok Imagine: aspect_ratio=${aspectRatio}`);
  } else if (modelId === 'gpt4o/image') {
    // GPT-4O Image - note: may need specific size format
    input.num_outputs = parameters.num_outputs || 1; // 1, 2, or 4
    if (parameters.negative_prompt) {
      input.negative_prompt = parameters.negative_prompt;
    }
    console.log(`GPT-4O: num_outputs=${input.num_outputs}`);
  }

  const requestBody = {
    model: modelId,
    input,
  };

  console.log('KIE.AI request body:', JSON.stringify(requestBody, null, 2));

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

  // Check for API errors in response
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

async function generateWithGemini(prompt: string, parameters: any, apiKey: string, inputImage?: string, inputImages?: string[]) {
  console.log('Generating with Google Gemini:', {
    prompt,
    hasImage: !!inputImage,
    numImages: inputImages?.length || 0
  });

  const parts: any[] = [];

  // Support multiple images for combination
  const imagesToProcess = inputImages && inputImages.length > 0 ? inputImages : (inputImage ? [inputImage] : []);

  // For img2img, add the input images first, then the prompt
  if (imagesToProcess.length > 0) {
    console.log(`Adding ${imagesToProcess.length} input image(s) to request`);

    for (let i = 0; i < imagesToProcess.length; i++) {
      const img = imagesToProcess[i];
      let base64Data: string;
      let mimeType = 'image/jpeg';

      // Check if it's already a base64 data URL or an HTTP URL
      if (img.startsWith('data:image')) {
        // Extract mime type from data URL
        const mimeTypeMatch = img.match(/^data:(image\/\w+);base64,/);
        mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
        base64Data = img.replace(/^data:image\/\w+;base64,/, '');
      } else if (img.startsWith('http')) {
        // Fetch the image from the URL and convert to base64
        console.log(`Fetching image ${i + 1} from URL:`, img);
        const imageResponse = await fetch(img);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from URL: ${img}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        base64Data = btoa(String.fromCharCode.apply(null, Array.from(bytes)));

        // Determine mime type from Content-Type header or default to png
        const contentType = imageResponse.headers.get('content-type');
        mimeType = contentType || 'image/png';
      } else {
        throw new Error(`Invalid image format: must be a data URL or HTTP URL`);
      }

      console.log(`Adding image ${i + 1}:`, { mimeType, dataLength: base64Data.length });

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }
  }

  // Add prompt after the images (for img2img) or as the only part (for text2img)
  parts.push({ text: prompt });

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: parameters.temperature || 1,
      topP: parameters.top_p || 0.95,
      topK: parameters.top_k || 40,
      maxOutputTokens: 8192,
      responseModalities: ["IMAGE"],
    }
  };

  console.log('Gemini API request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);

    // Parse error for better user message
    let errorMessage = `Gemini API error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch (e) {
      errorMessage = errorText;
    }

    // Check for quota/billing issues
    if (response.status === 429) {
      throw new Error('Gemini API quota exceeded. Please check your billing settings at https://aistudio.google.com/billing');
    } else if (response.status === 403) {
      throw new Error('Gemini API access forbidden. Please verify your API key has the correct permissions and billing is enabled.');
    }

    throw new Error(`Gemini API error: ${errorMessage}`);
  }

  const result = await response.json();
  console.log('Gemini response received:', JSON.stringify(result, null, 2));

  // Extract base64 image from response
  if (!result.candidates || !result.candidates[0]?.content?.parts?.[0]?.inlineData) {
    console.error('Invalid Gemini response structure:', result);

    // Check for safety filters or other issues
    if (result.candidates && result.candidates[0]?.finishReason) {
      throw new Error(`Gemini blocked the request: ${result.candidates[0].finishReason}`);
    }

    throw new Error('Invalid response from Gemini API - no image data found');
  }

  const imageData = result.candidates[0].content.parts[0].inlineData.data;
  const imageUrl = `data:image/png;base64,${imageData}`;

  return {
    imageUrl,
    model: 'gemini-2.5-flash-image',
    status: 'completed',
  };
}

async function checkKieAIProgress(taskId: string, apiKey: string, provider: string) {
  // All KIE models use the same unified status endpoint
  const endpoint = `/api/v1/jobs/recordInfo?taskId=${taskId}`;

  console.log(`Checking KIE.AI progress for ${provider} at ${endpoint}`);

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

  // KIE.AI unified jobs API uses state: "waiting", "success", "fail"
  if (result.code === 200 && result.data) {
    const state = result.data.state;

    if (state === 'success' && result.data.resultJson) {
      // Parse the resultJson to get image URLs
      try {
        const resultData = typeof result.data.resultJson === 'string'
          ? JSON.parse(result.data.resultJson)
          : result.data.resultJson;

        const imageUrl = resultData.resultUrls?.[0];

        if (imageUrl) {
          return {
            status: 'completed',
            progress: 100,
            imageUrl,
          };
        }
      } catch (e) {
        console.error('Failed to parse resultJson:', e);
      }
    } else if (state === 'fail') {
      return {
        status: 'failed',
        progress: 0,
        error: result.data.failMsg || result.data.failCode || 'Generation failed',
      };
    } else {
      // waiting state
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
  console.log('=== EDGE FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('Request body received:', JSON.stringify({
      provider: requestBody.provider,
      hasPrompt: !!requestBody.prompt,
      hasInputImage: !!requestBody.inputImage,
      hasInputImages: !!requestBody.inputImages,
      numInputImages: requestBody.inputImages?.length || 0,
      checkProgress: requestBody.checkProgress,
      taskId: requestBody.taskId,
    }, null, 2));

    const { prompt, provider = 'openai', parameters = {}, checkProgress = false, taskId, inputImage, inputImages } = requestBody;

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth
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

    // Handle progress check for async providers
    if (checkProgress && taskId) {
      console.log('Checking progress for task:', taskId, 'provider:', provider);

      // Check if it's a KIE.AI service (all start with 'kie-')
      if (provider.startsWith('kie-')) {
        const kieApiKey = await getApiKey(
          supabase,
          user.id,
          'kie-ai',
          Deno.env.get('KIE_AI_API_KEY')
        );

        const progress = await checkKieAIProgress(taskId, kieApiKey, provider);

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

    console.log(`Generating image with provider: ${provider}`);

    let result;

    // Route to appropriate provider (KIE.AI unified jobs API only)
    const kieKey = await getApiKey(
      supabase,
      user.id,
      'kie-ai',
      Deno.env.get('KIE_AI_API_KEY')
    );

    // For img2img with KIE.AI, we need to upload input images to storage first
    // KIE.AI doesn't accept base64 data URLs, only HTTP URLs
    let processedInputImage: string | undefined = undefined;

    if (inputImages && inputImages.length > 0) {
      const firstImage = inputImages[0];

      // If it's a base64 image, upload to storage first
      if (firstImage.startsWith('data:image')) {
        console.log('Uploading input image to storage for KIE.AI...');
        const inputImageId = `input_${crypto.randomUUID()}`;
        processedInputImage = await uploadToStorage(supabase, user.id, firstImage, inputImageId);
        console.log('Input image uploaded:', processedInputImage);
      } else if (firstImage.startsWith('http')) {
        // Already a URL, use it directly
        processedInputImage = firstImage;
        console.log('Using existing HTTP URL for input image:', processedInputImage);
      }
    } else if (inputImage) {
      // Legacy single image support
      if (inputImage.startsWith('data:image')) {
        console.log('Uploading input image to storage for KIE.AI...');
        const inputImageId = `input_${crypto.randomUUID()}`;
        processedInputImage = await uploadToStorage(supabase, user.id, inputImage, inputImageId);
        console.log('Input image uploaded:', processedInputImage);
      } else if (inputImage.startsWith('http')) {
        processedInputImage = inputImage;
        console.log('Using existing HTTP URL for input image:', processedInputImage);
      }
    }

    switch (provider) {
      case 'kie-nano-banana': {
        result = await generateWithKieUnified(
          'google/nano-banana',
          'Nano Banana',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-qwen-text2img': {
        result = await generateWithKieUnified(
          'qwen/text-to-image',
          'Qwen Text-to-Image',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-imagen4-ultra': {
        result = await generateWithKieUnified(
          'google/imagen4-ultra',
          'Imagen 4 Ultra',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-imagen4': {
        result = await generateWithKieUnified(
          'google/imagen4',
          'Imagen 4 Standard',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-imagen4-fast': {
        result = await generateWithKieUnified(
          'google/imagen4-fast',
          'Imagen 4 Fast',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-grok-imagine': {
        result = await generateWithKieUnified(
          'grok-imagine/text-to-image',
          'Grok Imagine',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-gpt4o-image': {
        result = await generateWithKieUnified(
          'gpt4o/image',
          'GPT-4O Image',
          prompt,
          parameters,
          kieKey
        );
        break;
      }

      case 'kie-qwen-img2img': {
        result = await generateWithKieUnified(
          'qwen/image-to-image',
          'Qwen Image-to-Image',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-nano-banana-edit': {
        result = await generateWithKieUnified(
          'google/nano-banana-edit',
          'Nano Banana Edit',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-nano-banana-pro': {
        result = await generateWithKieUnified(
          'google/nano-banana-pro',
          'Nano Banana Pro',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-seedream-v4-edit': {
        result = await generateWithKieUnified(
          'bytedance/seedream-v4-edit',
          'Seedream V4 Edit',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-recraft-remove-bg': {
        result = await generateWithKieUnified(
          'recraft/remove-background',
          'Recraft Remove Background',
          prompt,
          parameters,
          kieKey,
          processedInputImage
        );
        break;
      }

      case 'kie-imagen4-edit': {
        result = await generateWithKieUnified(
          'google/imagen4-edit',
          'Imagen 4 Edit',
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

    // For sync providers, upload to storage but DON'T save to DB yet
    // Let the frontend show preview first, then save on user confirmation
    if (result.status === 'completed' && result.imageUrl) {
      // Generate image ID before uploading
      const imageId = crypto.randomUUID();

      // Upload to storage if it's a base64 image
      let finalImageUrl = result.imageUrl;
      if (result.imageUrl.startsWith('data:image')) {
        console.log('Uploading base64 image to storage...');
        finalImageUrl = await uploadToStorage(supabase, user.id, result.imageUrl, imageId);
      }

      // Return the storage URL without saving to DB
      // Frontend will show preview and save on user confirmation
      result.imageUrl = finalImageUrl;

      // Also upload original input images to storage if present
      const originalImageUrls: string[] = [];
      if (inputImages && inputImages.length > 0) {
        console.log(`Processing ${inputImages.length} original images...`);
        for (let i = 0; i < inputImages.length; i++) {
          const inputImage = inputImages[i];
          if (inputImage.startsWith('data:image')) {
            console.log(`Uploading original image ${i} to storage...`);
            const originalId = `${imageId}_original_${i}`;
            const originalUrl = await uploadToStorage(supabase, user.id, inputImage, originalId);
            originalImageUrls.push(originalUrl);
          } else if (inputImage.startsWith('http')) {
            // Already a URL (storage or external), just store it
            console.log(`Using existing URL for original image ${i}`);
            originalImageUrls.push(inputImage);
          }
        }
      } else if (inputImage) {
        if (inputImage.startsWith('data:image')) {
          // Legacy single image support - base64
          console.log('Uploading single original image to storage...');
          const originalId = `${imageId}_original_0`;
          const originalUrl = await uploadToStorage(supabase, user.id, inputImage, originalId);
          originalImageUrls.push(originalUrl);
        } else if (inputImage.startsWith('http')) {
          // Already a URL
          console.log('Using existing URL for single original image');
          originalImageUrls.push(inputImage);
        }
      }

      result.originalImageUrls = originalImageUrls.length > 0 ? originalImageUrls : undefined;
    }

    // Return result (with taskId for async or imageUrl for sync)
    return new Response(
      JSON.stringify({
        success: true,
        provider,
        taskId: result.taskId || result.imageUrl, // For sync providers, imageUrl is the "taskId"
        status: result.status,
        imageUrl: result.imageUrl,
        originalImageUrls: result.originalImageUrls,
        model: result.model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== EDGE FUNCTION ERROR ===');
    console.error('Unexpected error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error.constructor?.name);
    console.error('==========================');

    // Create a detailed error response
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
