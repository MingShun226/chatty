// Professional Advertising Prompt Generation Service
// Generates 5 detailed prompts for Malaysian e-commerce platforms

import { ProductAnalysis } from './productAnalysis';

export interface GeneratedPrompt {
  id: string;
  name: string;
  purpose: string;
  prompt: string;
  negativePrompt: string;
  aspectRatio: string;
  platforms: string[];
  imageType: 'hero' | 'multi-angle' | 'functionality' | 'lifestyle' | 'human-interaction';
}

export interface PromptGenerationResult {
  productSummary: string;
  prompts: GeneratedPrompt[];
}

// Helper to format product colors
function formatColors(colors: string[]): string {
  if (!colors || colors.length === 0) return '';
  if (colors.length === 1) return colors[0];
  if (colors.length === 2) return `${colors[0]} / ${colors[1]}`;
  return colors.slice(0, 3).join(' / ');
}

// Helper to format materials
function formatMaterials(materials?: string[]): string {
  if (!materials || materials.length === 0) return '';
  return materials.join(' and ');
}

// Helper to format key features
function formatFeatures(features: string[]): string {
  if (!features || features.length === 0) return '';
  return features.slice(0, 4).join(', ');
}

// Determine material rendering description based on product category
function getMaterialRendering(category: string, materials?: string[]): string {
  const categoryLower = category.toLowerCase();

  if (materials && materials.length > 0) {
    const matStr = materials.join(' and ').toLowerCase();
    if (matStr.includes('plastic')) return 'realistic plastic material rendering';
    if (matStr.includes('metal') || matStr.includes('steel') || matStr.includes('aluminum')) return 'realistic metal material rendering with subtle reflections';
    if (matStr.includes('wood')) return 'realistic wood grain texture rendering';
    if (matStr.includes('leather')) return 'realistic leather texture rendering';
    if (matStr.includes('fabric') || matStr.includes('cotton') || matStr.includes('cloth')) return 'realistic fabric texture rendering';
    if (matStr.includes('glass')) return 'realistic glass material with subtle transparency';
    if (matStr.includes('ceramic')) return 'realistic ceramic material rendering';
    if (matStr.includes('rubber') || matStr.includes('silicone')) return 'realistic rubber/silicone material rendering';
  }

  // Category-based fallback
  if (categoryLower.includes('electronic') || categoryLower.includes('tech') || categoryLower.includes('gadget')) {
    return 'realistic plastic and metal material rendering';
  }
  if (categoryLower.includes('fashion') || categoryLower.includes('clothing') || categoryLower.includes('apparel')) {
    return 'realistic fabric texture rendering';
  }
  if (categoryLower.includes('beauty') || categoryLower.includes('cosmetic')) {
    return 'realistic packaging material rendering';
  }
  if (categoryLower.includes('home') || categoryLower.includes('furniture')) {
    return 'realistic material textures and surfaces';
  }
  if (categoryLower.includes('food') || categoryLower.includes('beverage')) {
    return 'realistic food photography rendering';
  }

  return 'realistic material rendering';
}

// Get lifestyle context based on product category
function getLifestyleContext(category: string): string {
  const categoryLower = category.toLowerCase();

  if (categoryLower.includes('electronic') || categoryLower.includes('tech') || categoryLower.includes('gadget')) {
    return 'modern Malaysian setting such as outdoor café, public transport, office desk, or casual home environment';
  }
  if (categoryLower.includes('fashion') || categoryLower.includes('clothing')) {
    return 'stylish Malaysian urban setting such as shopping mall, café, or modern street background';
  }
  if (categoryLower.includes('beauty') || categoryLower.includes('cosmetic') || categoryLower.includes('skincare')) {
    return 'clean and bright bathroom counter, vanity table, or modern bedroom setting';
  }
  if (categoryLower.includes('home') || categoryLower.includes('kitchen') || categoryLower.includes('decor')) {
    return 'modern Malaysian home interior, clean living room, or organized kitchen setting';
  }
  if (categoryLower.includes('food') || categoryLower.includes('beverage') || categoryLower.includes('snack')) {
    return 'cozy café table, kitchen counter, or outdoor picnic setting';
  }
  if (categoryLower.includes('sport') || categoryLower.includes('fitness') || categoryLower.includes('outdoor')) {
    return 'outdoor park, gym, or active lifestyle setting in Malaysia';
  }
  if (categoryLower.includes('baby') || categoryLower.includes('kid') || categoryLower.includes('toy')) {
    return 'bright and cheerful nursery, playroom, or family living space';
  }

  return 'modern Malaysian daily environment, clean and relatable lifestyle setting';
}

// Get human interaction description based on product category
function getHumanInteractionDesc(category: string, productName: string): string {
  const categoryLower = category.toLowerCase();

  if (categoryLower.includes('electronic') || categoryLower.includes('tech') || categoryLower.includes('gadget')) {
    return `Young Asian person holding and using ${productName.toLowerCase()}, natural and relaxed pose, engaged expression`;
  }
  if (categoryLower.includes('fashion') || categoryLower.includes('clothing')) {
    return `Young Asian model wearing or showcasing ${productName.toLowerCase()}, confident and stylish pose, natural expression`;
  }
  if (categoryLower.includes('beauty') || categoryLower.includes('cosmetic') || categoryLower.includes('skincare')) {
    return `Young Asian woman applying or holding ${productName.toLowerCase()}, natural beauty look, glowing skin, relaxed expression`;
  }
  if (categoryLower.includes('food') || categoryLower.includes('beverage')) {
    return `Young Asian person enjoying ${productName.toLowerCase()}, happy expression, natural eating/drinking pose`;
  }
  if (categoryLower.includes('sport') || categoryLower.includes('fitness')) {
    return `Young Asian person using ${productName.toLowerCase()} during workout or outdoor activity, energetic and active pose`;
  }

  return `Young Asian person holding and using ${productName.toLowerCase()}, natural and relaxed pose, friendly expression`;
}

// Get functionality highlight based on product features
function getFunctionalityHighlight(productName: string, features: string[], category: string): string {
  const featureStr = features.slice(0, 3).join(', ').toLowerCase();

  let highlight = `visual emphasis on key features`;

  if (featureStr.includes('portable') || featureStr.includes('compact') || featureStr.includes('lightweight')) {
    highlight = 'visual emphasis on portability and compact size';
  }
  if (featureStr.includes('rechargeable') || featureStr.includes('battery') || featureStr.includes('usb')) {
    highlight += ', USB rechargeable port clearly visible';
  }
  if (featureStr.includes('speed') || featureStr.includes('setting') || featureStr.includes('mode')) {
    highlight += ', control buttons and settings clearly shown';
  }
  if (featureStr.includes('waterproof') || featureStr.includes('water resistant')) {
    highlight += ', water droplets or splash effect to show waterproof feature';
  }
  if (featureStr.includes('wireless') || featureStr.includes('bluetooth')) {
    highlight += ', subtle wireless connectivity visual';
  }

  return highlight;
}

/**
 * Generate 5 professional advertising prompts based on product analysis
 */
export function generateProfessionalPrompts(analysis: ProductAnalysis): PromptGenerationResult {
  const productName = analysis.productName;
  const category = analysis.category || 'General';
  const colors = formatColors(analysis.colors);
  const materials = formatMaterials(analysis.materials);
  const features = formatFeatures(analysis.keyFeatures);
  const materialRendering = getMaterialRendering(category, analysis.materials);
  const lifestyleContext = getLifestyleContext(category);
  const humanInteraction = getHumanInteractionDesc(category, productName);
  const functionalityHighlight = getFunctionalityHighlight(productName, analysis.keyFeatures, category);

  const productSummary = `Product: ${productName}\nCategory: ${category}${colors ? `\nColor: ${colors}` : ''}${features ? `\nKey Features: ${features}` : ''}\nMarket: Malaysia`;

  // CRITICAL: Ultra-specific product preservation instructions
  // This is the most important part - AI must NOT modify the product
  const strictPreservation = `ABSOLUTE REQUIREMENT: This is an image-to-image transformation. The product in the output MUST be pixel-perfect identical to the input image. DO NOT generate a new product. DO NOT create variations. DO NOT change any colors. DO NOT modify the design. Copy the EXACT product from the input and only change the background/context.`;

  // Color-specific preservation based on analyzed colors
  const colorPreservation = colors
    ? `STRICT COLOR MATCH: The product colors MUST be exactly ${colors}. Do not substitute, brighten, darken, or change any colors. Orange must stay orange (not yellow). Blue must stay blue. Pink must stay pink. Preserve the exact color values from the input image.`
    : `Preserve all original product colors exactly as shown in input image.`;

  // Detailed negative prompt to prevent common AI mistakes
  const strictNegative = 'different product, redesigned product, modified design, color changes, wrong colors, yellow instead of orange, different shade, altered proportions, different shape, new design, generic product, stock photo product, similar product, product variation, different model, changed features, missing details, added details, simplified design, different brand, removed logos, changed handles, different wheels, modified buttons';

  const prompts: GeneratedPrompt[] = [
    // IMAGE 1 — E-Commerce Hero Image
    {
      id: 'hero-image',
      name: 'E-Commerce Hero Image',
      purpose: 'Main product image / first impression for Shopee, Lazada, Temu',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'Temu Malaysia'],
      imageType: 'hero',
      aspectRatio: '1:1',
      prompt: `${strictPreservation}

TASK: Place the IDENTICAL product from input image on a clean white studio background.

PRODUCT PRESERVATION CHECKLIST:
- Product shape: EXACT same silhouette and proportions
- Product colors: ${colors ? `EXACTLY ${colors} - no substitutions` : 'Identical to input'}
- Product details: ALL logos, text, buttons, handles, wheels, patterns must be preserved
- Product materials: ${materialRendering}

BACKGROUND: Clean pure white (#FFFFFF) studio background with soft professional lighting.
LIGHTING: Soft diffused studio light, realistic natural shadow beneath product.
QUALITY: Ultra high resolution, sharp edges, no dust, no fingerprints, flawless surface.
STYLE: Premium e-commerce product photography for Shopee/Lazada Malaysia.`,
      negativePrompt: `${strictNegative}, people, hands, text overlay, watermark, distortion, blurry, low quality, cartoon, illustration, cluttered background, gradient background, colored background`,
    },

    // IMAGE 2 — Multi-Product Clean Display (renamed from 4-Angle)
    {
      id: 'multi-angle',
      name: 'Product Collection Display',
      purpose: 'Show all products clearly - important for SEA buyers',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'Amazon'],
      imageType: 'multi-angle',
      aspectRatio: '1:1',
      prompt: `${strictPreservation}

TASK: Display ALL products from the input image in a clean arranged layout.

CRITICAL - MULTI-PRODUCT PRESERVATION:
- If input shows multiple products (e.g., 4 suitcases of different colors), show ALL of them
- Each product must be the EXACT same design as in input image
- ${colors ? `Colors MUST be: ${colors} - preserve each color exactly` : 'Preserve all original product colors'}
- Do NOT substitute any colors (orange stays orange, not yellow)
- Do NOT change the arrangement or remove any products

LAYOUT: Clean organized display, products clearly separated
BACKGROUND: Pure white background, consistent lighting across all products
QUALITY: Professional product photography, realistic shadows, high detail
STYLE: E-commerce multi-product showcase for Shopee/Lazada detail images.`,
      negativePrompt: `${strictNegative}, single product only, missing products, rearranged products, people, text, clutter, watermark, inconsistent lighting, different backgrounds, blurry, low quality`,
    },

    // IMAGE 3 — Functionality Highlight
    {
      id: 'functionality',
      name: 'Feature Highlight',
      purpose: 'Show product features and details clearly',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'Amazon'],
      imageType: 'functionality',
      aspectRatio: '1:1',
      prompt: `${strictPreservation}

TASK: Showcase the IDENTICAL product from input with emphasis on its features.

PRODUCT PRESERVATION:
- Use the EXACT product from input image - do not recreate
- ${colorPreservation}
- Preserve all design elements: ${features ? features : 'all visible features'}

FEATURE EMPHASIS:
${functionalityHighlight}
- Show product details clearly: buttons, ports, handles, textures
- Clean angles that highlight functionality

BACKGROUND: Light neutral background, clean and minimal
LIGHTING: Bright, even lighting to show details clearly
STYLE: Technical product photography for feature explanation.`,
      negativePrompt: `${strictNegative}, people, excessive text, cartoon style, watermark, cluttered background, blurry, low quality, artistic interpretation`,
    },

    // IMAGE 4 — Lifestyle Usage Scenario
    {
      id: 'lifestyle',
      name: 'Lifestyle Scene',
      purpose: 'Show product in real-world use - emotional selling',
      platforms: ['Instagram Malaysia', 'Facebook Malaysia', 'TikTok Malaysia'],
      imageType: 'lifestyle',
      aspectRatio: '4:5',
      prompt: `${strictPreservation}

TASK: Place the EXACT product from input image in a lifestyle setting.

CRITICAL PRODUCT RULES:
- The product MUST be the identical item from the input image
- ${colorPreservation}
- Do NOT use a generic or similar-looking product
- All product details (logos, design, shape) must match input exactly

SCENE SETTING:
- Location: ${lifestyleContext}
- Lighting: Warm natural daylight
- Mood: Comfortable, practical, everyday usage feeling
- Style: Instagram/TikTok-friendly lifestyle photography

COMPOSITION: Product clearly visible and in focus, natural placement in scene.`,
      negativePrompt: `${strictNegative}, text overlay, watermark, clutter, artificial lighting, studio background, blurry, low quality, generic product, stock photo`,
    },

    // IMAGE 5 — Human Interaction Shot
    {
      id: 'human-interaction',
      name: 'Influencer Style Shot',
      purpose: 'TikTok / Instagram / Trust-building image',
      platforms: ['TikTok Malaysia', 'Instagram Malaysia', 'Facebook Malaysia'],
      imageType: 'human-interaction',
      aspectRatio: '9:16',
      prompt: `${strictPreservation}

TASK: Show a person naturally using/holding the EXACT product from input image.

CRITICAL PRODUCT RULES:
- The product in the person's hands MUST be identical to input image
- ${colorPreservation}
- Product must be clearly visible and recognizable
- ALL product details must match: shape, color, design, logos

PERSON & SCENE:
- ${humanInteraction}
- Young Asian person, natural and relaxed pose
- Bright clean background, soft natural lighting
- Realistic skin tones, friendly expression
- Modern social media advertisement style

FOCUS: Product should be clearly visible and in sharp focus.`,
      negativePrompt: `${strictNegative}, exaggerated beauty filters, text overlay, watermark, unnatural poses, artificial skin, blurry, low quality, cartoon, holding different product, wrong product`,
    },
  ];

  return {
    productSummary,
    prompts,
  };
}

/**
 * Get all generated prompts as advertising styles format
 * (Compatible with existing advertising workflow)
 */
export function getGeneratedStylesFromPrompts(prompts: GeneratedPrompt[]): any[] {
  // Strength guide for product preservation:
  // - Lower strength (0.3-0.4) = Product stays almost identical, minimal changes
  // - Medium strength (0.45-0.55) = Product preserved but background/context can change
  // - Higher strength (0.6-0.7) = More creative freedom, product may change slightly

  const strengthByType: Record<string, number> = {
    'hero': 0.35,           // Very low - product must stay identical, only enhance lighting/background
    'multi-angle': 0.30,    // Lowest - must preserve exact product design across all angles
    'functionality': 0.40,  // Low - product must stay same, slight context changes allowed
    'lifestyle': 0.45,      // Medium-low - product preserved, background/scene can change
    'human-interaction': 0.50, // Medium - product preserved, person/scene generated
  };

  return prompts.map((prompt, index) => ({
    id: `generated-${prompt.id}`,
    name: prompt.name,
    platform: prompt.platforms[0], // Primary platform
    seriesNumber: index + 1,
    description: prompt.purpose,
    prompt: prompt.prompt.replace(/\n/g, ' ').trim(),
    negativePrompt: prompt.negativePrompt,
    aspectRatio: prompt.aspectRatio,
    strength: strengthByType[prompt.imageType] || 0.40, // Default to low strength for product preservation
  }));
}

export default generateProfessionalPrompts;
