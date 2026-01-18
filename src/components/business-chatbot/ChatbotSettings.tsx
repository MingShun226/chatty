import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Trash2,
  DollarSign,
  Bell
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getSettings, upsertSettings, FollowupSettings } from '@/services/followupService';

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

  // Price visibility state
  const [priceVisible, setPriceVisible] = useState(true);
  const [savingPrice, setSavingPrice] = useState(false);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<FollowupSettings | null>(null);
  const [notificationPhone, setNotificationPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingNotification, setSavingNotification] = useState(false);

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
      // Initialize price visibility
      setPriceVisible(chatbot.price_visible ?? true);
    }
  }, [chatbot]);

  // Fetch notification settings
  const fetchNotificationSettings = useCallback(async () => {
    if (!chatbot?.id) return;

    const settings = await getSettings(chatbot.id);
    if (settings) {
      setNotificationSettings(settings);
      setNotificationPhone(settings.notification_phone_number || '');
    }
  }, [chatbot?.id]);

  useEffect(() => {
    fetchNotificationSettings();
  }, [fetchNotificationSettings]);

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

  // Handle price visibility toggle
  const handlePriceVisibilityChange = async (checked: boolean) => {
    try {
      setSavingPrice(true);
      const { error } = await supabase
        .from('avatars')
        .update({ price_visible: checked })
        .eq('id', chatbot.id);

      if (error) throw error;

      setPriceVisible(checked);
      toast({
        title: "Success",
        description: checked ? "Product prices are now visible to customers" : "Product prices are now hidden from customers",
      });
      onUpdate();
    } catch (error: any) {
      console.error('Error updating price visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update price visibility",
        variant: "destructive"
      });
    } finally {
      setSavingPrice(false);
    }
  };

  // Validate Malaysia phone number
  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return true; // Empty is OK
    // Malaysia phone format: 60 followed by 9-10 digits
    const malaysiaPhoneRegex = /^60\d{9,10}$/;
    return malaysiaPhoneRegex.test(phone);
  };

  // Handle phone number blur
  const handlePhoneBlur = async () => {
    if (notificationPhone && !validatePhoneNumber(notificationPhone)) {
      setPhoneError('Enter valid Malaysia phone (e.g. 60123456789)');
      return;
    }
    setPhoneError('');

    // Auto-save when valid
    if (notificationSettings && validatePhoneNumber(notificationPhone)) {
      await handleNotificationSettingChange('notification_phone_number', notificationPhone || null);
    }
  };

  // Handle notification settings change
  const handleNotificationSettingChange = async (field: keyof FollowupSettings, value: any) => {
    if (!chatbot?.id || !chatbot?.user_id) return;

    try {
      setSavingNotification(true);
      const updatedSettings = await upsertSettings(chatbot.id, chatbot.user_id, {
        [field]: value
      });

      if (updatedSettings) {
        setNotificationSettings(updatedSettings);
        if (field === 'notification_phone_number') {
          setNotificationPhone(value || '');
        }
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive"
      });
    } finally {
      setSavingNotification(false);
    }
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

      {/* Price Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Product Pricing
          </CardTitle>
          <CardDescription>
            Control whether customers can see product prices in chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Show prices to customers</Label>
              <p className="text-sm text-muted-foreground">
                {priceVisible
                  ? "Customers can see product prices in chat responses"
                  : "Prices are hidden - customers will be told to contact you for pricing"}
              </p>
            </div>
            <Switch
              checked={priceVisible}
              onCheckedChange={handlePriceVisibilityChange}
              disabled={savingPrice}
            />
          </div>
        </CardContent>
      </Card>

      {/* Admin Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Admin Notifications
          </CardTitle>
          <CardDescription>
            Get WhatsApp alerts when customers need attention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable Notifications Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable WhatsApp Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive WhatsApp alerts when customers need attention
              </p>
            </div>
            <Switch
              checked={notificationSettings?.notification_enabled ?? false}
              onCheckedChange={(checked) => handleNotificationSettingChange('notification_enabled', checked)}
              disabled={savingNotification}
            />
          </div>

          {/* Phone Number Input - Only show if notifications enabled */}
          {notificationSettings?.notification_enabled && (
            <>
              <div className="space-y-2">
                <Label>Admin Phone Number</Label>
                <Input
                  placeholder="e.g. 60123456789"
                  value={notificationPhone}
                  onChange={(e) => {
                    setNotificationPhone(e.target.value);
                    setPhoneError('');
                  }}
                  onBlur={handlePhoneBlur}
                  className={phoneError ? 'border-red-500' : ''}
                />
                {phoneError ? (
                  <p className="text-xs text-red-500">{phoneError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enter Malaysia phone number starting with 60 (e.g. 60123456789)
                  </p>
                )}
              </div>

              {/* Notification Triggers */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Notify me when:</Label>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">Customer wants to buy</span>
                    <p className="text-xs text-muted-foreground">
                      "I want to buy", "how to order", "ready to purchase"
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings?.notify_on_purchase_intent ?? true}
                    onCheckedChange={(checked) => handleNotificationSettingChange('notify_on_purchase_intent', checked)}
                    disabled={savingNotification}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">Customer wants human agent</span>
                    <p className="text-xs text-muted-foreground">
                      "speak to human", "talk to agent", "real person"
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings?.notify_on_wants_human ?? true}
                    onCheckedChange={(checked) => handleNotificationSettingChange('notify_on_wants_human', checked)}
                    disabled={savingNotification}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">Customer asks about price</span>
                    <p className="text-xs text-muted-foreground">
                      When prices are hidden and customer inquires about pricing
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings?.notify_on_price_inquiry ?? true}
                    onCheckedChange={(checked) => handleNotificationSettingChange('notify_on_price_inquiry', checked)}
                    disabled={savingNotification}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">AI is unsure how to respond</span>
                    <p className="text-xs text-muted-foreground">
                      When chatbot encounters questions it cannot answer confidently
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings?.notify_on_ai_unsure ?? true}
                    onCheckedChange={(checked) => handleNotificationSettingChange('notify_on_ai_unsure', checked)}
                    disabled={savingNotification}
                  />
                </div>
              </div>

              {/* Auto-pause AI on Notification */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-sm font-medium">When notification is triggered:</Label>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">Auto-pause AI for this contact</span>
                    <p className="text-xs text-muted-foreground">
                      {notificationSettings?.auto_pause_on_notification
                        ? "AI will stop responding, admin takes over until manually resumed"
                        : "AI continues responding while you're notified"}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings?.auto_pause_on_notification ?? false}
                    onCheckedChange={(checked) => handleNotificationSettingChange('auto_pause_on_notification', checked)}
                    disabled={savingNotification}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
