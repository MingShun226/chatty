import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight,
  ArrowLeft,
  Tag,
  Plus,
  Trash2,
  CheckCircle2,
  Percent,
  DollarSign,
  Gift,
  Info
} from 'lucide-react';
import { OnboardingData, OnboardingPromotion } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PromotionsStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const promotionTemplates = [
  {
    id: 'percentage',
    icon: Percent,
    title: '% Off',
    description: 'Percentage discount',
    color: 'from-orange-400 to-red-500',
  },
  {
    id: 'fixed',
    icon: DollarSign,
    title: 'Fixed Amount',
    description: 'RM off discount',
    color: 'from-green-400 to-emerald-500',
  },
  {
    id: 'bundle',
    icon: Gift,
    title: 'Free Gift / Bundle',
    description: 'Free item with purchase',
    color: 'from-purple-400 to-pink-500',
  },
];

export const PromotionsStep: React.FC<PromotionsStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState<Partial<OnboardingPromotion>>({
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    promo_code: '',
    end_date: '',
  });

  const promotions = data.promotions || [];

  const handleSelectType = (typeId: string) => {
    setSelectedType(typeId);
    setNewPromo({
      ...newPromo,
      discount_type: typeId === 'percentage' ? 'percentage' : typeId === 'fixed' ? 'fixed' : 'none',
    });
    setShowAddForm(true);
  };

  const handleAddPromotion = () => {
    if (!newPromo.title) {
      toast({
        title: 'Missing Information',
        description: 'Promotion title is required.',
        variant: 'destructive',
      });
      return;
    }

    updateData({
      promotions: [...promotions, newPromo as OnboardingPromotion]
    });

    setNewPromo({
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      promo_code: '',
      end_date: '',
    });
    setShowAddForm(false);
    setSelectedType(null);

    toast({
      title: 'Promotion Added',
      description: `"${newPromo.title}" has been added.`,
    });
  };

  const handleRemovePromotion = (index: number) => {
    const updated = promotions.filter((_, i) => i !== index);
    updateData({ promotions: updated });
  };

  const handleSkip = () => {
    updateData({ promotions: [] });
    onNext();
  };

  const getDiscountDisplay = (promo: OnboardingPromotion) => {
    if (promo.discount_type === 'percentage' && promo.discount_value) {
      return `${promo.discount_value}% OFF`;
    }
    if (promo.discount_type === 'fixed' && promo.discount_value) {
      return `RM${promo.discount_value} OFF`;
    }
    return 'Special Offer';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Tag className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Add Current Promotions</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Let your chatbot know about ongoing deals so it can share them with customers.
          This step is optional.
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-pink-50/50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-pink-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-pink-800 dark:text-pink-200">
                Why add promotions?
              </h4>
              <p className="text-sm text-pink-700 dark:text-pink-300 mt-1">
                Your chatbot will proactively mention relevant promotions to customers,
                increasing conversion rates and customer satisfaction.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promotion Type Selection */}
      {!showAddForm && (
        <div className="space-y-3">
          <Label>Select promotion type to add</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {promotionTemplates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                onClick={() => handleSelectType(template.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className={cn(
                    "w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3",
                    `bg-gradient-to-br ${template.color}`
                  )}>
                    <template.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold">{template.title}</h3>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Promotion Form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                Add {selectedType === 'percentage' ? 'Percentage' : selectedType === 'fixed' ? 'Fixed Amount' : 'Special'} Promotion
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedType(null);
                }}
              >
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Promotion Title *</Label>
                <Input
                  placeholder="e.g., Chinese New Year Sale, 20% Off Weekends"
                  value={newPromo.title}
                  onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                />
              </div>

              {(selectedType === 'percentage' || selectedType === 'fixed') && (
                <div className="space-y-2">
                  <Label>
                    {selectedType === 'percentage' ? 'Discount %' : 'Discount Amount (RM)'}
                  </Label>
                  <Input
                    type="number"
                    placeholder={selectedType === 'percentage' ? 'e.g., 20' : 'e.g., 50'}
                    value={newPromo.discount_value || ''}
                    onChange={(e) => setNewPromo({ ...newPromo, discount_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Promo Code (optional)</Label>
                <Input
                  placeholder="e.g., CNY2024"
                  value={newPromo.promo_code}
                  onChange={(e) => setNewPromo({ ...newPromo, promo_code: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={newPromo.end_date}
                  onChange={(e) => setNewPromo({ ...newPromo, end_date: e.target.value })}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="e.g., Get 20% off on all electronic items. Valid for online purchases only."
                  value={newPromo.description}
                  onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <Button onClick={handleAddPromotion}>
              <Plus className="w-4 h-4 mr-2" />
              Add Promotion
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Promotions List */}
      {promotions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Active Promotions ({promotions.length})</h4>
              <Badge variant="outline" className="text-green-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ready
              </Badge>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {promotions.map((promo, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{promo.title}</p>
                      <Badge variant="secondary" className="text-xs">
                        {getDiscountDisplay(promo)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {promo.promo_code && `Code: ${promo.promo_code}`}
                      {promo.promo_code && promo.end_date && ' • '}
                      {promo.end_date && `Ends: ${new Date(promo.end_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePromotion(index)}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Another Button */}
      {!showAddForm && promotions.length > 0 && (
        <div className="text-center">
          <Button variant="ghost" onClick={() => setShowAddForm(false)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Another Promotion
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSkip}>
            Skip for Now
          </Button>
          <Button onClick={onNext}>
            Complete Setup
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PromotionsStep;
