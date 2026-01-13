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
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertCircle, BookOpen, Code, Zap } from 'lucide-react';
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
              Use these API keys to connect your avatars with external services like n8n, Make, or custom applications.
              Keys are scoped to specific permissions and can be restricted to individual avatars.
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
                  <TableHead>Avatar</TableHead>
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
                      {key.avatar_name || 'All Avatars'}
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                API Endpoints
              </CardTitle>
              <CardDescription>
                Your API base URL: <code className="bg-muted px-2 py-1 rounded">https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chat Endpoint */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge>POST</Badge>
                  <code className="text-sm">/avatar-chat</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send a message to an avatar and get a response. Includes RAG knowledge base, memories, and trained prompt versions.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Example Request:</p>
                  <pre className="text-xs overflow-x-auto">
{`curl -X POST https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/avatar-chat \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHJ0cWRnZ2hhbndkdWp5aGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NjE1MzEsImV4cCI6MjA3NDUzNzUzMX0.sniz2dGyadAa3BvZJ2Omi6thtVWuqMjTFFdM1H_zWAA" \\
  -H "x-api-key: pk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "avatar_id": "your-avatar-uuid",
    "message": "Hello!",
    "model": "gpt-4o-mini"
  }'`}
                  </pre>
                </div>
              </div>

              {/* Chatbot Data API - Products */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GET</Badge>
                  <code className="text-sm">/chatbot-data?type=products</code>
                  <Badge variant="secondary" className="text-xs">NEW</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Search or list products for a chatbot. Use this when customer asks about products.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Parameters:</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li><code>chatbot_id</code> - Required. The chatbot UUID</li>
                    <li><code>query</code> - Optional. Search term for product name/category/SKU</li>
                    <li><code>category</code> - Optional. Filter by category</li>
                    <li><code>limit</code> - Optional. Max results (default: 20)</li>
                  </ul>
                  <pre className="text-xs overflow-x-auto mt-2">
{`curl "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data?type=products&chatbot_id=YOUR_ID&query=phone" \\
  -H "Authorization: Bearer {anon_key}" \\
  -H "x-api-key: pk_live_YOUR_KEY"`}
                  </pre>
                </div>
              </div>

              {/* Chatbot Data API - Promotions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GET</Badge>
                  <code className="text-sm">/chatbot-data?type=promotions</code>
                  <Badge variant="secondary" className="text-xs">NEW</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get active promotions. Use this when customer asks about sales, discounts, or promo codes.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <pre className="text-xs overflow-x-auto">
{`curl "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data?type=promotions&chatbot_id=YOUR_ID" \\
  -H "Authorization: Bearer {anon_key}" \\
  -H "x-api-key: pk_live_YOUR_KEY"`}
                  </pre>
                </div>
              </div>

              {/* Chatbot Data API - Validate Promo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GET</Badge>
                  <code className="text-sm">/chatbot-data?type=validate_promo</code>
                  <Badge variant="secondary" className="text-xs">NEW</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Validate a specific promo code. Use when customer provides a code.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <pre className="text-xs overflow-x-auto">
{`curl "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data?type=validate_promo&chatbot_id=YOUR_ID&promo_code=CNY2024" \\
  -H "Authorization: Bearer {anon_key}" \\
  -H "x-api-key: pk_live_YOUR_KEY"`}
                  </pre>
                </div>
              </div>

              {/* Chatbot Data API - Knowledge */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GET</Badge>
                  <code className="text-sm">/chatbot-data?type=knowledge</code>
                  <Badge variant="secondary" className="text-xs">NEW</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Search the knowledge base. Uses vector search for semantic matching.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <pre className="text-xs overflow-x-auto">
{`curl "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/chatbot-data?type=knowledge&chatbot_id=YOUR_ID&query=return policy" \\
  -H "Authorization: Bearer {anon_key}" \\
  -H "x-api-key: pk_live_YOUR_KEY"`}
                  </pre>
                </div>
              </div>

              {/* Config Endpoint */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GET</Badge>
                  <code className="text-sm">/avatar-config</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get full avatar configuration including active prompt, ALL knowledge base chunks, and ALL memories with images.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Example Request:</p>
                  <pre className="text-xs overflow-x-auto">
{`curl "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/avatar-config?avatar_id=YOUR_AVATAR_ID" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHJ0cWRnZ2hhbndkdWp5aGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NjE1MzEsImV4cCI6MjA3NDUzNzUzMX0.sniz2dGyadAa3BvZJ2Omi6thtVWuqMjTFFdM1H_zWAA" \\
  -H "x-api-key: pk_live_YOUR_KEY"`}
                  </pre>
                </div>
              </div>

              {/* Get Conversation Endpoint */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GET</Badge>
                  <code className="text-sm">/avatar-conversations</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get conversation history for a specific phone number with this avatar.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Example Request:</p>
                  <pre className="text-xs overflow-x-auto">
{`curl "https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/avatar-conversations?avatar_id=YOUR_AVATAR_ID&phone_number=%2B60123456789" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHJ0cWRnZ2hhbndkdWp5aGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NjE1MzEsImV4cCI6MjA3NDUzNzUzMX0.sniz2dGyadAa3BvZJ2Omi6thtVWuqMjTFFdM1H_zWAA" \\
  -H "x-api-key: pk_live_YOUR_KEY"`}
                  </pre>
                </div>
              </div>

              {/* Save Conversation Endpoint */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge>POST</Badge>
                  <code className="text-sm">/avatar-conversations</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Save updated conversation transcript after each message exchange.
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Example Request:</p>
                  <pre className="text-xs overflow-x-auto">
{`curl -X POST https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/avatar-conversations \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHJ0cWRnZ2hhbndkdWp5aGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NjE1MzEsImV4cCI6MjA3NDUzNzUzMX0.sniz2dGyadAa3BvZJ2Omi6thtVWuqMjTFFdM1H_zWAA" \\
  -H "x-api-key: pk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "avatar_id": "your-avatar-uuid",
    "phone_number": "+60123456789",
    "conversation_content": "user: hey | assistant: hello || user: how are you | assistant: great!"
  }'`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All API requests require 3 headers (2 for authentication + 1 for content type):
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <code className="text-xs block">Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Supabase anon key)</code>
                <code className="text-xs block">x-api-key: pk_live_your_api_key_here (AvatarLab API key)</code>
                <code className="text-xs block">Content-Type: application/json</code>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Keep your API keys secret! Never commit them to version control or share them publicly. Get your Supabase anon key from Supabase Dashboard → Settings → API.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* n8n Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                n8n Integration Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">Step 1: Set up HTTP Request node</p>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Method: POST</li>
                  <li>URL: <code className="bg-muted px-1">https://xatrtqdgghanwdujyhkq.supabase.co/functions/v1/avatar-chat</code></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Step 2: Add Headers (3 required)</p>
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <code className="text-xs block">Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</code>
                  <code className="text-xs block">x-api-key: YOUR_API_KEY</code>
                  <code className="text-xs block">Content-Type: application/json</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Authorization header uses your Supabase anon key (from Supabase Dashboard → Settings → API)
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Step 3: Configure Request Body</p>
                <div className="bg-muted p-3 rounded-lg">
                  <pre className="text-xs overflow-x-auto">
{`{
  "avatar_id": "your-avatar-uuid",
  "message": "{{ $json.message }}",
  "conversation_history": []
}`}
                  </pre>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Step 4: Connect to WhatsApp/Telegram</p>
                <p className="text-sm text-muted-foreground">
                  Use n8n's WhatsApp or Telegram trigger nodes to receive messages, then connect to this HTTP node to get avatar responses.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Response Format */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Response Format
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Successful response example:</p>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs overflow-x-auto">
{`{
  "success": true,
  "avatar_id": "uuid-here",
  "message": "Hi! I'm Sarah...",
  "metadata": {
    "model": "gpt-4o-mini",
    "knowledge_chunks_used": 3,
    "memories_accessed": 5
  }
}`}
                </pre>
              </div>

              <p className="text-sm font-medium mt-4">Error response example:</p>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs overflow-x-auto">
{`{
  "error": "Invalid or inactive API key"
}`}
                </pre>
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
              <Label htmlFor="avatar">Avatar Scope</Label>
              <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                <SelectTrigger>
                  <SelectValue placeholder="Select avatar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Avatars</SelectItem>
                  {avatars.map(avatar => (
                    <SelectItem key={avatar.id} value={avatar.id}>
                      {avatar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Restrict this key to a specific avatar or allow access to all
              </p>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2">
                {[
                  { id: 'chat', label: 'Chat', description: 'Send messages to avatar' },
                  { id: 'config', label: 'Config', description: 'Read avatar configuration' },
                  { id: 'products', label: 'Products', description: 'Access product catalog' },
                  { id: 'promotions', label: 'Promotions', description: 'Access promotions & promo codes' },
                  { id: 'knowledge', label: 'Knowledge', description: 'Search knowledge base' },
                  { id: 'memories', label: 'Memories', description: 'Access avatar memories' }
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
