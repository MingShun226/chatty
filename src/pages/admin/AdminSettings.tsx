import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Building2,
  CreditCard,
  Check,
  Globe,
  Loader2,
  Upload,
  X,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface PlatformSettings {
  platform_name: string;
  platform_description: string;
  logo_url: string;
  favicon_url: string;
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
}

interface PaymentSettings {
  payment_gateway: 'stripe' | 'manual' | 'none';
  stripe_publishable_key: string;
  stripe_webhook_secret: string;
  manual_payment_instructions: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
}

interface TermsSettings {
  enabled: boolean;
  content: string;
  last_updated: string | null;
}

const defaultPlatformSettings: PlatformSettings = {
  platform_name: 'Chatty',
  platform_description: 'AI-powered chatbot platform',
  logo_url: '',
  favicon_url: '',
  support_email: '',
  support_phone: '',
  support_whatsapp: '',
};

const defaultPaymentSettings: PaymentSettings = {
  payment_gateway: 'manual',
  stripe_publishable_key: '',
  stripe_webhook_secret: '',
  manual_payment_instructions: '',
  bank_name: '',
  bank_account_number: '',
  bank_account_name: '',
};

const defaultTermsSettings: TermsSettings = {
  enabled: false,
  content: '',
  last_updated: null,
};

export const AdminSettings = () => {
  const { adminUser, isSuperAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(defaultPlatformSettings);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [termsSettings, setTermsSettings] = useState<TermsSettings>(defaultTermsSettings);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, [adminUser]);

  const fetchSettings = async () => {
    try {
      // Fetch platform settings
      const { data: platformData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'general')
        .maybeSingle();

      if (platformData?.setting_value) {
        setPlatformSettings({ ...defaultPlatformSettings, ...platformData.setting_value });
      }

      // Fetch payment settings
      const { data: paymentData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'payment')
        .maybeSingle();

      if (paymentData?.setting_value) {
        setPaymentSettings({ ...defaultPaymentSettings, ...paymentData.setting_value });
      }

      // Fetch terms settings
      const { data: termsData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'terms_and_conditions')
        .maybeSingle();

      if (termsData?.setting_value) {
        setTermsSettings({ ...defaultTermsSettings, ...termsData.setting_value });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (file: File, type: 'logo' | 'favicon') => {
    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `platform-${type}-${Date.now()}.${fileExt}`;
      const filePath = `platform/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update settings
      if (type === 'logo') {
        setPlatformSettings(prev => ({ ...prev, logo_url: publicUrl }));
      } else {
        setPlatformSettings(prev => ({ ...prev, favicon_url: publicUrl }));
      }

      toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully!`);
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Failed to upload ${type}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSavePlatformSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'general',
          setting_value: platformSettings,
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      toast.success('Platform settings saved successfully!');
    } catch (error) {
      console.error('Error saving platform settings:', error);
      toast.error('Failed to save platform settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaymentSettings = async () => {
    if (!isSuperAdmin()) {
      toast.error('Only super admins can modify payment settings');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'payment',
          setting_value: paymentSettings,
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      toast.success('Payment settings saved successfully!');
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast.error('Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTermsSettings = async () => {
    if (!isSuperAdmin()) {
      toast.error('Only super admins can modify terms and conditions');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'terms_and_conditions',
          setting_value: {
            ...termsSettings,
            last_updated: new Date().toISOString(),
          },
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      toast.success('Terms and conditions saved successfully!');
    } catch (error) {
      console.error('Error saving terms:', error);
      toast.error('Failed to save terms and conditions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Settings</h2>
        <p className="text-muted-foreground">Configure your platform settings and preferences</p>
      </div>

      <Tabs defaultValue="platform" className="space-y-6">
        <TabsList>
          <TabsTrigger value="platform" className="gap-2">
            <Building2 className="h-4 w-4" />
            Platform
          </TabsTrigger>
          {isSuperAdmin() && (
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Gateway
            </TabsTrigger>
          )}
          {isSuperAdmin() && (
            <TabsTrigger value="terms" className="gap-2">
              <FileText className="h-4 w-4" />
              Terms & Conditions
            </TabsTrigger>
          )}
        </TabsList>

        {/* Platform Settings Tab */}
        <TabsContent value="platform" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure your platform's name, description, and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="platform_name">Platform Name</Label>
                <Input
                  id="platform_name"
                  value={platformSettings.platform_name}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, platform_name: e.target.value })}
                  placeholder="Enter platform name"
                />
                <p className="text-xs text-muted-foreground">This name will be displayed in the sidebar and page titles</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform_description">Platform Description</Label>
                <Textarea
                  id="platform_description"
                  value={platformSettings.platform_description}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, platform_description: e.target.value })}
                  placeholder="Brief description of your platform"
                  rows={3}
                />
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Platform Logo</Label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'logo');
                    }}
                  />
                  <div className="flex items-center gap-3">
                    {platformSettings.logo_url ? (
                      <div className="relative w-16 h-16 border rounded-lg overflow-hidden bg-muted">
                        <img
                          src={platformSettings.logo_url}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={() => setPlatformSettings(prev => ({ ...prev, logo_url: '' }))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" />Upload Logo</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended: 200x200px, PNG or SVG</p>
                </div>

                {/* Favicon Upload */}
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*,.ico"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'favicon');
                    }}
                  />
                  <div className="flex items-center gap-3">
                    {platformSettings.favicon_url ? (
                      <div className="relative w-16 h-16 border rounded-lg overflow-hidden bg-muted">
                        <img
                          src={platformSettings.favicon_url}
                          alt="Favicon"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={() => setPlatformSettings(prev => ({ ...prev, favicon_url: '' }))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={uploadingFavicon}
                    >
                      {uploadingFavicon ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" />Upload Favicon</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended: 32x32px, ICO or PNG</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="support_email">Support Email</Label>
                  <Input
                    id="support_email"
                    type="email"
                    value={platformSettings.support_email}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, support_email: e.target.value })}
                    placeholder="support@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support_phone">Support Phone</Label>
                  <Input
                    id="support_phone"
                    value={platformSettings.support_phone}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, support_phone: e.target.value })}
                    placeholder="+60123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support_whatsapp">WhatsApp Support</Label>
                  <Input
                    id="support_whatsapp"
                    value={platformSettings.support_whatsapp}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, support_whatsapp: e.target.value })}
                    placeholder="60123456789"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSavePlatformSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Platform Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Gateway Tab - Only for Super Admin */}
        {isSuperAdmin() && (
          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Gateway Configuration
                </CardTitle>
                <CardDescription>
                  Configure how users pay for subscriptions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Payment Gateway</Label>
                  <div className="grid gap-4 md:grid-cols-3">
                    {(['manual', 'stripe', 'none'] as const).map((gateway) => (
                      <div
                        key={gateway}
                        onClick={() => setPaymentSettings({ ...paymentSettings, payment_gateway: gateway })}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          paymentSettings.payment_gateway === gateway
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-muted-foreground/50'
                        }`}
                      >
                        <div className="font-medium capitalize">{gateway}</div>
                        <div className="text-sm text-muted-foreground">
                          {gateway === 'manual' && 'Bank transfer / manual verification'}
                          {gateway === 'stripe' && 'Automated payments via Stripe'}
                          {gateway === 'none' && 'No payments (free platform)'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {paymentSettings.payment_gateway === 'manual' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium">Bank Account Details</h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="bank_name">Bank Name</Label>
                          <Input
                            id="bank_name"
                            value={paymentSettings.bank_name}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })}
                            placeholder="e.g., Maybank"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_account_number">Account Number</Label>
                          <Input
                            id="bank_account_number"
                            value={paymentSettings.bank_account_number}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_number: e.target.value })}
                            placeholder="1234567890"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_account_name">Account Holder Name</Label>
                          <Input
                            id="bank_account_name"
                            value={paymentSettings.bank_account_name}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_name: e.target.value })}
                            placeholder="Company Name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="manual_payment_instructions">Payment Instructions</Label>
                        <Textarea
                          id="manual_payment_instructions"
                          value={paymentSettings.manual_payment_instructions}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, manual_payment_instructions: e.target.value })}
                          placeholder="Instructions for users on how to make payment and submit proof..."
                          rows={4}
                        />
                      </div>
                    </div>
                  </>
                )}

                {paymentSettings.payment_gateway === 'stripe' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-medium">Stripe Configuration</h4>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="stripe_publishable_key">Stripe Publishable Key</Label>
                          <Input
                            id="stripe_publishable_key"
                            value={paymentSettings.stripe_publishable_key}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, stripe_publishable_key: e.target.value })}
                            placeholder="pk_live_..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stripe_webhook_secret">Stripe Webhook Secret</Label>
                          <Input
                            id="stripe_webhook_secret"
                            type="password"
                            value={paymentSettings.stripe_webhook_secret}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, stripe_webhook_secret: e.target.value })}
                            placeholder="whsec_..."
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSavePaymentSettings} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Payment Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Terms & Conditions Tab - Only for Super Admin */}
        {isSuperAdmin() && (
          <TabsContent value="terms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Terms & Conditions
                </CardTitle>
                <CardDescription>
                  Configure the terms and conditions that users must agree to when registering
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Terms Agreement</Label>
                    <p className="text-sm text-muted-foreground">
                      Users must agree to terms before registering
                    </p>
                  </div>
                  <Switch
                    checked={termsSettings.enabled}
                    onCheckedChange={(checked) => setTermsSettings({ ...termsSettings, enabled: checked })}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="terms_content">Terms & Conditions Content</Label>
                  <Textarea
                    id="terms_content"
                    value={termsSettings.content}
                    onChange={(e) => setTermsSettings({ ...termsSettings, content: e.target.value })}
                    placeholder="Enter your terms and conditions here. You can use markdown formatting..."
                    rows={15}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports basic markdown formatting. This will be displayed on the /terms page and during registration.
                  </p>
                </div>

                {termsSettings.last_updated && (
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(termsSettings.last_updated).toLocaleDateString('en-MY', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveTermsSettings} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Terms & Conditions
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
