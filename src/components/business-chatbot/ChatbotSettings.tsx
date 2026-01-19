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
import {
  getSettings,
  upsertSettings,
  FollowupSettings,
  getNotificationRules,
  initializeNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  toggleNotificationRule,
  NotificationRule
} from '@/services/followupService';

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

  // Notification rules state (dynamic rules system)
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    display_name: '',
    keywords: '',
    emoji: '🔔',
    description: ''
  });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<{ display_name: string; keywords: string; emoji: string; description: string } | null>(null);

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

  // Fetch notification rules
  const fetchNotificationRules = useCallback(async () => {
    if (!chatbot?.id || !chatbot?.user_id) return;

    setLoadingRules(true);
    try {
      // First, initialize default system rules if they don't exist
      await initializeNotificationRules(chatbot.id, chatbot.user_id);

      // Then fetch all rules
      const rules = await getNotificationRules(chatbot.id);
      setNotificationRules(rules);
    } catch (error) {
      console.error('Error fetching notification rules:', error);
    } finally {
      setLoadingRules(false);
    }
  }, [chatbot?.id, chatbot?.user_id]);

  useEffect(() => {
    fetchNotificationSettings();
    fetchNotificationRules();
  }, [fetchNotificationSettings, fetchNotificationRules]);

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

  // Handle toggling a notification rule
  const handleToggleRule = async (ruleId: string, isEnabled: boolean) => {
    try {
      await toggleNotificationRule(ruleId, isEnabled);
      setNotificationRules(prev =>
        prev.map(rule =>
          rule.id === ruleId ? { ...rule, is_enabled: isEnabled } : rule
        )
      );
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: "Error",
        description: "Failed to toggle notification rule",
        variant: "destructive"
      });
    }
  };

  // Handle adding a new custom rule
  const handleAddRule = async () => {
    if (!chatbot?.id || !chatbot?.user_id || !newRule.display_name || !newRule.keywords) {
      toast({
        title: "Error",
        description: "Please provide a name and at least one keyword",
        variant: "destructive"
      });
      return;
    }

    try {
      const keywords = newRule.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      if (keywords.length === 0) {
        toast({
          title: "Error",
          description: "Please provide at least one keyword",
          variant: "destructive"
        });
        return;
      }

      const rule = await createNotificationRule(chatbot.id, chatbot.user_id, {
        rule_key: newRule.display_name.toLowerCase().replace(/\s+/g, '_'),
        display_name: newRule.display_name,
        description: newRule.description || `Triggered by: ${keywords.join(', ')}`,
        keywords,
        emoji: newRule.emoji || '🔔'
      });

      if (rule) {
        setNotificationRules(prev => [...prev, rule]);
        setNewRule({ display_name: '', keywords: '', emoji: '🔔', description: '' });
        setShowAddRule(false);
        toast({
          title: "Success",
          description: "Custom notification rule created"
        });
      }
    } catch (error: any) {
      console.error('Error creating rule:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create notification rule",
        variant: "destructive"
      });
    }
  };

  // Handle editing a rule
  const handleStartEdit = (rule: NotificationRule) => {
    setEditingRuleId(rule.id);
    setEditingRule({
      display_name: rule.display_name,
      keywords: rule.keywords.join(', '),
      emoji: rule.emoji,
      description: rule.description || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRuleId || !editingRule) return;

    try {
      const keywords = editingRule.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      await updateNotificationRule(editingRuleId, {
        display_name: editingRule.display_name,
        keywords,
        emoji: editingRule.emoji,
        description: editingRule.description || `Triggered by: ${keywords.join(', ')}`
      });

      setNotificationRules(prev =>
        prev.map(rule =>
          rule.id === editingRuleId
            ? { ...rule, display_name: editingRule.display_name, keywords, emoji: editingRule.emoji, description: editingRule.description }
            : rule
        )
      );
      setEditingRuleId(null);
      setEditingRule(null);
      toast({
        title: "Success",
        description: "Notification rule updated"
      });
    } catch (error) {
      console.error('Error updating rule:', error);
      toast({
        title: "Error",
        description: "Failed to update notification rule",
        variant: "destructive"
      });
    }
  };

  // Handle deleting a custom rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this notification rule?')) return;

    try {
      await deleteNotificationRule(ruleId);
      setNotificationRules(prev => prev.filter(rule => rule.id !== ruleId));
      toast({
        title: "Success",
        description: "Notification rule deleted"
      });
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification rule",
        variant: "destructive"
      });
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

              {/* Notification Rules - Dynamic */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Notify me when:</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddRule(true)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Custom Rule
                  </Button>
                </div>

                {loadingRules ? (
                  <p className="text-sm text-muted-foreground">Loading rules...</p>
                ) : (
                  <div className="space-y-2">
                    {/* System Rules */}
                    {notificationRules.filter(r => r.is_system).map(rule => (
                      <div key={rule.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{rule.emoji}</span>
                            <span className="text-sm font-medium">{rule.display_name}</span>
                            <Badge variant="secondary" className="text-xs">System</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {rule.keywords.length > 0 ? `"${rule.keywords.slice(0, 3).join('", "')}"${rule.keywords.length > 3 ? '...' : ''}` : rule.description}
                          </p>
                        </div>
                        <Switch
                          checked={rule.is_enabled}
                          onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                        />
                      </div>
                    ))}

                    {/* Custom Rules */}
                    {notificationRules.filter(r => !r.is_system).length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Custom Rules</p>
                        {notificationRules.filter(r => !r.is_system).map(rule => (
                          <div key={rule.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 mb-2">
                            {editingRuleId === rule.id && editingRule ? (
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingRule.emoji}
                                    onChange={(e) => setEditingRule({ ...editingRule, emoji: e.target.value })}
                                    className="w-12 h-8 text-center"
                                    maxLength={2}
                                  />
                                  <Input
                                    value={editingRule.display_name}
                                    onChange={(e) => setEditingRule({ ...editingRule, display_name: e.target.value })}
                                    placeholder="Rule name"
                                    className="h-8"
                                  />
                                </div>
                                <Input
                                  value={editingRule.keywords}
                                  onChange={(e) => setEditingRule({ ...editingRule, keywords: e.target.value })}
                                  placeholder="Keywords (comma-separated)"
                                  className="h-8 text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" className="h-7" onClick={handleSaveEdit}>Save</Button>
                                  <Button size="sm" variant="outline" className="h-7" onClick={() => { setEditingRuleId(null); setEditingRule(null); }}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{rule.emoji}</span>
                                    <span className="text-sm font-medium">{rule.display_name}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    "{rule.keywords.slice(0, 3).join('", "')}"
                                    {rule.keywords.length > 3 ? '...' : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleStartEdit(rule)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteRule(rule.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                  <Switch
                                    checked={rule.is_enabled}
                                    onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Custom Rule Form */}
                    {showAddRule && (
                      <div className="p-3 border rounded-md space-y-3 bg-muted/20">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">New Custom Rule</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => { setShowAddRule(false); setNewRule({ display_name: '', keywords: '', emoji: '🔔', description: '' }); }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={newRule.emoji}
                            onChange={(e) => setNewRule({ ...newRule, emoji: e.target.value })}
                            placeholder="🔔"
                            className="w-12 h-8 text-center"
                            maxLength={2}
                          />
                          <Input
                            value={newRule.display_name}
                            onChange={(e) => setNewRule({ ...newRule, display_name: e.target.value })}
                            placeholder="Rule name (e.g., Urgent complaint)"
                            className="h-8"
                          />
                        </div>
                        <Input
                          value={newRule.keywords}
                          onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                          placeholder="Keywords (comma-separated, e.g., refund, cancel, angry)"
                          className="h-8"
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter keywords that should trigger this notification. AI will detect these in customer messages.
                        </p>
                        <Button size="sm" onClick={handleAddRule} className="w-full">
                          Create Rule
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
