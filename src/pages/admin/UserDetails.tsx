import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Crown,
  FileText,
  Key,
  Loader2,
  Package,
  Save,
  Tag,
  User,
  Webhook,
  Users,
  Eye,
  EyeOff,
  LogIn,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Calendar,
  Headphones,
  Settings2,
  ChevronDown,
  ChevronUp,
  Upload,
  Download,
  FileJson,
  Trash2,
  Plus,
  Pencil,
  X,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionTier } from '@/types/admin';
import { AIPromptGenerator } from '@/components/business-chatbot/AIPromptGenerator';
import { createPlatformApiKey } from '@/services/platformApiKeyService';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  industry: string | null;
  company_size: string | null;
  use_case: string | null;
  created_at: string;
  last_login: string | null;
  subscription_tier_id: string | null;
  onboarding_completed: boolean;
  account_status: string;
}

interface UserChatbot {
  id: string;
  name: string;
  company_name: string | null;
  industry: string | null;
  chatbot_type: string;
  n8n_webhook_url: string | null;
  n8n_workflow_name: string | null;
  n8n_workflow_url: string | null;
  n8n_workflow_json: any | null;
  n8n_enabled: boolean;
  activation_status: string;
  activation_requested_at: string | null;
  setup_started_at: string | null;
  setup_completed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  status: string;
}

interface ChatbotContent {
  products_count: number;
  promotions_count: number;
  documents_count: number;
  has_active_prompt: boolean;
  active_prompt_version?: string;
  active_prompt_content?: string;
  whatsapp_connected: boolean;
  contacts_count: number;
  messages_count: number;
}

interface AdminApiKey {
  id: string;
  user_id: string;
  service: string;
  api_key_encrypted: string;
  is_active: boolean;
  created_at: string;
}

interface PlatformApiKey {
  id: string;
  key_name: string;
  api_key_prefix: string;
  avatar_id: string | null;
  status: string;
  created_at: string;
  avatar_name?: string;
}

const CHATBOT_TYPE_INFO = {
  ecommerce: { label: 'E-commerce', icon: Package, description: 'Product inquiries & sales' },
  appointment: { label: 'Appointment', icon: Calendar, description: 'Booking & scheduling' },
  support: { label: 'Support', icon: Headphones, description: 'FAQ & customer support' },
  custom: { label: 'Custom', icon: Settings2, description: 'Custom workflow' },
};

export const UserDetails = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // User State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);

  // Chatbots State
  const [chatbots, setChatbots] = useState<UserChatbot[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<UserChatbot | null>(null);
  const [chatbotContent, setChatbotContent] = useState<ChatbotContent | null>(null);

  // API Keys State
  const [adminApiKeys, setAdminApiKeys] = useState<AdminApiKey[]>([]);
  const [openaiKey, setOpenaiKey] = useState('');
  const [kieaiKey, setKieaiKey] = useState('');
  const [savingOpenai, setSavingOpenai] = useState(false);
  const [savingKieai, setSavingKieai] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showKieaiKey, setShowKieaiKey] = useState(false);

  // Chatbot Edit State
  const [webhookUrl, setWebhookUrl] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowUrl, setWorkflowUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [activationStatus, setActivationStatus] = useState('pending');
  const [savingChatbot, setSavingChatbot] = useState(false);

  // Dialog State
  const [loginAsDialog, setLoginAsDialog] = useState(false);
  const [loginAsLoading, setLoginAsLoading] = useState(false);

  // Prompt & Workflow State
  const [showPromptContent, setShowPromptContent] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [editedPromptContent, setEditedPromptContent] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [uploadingWorkflow, setUploadingWorkflow] = useState(false);
  const workflowFileInputRef = React.useRef<HTMLInputElement>(null);
  const [exportingProducts, setExportingProducts] = useState(false);

  // Platform API Key State
  const [platformApiKeys, setPlatformApiKeys] = useState<PlatformApiKey[]>([]);
  const [platformApiKeyFull, setPlatformApiKeyFull] = useState<string | null>(null);
  const [generatingPlatformKey, setGeneratingPlatformKey] = useState(false);
  const [deletingPlatformKey, setDeletingPlatformKey] = useState<string | null>(null);
  const [selectedChatbotForApiKey, setSelectedChatbotForApiKey] = useState<string>('');

  useEffect(() => {
    if (userId) {
      fetchUserData();
      fetchTiers();
    }
  }, [userId]);

  const fetchUserData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(profile);

      await Promise.all([
        fetchUserApiKeys(userId),
        fetchUserChatbots(userId),
        fetchPlatformApiKeys(userId)
      ]);
    } catch (error: any) {
      console.error('Error fetching user:', error);
      toast({ title: 'Error', description: 'Failed to load user details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTiers = async () => {
    try {
      const { data } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('price_monthly', { ascending: true });
      setTiers(data || []);
    } catch (error) {
      console.error('Error fetching tiers:', error);
    }
  };

  const fetchUserApiKeys = async (uid: string) => {
    try {
      const { data } = await supabase
        .from('admin_assigned_api_keys')
        .select('*')
        .eq('user_id', uid)
        .order('service');

      setAdminApiKeys(data || []);
      const openai = data?.find(k => k.service === 'openai');
      const kieai = data?.find(k => k.service === 'kie-ai');

      // Decode base64 encoded keys for display (handle both old unencoded and new encoded keys)
      const decodeKey = (encoded: string | undefined): string => {
        if (!encoded) return '';
        try {
          const decoded = atob(encoded);
          // Check if it looks like a valid API key after decoding
          if (decoded.startsWith('sk-')) return decoded;
          // If not, it might be stored unencoded (old format)
          return encoded;
        } catch {
          // Not valid base64, return as-is
          return encoded;
        }
      };

      setOpenaiKey(decodeKey(openai?.api_key_encrypted));
      setKieaiKey(decodeKey(kieai?.api_key_encrypted));
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const fetchUserChatbots = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('avatars')
        .select(`
          id, name, company_name, industry, chatbot_type,
          n8n_webhook_url, n8n_workflow_name, n8n_workflow_url, n8n_workflow_json, n8n_enabled,
          activation_status, activation_requested_at, setup_started_at, setup_completed_at,
          admin_notes, created_at, status
        `)
        .eq('user_id', uid)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching chatbots:', error);
        return;
      }

      setChatbots(data || []);
      if (data && data.length > 0) {
        selectChatbot(data[0] as UserChatbot);
      }
    } catch (error) {
      console.error('Error fetching chatbots:', error);
    }
  };

  const selectChatbot = async (chatbot: UserChatbot) => {
    setSelectedChatbot(chatbot);
    setWebhookUrl(chatbot.n8n_webhook_url || '');
    setWorkflowName(chatbot.n8n_workflow_name || '');
    setWorkflowUrl(chatbot.n8n_workflow_url || '');
    setAdminNotes(chatbot.admin_notes || '');
    setActivationStatus(chatbot.activation_status || 'pending');
    await fetchChatbotContent(chatbot.id);
  };

  const fetchPlatformApiKeys = async (uid: string) => {
    try {
      // Fetch all platform API keys for this user with chatbot names
      const { data: keys, error } = await supabase
        .from('platform_api_keys')
        .select(`
          id, key_name, api_key_prefix, avatar_id, status, created_at,
          avatars:avatar_id (name)
        `)
        .eq('user_id', uid)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedKeys: PlatformApiKey[] = (keys || []).map(k => ({
        id: k.id,
        key_name: k.key_name,
        api_key_prefix: k.api_key_prefix,
        avatar_id: k.avatar_id,
        status: k.status,
        created_at: k.created_at,
        avatar_name: (k.avatars as any)?.name || null
      }));

      setPlatformApiKeys(formattedKeys);
    } catch (error) {
      console.error('Error fetching platform API keys:', error);
      setPlatformApiKeys([]);
    }
  };

  const handleGeneratePlatformKey = async (chatbotId?: string, chatbotName?: string) => {
    if (!userId) return;
    setGeneratingPlatformKey(true);
    try {
      const result = await createPlatformApiKey(
        userId,
        chatbotId || null,
        chatbotName || `API Key ${platformApiKeys.length + 1}`,
        true // isAdminCreating - use RPC to bypass RLS
      );

      if (result.success && result.apiKey) {
        setPlatformApiKeyFull(result.apiKey);
        await fetchPlatformApiKeys(userId);
        toast({
          title: 'Key Generated',
          description: 'Copy the API key now - it will not be shown again!'
        });
      } else {
        throw new Error(result.error || 'Failed to generate key');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setGeneratingPlatformKey(false);
    }
  };

  const handleDeletePlatformKey = async (keyId: string) => {
    if (!userId) return;
    setDeletingPlatformKey(keyId);
    try {
      const { error } = await supabase
        .from('platform_api_keys')
        .update({ status: 'revoked' })
        .eq('id', keyId);

      if (error) throw error;

      await fetchPlatformApiKeys(userId);
      toast({ title: 'Deleted', description: 'API key has been revoked' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingPlatformKey(null);
    }
  };

  const handleCopyPlatformKey = (key?: string) => {
    const keyToCopy = key || platformApiKeyFull;
    if (!keyToCopy) return;
    navigator.clipboard.writeText(keyToCopy);
    toast({ title: 'Copied', description: 'API key copied to clipboard' });
  };

  const fetchChatbotContent = async (chatbotId: string) => {
    try {
      const [productsRes, promosRes, docsRes, promptRes, whatsappRes, contactsRes, messagesRes] = await Promise.all([
        supabase.from('chatbot_products').select('id', { count: 'exact', head: true }).eq('chatbot_id', chatbotId),
        supabase.from('chatbot_promotions').select('id', { count: 'exact', head: true }).eq('chatbot_id', chatbotId).eq('is_active', true),
        supabase.from('avatar_knowledge_files').select('id', { count: 'exact', head: true }).eq('avatar_id', chatbotId),
        supabase.from('avatar_prompt_versions').select('version_name, system_prompt').eq('avatar_id', chatbotId).eq('is_active', true).maybeSingle(),
        supabase.from('whatsapp_web_sessions').select('id').eq('user_id', userId!).eq('status', 'connected').maybeSingle(),
        supabase.from('contact_profiles').select('id', { count: 'exact', head: true }).eq('chatbot_id', chatbotId),
        supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('chatbot_id', chatbotId)
      ]);

      setChatbotContent({
        products_count: productsRes.count || 0,
        promotions_count: promosRes.count || 0,
        documents_count: docsRes.count || 0,
        has_active_prompt: !!promptRes.data,
        active_prompt_version: promptRes.data?.version_name,
        active_prompt_content: promptRes.data?.system_prompt,
        whatsapp_connected: !!whatsappRes.data,
        contacts_count: contactsRes.count || 0,
        messages_count: messagesRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching chatbot content:', error);
    }
  };

  const handleSaveApiKey = async (service: 'openai' | 'kie-ai', apiKey: string) => {
    if (!userId || !apiKey.trim()) return;
    const setSaving = service === 'openai' ? setSavingOpenai : setSavingKieai;
    setSaving(true);

    try {
      const existing = adminApiKeys.find(k => k.service === service);
      // Encode the API key with base64 before storing (edge functions expect this encoding)
      const encodedKey = btoa(apiKey);

      if (existing) {
        await supabase
          .from('admin_assigned_api_keys')
          .update({ api_key_encrypted: encodedKey, is_active: true })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('admin_assigned_api_keys')
          .insert({ user_id: userId, service, api_key_encrypted: encodedKey, is_active: true });
      }

      toast({ title: 'Saved', description: `${service === 'openai' ? 'OpenAI' : 'KIE-AI'} key saved` });
      await fetchUserApiKeys(userId);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChatbotSettings = async () => {
    if (!selectedChatbot || !userId) return;
    setSavingChatbot(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const updateData: any = {
        n8n_webhook_url: webhookUrl || null,
        n8n_workflow_name: workflowName || null,
        n8n_workflow_url: workflowUrl || null,
        n8n_enabled: !!webhookUrl,
        admin_notes: adminNotes || null,
        activation_status: activationStatus,
      };

      // Track setup progress
      if (activationStatus === 'setting_up' && !selectedChatbot.setup_started_at) {
        updateData.setup_started_at = new Date().toISOString();
      }
      if (activationStatus === 'active' && selectedChatbot.activation_status !== 'active') {
        updateData.setup_completed_at = new Date().toISOString();
        updateData.setup_completed_by = currentUser?.id;
        updateData.activated_at = new Date().toISOString();
        updateData.activated_by = currentUser?.id;
      }

      const { error } = await supabase
        .from('avatars')
        .update(updateData)
        .eq('id', selectedChatbot.id);

      if (error) throw error;

      // Update local state
      const updatedChatbot = { ...selectedChatbot, ...updateData };
      setSelectedChatbot(updatedChatbot);
      setChatbots(prev => prev.map(c => c.id === selectedChatbot.id ? updatedChatbot : c));

      toast({
        title: 'Saved',
        description: activationStatus === 'active' ? 'Chatbot activated!' : 'Settings saved.'
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingChatbot(false);
    }
  };

  const handleChangeTier = async (tierId: string) => {
    if (!userId) return;
    try {
      await supabase
        .from('profiles')
        .update({ subscription_tier_id: tierId || null })
        .eq('id', userId);

      setUser(prev => prev ? { ...prev, subscription_tier_id: tierId || null } : null);
      toast({ title: 'Saved', description: 'Subscription tier updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLoginAs = async () => {
    if (!user) return;
    setLoginAsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: userId }
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({ title: 'Success', description: 'Opening dashboard in new tab...' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to impersonate', variant: 'destructive' });
    } finally {
      setLoginAsLoading(false);
      setLoginAsDialog(false);
    }
  };

  const handleWorkflowFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChatbot) return;

    setUploadingWorkflow(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Validate it's a proper n8n workflow (basic check)
      if (!json.nodes || !Array.isArray(json.nodes)) {
        throw new Error('Invalid n8n workflow JSON. Missing "nodes" array.');
      }

      const { error } = await supabase
        .from('avatars')
        .update({ n8n_workflow_json: json })
        .eq('id', selectedChatbot.id);

      if (error) throw error;

      // Update local state
      const updatedChatbot = { ...selectedChatbot, n8n_workflow_json: json };
      setSelectedChatbot(updatedChatbot);
      setChatbots(prev => prev.map(c => c.id === selectedChatbot.id ? updatedChatbot : c));

      toast({ title: 'Uploaded', description: 'Workflow JSON uploaded successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload workflow', variant: 'destructive' });
    } finally {
      setUploadingWorkflow(false);
      // Reset input
      if (workflowFileInputRef.current) {
        workflowFileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadWorkflow = () => {
    if (!selectedChatbot?.n8n_workflow_json) return;

    const blob = new Blob([JSON.stringify(selectedChatbot.n8n_workflow_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedChatbot.name.replace(/\s+/g, '_')}_workflow.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyPrompt = () => {
    if (!chatbotContent?.active_prompt_content) return;
    navigator.clipboard.writeText(chatbotContent.active_prompt_content);
    toast({ title: 'Copied', description: 'Prompt copied to clipboard' });
  };

  const handleEditPrompt = () => {
    setEditedPromptContent(chatbotContent?.active_prompt_content || '');
    setEditingPrompt(true);
    setShowPromptContent(true);
  };

  const handleCancelEditPrompt = () => {
    setEditingPrompt(false);
    setEditedPromptContent('');
  };

  const handleSavePrompt = async () => {
    if (!selectedChatbot || !userId || !editedPromptContent.trim()) return;
    setSavingPrompt(true);

    try {
      // Check if there's an active prompt version
      const { data: existingPrompt } = await supabase
        .from('avatar_prompt_versions')
        .select('id')
        .eq('avatar_id', selectedChatbot.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingPrompt) {
        // Update existing prompt - only update system_prompt field
        const { error } = await supabase
          .from('avatar_prompt_versions')
          .update({ system_prompt: editedPromptContent })
          .eq('id', existingPrompt.id);

        if (error) throw error;
      } else {
        // Get current highest version number
        const { data: versions } = await supabase
          .from('avatar_prompt_versions')
          .select('version_number')
          .eq('avatar_id', selectedChatbot.id)
          .order('version_number', { ascending: false })
          .limit(1);

        const nextVersionNumber = (versions && versions.length > 0)
          ? versions[0].version_number + 1
          : 1;

        // Create new prompt version with required fields
        const { error } = await supabase
          .from('avatar_prompt_versions')
          .insert({
            avatar_id: selectedChatbot.id,
            user_id: userId,
            version_number: nextVersionNumber,
            version_name: `Manual v${nextVersionNumber}`,
            system_prompt: editedPromptContent,
            personality_traits: [],
            behavior_rules: [],
            compliance_rules: [],
            response_guidelines: [],
            is_active: true
          });

        if (error) throw error;
      }

      // Update local state
      setChatbotContent(prev => prev ? {
        ...prev,
        has_active_prompt: true,
        active_prompt_content: editedPromptContent
      } : null);

      setEditingPrompt(false);
      toast({ title: 'Saved', description: 'Prompt content updated successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleExportProducts = async () => {
    if (!selectedChatbot) return;
    setExportingProducts(true);
    try {
      const { data: products, error } = await supabase
        .from('chatbot_products')
        .select('*')
        .eq('chatbot_id', selectedChatbot.id)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      if (!products || products.length === 0) {
        toast({ title: 'No Products', description: 'No products to export', variant: 'destructive' });
        return;
      }

      // Create CSV content
      const headers = ['Name', 'Category', 'Description', 'Price', 'Currency', 'Stock Status', 'SKU', 'Tags', 'Created At'];
      const csvRows = [
        headers.join(','),
        ...products.map(p => [
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.category || '').replace(/"/g, '""')}"`,
          `"${(p.description || '').replace(/"/g, '""')}"`,
          p.price || '',
          p.currency || 'MYR',
          p.stock_status || 'in_stock',
          `"${(p.sku || '').replace(/"/g, '""')}"`,
          `"${(p.tags || []).join(', ')}"`,
          p.created_at || ''
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedChatbot.name.replace(/\s+/g, '_')}_products_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'Exported', description: `${products.length} products exported to CSV` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to export products', variant: 'destructive' });
    } finally {
      setExportingProducts(false);
    }
  };

  const getTierName = (tierId: string | null) => {
    if (!tierId) return 'Free';
    return tiers.find(t => t.id === tierId)?.display_name || 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case 'setting_up':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Setting Up</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending Setup</Badge>;
      case 'suspended':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
        <Button onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
              {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-xl font-bold">{user.name || 'Unnamed User'}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setLoginAsDialog(true)}>
          <LogIn className="h-4 w-4 mr-2" /> Login As User
        </Button>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="chatbots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chatbots">Chatbots ({chatbots.length})</TabsTrigger>
          <TabsTrigger value="user-info">User Info</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        {/* Chatbots Tab */}
        <TabsContent value="chatbots" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Chatbot List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Chatbots</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {chatbots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No chatbots</p>
                ) : (
                  chatbots.map(chatbot => {
                    const TypeIcon = CHATBOT_TYPE_INFO[chatbot.chatbot_type as keyof typeof CHATBOT_TYPE_INFO]?.icon || Bot;
                    return (
                      <div
                        key={chatbot.id}
                        onClick={() => selectChatbot(chatbot)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedChatbot?.id === chatbot.id
                            ? 'bg-primary/10 border border-primary'
                            : 'border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm truncate">{chatbot.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {CHATBOT_TYPE_INFO[chatbot.chatbot_type as keyof typeof CHATBOT_TYPE_INFO]?.label || chatbot.chatbot_type}
                          </span>
                          {getStatusBadge(chatbot.activation_status)}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Chatbot Details */}
            <Card className="lg:col-span-3">
              {!selectedChatbot ? (
                <CardContent className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Select a chatbot</p>
                </CardContent>
              ) : (
                <>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedChatbot.name}</CardTitle>
                        <CardDescription>
                          {CHATBOT_TYPE_INFO[selectedChatbot.chatbot_type as keyof typeof CHATBOT_TYPE_INFO]?.description || 'Custom workflow'}
                        </CardDescription>
                      </div>
                      {getStatusBadge(selectedChatbot.activation_status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Content Summary */}
                    {chatbotContent && (
                      <div>
                        <h4 className="text-sm font-medium mb-3">User's Content</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 border rounded-lg text-center relative group">
                            <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-lg font-semibold">{chatbotContent.products_count}</p>
                            <p className="text-xs text-muted-foreground">Products</p>
                            {chatbotContent.products_count > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={handleExportProducts}
                                disabled={exportingProducts}
                                title="Export to CSV"
                              >
                                {exportingProducts ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="p-3 border rounded-lg text-center">
                            <Tag className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-lg font-semibold">{chatbotContent.promotions_count}</p>
                            <p className="text-xs text-muted-foreground">Promotions</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center">
                            <FileText className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-lg font-semibold">{chatbotContent.documents_count}</p>
                            <p className="text-xs text-muted-foreground">Documents</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center">
                            <Sparkles className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-sm font-medium">
                              {chatbotContent.has_active_prompt ? chatbotContent.active_prompt_version || 'Ready' : 'None'}
                            </p>
                            <p className="text-xs text-muted-foreground">Prompt</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            <span>{chatbotContent.whatsapp_connected ? 'WhatsApp Connected' : 'WhatsApp Not Connected'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{chatbotContent.contacts_count} contacts</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            <span>{chatbotContent.messages_count} messages</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* AI Prompt Generation - Admin Only */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Prompt Generation
                      </h4>
                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {chatbotContent?.has_active_prompt ? (
                                <>
                                  <span className="text-green-600">Active Prompt:</span> {chatbotContent.active_prompt_version || 'v1'}
                                </>
                              ) : (
                                <span className="text-amber-600">No prompt generated yet</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Generate an AI prompt based on user's content and business type
                            </p>
                          </div>
                          {userId && (
                            <AIPromptGenerator
                              chatbotId={selectedChatbot.id}
                              userId={userId}
                              onPromptGenerated={() => fetchChatbotContent(selectedChatbot.id)}
                              compact={true}
                            />
                          )}
                        </div>

                        {/* Display Active Prompt Content */}
                        {(chatbotContent?.active_prompt_content || editingPrompt) && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => setShowPromptContent(!showPromptContent)}
                                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                              >
                                {showPromptContent ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                {showPromptContent ? 'Hide Prompt Content' : 'View Prompt Content'}
                              </button>
                              <div className="flex items-center gap-1">
                                {!editingPrompt ? (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={handleEditPrompt}>
                                      <Pencil className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={handleCopyPrompt}>
                                      <Copy className="h-4 w-4 mr-1" />
                                      Copy
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={handleCancelEditPrompt}>
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button size="sm" onClick={handleSavePrompt} disabled={savingPrompt}>
                                      {savingPrompt ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                      Save
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {showPromptContent && (
                              editingPrompt ? (
                                <Textarea
                                  value={editedPromptContent}
                                  onChange={(e) => setEditedPromptContent(e.target.value)}
                                  className="min-h-[300px] font-mono text-xs"
                                  placeholder="Enter system prompt content..."
                                />
                              ) : (
                                <div className="bg-muted/50 rounded-lg p-3 max-h-80 overflow-y-auto">
                                  <pre className="text-xs whitespace-pre-wrap font-mono">
                                    {chatbotContent?.active_prompt_content}
                                  </pre>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* Add prompt if none exists */}
                        {!chatbotContent?.active_prompt_content && !editingPrompt && (
                          <div className="mt-4 pt-4 border-t">
                            <Button variant="outline" size="sm" onClick={handleEditPrompt}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Prompt Manually
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* n8n Workflow Settings */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">n8n Workflow Configuration</h4>

                      {/* Workflow JSON Upload */}
                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Workflow JSON</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedChatbot.n8n_workflow_json
                                  ? `${selectedChatbot.n8n_workflow_json?.nodes?.length || 0} nodes configured`
                                  : 'No workflow uploaded'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              ref={workflowFileInputRef}
                              onChange={handleWorkflowFileUpload}
                              accept=".json"
                              className="hidden"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => workflowFileInputRef.current?.click()}
                              disabled={uploadingWorkflow}
                            >
                              {uploadingWorkflow ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4 mr-1" />
                              )}
                              Upload
                            </Button>
                            {selectedChatbot.n8n_workflow_json && (
                              <Button variant="outline" size="sm" onClick={handleDownloadWorkflow}>
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            )}
                          </div>
                        </div>
                        {selectedChatbot.n8n_workflow_json && (
                          <p className="text-xs text-muted-foreground">
                            Workflow name: {selectedChatbot.n8n_workflow_json?.name || 'Unnamed'}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Workflow Name</Label>
                          <Input
                            placeholder="e.g., User123_Ecommerce"
                            value={workflowName}
                            onChange={(e) => setWorkflowName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Workflow URL (for quick access)</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="https://n8n.yourserver.com/workflow/123"
                              value={workflowUrl}
                              onChange={(e) => setWorkflowUrl(e.target.value)}
                            />
                            {workflowUrl && (
                              <Button variant="outline" size="icon" asChild>
                                <a href={workflowUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Webhook URL (from n8n)</Label>
                        <Input
                          placeholder="https://n8n.yourserver.com/webhook/..."
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          The webhook URL that receives WhatsApp messages
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Admin Notes</Label>
                        <Textarea
                          placeholder="Notes about customizations, special requirements..."
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Activation Status</Label>
                        <Select value={activationStatus} onValueChange={setActivationStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft (User still setting up)</SelectItem>
                            <SelectItem value="pending">Pending (Waiting for admin)</SelectItem>
                            <SelectItem value="setting_up">Setting Up (Admin working on it)</SelectItem>
                            <SelectItem value="active">Active (Live)</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Timeline */}
                      {(selectedChatbot.activation_requested_at || selectedChatbot.setup_started_at || selectedChatbot.setup_completed_at) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {selectedChatbot.activation_requested_at && (
                            <p>Requested: {format(new Date(selectedChatbot.activation_requested_at), 'MMM d, yyyy h:mm a')}</p>
                          )}
                          {selectedChatbot.setup_started_at && (
                            <p>Setup started: {format(new Date(selectedChatbot.setup_started_at), 'MMM d, yyyy h:mm a')}</p>
                          )}
                          {selectedChatbot.setup_completed_at && (
                            <p>Completed: {format(new Date(selectedChatbot.setup_completed_at), 'MMM d, yyyy h:mm a')}</p>
                          )}
                        </div>
                      )}

                      <Button onClick={handleSaveChatbotSettings} disabled={savingChatbot} className="w-full">
                        {savingChatbot ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Configuration
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* User Info Tab */}
        <TabsContent value="user-info" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user.email}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{user.name || '-'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{user.phone || '-'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Industry</span>
                  <span>{user.industry || '-'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company Size</span>
                  <span>{user.company_size || '-'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Use Case</span>
                  <span>{user.use_case || '-'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Status & Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Account Status</span>
                  <Badge variant={user.account_status === 'active' ? 'default' : 'destructive'}>
                    {user.account_status}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Onboarding</span>
                  <Badge variant={user.onboarding_completed ? 'outline' : 'secondary'}>
                    {user.onboarding_completed ? 'Completed' : 'Incomplete'}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined</span>
                  <span>{format(new Date(user.created_at), 'MMM d, yyyy')}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Login</span>
                  <span>{user.last_login ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true }) : 'Never'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subscription</span>
                  <Select value={user.subscription_tier_id || 'free'} onValueChange={handleChangeTier}>
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      {tiers.map(tier => (
                        <SelectItem key={tier.id} value={tier.id}>{tier.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Admin-Assigned API Keys</CardTitle>
              <CardDescription>
                These keys are used for all of this user's chatbots
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* OpenAI Key */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">OpenAI API Key</Label>
                  {adminApiKeys.find(k => k.service === 'openai') && (
                    <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Assigned</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showOpenaiKey ? 'text' : 'password'}
                      placeholder="sk-..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    >
                      {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={() => handleSaveApiKey('openai', openaiKey)} disabled={savingOpenai || !openaiKey}>
                    {savingOpenai ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Used for chatbot AI responses</p>
              </div>

              {/* KIE-AI Key */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">KIE-AI API Key</Label>
                  {adminApiKeys.find(k => k.service === 'kie-ai') && (
                    <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Assigned</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKieaiKey ? 'text' : 'password'}
                      placeholder="kie_..."
                      value={kieaiKey}
                      onChange={(e) => setKieaiKey(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowKieaiKey(!showKieaiKey)}
                    >
                      {showKieaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={() => handleSaveApiKey('kie-ai', kieaiKey)} disabled={savingKieai || !kieaiKey}>
                    {savingKieai ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Used for image/video generation</p>
              </div>
            </CardContent>
          </Card>

          {/* Platform API Keys for n8n */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Platform API Keys (for n8n)
                    </CardTitle>
                    <CardDescription>
                      API keys for n8n workflow to fetch chatbot data
                    </CardDescription>
                  </div>
                </div>
                {/* Chatbot selector and generate button */}
                <div className="flex items-center gap-2">
                  <Select value={selectedChatbotForApiKey} onValueChange={setSelectedChatbotForApiKey}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a chatbot..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chatbots.map(chatbot => (
                        <SelectItem key={chatbot.id} value={chatbot.id}>
                          {chatbot.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      const chatbot = chatbots.find(c => c.id === selectedChatbotForApiKey);
                      if (chatbot) {
                        handleGeneratePlatformKey(chatbot.id, chatbot.name);
                      }
                    }}
                    disabled={generatingPlatformKey || !selectedChatbotForApiKey}
                    size="sm"
                  >
                    {generatingPlatformKey ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Generate Key
                  </Button>
                </div>
                {!selectedChatbotForApiKey && chatbots.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Select a chatbot to generate an API key for n8n integration
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Show newly generated key */}
              {platformApiKeyFull && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">
                      Copy this key now - it won't be shown again!
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyPlatformKey()}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <code className="block p-2 bg-white dark:bg-black/20 rounded text-xs font-mono break-all select-all">
                    {platformApiKeyFull}
                  </code>
                </div>
              )}

              {/* List of existing keys */}
              {platformApiKeys.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No platform API keys yet</p>
                  <p className="text-xs">Click "New Key" to generate one for n8n integration</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {platformApiKeys.map(key => (
                    <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {key.api_key_prefix}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCopyPlatformKey(key.api_key_prefix)}
                            title="Copy prefix"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {key.key_name}
                          {key.avatar_name && <span className="ml-1">• {key.avatar_name}</span>}
                          <span className="ml-1">• Created {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}</span>
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeletePlatformKey(key.id)}
                        disabled={deletingPlatformKey === key.id}
                      >
                        {deletingPlatformKey === key.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Login As Dialog */}
      <AlertDialog open={loginAsDialog} onOpenChange={setLoginAsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login as {user?.name || user?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will open a new tab where you'll be logged in as this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoginAs} disabled={loginAsLoading}>
              {loginAsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
              Login as User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserDetails;
