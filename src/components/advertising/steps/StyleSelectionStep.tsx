import React from 'react';
import { Check, Star, Image, LayoutGrid, Zap, Camera, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { StyleRecommendation, ExtendedAdvertisingStyle } from '../AdvertisingWizard';

interface StyleSelectionStepProps {
  recommendations: StyleRecommendation[];
  selectedStyles: ExtendedAdvertisingStyle[];
  onStylesChange: (styles: ExtendedAdvertisingStyle[]) => void;
}

// Image type icons mapping
const IMAGE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'generated-hero-image': <Image className="h-5 w-5" />,
  'generated-multi-angle': <LayoutGrid className="h-5 w-5" />,
  'generated-functionality': <Zap className="h-5 w-5" />,
  'generated-lifestyle': <Camera className="h-5 w-5" />,
  'generated-human-interaction': <Users className="h-5 w-5" />,
};

// Image type colors
const IMAGE_TYPE_COLORS: Record<string, string> = {
  'generated-hero-image': 'border-blue-400 bg-blue-50',
  'generated-multi-angle': 'border-purple-400 bg-purple-50',
  'generated-functionality': 'border-orange-400 bg-orange-50',
  'generated-lifestyle': 'border-green-400 bg-green-50',
  'generated-human-interaction': 'border-pink-400 bg-pink-50',
};

export function StyleSelectionStep({
  recommendations,
  selectedStyles,
  onStylesChange,
}: StyleSelectionStepProps) {

  // Toggle style selection
  const toggleStyle = (style: ExtendedAdvertisingStyle) => {
    const isSelected = selectedStyles.some(s => s.id === style.id);
    if (isSelected) {
      onStylesChange(selectedStyles.filter(s => s.id !== style.id));
    } else {
      onStylesChange([...selectedStyles, style]);
    }
  };

  // Select all styles
  const selectAll = () => {
    onStylesChange(recommendations.map(r => r.style));
  };

  // Clear all selections
  const clearAll = () => {
    onStylesChange([]);
  };

  const totalImages = selectedStyles.length;
  const allSelected = selectedStyles.length === recommendations.length;

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Select Images to Generate</h3>
          <p className="text-sm text-muted-foreground">
            Choose which of the 5 professional ad images you want to create
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={allSelected}
            className="flex items-center gap-1"
          >
            <Star className="h-4 w-4 text-yellow-500" />
            Select All (5)
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={totalImages === 0}>
            Clear
          </Button>
        </div>
      </div>

      {/* Selection summary */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-purple-900">
            {totalImages} of 5 images selected
          </p>
          <p className="text-sm text-purple-700">
            {totalImages === 0 ? 'Select at least one image to generate' : `${totalImages} professional ad ${totalImages === 1 ? 'image' : 'images'} will be created`}
          </p>
        </div>
        <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-lg px-4 py-2">
          {totalImages}
        </Badge>
      </div>

      {/* 5 Image Options */}
      <div className="space-y-3">
        {recommendations.map((rec, index) => {
          const isSelected = selectedStyles.some(s => s.id === rec.style.id);
          const colorClass = IMAGE_TYPE_COLORS[rec.style.id] || 'border-gray-200 bg-white';

          return (
            <div
              key={rec.style.id}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                isSelected
                  ? `${colorClass} ring-2 ring-offset-2 ring-purple-500`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => toggleStyle(rec.style)}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div className="pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleStyle(rec.style)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 w-5"
                  />
                </div>

                {/* Number indicator */}
                <div className={`flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 ${
                  isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className="font-bold text-lg">{index + 1}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {IMAGE_TYPE_ICONS[rec.style.id]}
                    <h4 className="font-semibold text-lg">{rec.style.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {rec.style.aspectRatio}
                    </Badge>
                    {rec.isRecommended && (
                      <Badge className="bg-yellow-500 text-white text-xs">
                        <Star className="h-3 w-3 mr-1 fill-white" />
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{rec.style.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {rec.style.platform}
                    </Badge>
                  </div>
                </div>

                {/* Check indicator */}
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> We recommend generating all 5 images for a complete advertising campaign.
          Image 1 (Hero) is essential for marketplace listings, while Image 5 (Human Interaction)
          performs best on social media.
        </p>
      </div>
    </div>
  );
}

export default StyleSelectionStep;
