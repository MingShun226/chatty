import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Building2,
  FileText,
  Shield,
  Lightbulb,
  Globe,
  Save,
  X,
  Edit,
  Plus,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChatbotSettingsProps {
  chatbot: any;
  onUpdate: () => void;
}

export function ChatbotSettings({ chatbot, onUpdate }: ChatbotSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
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
    supported_languages: [] as string[],
    default_language: 'en',
  });

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
        supported_languages: Array.isArray(chatbot.supported_languages) ? chatbot.supported_languages : ['en'],
        default_language: chatbot.default_language || 'en',
      });
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
          compliance_rules: formData.compliance_rules,
          response_guidelines: formData.response_guidelines,
          supported_languages: formData.supported_languages,
          default_language: formData.default_language,
        })
        .eq('id', chatbot.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Chatbot settings updated successfully",
      });

      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating chatbot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original chatbot data
    setFormData({
      name: chatbot.name || '',
      company_name: chatbot.company_name || '',
      industry: chatbot.industry || '',
      business_context: chatbot.business_context || '',
      compliance_rules: Array.isArray(chatbot.compliance_rules) ? chatbot.compliance_rules : [],
      response_guidelines: Array.isArray(chatbot.response_guidelines) ? chatbot.response_guidelines : [],
      supported_languages: Array.isArray(chatbot.supported_languages) ? chatbot.supported_languages : ['en'],
      default_language: chatbot.default_language || 'en',
    });
    setIsEditing(false);
  };

  const addComplianceRule = () => {
    setFormData({
      ...formData,
      compliance_rules: [...formData.compliance_rules, '']
    });
  };

  const removeComplianceRule = (index: number) => {
    setFormData({
      ...formData,
      compliance_rules: formData.compliance_rules.filter((_, i) => i !== index)
    });
  };

  const updateComplianceRule = (index: number, value: string) => {
    const updated = [...formData.compliance_rules];
    updated[index] = value;
    setFormData({ ...formData, compliance_rules: updated });
  };

  const addResponseGuideline = () => {
    setFormData({
      ...formData,
      response_guidelines: [...formData.response_guidelines, '']
    });
  };

  const removeResponseGuideline = (index: number) => {
    setFormData({
      ...formData,
      response_guidelines: formData.response_guidelines.filter((_, i) => i !== index)
    });
  };

  const updateResponseGuideline = (index: number, value: string) => {
    const updated = [...formData.response_guidelines];
    updated[index] = value;
    setFormData({ ...formData, response_guidelines: updated });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Chatbot Settings
          </h2>
          <p className="text-muted-foreground">
            Configure your chatbot's business context and behavior
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleCancel} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Settings
            </Button>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Chatbot Name</label>
              {isEditing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Customer Support Bot"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{chatbot.name}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Company Name</label>
              {isEditing ? (
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="e.g., ABC Electronics"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{chatbot.company_name || 'Not set'}</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Industry</label>
            {isEditing ? (
              <Input
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="e.g., ecommerce, customer_service"
                disabled
              />
            ) : (
              <Badge variant="outline">{chatbot.industry || 'Not set'}</Badge>
            )}
            {isEditing && (
              <p className="text-xs text-muted-foreground mt-1">
                Industry cannot be changed after creation
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Business Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Business Context
          </CardTitle>
          <CardDescription>
            This is the core knowledge about your business that the chatbot will use to respond to customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={formData.business_context}
              onChange={(e) => setFormData({ ...formData, business_context: e.target.value })}
              placeholder="Describe your business, products/services, key information..."
              rows={8}
              className="resize-none"
            />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{chatbot.business_context || 'No business context set'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Rules
          </CardTitle>
          <CardDescription>
            Rules and restrictions the chatbot must follow when responding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <>
              {formData.compliance_rules.map((rule, index) => (
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
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button onClick={addComplianceRule} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </>
          ) : (
            <ul className="space-y-2">
              {chatbot.compliance_rules && chatbot.compliance_rules.length > 0 ? (
                chatbot.compliance_rules.map((rule: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{rule}</span>
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No compliance rules set</p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Response Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Response Guidelines
          </CardTitle>
          <CardDescription>
            Best practices for how the chatbot should respond to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <>
              {formData.response_guidelines.map((guideline, index) => (
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
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button onClick={addResponseGuideline} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Guideline
              </Button>
            </>
          ) : (
            <ul className="space-y-2">
              {chatbot.response_guidelines && chatbot.response_guidelines.length > 0 ? (
                chatbot.response_guidelines.map((guideline: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <span>{guideline}</span>
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No response guidelines set</p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Supported Languages</label>
            <div className="flex gap-2">
              {chatbot.supported_languages && chatbot.supported_languages.length > 0 ? (
                chatbot.supported_languages.map((lang: string) => (
                  <Badge key={lang} variant="secondary">
                    {lang === 'en' && 'English'}
                    {lang === 'ms' && 'Bahasa Malaysia'}
                    {lang === 'zh' && '中文 (Chinese)'}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary">English</Badge>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Default Language</label>
            <Badge variant="outline">
              {chatbot.default_language === 'en' && 'English'}
              {chatbot.default_language === 'ms' && 'Bahasa Malaysia'}
              {chatbot.default_language === 'zh' && '中文 (Chinese)'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
