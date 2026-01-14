import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Shield,
  Lightbulb,
  Save,
  Plus,
  X,
  Loader2,
  Trash2,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';

interface ChatbotSettingsModernProps {
  chatbot: any;
  onUpdate: () => void;
}

export function ChatbotSettingsModern({ chatbot, onUpdate }: ChatbotSettingsModernProps) {
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    industry: '',
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

  const handleDeleteChatbot = async () => {
    try {
      setDeleting(true);

      // Use soft delete function
      const { error } = await supabase.rpc('soft_delete_avatar', {
        avatar_id_param: chatbot.id,
      });

      if (error) throw error;

      toast({
        title: "Chatbot Deleted",
        description: `${chatbot.name} has been moved to trash. It will be permanently deleted after 90 days.`,
      });

      setDeleteDialogOpen(false);
      // Navigate to dashboard after deletion
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting chatbot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete chatbot",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
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
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Chatbot Settings</h2>
            <p className="text-sm text-muted-foreground">Configure your chatbot behavior</p>
          </div>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving}>
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
        )}
      </div>

      {/* Basic Info Card */}
      <div className="p-4 rounded-lg border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="chatbot-name" className="text-xs">Chatbot Name</Label>
            <Input
              id="chatbot-name"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              placeholder="e.g., Customer Support Bot"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-name" className="text-xs">Company Name</Label>
            <Input
              id="company-name"
              value={formData.company_name}
              onChange={(e) => updateFormData({ company_name: e.target.value })}
              placeholder="e.g., ABC Electronics"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry" className="text-xs">Industry</Label>
            <Select
              value={formData.industry}
              onValueChange={(value) => updateFormData({ industry: value })}
            >
              <SelectTrigger id="industry">
                <SelectValue placeholder="Select industry" />
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
        {/* Chatbot ID */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div>
            <Label className="text-xs text-muted-foreground">Chatbot ID</Label>
            <p className="font-mono text-xs">{chatbot?.id || '-'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(chatbot?.id || '')}
            disabled={!chatbot?.id}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Rules and Guidelines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compliance Rules */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <h3 className="font-medium text-sm">Compliance Rules</h3>
            </div>
            <Button onClick={addComplianceRule} variant="ghost" size="sm" className="h-7 px-2">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {formData.compliance_rules.length > 0 ? (
              formData.compliance_rules.map((rule, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={rule}
                    onChange={(e) => updateComplianceRule(index, e.target.value)}
                    placeholder="e.g., Never share competitor pricing"
                    className="h-8 text-sm"
                  />
                  <Button
                    onClick={() => removeComplianceRule(index)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
                No rules yet
              </p>
            )}
          </div>
        </div>

        {/* Response Guidelines */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              <h3 className="font-medium text-sm">Response Guidelines</h3>
            </div>
            <Button onClick={addResponseGuideline} variant="ghost" size="sm" className="h-7 px-2">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {formData.response_guidelines.length > 0 ? (
              formData.response_guidelines.map((guideline, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={guideline}
                    onChange={(e) => updateResponseGuideline(index, e.target.value)}
                    placeholder="e.g., Keep responses under 3 sentences"
                    className="h-8 text-sm"
                  />
                  <Button
                    onClick={() => removeResponseGuideline(index)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
                No guidelines yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium text-sm">Delete Chatbot</p>
              <p className="text-xs text-muted-foreground">
                Moves to trash for 90 days before permanent deletion
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteChatbot}
        title="Delete Chatbot"
        description="Are you sure you want to delete"
        itemName={chatbot?.name || 'this chatbot'}
      />
    </div>
  );
}
