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
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertCircle, BookOpen, Code, Zap, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

const APIKeysSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();

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
        .is('deleted_at', null) // Exclude soft-deleted chatbots
        .order('name');

      if (error) throw error;
      setAvatars(data || []);
    } catch (error: any) {
      console.error('Error loading avatars:', error);
    }
  };

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

      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="keys">API Keys Management</TabsTrigger>
          <TabsTrigger value="docs">API Documentation</TabsTrigger>
        </TabsList>

        {/* API Keys Management Tab */}
        <TabsContent value="keys" className="space-y-6">
          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Use these API keys to connect your chatbots with external services like n8n, Make, or custom applications.
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
                  {/* Products API */}
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
                      Search products by name, category, or SKU. Replace <code className="bg-muted px-1">YOUR_SEARCH_TERM</code> with the search query.
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
1. search_products → /chatbot-data?type=products&chatbot_id={id}&query={query}
2. get_promotions → /chatbot-data?type=promotions&chatbot_id={id}
3. validate_promo → /chatbot-data?type=validate_promo&chatbot_id={id}&promo_code={code}
4. get_knowledge → /chatbot-data?type=knowledge&chatbot_id={id}
   (Returns all files with download URLs + all chunks. AI searches through chunks locally.)`}
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
