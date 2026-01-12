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

  // CRITICAL: Product preservation instructions that MUST be included
  const productPreservation = `CRITICAL: Keep the EXACT same product design from the input image. Do NOT modify, redesign, or recreate the product. Preserve all original details: exact shape, proportions, colors, textures, logos, branding, buttons, handles, and all design elements.`;

  const preservationNegative = 'different product, modified design, wrong colors, altered shape, redesigned product, different model, changed proportions, missing features, added features';

  const prompts: GeneratedPrompt[] = [
    // IMAGE 1 — E-Commerce Hero Image
    {
      id: 'hero-image',
      name: 'E-Commerce Hero Image',
      purpose: 'Main product image / first impression for Shopee, Lazada, Temu',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'Temu Malaysia'],
      imageType: 'hero',
      aspectRatio: '1:1',
      prompt: `${productPreservation}
Premium product advertisement photo, the EXACT ${productName.toLowerCase()} from input image centered,
clean pure white background, soft professional studio lighting,
ultra high resolution, realistic natural shadow beneath product,
${colors ? `maintain exact ${colors.toLowerCase()} colors as shown in original, ` : ''}
${materialRendering},
keep all original product details, logos, and branding visible,
no dust, no fingerprints, flawless surface,
sharp edges, clean silhouette,
minimal and modern style,
high-end e-commerce product image,
optimized for Shopee and Lazada Malaysia main listing image.`,
      negativePrompt: `${preservationNegative}, people, hands, text overlay, watermark, distortion, blurry, low quality, cartoon, illustration, cluttered background`,
    },

    // IMAGE 2 — 4-Angle Showcase
    {
      id: 'multi-angle',
      name: '4-Angle Showcase',
      purpose: 'Show multiple POVs clearly - important for SEA buyers',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'Amazon'],
      imageType: 'multi-angle',
      aspectRatio: '1:1',
      prompt: `${productPreservation}
Product showcase layout, the EXACT same ${productName.toLowerCase()} from input image shown from multiple angles,
maintain identical product design in all views,
pure white background across all frames,
consistent soft studio lighting,
${colors ? `preserve exact ${colors.toLowerCase()} color tones as original, ` : ''}
keep all original logos, branding, buttons, and design features,
realistic shadows, clean reflections,
professional product photography style,
clear structure and symmetry,
designed for e-commerce detail image sections.`,
      negativePrompt: `${preservationNegative}, people, text, clutter, watermark, inconsistent lighting, different backgrounds, blurry, low quality, different products in each frame`,
    },

    // IMAGE 3 — Functionality Highlight
    {
      id: 'functionality',
      name: 'Functionality Highlight',
      purpose: 'Show what it does, not just how it looks',
      platforms: ['Shopee Malaysia', 'Lazada Malaysia', 'Amazon'],
      imageType: 'functionality',
      aspectRatio: '1:1',
      prompt: `${productPreservation}
Product functionality advertisement image, the EXACT ${productName.toLowerCase()} from input image as main focus,
clean light background,
${functionalityHighlight},
${features ? `highlighting ${features.toLowerCase()}, ` : ''}
keep all original product design details intact,
modern commercial product photography,
realistic lighting, high clarity,
technology-focused advertising style,
ideal for Amazon-style and Shopee feature explanation images.`,
      negativePrompt: `${preservationNegative}, people, excessive text, cartoon style, watermark, cluttered background, blurry, low quality`,
    },

    // IMAGE 4 — Lifestyle Usage Scenario
    {
      id: 'lifestyle',
      name: 'Lifestyle Usage Scenario',
      purpose: 'Emotional selling - "I need this" moment for Malaysian consumers',
      platforms: ['Instagram Malaysia', 'Facebook Malaysia', 'TikTok Malaysia'],
      imageType: 'lifestyle',
      aspectRatio: '4:5',
      prompt: `${productPreservation}
Lifestyle product advertisement, the EXACT ${productName.toLowerCase()} from input image shown in use,
${lifestyleContext},
warm natural daylight,
clean and realistic background,
the product must be the IDENTICAL design from the input image,
natural shadows and lighting,
comfortable, practical, everyday usage feeling,
Instagram and TikTok-friendly lifestyle photography style,
appealing to Malaysian consumers.`,
      negativePrompt: `${preservationNegative}, text overlay, watermark, clutter, artificial lighting, studio background, blurry, low quality, generic product`,
    },

    // IMAGE 5 — Human Interaction Shot
    {
      id: 'human-interaction',
      name: 'Influencer / Human Interaction Shot',
      purpose: 'TikTok / Instagram / Reels / Trust-building image',
      platforms: ['TikTok Malaysia', 'Instagram Malaysia', 'Facebook Malaysia'],
      imageType: 'human-interaction',
      aspectRatio: '9:16',
      prompt: `${productPreservation}
${humanInteraction},
the person is holding/using the EXACT same ${productName.toLowerCase()} from the input image,
bright and clean background,
soft natural lighting,
realistic skin tones,
product clearly visible and in focus with all original design details preserved,
modern social media advertisement photography,
friendly and relatable lifestyle mood,
ideal for TikTok Malaysia and Instagram ads.`,
      negativePrompt: `${preservationNegative}, exaggerated beauty filters, text overlay, watermark, unnatural poses, artificial skin, blurry, low quality, cartoon, generic product`,
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
