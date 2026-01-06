import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, CheckCircle, AlertCircle, Tag, Palette, Package, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { analyzeProductImage, ProductAnalysis } from '@/services/productAnalysis';
import { getAllPlatforms, AdvertisingStyle } from '@/config/advertisingStyles';
import { StyleRecommendation } from '../AdvertisingWizard';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisStepProps {
  productImage: string;
  productAnalysis: ProductAnalysis | null;
  recommendations: StyleRecommendation[];
  isAnalyzing: boolean;
  onAnalysisComplete: (analysis: ProductAnalysis, recommendations: StyleRecommendation[]) => void;
  onAnalysisStart: () => void;
}

// Category to platform mapping for AI recommendations
const CATEGORY_PLATFORM_MAP: Record<string, string[]> = {
  'electronics': ['instagram', 'tiktok', 'lazada'],
  'fashion': ['instagram', 'tiktok', 'shopee'],
  'beauty': ['instagram', 'tiktok', 'shopee'],
  'home': ['shopee', 'lazada', 'facebook'],
  'food': ['instagram', 'tiktok', 'facebook'],
  'sports': ['instagram', 'tiktok', 'shopee'],
  'toys': ['shopee', 'lazada', 'facebook'],
  'health': ['shopee', 'lazada', 'facebook'],
  'default': ['instagram', 'shopee', 'lazada'],
};

export function AnalysisStep({
  productImage,
  productAnalysis,
  recommendations,
  isAnalyzing,
  onAnalysisComplete,
  onAnalysisStart,
}: AnalysisStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasTriedAnalysis, setHasTriedAnalysis] = useState(false);

  // Generate style recommendations based on product analysis
  const generateRecommendations = (analysis: ProductAnalysis): StyleRecommendation[] => {
    const allPlatforms = getAllPlatforms();
    const allStyles: AdvertisingStyle[] = [];

    // Flatten all styles from all platforms
    allPlatforms.forEach(platform => {
      allStyles.push(...platform.styles);
    });

    // Determine best platforms based on category
    const category = analysis.category?.toLowerCase() || 'default';
    const preferredPlatforms = CATEGORY_PLATFORM_MAP[category] || CATEGORY_PLATFORM_MAP['default'];

    // Score each style
    const scoredStyles: StyleRecommendation[] = allStyles.map(style => {
      let score = 50; // Base score
      let reasons: string[] = [];

      // Platform preference (40 points max)
      const platformId = style.platform.toLowerCase().replace(' malaysia', '');
      const platformIndex = preferredPlatforms.indexOf(platformId);
      if (platformIndex !== -1) {
        score += (3 - platformIndex) * 13; // 39, 26, 13 points
        reasons.push(`Great for ${analysis.category || 'products'} on ${style.platform}`);
      }

      // Series number preference - prefer hero shots (20 points max)
      if (style.seriesNumber === 1) {
        score += 20;
        reasons.push('Hero shot - primary product display');
      } else if (style.seriesNumber === 2) {
        score += 15;
        reasons.push('Lifestyle context - shows product in use');
      } else if (style.seriesNumber === 5) {
        score += 10;
        reasons.push('Promotional style - great for sales');
      }

      // Boost based on product features
      if (analysis.style?.toLowerCase().includes('modern') && style.name.toLowerCase().includes('aesthetic')) {
        score += 10;
        reasons.push('Matches modern aesthetic');
      }

      // Cap score at 100
      score = Math.min(100, score);

      return {
        style,
        score,
        reason: reasons[0] || `Suitable for ${style.platform}`,
        isRecommended: score >= 70,
      };
    });

    // Sort by score and return top recommendations
    return scoredStyles.sort((a, b) => b.score - a.score);
  };

  // Auto-analyze when component mounts
  useEffect(() => {
    const runAnalysis = async () => {
      if (productAnalysis || hasTriedAnalysis) return;

      setHasTriedAnalysis(true);
      onAnalysisStart();
      setError(null);

      try {
        const analysis = await analyzeProductImage(productImage);
        const recs = generateRecommendations(analysis);
        onAnalysisComplete(analysis, recs);
      } catch (err: any) {
        console.error('Analysis failed:', err);
        setError(err.message || 'Failed to analyze product');

        // Create fallback analysis
        const fallbackAnalysis: ProductAnalysis = {
          productName: 'Product',
          category: 'General',
          keyFeatures: ['Quality item', 'Great value'],
          colors: ['Various'],
          detailedDescription: 'A quality product for your needs.',
        };

        const recs = generateRecommendations(fallbackAnalysis);
        onAnalysisComplete(fallbackAnalysis, recs);
      }
    };

    runAnalysis();
  }, [productImage, productAnalysis, hasTriedAnalysis]);

  // Retry analysis
  const handleRetry = () => {
    setHasTriedAnalysis(false);
    setError(null);
  };

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
            Our AI is identifying your product and selecting the best advertising styles
          </p>
        </div>
      </div>
    );
  }

  if (!productAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-yellow-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Analysis not started</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error || 'Waiting to analyze your product...'}
          </p>
        </div>
        <Button onClick={handleRetry}>
          <Sparkles className="h-4 w-4 mr-2" />
          Analyze Product
        </Button>
      </div>
    );
  }

  // Show recommended styles count
  const recommendedCount = recommendations.filter(r => r.isRecommended).length;

  return (
    <div className="space-y-6">
      {/* Product Analysis Results */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border bg-white">
            <img
              src={productImage}
              alt="Product"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-lg">Product Identified</h3>
            </div>
            <p className="text-xl font-bold text-purple-700 mb-2">
              {productAnalysis.productName}
            </p>
            <div className="flex flex-wrap gap-2">
              {productAnalysis.category && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {productAnalysis.category}
                </Badge>
              )}
              {productAnalysis.colors.slice(0, 3).map((color, i) => (
                <Badge key={i} variant="outline" className="flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  {color}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Key Features */}
        {productAnalysis.keyFeatures.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Key Features:</p>
            <div className="flex flex-wrap gap-2">
              {productAnalysis.keyFeatures.slice(0, 4).map((feature, i) => (
                <Badge key={i} variant="outline" className="bg-white">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Recommendations Summary */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Star className="h-5 w-5 text-yellow-600" />
          <h4 className="font-semibold text-yellow-900">AI Recommendations</h4>
        </div>
        <p className="text-sm text-yellow-800">
          Based on your <strong>{productAnalysis.productName}</strong>, we've selected{' '}
          <strong>{recommendedCount} advertising styles</strong> that will work best for your product.
          You can customize the selection in the next step.
        </p>
      </div>

      {/* Top Recommendations Preview */}
      <div>
        <h4 className="font-medium mb-3">Top Recommended Styles:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {recommendations.slice(0, 6).map((rec) => (
            <div
              key={rec.style.id}
              className={`p-3 rounded-lg border ${
                rec.isRecommended
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">
                  {rec.style.platform}
                </span>
                <Badge
                  variant={rec.isRecommended ? 'default' : 'secondary'}
                  className={rec.isRecommended ? 'bg-green-600' : ''}
                >
                  {rec.score}%
                </Badge>
              </div>
              <p className="font-medium text-sm">{rec.style.name}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {rec.reason}
              </p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            {error}. Using default recommendations.
          </p>
        </div>
      )}
    </div>
  );
}

export default AnalysisStep;
