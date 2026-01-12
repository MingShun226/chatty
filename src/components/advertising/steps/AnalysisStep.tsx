import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, CheckCircle, AlertCircle, Tag, Palette, Package, Star, Image, Users, Zap, Camera, LayoutGrid } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { analyzeProductImage, ProductAnalysis } from '@/services/productAnalysis';
import { generateProfessionalPrompts, getGeneratedStylesFromPrompts, GeneratedPrompt } from '@/services/promptGeneration';
import { StyleRecommendation } from '../AdvertisingWizard';

interface AnalysisStepProps {
  productImage: string;
  productName?: string;
  productDescription?: string;
  additionalRequirements?: string;
  productAnalysis: ProductAnalysis | null;
  recommendations: StyleRecommendation[];
  isAnalyzing: boolean;
  onAnalysisComplete: (analysis: ProductAnalysis, recommendations: StyleRecommendation[]) => void;
  onAnalysisStart: () => void;
}

// Image type icons mapping
const IMAGE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'hero': <Image className="h-4 w-4" />,
  'multi-angle': <LayoutGrid className="h-4 w-4" />,
  'functionality': <Zap className="h-4 w-4" />,
  'lifestyle': <Camera className="h-4 w-4" />,
  'human-interaction': <Users className="h-4 w-4" />,
};

// Image type colors
const IMAGE_TYPE_COLORS: Record<string, string> = {
  'hero': 'bg-blue-100 border-blue-300 text-blue-800',
  'multi-angle': 'bg-purple-100 border-purple-300 text-purple-800',
  'functionality': 'bg-orange-100 border-orange-300 text-orange-800',
  'lifestyle': 'bg-green-100 border-green-300 text-green-800',
  'human-interaction': 'bg-pink-100 border-pink-300 text-pink-800',
};

export function AnalysisStep({
  productImage,
  productName: userProductName,
  productDescription: userProductDescription,
  additionalRequirements,
  productAnalysis,
  recommendations,
  isAnalyzing,
  onAnalysisComplete,
  onAnalysisStart,
}: AnalysisStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasTriedAnalysis, setHasTriedAnalysis] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompt[]>([]);
  const [productSummary, setProductSummary] = useState<string>('');

  // Generate professional prompts and convert to style recommendations
  const generateRecommendations = (analysis: ProductAnalysis): StyleRecommendation[] => {
    // Merge user-provided info with AI analysis
    // User input takes priority if provided
    const enhancedAnalysis: ProductAnalysis = {
      ...analysis,
      // Use user's product name if provided, otherwise AI-detected name
      productName: userProductName?.trim() || analysis.productName,
      // Append user description to AI description if provided
      detailedDescription: userProductDescription?.trim()
        ? `${userProductDescription.trim()}. ${analysis.detailedDescription || ''}`
        : analysis.detailedDescription,
    };

    const result = generateProfessionalPrompts(enhancedAnalysis, additionalRequirements?.trim());
    setGeneratedPrompts(result.prompts);
    setProductSummary(result.productSummary);

    // Convert to StyleRecommendation format
    const styles = getGeneratedStylesFromPrompts(result.prompts);

    return styles.map((style, index) => ({
      style: {
        id: style.id,
        name: style.name,
        platform: style.platform,
        seriesNumber: style.seriesNumber,
        description: style.description,
        prompt: style.prompt,
        negativePrompt: style.negativePrompt,
        aspectRatio: style.aspectRatio,
        strength: style.strength,
      },
      score: 100 - (index * 5), // Decreasing score: 100, 95, 90, 85, 80
      reason: style.description,
      isRecommended: true, // All 5 are recommended
    }));
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
            Our AI is identifying your product and generating professional advertising prompts
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

  return (
    <div className="space-y-6">
      {/* Product Analysis Results */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border bg-white">
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
            <p className="text-2xl font-bold text-purple-700 mb-3">
              {productAnalysis.productName}
            </p>
            <div className="flex flex-wrap gap-2">
              {productAnalysis.category && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-purple-100">
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
              {productAnalysis.materials?.slice(0, 2).map((material, i) => (
                <Badge key={`mat-${i}`} variant="outline" className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {material}
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
              {productAnalysis.keyFeatures.slice(0, 5).map((feature, i) => (
                <Badge key={i} variant="outline" className="bg-white">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Generated 5 Professional Prompts */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-5 w-5 text-yellow-600 fill-yellow-500" />
          <h4 className="font-semibold text-yellow-900">5 Professional Ad Images Generated</h4>
        </div>
        <p className="text-sm text-yellow-800 mb-4">
          Based on your <strong>{productAnalysis.productName}</strong>, we've created 5 optimized advertising images
          for Malaysian e-commerce platforms.
        </p>

        {/* 5 Image Types Preview */}
        <div className="space-y-3">
          {generatedPrompts.map((prompt, index) => (
            <div
              key={prompt.id}
              className={`p-4 rounded-lg border ${IMAGE_TYPE_COLORS[prompt.imageType]} transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm flex-shrink-0">
                  <span className="font-bold text-lg">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {IMAGE_TYPE_ICONS[prompt.imageType]}
                    <h5 className="font-semibold">{prompt.name}</h5>
                    <Badge variant="outline" className="text-xs bg-white">
                      {prompt.aspectRatio}
                    </Badge>
                  </div>
                  <p className="text-sm opacity-90 mb-2">{prompt.purpose}</p>
                  <div className="flex flex-wrap gap-1">
                    {prompt.platforms.map((platform, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-white/50">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prompt Preview (Collapsible) */}
      <details className="bg-gray-50 rounded-lg border">
        <summary className="p-4 cursor-pointer font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
          View Generated Prompts (Advanced)
        </summary>
        <div className="p-4 pt-0 space-y-4">
          {generatedPrompts.map((prompt, index) => (
            <div key={prompt.id} className="border rounded-lg p-3 bg-white">
              <h6 className="font-medium text-sm mb-2">Image {index + 1}: {prompt.name}</h6>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {prompt.prompt}
              </pre>
              <p className="text-xs text-red-600 mt-2">
                <strong>Negative:</strong> {prompt.negativePrompt}
              </p>
            </div>
          ))}
        </div>
      </details>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            {error}. Using default prompts.
          </p>
        </div>
      )}
    </div>
  );
}

export default AnalysisStep;
