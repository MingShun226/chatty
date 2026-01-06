import React, { useMemo, useState } from 'react';
import { Check, Star, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AdvertisingStyle, getAllPlatforms } from '@/config/advertisingStyles';
import { StyleRecommendation } from '../AdvertisingWizard';

interface StyleSelectionStepProps {
  recommendations: StyleRecommendation[];
  selectedStyles: AdvertisingStyle[];
  onStylesChange: (styles: AdvertisingStyle[]) => void;
}

export function StyleSelectionStep({
  recommendations,
  selectedStyles,
  onStylesChange,
}: StyleSelectionStepProps) {
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'recommended' | 'selected'>('all');

  // Group styles by platform
  const stylesByPlatform = useMemo(() => {
    const platforms = getAllPlatforms();
    return platforms.map(platform => ({
      ...platform,
      recommendations: recommendations.filter(
        r => r.style.platform === platform.name
      ),
    }));
  }, [recommendations]);

  // Toggle style selection
  const toggleStyle = (style: AdvertisingStyle) => {
    const isSelected = selectedStyles.some(s => s.id === style.id);
    if (isSelected) {
      onStylesChange(selectedStyles.filter(s => s.id !== style.id));
    } else {
      onStylesChange([...selectedStyles, style]);
    }
  };

  // Toggle all styles for a platform
  const togglePlatform = (platformStyles: AdvertisingStyle[]) => {
    const allSelected = platformStyles.every(
      style => selectedStyles.some(s => s.id === style.id)
    );

    if (allSelected) {
      // Remove all platform styles
      onStylesChange(
        selectedStyles.filter(
          s => !platformStyles.some(ps => ps.id === s.id)
        )
      );
    } else {
      // Add all platform styles
      const newStyles = [...selectedStyles];
      platformStyles.forEach(style => {
        if (!newStyles.some(s => s.id === style.id)) {
          newStyles.push(style);
        }
      });
      onStylesChange(newStyles);
    }
  };

  // Select only recommended styles
  const selectRecommended = () => {
    const recommendedStyles = recommendations
      .filter(r => r.isRecommended)
      .map(r => r.style);
    onStylesChange(recommendedStyles);
  };

  // Clear all selections
  const clearAll = () => {
    onStylesChange([]);
  };

  // Toggle platform expansion
  const togglePlatformExpansion = (platformId: string) => {
    setExpandedPlatforms(prev => ({
      ...prev,
      [platformId]: !prev[platformId],
    }));
  };

  // Filter recommendations
  const getFilteredRecommendations = (recs: StyleRecommendation[]) => {
    switch (filter) {
      case 'recommended':
        return recs.filter(r => r.isRecommended);
      case 'selected':
        return recs.filter(r => selectedStyles.some(s => s.id === r.style.id));
      default:
        return recs;
    }
  };

  const totalImages = selectedStyles.length;
  const recommendedCount = recommendations.filter(r => r.isRecommended).length;

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Select Advertising Styles</h3>
          <p className="text-sm text-muted-foreground">
            Choose which styles to generate for your product
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectRecommended}
            className="flex items-center gap-1"
          >
            <Star className="h-4 w-4 text-yellow-500" />
            Select AI Picks ({recommendedCount})
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Selection summary */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-purple-900">
            {totalImages} {totalImages === 1 ? 'style' : 'styles'} selected
          </p>
          <p className="text-sm text-purple-700">
            {totalImages} {totalImages === 1 ? 'image' : 'images'} will be generated
          </p>
        </div>
        <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-lg px-3 py-1">
          {totalImages}
        </Badge>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { key: 'all', label: 'All Styles' },
          { key: 'recommended', label: 'AI Recommended' },
          { key: 'selected', label: 'Selected' },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter(key as typeof filter)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Platforms and styles */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {stylesByPlatform.map(platform => {
          const filteredRecs = getFilteredRecommendations(platform.recommendations);
          if (filteredRecs.length === 0) return null;

          const platformStyles = filteredRecs.map(r => r.style);
          const selectedCount = platformStyles.filter(
            s => selectedStyles.some(sel => sel.id === s.id)
          ).length;
          const isExpanded = expandedPlatforms[platform.id] !== false; // Default to expanded
          const allSelected = selectedCount === platformStyles.length;

          return (
            <div
              key={platform.id}
              className="border rounded-lg overflow-hidden"
            >
              {/* Platform header */}
              <div
                className="bg-gray-50 p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                onClick={() => togglePlatformExpansion(platform.id)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => togglePlatform(platformStyles)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <p className="font-medium">{platform.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCount} of {platformStyles.length} selected
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {platform.popular && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      Popular
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </div>
              </div>

              {/* Platform styles */}
              {isExpanded && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredRecs.map(rec => {
                    const isSelected = selectedStyles.some(s => s.id === rec.style.id);

                    return (
                      <div
                        key={rec.style.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleStyle(rec.style)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleStyle(rec.style)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="font-medium text-sm">
                              {rec.style.name}
                            </span>
                          </div>
                          {rec.isRecommended && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                          {rec.style.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2 ml-6">
                          <Badge variant="outline" className="text-xs">
                            {rec.style.aspectRatio}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              rec.score >= 70
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100'
                            }`}
                          >
                            {rec.score}% match
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filter === 'selected' && selectedStyles.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No styles selected yet.</p>
          <p className="text-sm">Click on styles above to select them, or use "Select AI Picks".</p>
        </div>
      )}
    </div>
  );
}

export default StyleSelectionStep;
