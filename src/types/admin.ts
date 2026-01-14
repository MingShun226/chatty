// Admin Panel Types
export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support' | 'analyst';

export interface AdminUser {
  id: string;
  user_id: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  permissions: {
    users: { read: boolean; write: boolean; delete: boolean };
    chatbots: { read: boolean; write: boolean; delete: boolean };
    tiers: { read: boolean; write: boolean; delete: boolean };
    financial: { read: boolean; write: boolean; delete: boolean };
    settings: { read: boolean; write: boolean; delete: boolean };
    moderation: { read: boolean; write: boolean; delete: boolean };
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  account_status: 'active' | 'suspended' | 'banned' | 'deleted';
  subscription_tier_id: string | null;
  created_at: string;
  last_login: string | null;
  banned_at: string | null;
  banned_reason: string | null;
}

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

export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_quarterly: number;
  price_yearly: number;
  trial_days: number;
  max_avatars: number;
  features: TierFeatures;
  priority_support: boolean;
  custom_branding: boolean;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'suspended' | 'trial';
  billing_cycle: 'monthly' | 'yearly' | 'lifetime';
  started_at: string;
  expires_at: string | null;
  is_trial: boolean;
  trial_ends_at: string | null;
}

export interface MonthlyUsage {
  id: string;
  user_id: string;
  usage_month: string;
  chatbots_created: number;
  conversations_count: number;
  products_added: number;
  promotions_created: number;
  knowledge_files_uploaded: number;
  api_calls_count: number;
  whatsapp_messages_count: number;
  is_over_chatbot_limit: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformStatistics {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  total_chatbots: number;
  total_conversations: number;
  total_products: number;
  total_promotions: number;
  total_whatsapp_sessions: number;
  total_contacts: number;
  total_api_keys: number;
  mrr: number;
  churn_rate: number;
}

export interface UserAdminDetails {
  user_email: string;
  user_name: string;
  account_status: string;
  tier_name: string;
  subscription_status: string;
  chatbots_count: number;
  products_count: number;
  contacts_count: number;
  api_keys_count: number;
  total_spent: number;
  created_at: string;
  last_login: string;
}

export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  description: string;
  changes: any;
  ip_address: string | null;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}
