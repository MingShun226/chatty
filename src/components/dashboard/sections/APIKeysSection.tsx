import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertCircle, BookOpen, Code, Zap, Download, BarChart3, TrendingUp, Clock, DollarSign, RefreshCw, Loader2, Wallet, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiKeyService, ApiKeyDisplay } from '@/services/apiKeyService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PlatformAPIKey {
  id: string;
  key_name: string;
  api_key_prefix: string;
  scopes: string[];
  avatar_id: string | null;
  avatar_name?: string;
  status: 'active' | 'inactive' | 'revoked';
  last_used_at: string | null;
  request_count: number;
  created_at: string;
  expires_at: string | null;
  description: string | null;
}

interface Avatar {
  id: string;
  name: string;
}

interface TokenUsage {
  id: string;
  service: string;
  operation: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  created_at: string;
}

interface UsageSummary {
  service: string;
  request_count: number;
  total_tokens: number;
  total_cost: number;
}

interface APIBalance {
  service: string;
  balance: number | null;
  currency: string;
  error?: string;
  loading: boolean;
  lastUpdated?: Date;
}

const APIKeysSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKeys, setApiKeys] = useState<PlatformAPIKey[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAPIKey, setNewAPIKey] = useState<string | null>(null);
  const [showNewAPIKey, setShowNewAPIKey] = useState(false);

  // Form state
  const [keyName, setKeyName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('all');
  const [description, setDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['chat', 'config', 'products', 'promotions', 'knowledge']);

  // Docs state
  const [selectedDocsAvatar, setSelectedDocsAvatar] = useState<string>('');

  // Usage state
  const [usageData, setUsageData] = useState<TokenUsage[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usagePeriod, setUsagePeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // External API Keys state (for OpenAI, Kie.AI)
  const [showExternalKeys, setShowExternalKeys] = useState<Record<string, boolean>>({});
  const [newExternalApiKey, setNewExternalApiKey] = useState({ name: '', service: '', key: '' });

  // API Balances state
  const [apiBalances, setApiBalances] = useState<APIBalance[]>([
    { service: 'openai', balance: null, currency: 'USD', loading: false },
    { service: 'kie-ai', balance: null, currency: 'USD', loading: false }
  ]);

  // Constants
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHJ0cWRnZ2hhbndkdWp5aGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NjE1MzEsImV4cCI6MjA3NDUzNzUzMX0.sniz2dGyadAa3BvZJ2Omi6thtVWuqMjTFFdM1H_zWAA';
  const API_BASE_URL = 'https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1';

  useEffect(() => {
    if (user) {
      loadAPIKeys();
      loadAvatars();
    }
  }, [user]);

  const loadAPIKeys = async () => {
    try {
      setIsLoading(true);
      const { data: keysData, error } = await supabase
        .from('platform_api_keys')
        .select(`
          *,
          avatars:avatar_id (
            name
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedKeys = keysData?.map(key => ({
        ...key,
        avatar_name: key.avatars?.name || null
      })) || [];

      setApiKeys(formattedKeys);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvatars = async () => {
    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('status', 'active') // Only show active chatbots (matches RLS policy)
        .order('name');

      if (error) throw error;
      setAvatars(data || []);
    } catch (error: any) {
      console.error('Error loading avatars:', error);
    }
  };

  const loadUsageData = async () => {
    setUsageLoading(true);
    try {
      // Calculate date range
      const days = usagePeriod === '7d' ? 7 : usagePeriod === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch usage data
      const { data, error } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      // Handle table not existing (migration not run yet)
      if (error && (error.code === 'PGRST205' || error.message?.includes('not find'))) {
        // Table doesn't exist yet, just show empty state
        setUsageData([]);
        setUsageSummary([]);
        return;
      }

      if (error) throw error;

      setUsageData(data || []);

      // Calculate summary by service
      const summaryMap = new Map<string, UsageSummary>();
      (data || []).forEach(item => {
        const existing = summaryMap.get(item.service) || {
          service: item.service,
          request_count: 0,
          total_tokens: 0,
          total_cost: 0
        };
        existing.request_count += 1;
        existing.total_tokens += item.total_tokens || 0;
        existing.total_cost += parseFloat(item.cost_usd?.toString() || '0');
        summaryMap.set(item.service, existing);
      });

      setUsageSummary(Array.from(summaryMap.values()));
    } catch (error: any) {
      // Silently handle errors - usage tracking is optional
      console.warn('Usage tracking not available:', error.message);
      setUsageData([]);
      setUsageSummary([]);
    } finally {
      setUsageLoading(false);
    }
  };

  // Load usage data when period changes
  useEffect(() => {
    if (user) {
      loadUsageData();
    }
  }, [user, usagePeriod]);

  // Fetch External API keys from database
  const { data: externalApiKeys = [], isLoading: externalApiKeysLoading } = useQuery({
    queryKey: ['external-api-keys', user?.id],
    queryFn: () => apiKeyService.getUserApiKeys(user!.id),
    enabled: !!user?.id
  });

  // Add External API key mutation
  const addExternalApiKeyMutation = useMutation({
    mutationFn: ({ name, service, key }: { name: string; service: string; key: string }) =>
      apiKeyService.addApiKey(user!.id, name, service, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-api-keys', user?.id] });
      setNewExternalApiKey({ name: '', service: '', key: '' });
      toast({
        title: "API Key Added",
        description: "Your external API key has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add API key. Please try again.",
        variant: "destructive"
      });
      console.error('Error adding API key:', error);
    }
  });

  const handleAddExternalApiKey = () => {
    if (newExternalApiKey.name && newExternalApiKey.service && newExternalApiKey.key) {
      addExternalApiKeyMutation.mutate(newExternalApiKey);
    }
  };

  // Delete External API key mutation
  const deleteExternalApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => apiKeyService.deleteApiKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-api-keys', user?.id] });
      toast({
        title: "API Key Deleted",
        description: "The API key has been removed from your account.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete API key. Please try again.",
        variant: "destructive"
      });
      console.error('Error deleting API key:', error);
    }
  });

  const handleDeleteExternalApiKey = (id: string) => {
    deleteExternalApiKeyMutation.mutate(id);
  };

  const toggleExternalKeyVisibility = (id: string) => {
    setShowExternalKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Fetch OpenAI balance
  const fetchOpenAIBalance = async () => {
    setApiBalances(prev => prev.map(b =>
      b.service === 'openai' ? { ...b, loading: true, error: undefined } : b
    ));

    try {
      // Get the OpenAI API key from user's stored keys (use 'OpenAI' to match stored service name)
      const openaiKey = await apiKeyService.getDecryptedApiKey(user!.id, 'OpenAI');

      if (!openaiKey) {
        setApiBalances(prev => prev.map(b =>
          b.service === 'openai' ? { ...b, loading: false, error: 'No OpenAI API key configured' } : b
        ));
        return;
      }

      // Note: OpenAI's billing API is not publicly available through API keys
      // Users should check their balance at platform.openai.com/usage
      setApiBalances(prev => prev.map(b =>
        b.service === 'openai' ? {
          ...b,
          loading: false,
          balance: null,
          error: 'Check balance at platform.openai.com/usage',
          lastUpdated: new Date()
        } : b
      ));

    } catch (error: any) {
      setApiBalances(prev => prev.map(b =>
        b.service === 'openai' ? {
          ...b,
          loading: false,
          error: 'Check balance at platform.openai.com/usage'
        } : b
      ));
    }
  };

  // Fetch Kie.AI balance
  const fetchKieAIBalance = async () => {
    setApiBalances(prev => prev.map(b =>
      b.service === 'kie-ai' ? { ...b, loading: true, error: undefined } : b
    ));

    try {
      const kieKey = await apiKeyService.getDecryptedApiKey(user!.id, 'kie-ai');

      if (!kieKey) {
        setApiBalances(prev => prev.map(b =>
          b.service === 'kie-ai' ? { ...b, loading: false, error: 'No Kie.AI API key configured' } : b
        ));
        return;
      }

      // Note: Kie.AI balance API endpoint may vary
      // Users should check their balance at kie.ai/dashboard
      setApiBalances(prev => prev.map(b =>
        b.service === 'kie-ai' ? {
          ...b,
          loading: false,
          balance: null,
          error: 'Check balance at kie.ai/dashboard',
          lastUpdated: new Date()
        } : b
      ));

    } catch (error: any) {
      setApiBalances(prev => prev.map(b =>
        b.service === 'kie-ai' ? {
          ...b,
          loading: false,
          error: 'Check balance at kie.ai/dashboard'
        } : b
      ));
    }
  };

  // Fetch all balances
  const fetchAllBalances = async () => {
    if (!user) return;
    await Promise.all([fetchOpenAIBalance(), fetchKieAIBalance()]);
  };

  // Auto-fetch balances on load when external keys exist
  useEffect(() => {
    if (user && externalApiKeys.length > 0) {
      fetchAllBalances();
    }
  }, [user, externalApiKeys]);

  const generateAPIKey = () => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const randomString = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `pk_live_${randomString}`;
  };

  const hashAPIKey = async (apiKey: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createAPIKey = async () => {
    if (!keyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name for your API key',
        variant: 'destructive'
      });
      return;
    }

    try {
      const apiKey = generateAPIKey();
      const apiKeyHash = await hashAPIKey(apiKey);
      const apiKeyPrefix = apiKey.substring(0, 15) + '...';

      const { error } = await supabase
        .from('platform_api_keys')
        .insert({
          user_id: user?.id,
          key_name: keyName,
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          scopes: selectedScopes,
          avatar_id: selectedAvatar === 'all' ? null : selectedAvatar,
          description: description || null,
          status: 'active'
        });

      if (error) throw error;

      setNewAPIKey(apiKey);
      setShowNewAPIKey(true);

      setKeyName('');
      setSelectedAvatar('all');
      setDescription('');
      setSelectedScopes(['chat', 'config', 'products', 'promotions', 'knowledge']);

      await loadAPIKeys();

      toast({
        title: 'Success',
        description: 'API key created successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard'
    });
  };

  const deleteAPIKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('platform_api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      await loadAPIKeys();
      toast({
        title: 'Success',
        description: 'API key deleted successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleKeyStatus = async (keyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
      const { error } = await supabase
        .from('platform_api_keys')
        .update({ status: newStatus })
        .eq('id', keyId);

      if (error) throw error;

      await loadAPIKeys();
      toast({
        title: 'Success',
        description: `API key ${newStatus === 'active' ? 'activated' : 'deactivated'}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Key className="w-8 h-8" />
          Platform API Keys
        </h1>
        <p className="text-muted-foreground mt-2">
          Create and manage API keys for external integrations like n8n
        </p>
      </div>

      <Tabs defaultValue="platform" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="platform">Platform API Keys</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        {/* Platform API Keys Tab (for n8n integrations) */}
        <TabsContent value="platform" className="space-y-6">
          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Platform API Keys</strong> allow external services like n8n, Make, or custom applications to access your chatbot data.
              Keys are scoped to specific permissions and can be restricted to individual chatbots.
            </AlertDescription>
          </Alert>

          {/* Create API Key Button */}
          <div className="flex justify-end">
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </Button>
          </div>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            Manage your platform API keys for integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API keys yet. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Chatbot</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">
                      {key.key_name}
                      {key.description && (
                        <div className="text-xs text-muted-foreground mt-1">{key.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {key.api_key_prefix}
                    </TableCell>
                    <TableCell>
                      {key.avatar_name || 'All Chatbots'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map(scope => (
                          <Badge key={scope} variant="outline" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                        {key.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.request_count.toLocaleString()} requests
                    </TableCell>
                    <TableCell>
                      {formatDate(key.last_used_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleKeyStatus(key.id, key.status)}
                        >
                          {key.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteAPIKey(key.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          {/* API Balances Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                API Credit Balances
              </h3>
              <p className="text-sm text-muted-foreground">Check your credit balances at each provider's dashboard</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Info about API Keys */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    AI Service API Keys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      API keys for AI services (OpenAI, etc.) are managed by your administrator as part of your subscription.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Your usage is included in your subscription plan. Contact your administrator if you have questions about usage limits.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="border-t pt-6">
            {/* Period Selector */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">Token Usage Overview</h3>
                <p className="text-sm text-muted-foreground">Track your API and AI token usage across services</p>
              </div>
              <Select value={usagePeriod} onValueChange={(v) => setUsagePeriod(v as '7d' | '30d' | '90d')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageSummary.reduce((acc, s) => acc + s.request_count, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {usagePeriod === '7d' ? 'Last 7 days' : usagePeriod === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageSummary.reduce((acc, s) => acc + s.total_tokens, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Input + Output tokens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Cost (USD)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${usageSummary.reduce((acc, s) => acc + s.total_cost, 0).toFixed(4)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Approximate cost
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Services Used</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageSummary.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active services
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Usage by Service */}
          <Card>
            <CardHeader>
              <CardTitle>Usage by Service</CardTitle>
              <CardDescription>Breakdown of token usage across different services</CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading usage data...</div>
              ) : usageSummary.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No usage data yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Token usage will appear here as you use AI services like Prompt Engineer, n8n workflows, and more.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {usageSummary.map((service) => (
                    <div key={service.service} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {service.service === 'openai' && <span className="text-lg">🤖</span>}
                          {service.service === 'n8n' && <Zap className="w-5 h-5 text-orange-500" />}
                          {service.service === 'kie_ai' && <span className="text-lg">🎨</span>}
                          {service.service === 'whatsapp' && <span className="text-lg">💬</span>}
                          {!['openai', 'n8n', 'kie_ai', 'whatsapp'].includes(service.service) && (
                            <BarChart3 className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium capitalize">{service.service.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">{service.request_count} requests</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{service.total_tokens.toLocaleString()} tokens</p>
                        <p className="text-sm text-muted-foreground">${service.total_cost.toFixed(4)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest token usage across all services</CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : usageData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity to display
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageData.slice(0, 20).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleString('en-MY', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.service.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{item.operation}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.model || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">{item.total_tokens.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.input_tokens}+{item.output_tokens})
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ${parseFloat(item.cost_usd?.toString() || '0').toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Token usage is tracked automatically when you use AI-powered features like Prompt Engineer, n8n AI workflows, and image/video generation.
              Costs shown are estimates based on standard API pricing and may vary.
            </AlertDescription>
          </Alert>
          </div>
        </TabsContent>

        {/* API Documentation Tab */}
        <TabsContent value="docs" className="space-y-6">
          {/* Avatar Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Chatbot Data API
              </CardTitle>
              <CardDescription>
                Copy-ready curl commands for your AI agent to fetch data on-demand
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Selection */}
              <div className="space-y-2">
                <Label>Select Chatbot</Label>
                <Select value={selectedDocsAvatar} onValueChange={setSelectedDocsAvatar}>
                  <SelectTrigger className="w-full md:w-[400px]">
                    <SelectValue placeholder="Select a chatbot to generate curl commands" />
                  </SelectTrigger>
                  <SelectContent>
                    {avatars.map(avatar => (
                      <SelectItem key={avatar.id} value={avatar.id}>
                        {avatar.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedDocsAvatar && (
                  <p className="text-xs text-amber-600">Please select a chatbot to see copy-ready curl commands</p>
                )}
              </div>

              {selectedDocsAvatar && (
                <div className="space-y-6">
                  {/* Full Catalog API - RECOMMENDED */}
                  <div className="space-y-3 p-4 border rounded-lg border-primary/50 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">GET</Badge>
                        <code className="text-sm font-semibold">Browse Full Catalog</code>
                        <Badge className="bg-green-500 text-white">Recommended</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const curl = `curl "${API_BASE_URL}/chatbot-data?type=catalog&chatbot_id=${selectedDocsAvatar}" \\\n  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\\n  -H "x-api-key: YOUR_API_KEY"`;
                          navigator.clipboard.writeText(curl);
                          toast({ title: 'Copied!', description: 'Catalog API curl command copied' });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>Best for AI agents.</strong> Returns the COMPLETE product catalog grouped by category. Let AI intelligently match products to user requests instead of relying on search terms.
                    </p>
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded-lg">
{`curl "${API_BASE_URL}/chatbot-data?type=catalog&chatbot_id=${selectedDocsAvatar}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "x-api-key: YOUR_API_KEY"`}
                    </pre>
                  </div>

                  {/* Search Products API */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">GET</Badge>
                        <code className="text-sm font-semibold">Search Products</code>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const curl = `curl "${API_BASE_URL}/chatbot-data?type=products&chatbot_id=${selectedDocsAvatar}&query=YOUR_SEARCH_TERM&limit=20" \\\n  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\\n  -H "x-api-key: YOUR_API_KEY"`;
                          navigator.clipboard.writeText(curl);
                          toast({ title: 'Copied!', description: 'Products API curl command copied' });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Search products by exact name, category, or SKU. Use <code className="bg-muted px-1">type=catalog</code> above for general product questions.
                    </p>
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded-lg">
{`curl "${API_BASE_URL}/chatbot-data?type=products&chatbot_id=${selectedDocsAvatar}&query=YOUR_SEARCH_TERM&limit=20" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "x-api-key: YOUR_API_KEY"`}
                    </pre>
                  </div>

                  {/* Promotions API */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">GET</Badge>
                        <code className="text-sm font-semibold">Get Promotions</code>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const curl = `curl "${API_BASE_URL}/chatbot-data?type=promotions&chatbot_id=${selectedDocsAvatar}" \\\n  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\\n  -H "x-api-key: YOUR_API_KEY"`;
                          navigator.clipboard.writeText(curl);
                          toast({ title: 'Copied!', description: 'Promotions API curl command copied' });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Get all active promotions, discounts, and special offers.
                    </p>
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded-lg">
{`curl "${API_BASE_URL}/chatbot-data?type=promotions&chatbot_id=${selectedDocsAvatar}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "x-api-key: YOUR_API_KEY"`}
                    </pre>
                  </div>

                  {/* Validate Promo API */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">GET</Badge>
                        <code className="text-sm font-semibold">Validate Promo Code</code>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const curl = `curl "${API_BASE_URL}/chatbot-data?type=validate_promo&chatbot_id=${selectedDocsAvatar}&promo_code=YOUR_PROMO_CODE" \\\n  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\\n  -H "x-api-key: YOUR_API_KEY"`;
                          navigator.clipboard.writeText(curl);
                          toast({ title: 'Copied!', description: 'Validate Promo API curl command copied' });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Check if a promo code is valid. Replace <code className="bg-muted px-1">YOUR_PROMO_CODE</code> with the code to validate.
                    </p>
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded-lg">
{`curl "${API_BASE_URL}/chatbot-data?type=validate_promo&chatbot_id=${selectedDocsAvatar}&promo_code=YOUR_PROMO_CODE" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "x-api-key: YOUR_API_KEY"`}
                    </pre>
                  </div>

                  {/* Knowledge API */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">GET</Badge>
                        <code className="text-sm font-semibold">Get Knowledge Base</code>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const curl = `curl "${API_BASE_URL}/chatbot-data?type=knowledge&chatbot_id=${selectedDocsAvatar}" \\\n  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\\n  -H "x-api-key: YOUR_API_KEY"`;
                          navigator.clipboard.writeText(curl);
                          toast({ title: 'Copied!', description: 'Knowledge API curl command copied' });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fetches all knowledge base files (PDFs) with download URLs and all text chunks. AI can search through chunks and share document URLs with users.
                    </p>
                    <pre className="text-xs overflow-x-auto bg-muted p-3 rounded-lg">
{`curl "${API_BASE_URL}/chatbot-data?type=knowledge&chatbot_id=${selectedDocsAvatar}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "x-api-key: YOUR_API_KEY"`}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      Response includes: files with <code className="bg-muted px-1">download_url</code>, and all <code className="bg-muted px-1">chunks</code> grouped by file.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Quick Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-3 border rounded-lg">
                  <p className="text-sm font-medium mb-2">Replace in curl commands:</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li><code className="bg-muted px-1">YOUR_API_KEY</code> → Your platform API key (pk_live_...)</li>
                    <li><code className="bg-muted px-1">YOUR_SEARCH_TERM</code> → Product search query</li>
                    <li><code className="bg-muted px-1">YOUR_PROMO_CODE</code> → Promo code to validate</li>
                  </ul>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm font-medium mb-2">Required Headers:</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li><code className="bg-muted px-1">Authorization</code> → Supabase anon key (already filled)</li>
                    <li><code className="bg-muted px-1">x-api-key</code> → Your platform API key</li>
                  </ul>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The chatbot ID and Authorization header are already filled in. You only need to replace <strong>YOUR_API_KEY</strong> with your platform API key from the API Keys tab.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* n8n Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                n8n AI Agent Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add these as HTTP Request tools in your n8n AI Agent. The agent will call these APIs when it needs product, promotion, or knowledge data.
              </p>
              <div className="space-y-3">
                <p className="text-sm font-medium">Tool Configuration:</p>
                <div className="bg-muted p-3 rounded-lg">
                  <pre className="text-xs overflow-x-auto">
{`Method: GET
Headers:
  - Authorization: Bearer ${SUPABASE_ANON_KEY}
  - x-api-key: {your_api_key}

Tools to add:
1. browse_catalog → /chatbot-data?type=catalog&chatbot_id={id}
   ⭐ RECOMMENDED: Returns FULL catalog grouped by category. Best for AI to intelligently match products.
2. search_products → /chatbot-data?type=products&chatbot_id={id}&query={query}
   (Only use for exact product name/SKU search)
3. get_promotions → /chatbot-data?type=promotions&chatbot_id={id}
4. validate_promo → /chatbot-data?type=validate_promo&chatbot_id={id}&promo_code={code}
5. get_knowledge → /chatbot-data?type=knowledge&chatbot_id={id}
   (Returns all files with download URLs + all chunks)`}
                  </pre>
                </div>
              </div>

              {/* Workflow Template Download */}
              <div className="border-t pt-4 mt-4">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-900 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="font-medium flex items-center gap-2">
                        <Download className="w-4 h-4 text-purple-600" />
                        Ready-to-Use n8n Workflow Template
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Download our pre-built workflow template and import it directly into n8n.
                        You only need to configure:
                      </p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        <li><code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">YOUR_PLATFORM_API_KEY</code> - Your API key from the Keys tab</li>
                        <li><code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">YOUR_WEBHOOK_PATH</code> - Your unique webhook path in n8n</li>
                        <li><code className="bg-white dark:bg-gray-800 px-1 rounded text-xs">Credentials</code> - OpenAI, Google Gemini, and Postgres credentials</li>
                      </ul>
                    </div>
                    <Button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = '/n8n-workflow-template.json';
                        link.download = 'avatarlab-n8n-workflow-template.json';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast({
                          title: 'Template Downloaded',
                          description: 'Import the JSON file into n8n and update the credentials'
                        });
                      }}
                      className="shrink-0"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for external integrations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name *</Label>
              <Input
                id="keyName"
                placeholder="e.g., n8n WhatsApp Integration"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Chatbot Scope</Label>
              <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chatbot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chatbots</SelectItem>
                  {avatars.map(avatar => (
                    <SelectItem key={avatar.id} value={avatar.id}>
                      {avatar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Restrict this key to a specific chatbot or allow access to all
              </p>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2">
                {[
                  { id: 'chat', label: 'Chat', description: 'Send messages to chatbot' },
                  { id: 'config', label: 'Config', description: 'Read chatbot configuration' },
                  { id: 'products', label: 'Products', description: 'Access product catalog' },
                  { id: 'promotions', label: 'Promotions', description: 'Access promotions & promo codes' },
                  { id: 'knowledge', label: 'Knowledge', description: 'Search knowledge base' }
                ].map(scope => (
                  <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, scope.id]);
                        } else {
                          setSelectedScopes(selectedScopes.filter(s => s !== scope.id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="text-sm font-medium">{scope.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">- {scope.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="What will this key be used for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={createAPIKey}>
              Create API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New API Key Dialog */}
      <Dialog open={showNewAPIKey} onOpenChange={setShowNewAPIKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created Successfully!</DialogTitle>
            <DialogDescription>
              Make sure to copy your API key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This is the only time you'll see this key. Store it securely!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={newAPIKey || ''}
                  readOnly
                  className="font-mono"
                />
                <Button
                  onClick={() => copyToClipboard(newAPIKey || '')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowNewAPIKey(false);
                setNewAPIKey(null);
                setIsCreateDialogOpen(false);
              }}
            >
              I've Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default APIKeysSection;
