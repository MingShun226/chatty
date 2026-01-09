import { supabase } from '@/integrations/supabase/client';

export interface Promotion {
  id?: string;
  chatbot_id: string;
  user_id?: string;
  title: string;
  title_en?: string | null;
  title_ms?: string | null;
  title_zh?: string | null;
  description: string | null;
  description_en?: string | null;
  description_ms?: string | null;
  description_zh?: string | null;
  promo_code: string | null;
  discount_type: 'percentage' | 'fixed_amount' | null;
  discount_value: number | null;
  banner_image_url: string | null;
  thumbnail_url: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  terms_and_conditions: string | null;
  terms_en?: string | null;
  terms_ms?: string | null;
  terms_zh?: string | null;
  max_uses: number | null;
  current_uses: number;
  created_at?: string;
  updated_at?: string;
}

export class PromotionService {
  /**
   * Get all promotions for a chatbot
   */
  static async getPromotions(chatbotId: string): Promise<Promotion[]> {
    const { data, error } = await supabase
      .from('chatbot_promotions')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promotions:', error);
      throw new Error(`Failed to fetch promotions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get active promotions for a chatbot (for chatbot responses)
   */
  static async getActivePromotions(chatbotId: string): Promise<Promotion[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('chatbot_promotions')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active promotions:', error);
      throw new Error(`Failed to fetch active promotions: ${error.message}`);
    }

    // Filter by date range more precisely
    return (data || []).filter(promo => {
      const now = new Date();
      const startDate = promo.start_date ? new Date(promo.start_date) : null;
      const endDate = promo.end_date ? new Date(promo.end_date) : null;

      const afterStart = !startDate || now >= startDate;
      const beforeEnd = !endDate || now <= endDate;

      return afterStart && beforeEnd;
    });
  }

  /**
   * Get a single promotion by ID
   */
  static async getPromotion(promotionId: string): Promise<Promotion | null> {
    const { data, error } = await supabase
      .from('chatbot_promotions')
      .select('*')
      .eq('id', promotionId)
      .single();

    if (error) {
      console.error('Error fetching promotion:', error);
      return null;
    }

    return data;
  }

  /**
   * Create a new promotion
   */
  static async createPromotion(
    promotion: Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'current_uses'>,
    userId: string
  ): Promise<Promotion> {
    const { data, error } = await supabase
      .from('chatbot_promotions')
      .insert({
        chatbot_id: promotion.chatbot_id,
        user_id: userId,
        title: promotion.title,
        title_en: promotion.title_en,
        title_ms: promotion.title_ms,
        title_zh: promotion.title_zh,
        description: promotion.description,
        description_en: promotion.description_en,
        description_ms: promotion.description_ms,
        description_zh: promotion.description_zh,
        promo_code: promotion.promo_code,
        discount_type: promotion.discount_type,
        discount_value: promotion.discount_value,
        banner_image_url: promotion.banner_image_url,
        thumbnail_url: promotion.thumbnail_url,
        start_date: promotion.start_date,
        end_date: promotion.end_date,
        is_active: promotion.is_active,
        terms_and_conditions: promotion.terms_and_conditions,
        terms_en: promotion.terms_en,
        terms_ms: promotion.terms_ms,
        terms_zh: promotion.terms_zh,
        max_uses: promotion.max_uses,
        current_uses: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating promotion:', error);
      throw new Error(`Failed to create promotion: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a promotion
   */
  static async updatePromotion(promotionId: string, updates: Partial<Promotion>): Promise<Promotion> {
    const { data, error } = await supabase
      .from('chatbot_promotions')
      .update(updates)
      .eq('id', promotionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating promotion:', error);
      throw new Error(`Failed to update promotion: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a promotion
   */
  static async deletePromotion(promotionId: string): Promise<void> {
    const { error } = await supabase
      .from('chatbot_promotions')
      .delete()
      .eq('id', promotionId);

    if (error) {
      console.error('Error deleting promotion:', error);
      throw new Error(`Failed to delete promotion: ${error.message}`);
    }
  }

  /**
   * Increment promotion usage count
   */
  static async incrementUsage(promotionId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_promotion_usage', {
      promotion_id: promotionId,
    });

    if (error) {
      // Fallback: manual increment if RPC doesn't exist
      const promo = await this.getPromotion(promotionId);
      if (promo) {
        await supabase
          .from('chatbot_promotions')
          .update({ current_uses: (promo.current_uses || 0) + 1 })
          .eq('id', promotionId);
      }
    }
  }

  /**
   * Check if a promo code is valid
   */
  static async validatePromoCode(chatbotId: string, promoCode: string): Promise<Promotion | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('chatbot_promotions')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .eq('promo_code', promoCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    // Check date validity
    const now = new Date();
    const startDate = data.start_date ? new Date(data.start_date) : null;
    const endDate = data.end_date ? new Date(data.end_date) : null;

    if (startDate && now < startDate) return null;
    if (endDate && now > endDate) return null;

    // Check usage limit
    if (data.max_uses && data.current_uses >= data.max_uses) {
      return null;
    }

    return data;
  }

  /**
   * Get promotion status info
   */
  static getPromotionStatus(promo: Promotion): {
    status: 'active' | 'upcoming' | 'expired' | 'inactive' | 'maxed_out';
    statusLabel: string;
    statusColor: string;
  } {
    if (!promo.is_active) {
      return { status: 'inactive', statusLabel: 'Inactive', statusColor: 'gray' };
    }

    const now = new Date();
    const startDate = promo.start_date ? new Date(promo.start_date) : null;
    const endDate = promo.end_date ? new Date(promo.end_date) : null;

    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return { status: 'maxed_out', statusLabel: 'Limit Reached', statusColor: 'orange' };
    }

    if (startDate && now < startDate) {
      return { status: 'upcoming', statusLabel: 'Upcoming', statusColor: 'blue' };
    }

    if (endDate && now > endDate) {
      return { status: 'expired', statusLabel: 'Expired', statusColor: 'red' };
    }

    return { status: 'active', statusLabel: 'Active', statusColor: 'green' };
  }

  /**
   * Format discount display
   */
  static formatDiscount(promo: Promotion): string {
    if (!promo.discount_type || !promo.discount_value) return '';

    if (promo.discount_type === 'percentage') {
      return `${promo.discount_value}% OFF`;
    } else {
      return `RM${promo.discount_value} OFF`;
    }
  }
}
