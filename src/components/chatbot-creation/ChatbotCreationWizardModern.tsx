import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplateService, ChatbotTemplate } from '@/services/templateService';
import { createPlatformApiKey } from '@/services/platformApiKeyService';
import { Loader2, Bot, Building2, FileText, Package, Calendar, Headphones, Settings2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Chatbot type definitions
const CHATBOT_TYPES = [
  {
    id: 'ecommerce',
    icon: Package,
    title: 'E-commerce',
    description: 'Product inquiries, sales assistance, order support',
    color: 'from-green-400 to-green-600',
  },
  {
    id: 'appointment',
    icon: Calendar,
    title: 'Appointment Booking',
    description: 'Schedule appointments, manage reservations',
    color: 'from-purple-400 to-purple-600',
  },
  {
    id: 'support',
    icon: Headphones,
    title: 'Customer Support',
    description: 'FAQ handling, document Q&A, general support',
    color: 'from-blue-400 to-blue-600',
  },
  {
    id: 'custom',
    icon: Settings2,
    title: 'Custom',
    description: 'Custom workflow - specify your requirements',
    color: 'from-orange-400 to-orange-600',
  },
];

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
  const [chatbotType, setChatbotType] = useState<string>('ecommerce');
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

      // Create chatbot with draft status - admin will activate after setup
      const { data: newChatbot, error: createError } = await supabase
        .from('avatars')
        .insert({
          user_id: user.id,
          name: chatbotName,
          chatbot_type: chatbotType, // Use selected chatbot type
          activation_status: 'draft', // Start as draft until user requests setup
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

      // Auto-generate platform API key for this chatbot
      const apiKeyResult = await createPlatformApiKey(
        user.id,
        newChatbot.id,
        chatbotName
      );

      if (apiKeyResult.success) {
        console.log('Platform API key auto-generated for chatbot:', newChatbot.id);
      } else {
        console.warn('Failed to auto-generate platform API key:', apiKeyResult.error);
        // Non-critical error, continue with chatbot creation
      }

      toast({
        title: "Success",
        description: "Your chatbot has been created successfully",
      });

      // Call onComplete callback if provided, otherwise navigate
      if (onComplete) {
        onComplete(newChatbot.id);
      } else {
        navigate(`/chatbot/overview?id=${newChatbot.id}`);
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
        {/* Chatbot Type Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Chatbot Type</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Select the type of chatbot based on your business needs. This helps our team set up the right workflow for you.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CHATBOT_TYPES.map((type) => {
              const isSelected = chatbotType === type.id;
              return (
                <Card
                  key={type.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                    isSelected
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/50"
                  )}
                  onClick={() => setChatbotType(type.id)}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        `bg-gradient-to-br ${type.color}`
                      )}>
                        <type.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{type.title}</h3>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

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
