import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/components/settings/UserProfile';
import ReferralSection from '@/components/settings/ReferralSection';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { apiKeyService, ApiKeyDisplay } from '@/services/apiKeyService';

const SettingsSection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newApiKey, setNewApiKey] = useState({ name: '', service: '', key: '' });
  const { toast } = useToast();

  // Fetch API keys from database
  const { data: apiKeys = [], isLoading: apiKeysLoading } = useQuery({
    queryKey: ['api-keys', user?.id],
    queryFn: () => apiKeyService.getUserApiKeys(user!.id),
    enabled: !!user?.id
  });

  // Fetch profile data for referral section
  const { data: profileData } = useQuery({
    queryKey: ['profile-referral', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code, referrer_id')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        throw error;
      }

      return data || { referral_code: '', referrer_id: null };
    },
    enabled: !!user?.id
  });

  const handleReferralUpdate = (data: { referrerCode: string }) => {
    // This will be handled by the ReferralSection component
    console.log('Referral updated:', data);
  };

  // Add API key mutation
  const addApiKeyMutation = useMutation({
    mutationFn: ({ name, service, key }: { name: string; service: string; key: string }) =>
      apiKeyService.addApiKey(user!.id, name, service, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', user?.id] });
      setNewApiKey({ name: '', service: '', key: '' });
      toast({
        title: "API Key Added",
        description: "Your API key has been successfully added.",
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

  const handleAddApiKey = () => {
    if (newApiKey.name && newApiKey.service && newApiKey.key) {
      addApiKeyMutation.mutate(newApiKey);
    }
  };

  // Delete API key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => apiKeyService.deleteApiKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', user?.id] });
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

  const handleDeleteApiKey = (id: string) => {
    deleteApiKeyMutation.mutate(id);
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and API configurations
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile Management</TabsTrigger>
          <TabsTrigger value="referral">Referral System</TabsTrigger>
          <TabsTrigger value="api">API Management</TabsTrigger>
        </TabsList>

        {/* Profile Management Tab */}
        <TabsContent value="profile" className="space-y-4">
          <UserProfile />
        </TabsContent>

        {/* Referral System Tab */}
        <TabsContent value="referral" className="space-y-4">
          {profileData && (
            <ReferralSection
              profileData={{
                referralCode: profileData.referral_code || '',
                referrerCode: profileData.referrer_id || ''
              }}
              onUpdate={handleReferralUpdate}
            />
          )}
        </TabsContent>

        {/* API Management Tab */}
        <TabsContent value="api" className="space-y-4">
          {/* Add New API Key */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5" />
                Add New API Key
              </CardTitle>
              <CardDescription>
                Configure API keys for AI services. Add your OpenAI key for GPT and DALL-E. Add your KIE.AI key for image/video/music generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., OpenAI GPT-4"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey({...newApiKey, name: e.target.value})}
                    className="input-modern"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="service">Service</Label>
                  <Select value={newApiKey.service} onValueChange={(value) => setNewApiKey({...newApiKey, service: value})}>
                    <SelectTrigger className="input-modern">
                      <SelectValue placeholder="Select a service..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI (GPT, DALL-E, Whisper)</SelectItem>
                      <SelectItem value="kie-ai">KIE.AI (Images, Videos, Music)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={newApiKey.key}
                    onChange={(e) => setNewApiKey({...newApiKey, key: e.target.value})}
                    className="input-modern"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleAddApiKey}
                disabled={addApiKeyMutation.isPending || !newApiKey.name || !newApiKey.service || !newApiKey.key}
                className="btn-hero"
              >
                {addApiKeyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                {addApiKeyMutation.isPending ? 'Adding...' : 'Add API Key'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing API Keys */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5" />
                Your API Keys
              </CardTitle>
              <CardDescription>
                Manage your existing API keys and their usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading API keys...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No API keys configured yet. Add one above to get started.
                    </div>
                  ) : (
                    apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{apiKey.name}</span>
                        <Badge 
                          variant={apiKey.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {apiKey.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{apiKey.service}</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {showKeys[apiKey.id] ? apiKey.key.replace('••••••••••••••••••••••••••••••••••••••••••••••••', 'ACTUAL_KEY_HERE') : apiKey.key}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                        >
                          {showKeys[apiKey.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Last used: {apiKey.lastUsed}</p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteApiKey(apiKey.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsSection;
