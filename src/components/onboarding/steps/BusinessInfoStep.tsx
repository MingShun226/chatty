import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';

interface BusinessInfoStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const industries = [
  { id: 'ecommerce', label: 'E-commerce & Retail', icon: '🛒' },
  { id: 'fnb', label: 'Food & Beverage', icon: '🍽️' },
  { id: 'healthcare', label: 'Healthcare & Medical', icon: '🏥' },
  { id: 'education', label: 'Education & Training', icon: '📚' },
  { id: 'realestate', label: 'Real Estate & Property', icon: '🏠' },
  { id: 'finance', label: 'Financial Services', icon: '💰' },
  { id: 'services', label: 'Professional Services', icon: '💼' },
  { id: 'tech', label: 'Technology & SaaS', icon: '💻' },
  { id: 'travel', label: 'Travel & Hospitality', icon: '✈️' },
  { id: 'beauty', label: 'Beauty & Wellness', icon: '💅' },
  { id: 'automotive', label: 'Automotive', icon: '🚗' },
  { id: 'other', label: 'Other', icon: '🏢' },
];

const companySizes = [
  { id: 'solo', label: 'Solo / Freelancer', description: 'Just me' },
  { id: 'small', label: 'Small (2-10)', description: 'Small team' },
  { id: 'medium', label: 'Medium (11-50)', description: 'Growing business' },
  { id: 'large', label: 'Large (51-200)', description: 'Established company' },
  { id: 'enterprise', label: 'Enterprise (200+)', description: 'Large organization' },
];

export const BusinessInfoStep: React.FC<BusinessInfoStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const canProceed = data.businessName && data.industry;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Tell Us About Your Business</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          This helps us create the perfect AI chatbot for your needs. We'll use this to generate a smart starting prompt.
        </p>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="businessName">Business / Brand Name *</Label>
        <Input
          id="businessName"
          placeholder="e.g., Acme Coffee Shop, TechSolutions Inc."
          value={data.businessName}
          onChange={(e) => updateData({ businessName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Your chatbot will introduce itself as representing this business
        </p>
      </div>

      {/* What you sell/offer */}
      <div className="space-y-2">
        <Label htmlFor="businessDescription">What do you sell or offer? *</Label>
        <Textarea
          id="businessDescription"
          placeholder="e.g., We sell organic coffee beans and brewing equipment. We also offer coffee-making classes and home delivery service."
          value={data.businessDescription}
          onChange={(e) => updateData({ businessDescription: e.target.value })}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Be specific - this helps the AI understand your products and services
        </p>
      </div>

      {/* Industry Selection */}
      <div className="space-y-3">
        <Label>What industry are you in? *</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {industries.map((industry) => {
            const isSelected = data.industry === industry.id;
            return (
              <button
                key={industry.id}
                type="button"
                onClick={() => updateData({ industry: industry.id })}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border text-left transition-all text-sm",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <span className="text-lg">{industry.icon}</span>
                <span className={cn("font-medium", isSelected && "text-primary")}>
                  {industry.label}
                </span>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Company Size */}
      <div className="space-y-3">
        <Label>Company size (optional)</Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {companySizes.map((size) => {
            const isSelected = data.companySize === size.id;
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => updateData({ companySize: size.id })}
                className={cn(
                  "p-3 rounded-lg border text-center transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <span className={cn("font-medium text-sm block", isSelected && "text-primary")}>
                  {size.label}
                </span>
                <span className="text-xs text-muted-foreground">{size.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default BusinessInfoStep;
