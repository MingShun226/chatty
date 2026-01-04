import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
import { TemplateService, ChatbotTemplate } from '@/services/templateService';
import { Loader2, Bot, Building2, FileText } from 'lucide-react';

interface ChatbotCreationWizardModernProps {
  onComplete?: (chatbotId: string) => void;
}

export function ChatbotCreationWizardModern({ onComplete }: ChatbotCreationWizardModernProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<ChatbotTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [chatbotName, setChatbotName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await TemplateService.getTemplates();
      setTemplates(data);

      // Auto-select first template
      if (data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive"
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === selectedTemplateId);
  };

  const handleCreate = async () => {
    // Validation
    if (!chatbotName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a chatbot name",
        variant: "destructive"
      });
      return;
    }

    if (!companyName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter your company name",
        variant: "destructive"
      });
      return;
    }

    if (!businessDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a business description",
        variant: "destructive"
      });
      return;
    }

    const template = getSelectedTemplate();
    if (!template) {
      toast({
        title: "Error",
        description: "Please select a template",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Prepare business context from template
      const businessContext = template.business_context_template_en || businessDescription;
      const businessContextWithCompany = typeof businessContext === 'string'
        ? businessContext.replace(/\[COMPANY_NAME\]/g, companyName)
        : businessDescription;

      // Create chatbot
      const { data: newChatbot, error: createError } = await supabase
        .from('avatars')
        .insert({
          user_id: user.id,
          name: chatbotName,
          chatbot_type: 'business',
          industry: template.industry,
          company_name: companyName,
          business_context: businessContextWithCompany,
          compliance_rules: template.compliance_rules_en || [],
          response_guidelines: template.response_guidelines_en || [],
          supported_languages: ['en'],
          default_language: 'en',
          tone_settings: template.tone_settings || {},
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      toast({
        title: "Success",
        description: "Your chatbot has been created successfully",
      });

      // Call onComplete callback if provided, otherwise navigate
      if (onComplete) {
        onComplete(newChatbot.id);
      } else {
        navigate(`/chatbot-studio?id=${newChatbot.id}`);
      }
    } catch (error: any) {
      console.error('Error creating chatbot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create chatbot",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  if (loadingTemplates) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-muted-foreground">Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center pb-8 border-b">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Bot className="h-10 w-10 text-blue-600" />
          <h1 className="text-4xl font-bold">Create Your Chatbot</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Set up your business chatbot in minutes
        </p>
      </div>

      {/* Form */}
      <div className="space-y-8">
        {/* Template Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Industry Template</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="template">Select Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Choose an industry template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name_en} - {template.industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getSelectedTemplate() && (
              <p className="text-sm text-muted-foreground mt-2">
                {getSelectedTemplate()?.description_en}
              </p>
            )}
          </div>
        </div>

        {/* Basic Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="chatbot-name">
                Chatbot Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="chatbot-name"
                value={chatbotName}
                onChange={(e) => setChatbotName(e.target.value)}
                placeholder="e.g., Customer Support Bot"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., ABC Electronics"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-description">
              Business Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="business-description"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="Tell us about your business, products, and services..."
              rows={6}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              This helps the chatbot understand your business and provide accurate responses
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-8 border-t">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            size="lg"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating}
            size="lg"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Chatbot'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
