import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, Building2, Target, Users } from 'lucide-react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';

interface UserInfoStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const industries = [
  { value: 'ecommerce', label: 'E-commerce & Retail' },
  { value: 'fnb', label: 'Food & Beverage' },
  { value: 'healthcare', label: 'Healthcare & Medical' },
  { value: 'education', label: 'Education & Training' },
  { value: 'realestate', label: 'Real Estate' },
  { value: 'finance', label: 'Financial Services' },
  { value: 'services', label: 'Professional Services' },
  { value: 'tech', label: 'Technology & SaaS' },
  { value: 'travel', label: 'Travel & Hospitality' },
  { value: 'other', label: 'Other' },
];

const useCases = [
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'sales', label: 'Sales & Lead Gen' },
  { value: 'marketing', label: 'Marketing & Promos' },
  { value: 'booking', label: 'Appointment Booking' },
  { value: 'orders', label: 'Order Management' },
  { value: 'faq', label: 'FAQ Bot' },
  { value: 'recommendations', label: 'Product Recommendations' },
  { value: 'feedback', label: 'Feedback Collection' },
  { value: 'other', label: 'Other' },
];

const companySizes = [
  { value: 'solo', label: 'Solo / Freelancer' },
  { value: 'small', label: 'Small (2-10)' },
  { value: 'medium', label: 'Medium (11-50)' },
  { value: 'large', label: 'Large (51-200)' },
  { value: 'enterprise', label: 'Enterprise (200+)' },
];

const SelectButton: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
      "border hover:border-primary",
      selected
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background text-foreground border-border hover:bg-muted"
    )}
  >
    {children}
  </button>
);

export const UserInfoStep: React.FC<UserInfoStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Tell Us About Your Business</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          This helps us personalize your experience and provide better recommendations.
        </p>
      </div>

      {/* Industry Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          What industry are you in?
        </Label>
        <div className="flex flex-wrap gap-2">
          {industries.map((industry) => (
            <SelectButton
              key={industry.value}
              selected={data.industry === industry.value}
              onClick={() => updateData({ industry: industry.value })}
            >
              {industry.label}
            </SelectButton>
          ))}
        </div>
      </div>

      {/* Use Case Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Target className="w-4 h-4" />
          What's your primary use case?
        </Label>
        <div className="flex flex-wrap gap-2">
          {useCases.map((useCase) => (
            <SelectButton
              key={useCase.value}
              selected={data.useCase === useCase.value}
              onClick={() => updateData({ useCase: useCase.value })}
            >
              {useCase.label}
            </SelectButton>
          ))}
        </div>
      </div>

      {/* Company Size Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Company size?
        </Label>
        <div className="flex flex-wrap gap-2">
          {companySizes.map((size) => (
            <SelectButton
              key={size.value}
              selected={data.companySize === size.value}
              onClick={() => updateData({ companySize: size.value })}
            >
              {size.label}
            </SelectButton>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onNext}>
            Skip this step
          </Button>
          <Button onClick={onNext}>
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserInfoStep;
