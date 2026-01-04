import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  FileText,
  Shield,
  Lightbulb,
  Save,
  Plus,
  X,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChatbotSettingsModernProps {
  chatbot: any;
  onUpdate: () => void;
}

export function ChatbotSettingsModern({ chatbot, onUpdate }: ChatbotSettingsModernProps) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    industry: '',
    business_context: '',
    compliance_rules: [] as string[],
    response_guidelines: [] as string[],
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form with chatbot data
  useEffect(() => {
    if (chatbot) {
      setFormData({
        name: chatbot.name || '',
        company_name: chatbot.company_name || '',
        industry: chatbot.industry || '',
        business_context: chatbot.business_context || '',
        compliance_rules: Array.isArray(chatbot.compliance_rules) ? chatbot.compliance_rules : [],
        response_guidelines: Array.isArray(chatbot.response_guidelines) ? chatbot.response_guidelines : [],
      });
      setHasChanges(false);
    }
  }, [chatbot]);

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('avatars')
        .update({
          name: formData.name,
          company_name: formData.company_name,
          industry: formData.industry,
          business_context: formData.business_context,
          compliance_rules: formData.compliance_rules.filter(r => r.trim() !== ''),
          response_guidelines: formData.response_guidelines.filter(g => g.trim() !== ''),
        })
        .eq('id', chatbot.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Your changes have been saved successfully",
      });

      setHasChanges(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating chatbot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData({ ...formData, ...updates });
    setHasChanges(true);
  };

  const addComplianceRule = () => {
    updateFormData({
      compliance_rules: [...formData.compliance_rules, '']
    });
  };

  const removeComplianceRule = (index: number) => {
    updateFormData({
      compliance_rules: formData.compliance_rules.filter((_, i) => i !== index)
    });
  };

  const updateComplianceRule = (index: number, value: string) => {
    const updated = [...formData.compliance_rules];
    updated[index] = value;
    updateFormData({ compliance_rules: updated });
  };

  const addResponseGuideline = () => {
    updateFormData({
      response_guidelines: [...formData.response_guidelines, '']
    });
  };

  const removeResponseGuideline = (index: number) => {
    updateFormData({
      response_guidelines: formData.response_guidelines.filter((_, i) => i !== index)
    });
  };

  const updateResponseGuideline = (index: number, value: string) => {
    const updated = [...formData.response_guidelines];
    updated[index] = value;
    updateFormData({ response_guidelines: updated });
  };

  const industryTemplates = [
    { value: 'ecommerce', label: 'E-commerce & Retail' },
    { value: 'customer_service', label: 'Customer Service' },
    { value: 'healthcare', label: 'Healthcare & Wellness' },
    { value: 'finance', label: 'Finance & Banking' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'education', label: 'Education & Training' },
    { value: 'hospitality', label: 'Hospitality & Tourism' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-8">
      {/* Save Button - Floating at top */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-blue-600" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="chatbot-name">Chatbot Name</Label>
              <Input
                id="chatbot-name"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="e.g., Customer Support Bot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={formData.company_name}
                onChange={(e) => updateFormData({ company_name: e.target.value })}
                placeholder="e.g., ABC Electronics"
              />
            </div>
          </div>
          <div className="space-y-2 mt-6">
            <Label htmlFor="industry">Industry Template</Label>
            <Select
              value={formData.industry}
              onValueChange={(value) => updateFormData({ industry: value })}
            >
              <SelectTrigger id="industry">
                <SelectValue placeholder="Select an industry" />
              </SelectTrigger>
              <SelectContent>
                {industryTemplates.map((template) => (
                  <SelectItem key={template.value} value={template.value}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Business Context */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-blue-600" />
            Business Context
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Describe your business, products, and key information that the chatbot should know
          </p>
        </div>
        <Textarea
          value={formData.business_context}
          onChange={(e) => updateFormData({ business_context: e.target.value })}
          placeholder="Example: We are ABC Electronics, a leading electronics retailer in Malaysia. We sell smartphones, laptops, home appliances, and accessories..."
          rows={6}
          className="resize-none"
        />
      </div>

      {/* Compliance Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Shield className="h-5 w-5 text-blue-600" />
              Compliance Rules
            </h3>
            <p className="text-sm text-muted-foreground">
              Rules and restrictions the chatbot must follow
            </p>
          </div>
          <Button onClick={addComplianceRule} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
        <div className="space-y-3">
          {formData.compliance_rules.length > 0 ? (
            formData.compliance_rules.map((rule, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={rule}
                  onChange={(e) => updateComplianceRule(index, e.target.value)}
                  placeholder="e.g., Never make promises about delivery dates"
                />
                <Button
                  onClick={() => removeComplianceRule(index)}
                  variant="ghost"
                  size="icon"
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
              No compliance rules yet. Click "Add Rule" to create one.
            </p>
          )}
        </div>
      </div>

      {/* Response Guidelines */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Lightbulb className="h-5 w-5 text-blue-600" />
              Response Guidelines
            </h3>
            <p className="text-sm text-muted-foreground">
              Best practices for how the chatbot should communicate
            </p>
          </div>
          <Button onClick={addResponseGuideline} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Guideline
          </Button>
        </div>
        <div className="space-y-3">
          {formData.response_guidelines.length > 0 ? (
            formData.response_guidelines.map((guideline, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={guideline}
                  onChange={(e) => updateResponseGuideline(index, e.target.value)}
                  placeholder="e.g., Always be polite and professional"
                />
                <Button
                  onClick={() => removeResponseGuideline(index)}
                  variant="ghost"
                  size="icon"
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
              No response guidelines yet. Click "Add Guideline" to create one.
            </p>
          )}
        </div>
      </div>

      {/* Save Button - Bottom */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
