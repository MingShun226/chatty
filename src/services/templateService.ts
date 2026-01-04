import { supabase } from '@/integrations/supabase/client';

export interface ChatbotTemplate {
  id: string;
  industry: string;
  template_name: string;
  template_name_en: string;
  template_name_ms: string | null;
  template_name_zh: string | null;
  description: string | null;
  description_en: string | null;
  description_ms: string | null;
  description_zh: string | null;
  business_context_template_en: string | null;
  business_context_template_ms: string | null;
  business_context_template_zh: string | null;
  compliance_rules_en: string[];
  compliance_rules_ms: string[];
  compliance_rules_zh: string[];
  response_guidelines_en: string[];
  response_guidelines_ms: string[];
  response_guidelines_zh: string[];
  tone_settings: {
    formality?: string;
    politeness?: string;
    empathy?: string;
    enthusiasm?: string;
    language_mixing?: boolean;
  };
  default_language: string;
  supported_languages: string[];
  required_documents: Array<{
    type: string;
    name_en?: string;
    name_ms?: string;
    name_zh?: string;
  }>;
  sample_greetings_en: string[];
  sample_greetings_ms: string[];
  sample_greetings_zh: string[];
  product_features: Record<string, any>;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export class TemplateService {
  /**
   * Fetch all active chatbot templates
   */
  static async getTemplates(): Promise<ChatbotTemplate[]> {
    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get template by industry
   */
  static async getTemplateByIndustry(industry: string): Promise<ChatbotTemplate | null> {
    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('industry', industry)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return data;
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(id: string): Promise<ChatbotTemplate | null> {
    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return data;
  }

  /**
   * Get localized template name
   */
  static getLocalizedName(template: ChatbotTemplate, language: string): string {
    switch (language) {
      case 'ms':
        return template.template_name_ms || template.template_name_en;
      case 'zh':
        return template.template_name_zh || template.template_name_en;
      default:
        return template.template_name_en;
    }
  }

  /**
   * Get localized template description
   */
  static getLocalizedDescription(template: ChatbotTemplate, language: string): string {
    switch (language) {
      case 'ms':
        return template.description_ms || template.description_en || '';
      case 'zh':
        return template.description_zh || template.description_en || '';
      default:
        return template.description_en || '';
    }
  }

  /**
   * Get localized business context template
   */
  static getLocalizedBusinessContext(template: ChatbotTemplate, language: string): string {
    switch (language) {
      case 'ms':
        return template.business_context_template_ms || template.business_context_template_en || '';
      case 'zh':
        return template.business_context_template_zh || template.business_context_template_en || '';
      default:
        return template.business_context_template_en || '';
    }
  }

  /**
   * Get localized compliance rules
   */
  static getLocalizedComplianceRules(template: ChatbotTemplate, language: string): string[] {
    switch (language) {
      case 'ms':
        return template.compliance_rules_ms?.length > 0 ? template.compliance_rules_ms : template.compliance_rules_en;
      case 'zh':
        return template.compliance_rules_zh?.length > 0 ? template.compliance_rules_zh : template.compliance_rules_en;
      default:
        return template.compliance_rules_en || [];
    }
  }

  /**
   * Get localized response guidelines
   */
  static getLocalizedResponseGuidelines(template: ChatbotTemplate, language: string): string[] {
    switch (language) {
      case 'ms':
        return template.response_guidelines_ms?.length > 0 ? template.response_guidelines_ms : template.response_guidelines_en;
      case 'zh':
        return template.response_guidelines_zh?.length > 0 ? template.response_guidelines_zh : template.response_guidelines_en;
      default:
        return template.response_guidelines_en || [];
    }
  }

  /**
   * Get localized sample greetings
   */
  static getLocalizedGreetings(template: ChatbotTemplate, language: string): string[] {
    switch (language) {
      case 'ms':
        return template.sample_greetings_ms?.length > 0 ? template.sample_greetings_ms : template.sample_greetings_en;
      case 'zh':
        return template.sample_greetings_zh?.length > 0 ? template.sample_greetings_zh : template.sample_greetings_en;
      default:
        return template.sample_greetings_en || [];
    }
  }

  /**
   * Apply template to chatbot creation
   * Returns the values to populate in the chatbot form
   */
  static applyTemplateToForm(template: ChatbotTemplate, language: string, companyName: string) {
    const businessContext = this.getLocalizedBusinessContext(template, language)
      .replace(/\[COMPANY_NAME\]/g, companyName);

    return {
      industry: template.industry,
      business_context: businessContext,
      compliance_rules: this.getLocalizedComplianceRules(template, language),
      response_guidelines: this.getLocalizedResponseGuidelines(template, language),
      tone_settings: template.tone_settings,
      supported_languages: template.supported_languages,
      default_language: language,
      sample_greetings: this.getLocalizedGreetings(template, language),
    };
  }
}
