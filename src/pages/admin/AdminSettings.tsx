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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Building2,
  CreditCard,
  Check,
  Globe,
  Loader2,
  Upload,
  X,
  FileText,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Trash2,
  XCircle,
  Clock,
  DollarSign,
  User,
  Bot,
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

interface FineTuneJobWithDetails {
  id: string;
  user_id: string;
  avatar_id: string;
  openai_job_id: string;
  base_model: string;
  fine_tuned_model: string | null;
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error_message: string | null;
  training_examples_count: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  // Joined data
  user_email?: string;
  avatar_name?: string;
}

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

  // API Key state
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [validatingApiKey, setValidatingApiKey] = useState(false);
  const [apiKeyValidated, setApiKeyValidated] = useState(false);

  // Fine-tuning state
  const [fineTuneJobs, setFineTuneJobs] = useState<FineTuneJobWithDetails[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('all');
  const [cancellingJob, setCancellingJob] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [jobToCancel, setJobToCancel] = useState<FineTuneJobWithDetails | null>(null);
  const [modelToDelete, setModelToDelete] = useState<FineTuneJobWithDetails | null>(null);

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

      // Fetch admin's OpenAI API key
      if (adminUser) {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          const { data: adminKey } = await supabase
            .from('admin_assigned_api_keys')
            .select('api_key_encrypted')
            .eq('user_id', session.session.user.id)
            .eq('service', 'openai')
            .eq('is_active', true)
            .maybeSingle();

          if (adminKey?.api_key_encrypted) {
            setHasExistingKey(true);
            // Don't show the actual key, just indicate it exists
            setOpenaiApiKey('');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Validate OpenAI API key
  const validateOpenaiApiKey = async (key: string): Promise<boolean> => {
    if (!key.trim() || !key.startsWith('sk-')) {
      toast.error('Invalid API key format. OpenAI keys start with "sk-"');
      return false;
    }

    setValidatingApiKey(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      });

      if (response.ok) {
        setApiKeyValidated(true);
        return true;
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Invalid API key');
        return false;
      }
    } catch (err) {
      toast.error('Failed to validate API key. Please check your connection.');
      return false;
    } finally {
      setValidatingApiKey(false);
    }
  };

  // Save OpenAI API key
  const handleSaveApiKey = async () => {
    if (!openaiApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    // Validate first
    const isValid = await validateOpenaiApiKey(openaiApiKey);
    if (!isValid) return;

    setSavingApiKey(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error('Not authenticated');
        return;
      }

      // Encode the API key (base64)
      const encodedKey = btoa(openaiApiKey);

      // Upsert the API key
      const { error } = await supabase
        .from('admin_assigned_api_keys')
        .upsert({
          user_id: session.session.user.id,
          service: 'openai',
          api_key_encrypted: encodedKey,
          is_active: true,
          assigned_by: session.session.user.id,
        }, {
          onConflict: 'user_id,service'
        });

      if (error) throw error;

      toast.success('OpenAI API key saved successfully!');
      setHasExistingKey(true);
      setOpenaiApiKey(''); // Clear the input for security
      setApiKeyValidated(false);
    } catch (error: any) {
      console.error('Error saving API key:', error);
      toast.error(error.message || 'Failed to save API key');
    } finally {
      setSavingApiKey(false);
    }
  };

  // Remove OpenAI API key
  const handleRemoveApiKey = async () => {
    setSavingApiKey(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error('Not authenticated');
        return;
      }

      const { error } = await supabase
        .from('admin_assigned_api_keys')
        .delete()
        .eq('user_id', session.session.user.id)
        .eq('service', 'openai');

      if (error) throw error;

      toast.success('OpenAI API key removed');
      setHasExistingKey(false);
      setOpenaiApiKey('');
      setApiKeyValidated(false);
    } catch (error: any) {
      console.error('Error removing API key:', error);
      toast.error(error.message || 'Failed to remove API key');
    } finally {
      setSavingApiKey(false);
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

  // Fine-tuning functions
  const fetchFineTuneJobs = async () => {
    setLoadingJobs(true);
    try {
      // Fetch all fine-tune jobs with user and avatar details
      const { data: jobs, error } = await supabase
        .from('avatar_fine_tune_jobs')
        .select(`
          *,
          avatars:avatar_id (name),
          profiles:user_id (email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const jobsWithDetails: FineTuneJobWithDetails[] = (jobs || []).map((job: any) => ({
        ...job,
        user_email: job.profiles?.email,
        avatar_name: job.avatars?.name,
      }));

      setFineTuneJobs(jobsWithDetails);
    } catch (error) {
      console.error('Error fetching fine-tune jobs:', error);
      toast.error('Failed to load fine-tuning jobs');
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleCancelJob = async (job: FineTuneJobWithDetails) => {
    setCancellingJob(job.id);
    try {
      // Call OpenAI to cancel the job
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to cancel job');
      }

      // Update database
      await supabase
        .from('avatar_fine_tune_jobs')
        .update({ status: 'cancelled' })
        .eq('id', job.id);

      toast.success('Fine-tuning job cancelled');
      fetchFineTuneJobs();
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      toast.error(error.message || 'Failed to cancel job');
    } finally {
      setCancellingJob(null);
      setJobToCancel(null);
    }
  };

  const handleDeleteModel = async (job: FineTuneJobWithDetails) => {
    if (!job.fine_tuned_model) return;

    setDeletingModel(job.id);
    try {
      // Call OpenAI to delete the model
      const response = await fetch(`https://api.openai.com/v1/models/${job.fine_tuned_model}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete model');
      }

      // Update database - clear the fine_tuned_model and mark as deleted
      await supabase
        .from('avatar_fine_tune_jobs')
        .update({ fine_tuned_model: null, status: 'cancelled' })
        .eq('id', job.id);

      // Also deactivate from avatar if it was active
      await supabase
        .from('avatars')
        .update({
          active_fine_tuned_model: null,
          use_fine_tuned_model: false
        })
        .eq('active_fine_tuned_model', job.fine_tuned_model);

      toast.success('Fine-tuned model deleted from OpenAI');
      fetchFineTuneJobs();
    } catch (error: any) {
      console.error('Error deleting model:', error);
      toast.error(error.message || 'Failed to delete model');
    } finally {
      setDeletingModel(null);
      setModelToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      'validating_files': { variant: 'secondary', label: 'Validating' },
      'queued': { variant: 'secondary', label: 'Queued' },
      'running': { variant: 'default', label: 'Running' },
      'succeeded': { variant: 'outline', label: 'Succeeded' },
      'failed': { variant: 'destructive', label: 'Failed' },
      'cancelled': { variant: 'secondary', label: 'Cancelled' },
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCost = (cost: number | null) => {
    if (cost === null || cost === undefined) return '-';
    return `$${cost.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const filteredJobs = fineTuneJobs.filter(job => {
    if (jobStatusFilter === 'all') return true;
    return job.status === jobStatusFilter;
  });

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
          <TabsTrigger value="apikeys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="finetuning" className="gap-2" onClick={() => fetchFineTuneJobs()}>
            <Sparkles className="h-4 w-4" />
            Fine-Tuning
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

        {/* API Keys Tab */}
        <TabsContent value="apikeys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                OpenAI API Key
              </CardTitle>
              <CardDescription>
                Configure your OpenAI API key for platform AI operations (prompt generation, embeddings, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasExistingKey ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">API Key Configured</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Your OpenAI API key is set up and ready to use.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Update API Key</Label>
                    <p className="text-sm text-muted-foreground">
                      Enter a new API key to replace the existing one.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={openaiApiKey}
                          onChange={(e) => {
                            setOpenaiApiKey(e.target.value);
                            setApiKeyValidated(false);
                          }}
                          placeholder="sk-..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={handleSaveApiKey}
                        disabled={!openaiApiKey.trim() || savingApiKey || validatingApiKey}
                      >
                        {savingApiKey || validatingApiKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Update'
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-destructive">Remove API Key</Label>
                    <p className="text-sm text-muted-foreground">
                      Remove your API key. AI features requiring OpenAI will stop working.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={handleRemoveApiKey}
                      disabled={savingApiKey}
                    >
                      {savingApiKey ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Remove API Key
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">No API Key Configured</p>
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        AI features like prompt generation won't work until you add an API key.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="openai_api_key"
                          type={showApiKey ? 'text' : 'password'}
                          value={openaiApiKey}
                          onChange={(e) => {
                            setOpenaiApiKey(e.target.value);
                            setApiKeyValidated(false);
                          }}
                          placeholder="sk-..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={handleSaveApiKey}
                        disabled={!openaiApiKey.trim() || savingApiKey || validatingApiKey}
                      >
                        {savingApiKey || validatingApiKey ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {validatingApiKey ? 'Validating...' : 'Saving...'}
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Save API Key
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        OpenAI Dashboard
                      </a>
                    </p>
                  </div>

                  {apiKeyValidated && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">API key validated successfully!</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fine-Tuning Management Tab */}
        <TabsContent value="finetuning" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Fine-Tuning Jobs
                  </CardTitle>
                  <CardDescription>
                    Manage all OpenAI fine-tuning jobs across users
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={jobStatusFilter} onValueChange={setJobStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="queued">Queued</SelectItem>
                      <SelectItem value="succeeded">Succeeded</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchFineTuneJobs}
                    disabled={loadingJobs}
                  >
                    {loadingJobs ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!hasExistingKey && (
                <div className="flex items-center gap-3 p-4 mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">API Key Required</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Configure your OpenAI API key in the API Keys tab to manage fine-tuning jobs.
                    </p>
                  </div>
                </div>
              )}

              {loadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {fineTuneJobs.length === 0 ? (
                    <p>No fine-tuning jobs found. Users can start fine-tuning from their dashboard.</p>
                  ) : (
                    <p>No jobs match the selected filter.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Chatbot</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Examples</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm truncate max-w-[150px]" title={job.user_email}>
                                {job.user_email || 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{job.avatar_name || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {job.base_model.replace('gpt-', '').replace('-2024-08-06', '').replace('-2024-07-18', '')}
                            </code>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell>{job.training_examples_count || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span>{formatCost(job.actual_cost || job.estimated_cost)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(job.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(job.status === 'queued' || job.status === 'running' || job.status === 'validating_files') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setJobToCancel(job)}
                                  disabled={cancellingJob === job.id || !hasExistingKey}
                                  title="Cancel job"
                                >
                                  {cancellingJob === job.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-orange-500" />
                                  )}
                                </Button>
                              )}
                              {job.status === 'succeeded' && job.fine_tuned_model && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setModelToDelete(job)}
                                  disabled={deletingModel === job.id || !hasExistingKey}
                                  title="Delete model"
                                >
                                  {deletingModel === job.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary Stats */}
              {fineTuneJobs.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{fineTuneJobs.length}</div>
                    <div className="text-xs text-muted-foreground">Total Jobs</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {fineTuneJobs.filter(j => j.status === 'succeeded').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Succeeded</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {fineTuneJobs.filter(j => j.status === 'running' || j.status === 'queued').length}
                    </div>
                    <div className="text-xs text-muted-foreground">In Progress</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {fineTuneJobs.filter(j => j.status === 'failed').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      ${fineTuneJobs.reduce((sum, j) => sum + (j.actual_cost || j.estimated_cost || 0), 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Cost</div>
                  </div>
                </div>
              )}
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

      {/* Cancel Job Confirmation Dialog */}
      <AlertDialog open={!!jobToCancel} onOpenChange={() => setJobToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Fine-Tuning Job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the fine-tuning job for{' '}
              <strong>{jobToCancel?.avatar_name || 'Unknown'}</strong>.
              The job cannot be resumed after cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Running</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => jobToCancel && handleCancelJob(jobToCancel)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Model Confirmation Dialog */}
      <AlertDialog open={!!modelToDelete} onOpenChange={() => setModelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fine-Tuned Model?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the fine-tuned model from OpenAI.
              <br /><br />
              <strong>Model:</strong> {modelToDelete?.fine_tuned_model}
              <br />
              <strong>Chatbot:</strong> {modelToDelete?.avatar_name}
              <br /><br />
              This action cannot be undone. If the chatbot is using this model,
              it will revert to the base model.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => modelToDelete && handleDeleteModel(modelToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
