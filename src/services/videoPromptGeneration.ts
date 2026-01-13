/**
 * Video Prompt Generation Service
 *
 * Generates professional advertising video prompts based on product analysis.
 * Creates a series of different video styles for Malaysian e-commerce.
 */

import { ProductAnalysis } from './productAnalysis';

export interface VideoPrompt {
  id: string;
  name: string;
  purpose: string;
  platforms: string[];
  videoType: 'product-showcase' | 'product-demo' | 'lifestyle' | 'unboxing' | 'testimonial';
  aspectRatio: '16:9' | '9:16' | '1:1';
  duration: number; // seconds
  prompt: string;
  cameraMovement: string;
  defaultProvider: string;
}

export interface VideoPromptGenerationResult {
  productSummary: string;
  prompts: VideoPrompt[];
}

/**
 * Get camera movement suggestions based on product category
 */
function getCameraMovement(category: string, videoType: string): string {
  const movements: Record<string, Record<string, string>> = {
    'Electronics': {
      'product-showcase': 'Slow orbit around product, 360-degree rotation, smooth tracking shot',
      'product-demo': 'Close-up zoom on features, pull back reveal, smooth pan across buttons/ports',
      'lifestyle': 'Follow shot, handheld natural movement, slow push-in on user interaction',
      'unboxing': 'Top-down static, slow pan as items revealed, dolly in on key moments',
      'testimonial': 'Medium shot, subtle drift, occasional close-up cuts',
    },
    'Fashion': {
      'product-showcase': 'Smooth vertical pan, glamour rotation, fabric detail zoom',
      'product-demo': 'Model movement tracking, texture close-ups, style transition cuts',
      'lifestyle': 'Lifestyle walk-through, natural motion, golden hour outdoor shots',
      'unboxing': 'Elegant unwrap reveal, slow fabric unfold, quality detail shots',
      'testimonial': 'Fashion editorial style, posed movements, confident walk',
    },
    'Beauty': {
      'product-showcase': 'Macro close-up, reflective surface shots, luxurious slow motion',
      'product-demo': 'Application demonstration, before/after transitions, texture reveal',
      'lifestyle': 'Morning routine style, soft focus background, glamour lighting',
      'unboxing': 'Premium unboxing, tissue reveal, product arrangement shot',
      'testimonial': 'Beauty influencer style, well-lit face shots, product in frame',
    },
    'Food': {
      'product-showcase': 'Appetizing close-up, steam/freshness capture, ingredient cascade',
      'product-demo': 'Cooking process, pouring/serving action, satisfying food shots',
      'lifestyle': 'Dining scene, social gathering, enjoyment moments',
      'unboxing': 'Package open reveal, freshness emphasis, product arrangement',
      'testimonial': 'Taste reaction, enjoying moment, family/friends sharing',
    },
    'default': {
      'product-showcase': 'Smooth 360 orbit, slow zoom in on details, elegant reveal',
      'product-demo': 'Feature highlight shots, usage demonstration, detail close-ups',
      'lifestyle': 'Natural environment, user interaction, everyday scenario',
      'unboxing': 'Reveal sequence, product arrangement, quality emphasis',
      'testimonial': 'Authentic user footage, natural expressions, product in use',
    },
  };

  return movements[category]?.[videoType] || movements['default'][videoType];
}

/**
 * Get lifestyle context based on product category
 */
function getVideoLifestyleContext(category: string): string {
  const contexts: Record<string, string> = {
    'Electronics': 'modern home office, tech-savvy environment, sleek workspace',
    'Fashion': 'urban Malaysian street style, trendy cafe, shopping district',
    'Beauty': 'bright vanity setup, spa-like bathroom, natural daylight room',
    'Food': 'cozy kitchen, dining table, Malaysian food court or restaurant',
    'Sports': 'gym environment, outdoor park, active lifestyle setting',
    'Home': 'modern Malaysian apartment, cozy living room, organized space',
    'Travel': 'airport, hotel room, scenic Malaysian destination',
    'Baby': 'nursery, family living room, outdoor playground',
    'default': 'clean modern Malaysian home, lifestyle setting',
  };

  return contexts[category] || contexts['default'];
}

/**
 * Generate professional video advertising prompts based on product analysis
 */
export function generateVideoPrompts(
  analysis: ProductAnalysis,
  additionalRequirements?: string
): VideoPromptGenerationResult {
  const productName = analysis.productName;
  const category = analysis.category || 'General';
  const colors = analysis.colors?.join(', ') || '';
  const features = analysis.keyFeatures?.slice(0, 3).join(', ') || '';
  const lifestyleContext = getVideoLifestyleContext(category);

  const productSummary = `Product: ${productName}\nCategory: ${category}${colors ? `\nColors: ${colors}` : ''}${features ? `\nKey Features: ${features}` : ''}\nMarket: Malaysia`;

  // User's additional requirements
  const userRequirements = additionalRequirements
    ? `\n\nADDITIONAL REQUIREMENTS: ${additionalRequirements}`
    : '';

  // Product preservation note
  const productPreservation = `The ${productName} must remain clearly visible and recognizable throughout the video. Maintain the exact product appearance, colors (${colors || 'as shown'}), and design from the input image.`;

  const prompts: VideoPrompt[] = [
    // VIDEO 1 - Product Showcase (Hero Video)
    {
      id: 'product-showcase',
      name: 'Product Showcase',
      purpose: 'Hero video for product listing - first impression',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'TikTok Shop'],
      videoType: 'product-showcase',
      aspectRatio: '1:1',
      duration: 6,
      prompt: `Cinematic product showcase video of ${productName}.

${productPreservation}

SCENE: Clean white/light gray studio background with professional soft lighting.
ACTION: ${getCameraMovement(category, 'product-showcase')}
FOCUS: Highlight the product from multiple angles, showing its premium quality and design.
STYLE: High-end e-commerce product video, smooth motion, professional lighting.
MOOD: Premium, trustworthy, desirable.

KEY MOMENTS:
- Opening: Product reveal with elegant entrance
- Middle: Slow rotation showing all angles
- Closing: Final hero shot with product centered

${features ? `FEATURES TO HIGHLIGHT: ${features}` : ''}${userRequirements}`,
      cameraMovement: getCameraMovement(category, 'product-showcase'),
      defaultProvider: 'kie-hailuo-standard-img2vid',
    },

    // VIDEO 2 - Product Demo / Features
    {
      id: 'product-demo',
      name: 'Feature Demonstration',
      purpose: 'Show product features and functionality',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'YouTube Shorts'],
      videoType: 'product-demo',
      aspectRatio: '9:16',
      duration: 6,
      prompt: `Product demonstration video showcasing ${productName} features.

${productPreservation}

SCENE: Clean background transitioning to detail shots.
ACTION: ${getCameraMovement(category, 'product-demo')}
FOCUS: Demonstrate key features and product quality in action.
STYLE: Informative yet engaging, clean transitions, detail-oriented.
MOOD: Helpful, informative, builds trust.

KEY MOMENTS:
- Opening: Product overview shot
- Middle: Close-up on ${features || 'key features'}, showing functionality
- Closing: Full product shot with all features visible

DEMONSTRATION STYLE: Show the product's unique selling points clearly.${userRequirements}`,
      cameraMovement: getCameraMovement(category, 'product-demo'),
      defaultProvider: 'kie-hailuo-standard-img2vid',
    },

    // VIDEO 3 - Lifestyle Video (Social Media)
    {
      id: 'lifestyle',
      name: 'Lifestyle Video',
      purpose: 'Social media ad - emotional connection',
      platforms: ['TikTok Malaysia', 'Instagram Reels', 'Facebook'],
      videoType: 'lifestyle',
      aspectRatio: '9:16',
      duration: 6,
      prompt: `Lifestyle video featuring ${productName} in everyday use.

${productPreservation}

SCENE: ${lifestyleContext}
ACTION: ${getCameraMovement(category, 'lifestyle')}
PERSON: Young Malaysian adult naturally using the ${productName}.
STYLE: TikTok/Instagram-friendly, relatable, aspirational lifestyle.
MOOD: Happy, satisfied, lifestyle upgrade feeling.

KEY MOMENTS:
- Opening: Person in their environment, product visible
- Middle: Natural interaction with ${productName}, showing ease of use
- Closing: Satisfied expression, product clearly featured

VIBE: Modern Malaysian lifestyle, relatable and aspirational.${userRequirements}`,
      cameraMovement: getCameraMovement(category, 'lifestyle'),
      defaultProvider: 'kie-hailuo-standard-img2vid',
    },

    // VIDEO 4 - Unboxing / Reveal
    {
      id: 'unboxing',
      name: 'Unboxing Experience',
      purpose: 'Build anticipation and show packaging quality',
      platforms: ['TikTok Malaysia', 'YouTube Shorts', 'Instagram Reels'],
      videoType: 'unboxing',
      aspectRatio: '9:16',
      duration: 6,
      prompt: `Satisfying unboxing video of ${productName}.

${productPreservation}

SCENE: Clean desk/table surface with good lighting.
ACTION: ${getCameraMovement(category, 'unboxing')}
HANDS: Clean, well-manicured hands opening the product packaging.
STYLE: ASMR-friendly, satisfying reveal, premium feel.
MOOD: Anticipation, excitement, satisfaction.

KEY MOMENTS:
- Opening: Package comes into frame
- Middle: Careful opening, tissue/packaging reveal
- Closing: Product fully revealed in beautiful arrangement

EMPHASIS: Premium unboxing experience, quality packaging, product reveal.${userRequirements}`,
      cameraMovement: getCameraMovement(category, 'unboxing'),
      defaultProvider: 'kie-hailuo-standard-img2vid',
    },

    // VIDEO 5 - Testimonial Style
    {
      id: 'testimonial',
      name: 'User Testimonial Style',
      purpose: 'Build trust with authentic-feeling content',
      platforms: ['TikTok Malaysia', 'Instagram', 'Facebook Ads'],
      videoType: 'testimonial',
      aspectRatio: '9:16',
      duration: 6,
      prompt: `Testimonial-style video featuring ${productName}.

${productPreservation}

SCENE: Natural home environment, good natural lighting.
PERSON: Young Malaysian person showing and talking about ${productName}.
ACTION: ${getCameraMovement(category, 'testimonial')}
STYLE: Authentic influencer review style, genuine expressions.
MOOD: Trustworthy, relatable, enthusiastic recommendation.

KEY MOMENTS:
- Opening: Person holds up ${productName}, friendly expression
- Middle: Shows product features, demonstrates usage
- Closing: Satisfied nod, product clearly visible, recommendation gesture

AUTHENTICITY: Natural, unscripted feel, like a real customer review.${userRequirements}`,
      cameraMovement: getCameraMovement(category, 'testimonial'),
      defaultProvider: 'kie-hailuo-standard-img2vid',
    },
  ];

  return {
    productSummary,
    prompts,
  };
}

/**
 * Get generated video styles from prompts
 */
export function getGeneratedVideoStylesFromPrompts(prompts: VideoPrompt[]) {
  return prompts.map(prompt => ({
    id: prompt.id,
    name: prompt.name,
    platform: prompt.platforms[0],
    description: prompt.purpose,
    prompt: prompt.prompt,
    aspectRatio: prompt.aspectRatio,
    duration: prompt.duration,
    videoType: prompt.videoType,
    cameraMovement: prompt.cameraMovement,
    defaultProvider: prompt.defaultProvider,
  }));
}

// Cost per video in USD (using Hailuo Standard as default)
export const VIDEO_COST_PER_VIDEO_USD = 0.30;
// USD to MYR exchange rate
export const VIDEO_USD_TO_MYR_RATE = 4.0;

/**
 * Calculate video generation cost
 */
export function calculateVideoCost(videoCount: number) {
  const costUSD = videoCount * VIDEO_COST_PER_VIDEO_USD;
  const costMYR = costUSD * VIDEO_USD_TO_MYR_RATE;
  return { costUSD, costMYR };
}
