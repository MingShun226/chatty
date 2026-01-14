import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TierFeatures {
  chatbot: {
    knowledge_base: boolean;
    ai_training: boolean;
    whatsapp_integration: boolean;
    contacts_management: boolean;
    follow_ups: boolean;
    prompt_engineer: boolean;
  };
  advertising: {
    images_studio: boolean;
    video_studio: boolean;
  };
}

export interface TierInfo {
  id: string;
  name: string;
  display_name: string;
  features: TierFeatures;
}

// Default features for when no tier is assigned
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

// Feature display names and descriptions
export const featureInfo: Record<string, { name: string; description: string; category: 'chatbot' | 'advertising' }> = {
  // Chatbot features
  'chatbot.knowledge_base': { name: 'Knowledge Base', description: 'Upload documents for AI to reference', category: 'chatbot' },
  'chatbot.ai_training': { name: 'AI Training', description: 'Train custom AI models with your data', category: 'chatbot' },
  'chatbot.whatsapp_integration': { name: 'WhatsApp Integration', description: 'Connect your chatbot to WhatsApp', category: 'chatbot' },
  'chatbot.contacts_management': { name: 'Contacts Management', description: 'Manage customer contacts and conversations', category: 'chatbot' },
  'chatbot.follow_ups': { name: 'Smart Follow-ups', description: 'AI-powered automated follow-up system', category: 'chatbot' },
  'chatbot.prompt_engineer': { name: 'Prompt Engineer', description: 'Advanced prompt optimization tools', category: 'chatbot' },
  // Advertising features
  'advertising.images_studio': { name: 'Images Studio', description: 'AI-powered product image generation', category: 'advertising' },
  'advertising.video_studio': { name: 'Video Studio', description: 'Create promotional videos with AI', category: 'advertising' },
};

// Cache key for localStorage
const TIER_CACHE_KEY = 'user_tier_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedTierData {
  tierInfo: TierInfo | null;
  timestamp: number;
  userId: string;
}

// Get cached tier data
const getCachedTier = (userId: string): TierInfo | null => {
  try {
    const cached = localStorage.getItem(TIER_CACHE_KEY);
    if (!cached) return null;

    const data: CachedTierData = JSON.parse(cached);

    // Check if cache is valid (same user and not expired)
    if (data.userId === userId && Date.now() - data.timestamp < CACHE_DURATION) {
      return data.tierInfo;
    }

    return null;
  } catch {
    return null;
  }
};

// Set cached tier data
const setCachedTier = (userId: string, tierInfo: TierInfo | null) => {
  try {
    const data: CachedTierData = {
      tierInfo,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(TIER_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore localStorage errors
  }
};

// Check if we have any cached tier (for initial render)
const getAnyCachedTier = (): TierInfo | null => {
  try {
    const cached = localStorage.getItem(TIER_CACHE_KEY);
    if (!cached) return null;
    const data: CachedTierData = JSON.parse(cached);
    // Return cached data even if expired (for initial render only)
    return data.tierInfo;
  } catch {
    return null;
  }
};

export const useFeatureAccess = () => {
  const { user, loading: authLoading } = useAuth();
  const [allTiers, setAllTiers] = useState<TierInfo[]>([]);

  // Initialize with any cached data for immediate render
  const initialCachedTier = getAnyCachedTier();
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(initialCachedTier);

  // Track if we've completed initial load
  const [hasInitialized, setHasInitialized] = useState(!!initialCachedTier);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (authLoading) {
      // Still loading auth, don't do anything yet
      return;
    }

    if (user) {
      // Check for valid cached data first
      const cachedTier = getCachedTier(user.id);
      if (cachedTier) {
        setTierInfo(cachedTier);
        setHasInitialized(true);
      }

      // Fetch fresh data (only once)
      if (!hasFetched.current) {
        hasFetched.current = true;
        fetchUserTier();
        fetchAllTiers();
      }
    } else {
      // No user - but DON'T clear tierInfo if we have cached data
      // This prevents the flash when auth is still initializing
      // Only clear if we don't have any cached data (true logout scenario)
      // Also check localStorage again in case the hook was re-instantiated
      const stillHasCachedTier = getAnyCachedTier();
      if (!initialCachedTier && !stillHasCachedTier) {
        setTierInfo(null);
      }
      setHasInitialized(true);
      hasFetched.current = false;
    }
  }, [user, authLoading]);

  const fetchUserTier = async () => {
    try {
      // Get user's subscription tier from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_tier_id')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.subscription_tier_id) {
        // Get tier details
        const { data: tier, error: tierError } = await supabase
          .from('subscription_tiers')
          .select('id, name, display_name, features')
          .eq('id', profile.subscription_tier_id)
          .single();

        if (tierError) throw tierError;

        if (tier) {
          // Deep merge features with defaults
          const mergedFeatures: TierFeatures = {
            chatbot: {
              ...defaultFeatures.chatbot,
              ...(tier.features?.chatbot || {}),
            },
            advertising: {
              ...defaultFeatures.advertising,
              ...(tier.features?.advertising || {}),
            },
          };

          const newTierInfo: TierInfo = {
            id: tier.id,
            name: tier.name,
            display_name: tier.display_name,
            features: mergedFeatures,
          };

          setTierInfo(newTierInfo);
          setCachedTier(user!.id, newTierInfo);
        }
      } else {
        // No tier assigned - use default features
        setTierInfo(null);
        setCachedTier(user!.id, null);
      }
    } catch (error) {
      console.error('Error fetching user tier:', error);
      setTierInfo(null);
    } finally {
      setHasInitialized(true);
    }
  };

  const fetchAllTiers = async () => {
    try {
      const { data: tiers, error } = await supabase
        .from('subscription_tiers')
        .select('id, name, display_name, features')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const parsedTiers = (tiers || []).map((tier: any) => ({
        id: tier.id,
        name: tier.name,
        display_name: tier.display_name,
        features: {
          chatbot: {
            ...defaultFeatures.chatbot,
            ...(tier.features?.chatbot || {}),
          },
          advertising: {
            ...defaultFeatures.advertising,
            ...(tier.features?.advertising || {}),
          },
        },
      }));

      setAllTiers(parsedTiers);
    } catch (error) {
      console.error('Error fetching all tiers:', error);
    }
  };

  /**
   * Check if user has access to a specific feature
   * @param featureKey - e.g., 'chatbot.knowledge_base' or 'advertising.images_studio'
   */
  const hasFeatureAccess = (featureKey: string): boolean => {
    if (!tierInfo) return false;

    const [category, feature] = featureKey.split('.') as ['chatbot' | 'advertising', string];

    if (category === 'chatbot') {
      return tierInfo.features.chatbot[feature as keyof typeof tierInfo.features.chatbot] ?? false;
    } else if (category === 'advertising') {
      return tierInfo.features.advertising[feature as keyof typeof tierInfo.features.advertising] ?? false;
    }

    return false;
  };

  /**
   * Get list of tiers that have access to a specific feature
   * @param featureKey - e.g., 'chatbot.ai_training' or 'advertising.images_studio'
   */
  const getTiersWithFeature = (featureKey: string): TierInfo[] => {
    const [category, feature] = featureKey.split('.') as ['chatbot' | 'advertising', string];

    return allTiers.filter(tier => {
      if (category === 'chatbot') {
        return tier.features.chatbot[feature as keyof typeof tier.features.chatbot] ?? false;
      } else if (category === 'advertising') {
        return tier.features.advertising[feature as keyof typeof tier.features.advertising] ?? false;
      }
      return false;
    });
  };

  // Loading = auth is loading OR we haven't initialized yet
  const loading = authLoading || !hasInitialized;

  return {
    tierInfo,
    loading,
    allTiers,
    hasFeatureAccess,
    getTiersWithFeature,
    features: tierInfo?.features || defaultFeatures,
  };
};
