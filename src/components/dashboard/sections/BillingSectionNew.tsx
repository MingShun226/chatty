import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Zap, Users, Building2, Bot, ArrowUp, ArrowDown, MessageCircle } from 'lucide-react';
import type { SubscriptionTier, TierFeatures } from '@/types/admin';

interface UserTierInfo {
  current_tier: SubscriptionTier | null;
  avatar_count: number;
  max_avatars: number;
}

// Default features for merging
const defaultFeatures: TierFeatures = {
  chatbot: {
    knowledge_base: false,
    ai_training: false,
    whatsapp_integration: false,
    contacts_management: false,
    follow_ups: false,
    prompt_engineer: false,
  },
  advertising: {
    images_studio: false,
    video_studio: false,
  },
};

// Feature display info
const featureLabels: Record<string, { label: string; beta?: boolean }> = {
  'knowledge_base': { label: 'Knowledge Base' },
  'ai_training': { label: 'AI Training' },
  'whatsapp_integration': { label: 'WhatsApp Integration' },
  'contacts_management': { label: 'Contacts Management' },
  'follow_ups': { label: 'Smart Follow-ups' },
  'prompt_engineer': { label: 'Prompt Engineer' },
  'images_studio': { label: 'Images Studio', beta: true },
  'video_studio': { label: 'Video Studio', beta: true },
};

const BillingSectionNew = () => {
  const { user } = useAuth();
  const [userTierInfo, setUserTierInfo] = useState<UserTierInfo | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly'>('monthly');

  // WhatsApp contact
  const whatsappNumber = '60165230268';
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=Hi, I need help with my subscription plan.`;

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          subscription_tier_id,
          subscription_tiers:subscription_tier_id (*)
        `)
        .eq('id', user?.id)
        .single();

      const { count } = await supabase
        .from('avatars')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('status', 'active');

      setUserTierInfo({
        current_tier: profile?.subscription_tiers || null,
        avatar_count: count || 0,
        max_avatars: profile?.subscription_tiers?.max_avatars || 1,
      });

      const { data: tiersData, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setTiers(tiersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'free':
        return <Users className="h-5 w-5" />;
      case 'starter':
        return <Zap className="h-5 w-5" />;
      case 'pro':
      case 'business':
        return <Crown className="h-5 w-5" />;
      case 'enterprise':
        return <Building2 className="h-5 w-5" />;
      default:
        return <Users className="h-5 w-5" />;
    }
  };

  const getPlanStatus = (tier: SubscriptionTier): 'current' | 'upgrade' | 'downgrade' => {
    const currentSortOrder = userTierInfo?.current_tier?.sort_order ?? 0;
    if (tier.id === userTierInfo?.current_tier?.id) return 'current';
    if (tier.sort_order > currentSortOrder) return 'upgrade';
    return 'downgrade';
  };

  const getPrice = (tier: SubscriptionTier) => {
    if (billingCycle === 'quarterly') {
      return tier.price_quarterly || tier.price_monthly * 3;
    }
    return tier.price_monthly;
  };

  const getMonthlySavings = (tier: SubscriptionTier) => {
    if (billingCycle === 'monthly' || tier.price_monthly === 0) return null;
    const monthlyTotal = tier.price_monthly * 3;
    const actualPrice = tier.price_quarterly || monthlyTotal;
    const savings = monthlyTotal - actualPrice;
    if (savings <= 0) return null;
    return Math.round((savings / monthlyTotal) * 100);
  };

  const mergeFeatures = (features: any): TierFeatures => {
    return {
      chatbot: { ...defaultFeatures.chatbot, ...(features?.chatbot || {}) },
      advertising: { ...defaultFeatures.advertising, ...(features?.advertising || {}) },
    };
  };

  const handleRequestUpgrade = async (tierId: string, tierName: string) => {
    try {
      const { data: existingRequest } = await supabase
        .from('tier_upgrade_requests')
        .select('id')
        .eq('user_id', user?.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequest) {
        alert('You already have a pending request. Please wait for admin review.');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier_id')
        .eq('id', user?.id)
        .single();

      const { error } = await supabase
        .from('tier_upgrade_requests')
        .insert({
          user_id: user?.id,
          requested_tier_id: tierId,
          current_tier_id: profile?.subscription_tier_id,
          status: 'pending',
        });

      if (error) throw error;
      alert(`Request for ${tierName} submitted successfully! An admin will review your request soon.`);
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Failed to submit request. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentTier = userTierInfo?.current_tier;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Billing & Plans</h1>
        <p className="text-muted-foreground">
          Choose the plan that best fits your needs. All plans include unlimited conversations and your own API keys.
        </p>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 rounded-lg bg-muted">
          <Button
            variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setBillingCycle('monthly')}
            className="rounded-md"
          >
            Monthly
          </Button>
          <Button
            variant={billingCycle === 'quarterly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setBillingCycle('quarterly')}
            className="rounded-md"
          >
            Quarterly
          </Button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-3 justify-center">
        {tiers.map((tier) => {
          const planStatus = getPlanStatus(tier);
          const isCurrentPlan = planStatus === 'current';
          const features = mergeFeatures(tier.features);
          const savings = getMonthlySavings(tier);

          return (
            <Card
              key={tier.id}
              className={`relative ${isCurrentPlan ? 'ring-2 ring-primary border-primary' : ''} ${tier.is_featured && !isCurrentPlan ? 'ring-2 ring-purple-400' : ''}`}
            >
              {/* Status Badge */}
              <div className="absolute top-3 right-3">
                {isCurrentPlan ? (
                  <Badge className="bg-primary text-primary-foreground">Current Plan</Badge>
                ) : planStatus === 'upgrade' ? (
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    <ArrowUp className="h-3 w-3 mr-1" />
                    Upgrade
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-500 border-gray-300">
                    <ArrowDown className="h-3 w-3 mr-1" />
                    Downgrade
                  </Badge>
                )}
              </div>

              {/* Popular Badge */}
              {tier.is_featured && !isCurrentPlan && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-purple-500 text-white">Popular</Badge>
                </div>
              )}

              <CardHeader className="pt-12 pb-4 text-center">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 bg-muted text-foreground">
                  {getTierIcon(tier.name)}
                </div>
                <CardTitle className="text-xl">{tier.display_name}</CardTitle>
                <CardDescription className="text-sm min-h-[40px]">
                  {tier.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 text-center">
                {/* Pricing */}
                <div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">RM{getPrice(tier)}</span>
                    <span className="text-muted-foreground">/{billingCycle === 'monthly' ? 'mo' : 'qtr'}</span>
                  </div>
                  {savings && (
                    <p className="text-sm text-green-600 mt-1">
                      Save {savings}% with quarterly billing
                    </p>
                  )}
                </div>

                {/* Avatar Limit */}
                <div className="flex items-center justify-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {tier.max_avatars === -1 ? 'Unlimited' : tier.max_avatars}{' '}
                    {tier.max_avatars === 1 ? 'avatar' : 'avatars'}
                  </span>
                </div>

                {/* Chatbot Features */}
                <div className="text-left space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Chatbot Features
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(features.chatbot).map(([key, enabled]) => (
                      <div key={key} className={`flex items-center gap-2 text-sm ${!enabled ? 'text-muted-foreground' : ''}`}>
                        {enabled ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        )}
                        <span>{featureLabels[key]?.label || key}</span>
                        {enabled && featureLabels[key]?.beta && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">BETA</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advertising Features */}
                <div className="text-left space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Advertising
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(features.advertising).map(([key, enabled]) => (
                      <div key={key} className={`flex items-center gap-2 text-sm ${!enabled ? 'text-muted-foreground' : ''}`}>
                        {enabled ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        )}
                        <span>{featureLabels[key]?.label || key}</span>
                        {enabled && featureLabels[key]?.beta && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">BETA</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-2">
                  {isCurrentPlan ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={tier.is_featured ? 'default' : 'outline'}
                      onClick={() => handleRequestUpgrade(tier.id, tier.display_name)}
                    >
                      {planStatus === 'upgrade' ? 'Request Upgrade' : 'Request Change'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="text-center space-y-3 pt-4">
        <p className="text-sm text-muted-foreground">
          All plans require you to provide your own API keys (OpenAI, etc.). Plan changes will be reviewed by an administrator.
        </p>
        <div className="flex items-center justify-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm text-muted-foreground">Need help choosing?</span>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline font-medium"
          >
            Contact us on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

export default BillingSectionNew;
