import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFeatureAccess, featureInfo } from '@/hooks/useFeatureAccess';
import { Loader2 } from 'lucide-react';

// Check if there's any cached tier data in localStorage (for optimistic rendering)
const hasCachedTierData = (): boolean => {
  try {
    const cached = localStorage.getItem('user_tier_cache');
    if (!cached) return false;
    const data = JSON.parse(cached);
    return !!data.tierInfo;
  } catch {
    return false;
  }
};

interface FeatureGateProps {
  featureKey: string; // e.g., 'advertising.images_studio' or 'chatbot.ai_training'
  children: React.ReactNode;
  fallbackContent?: React.ReactNode; // Optional custom fallback content
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  featureKey,
  children,
  fallbackContent,
}) => {
  const { hasFeatureAccess, getTiersWithFeature, tierInfo, loading } = useFeatureAccess();

  // While loading, render children (optimistic - assume access)
  // This prevents the loading flash
  if (loading) {
    return <>{children}</>;
  }

  // User has access - render children normally
  if (hasFeatureAccess(featureKey)) {
    return <>{children}</>;
  }

  // Extra safety: if we have cached tier data but tierInfo is null temporarily,
  // still show children (optimistic) to prevent flash during auth transitions
  if (!tierInfo && hasCachedTierData()) {
    return <>{children}</>;
  }

  // User doesn't have access - show upgrade prompt
  const feature = featureInfo[featureKey];
  const availableTiers = getTiersWithFeature(featureKey);

  // Custom fallback content
  if (fallbackContent) {
    return <>{fallbackContent}</>;
  }

  // WhatsApp contact link
  const whatsappNumber = '60165230268';
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=Hi, I need help choosing a plan for ${feature?.name || 'this feature'}.`;

  return (
    <div className="min-h-[calc(100vh-200px)] bg-white dark:bg-background flex items-center justify-center p-4">
      {/* Upgrade prompt */}
      <Card className="max-w-lg w-full shadow-lg border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {feature?.name || 'Feature'} is Locked
          </CardTitle>
          <CardDescription className="text-base">
            {feature?.description || 'This feature is not available on your current plan.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current plan info */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Your current plan</p>
            <p className="font-semibold text-lg">
              {tierInfo?.display_name || 'No Plan'}
            </p>
          </div>

          {/* Available plans with this feature */}
          {availableTiers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Available with these plans:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableTiers.map((tier) => (
                  <Badge
                    key={tier.id}
                    variant="secondary"
                    className="px-3 py-1 text-sm"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {tier.display_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Single CTA Button */}
          <Button asChild size="lg" className="w-full">
            <Link to="/billing">
              View All Plans
            </Link>
          </Button>

          {/* Help text with WhatsApp link */}
          <p className="text-xs text-center text-muted-foreground">
            Need help choosing a plan?{' '}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Contact us on WhatsApp
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Higher-order component to wrap entire pages with feature gating
 */
export const withFeatureGate = (
  WrappedComponent: React.ComponentType<any>,
  featureKey: string
) => {
  return function FeatureGatedComponent(props: any) {
    return (
      <FeatureGate featureKey={featureKey}>
        <WrappedComponent {...props} />
      </FeatureGate>
    );
  };
};

export default FeatureGate;
