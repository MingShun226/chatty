/**
 * n8n Configuration Card
 *
 * Allows admins/technical users to configure n8n webhook for a chatbot.
 * Part of SaaS multi-tenant setup - each chatbot gets its own workflow.
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import {
  Workflow,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Trash2,
  Loader2,
  Info,
  Download,
  Key
} from 'lucide-react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'

interface N8nConfigurationCardProps {
  chatbot: any
  onUpdate: () => void
}

export function N8nConfigurationCard({ chatbot, onUpdate }: N8nConfigurationCardProps) {
  const { toast } = useToast()
  const [webhookUrl, setWebhookUrl] = useState(chatbot?.n8n_webhook_url || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const isConfigured = chatbot?.n8n_enabled && chatbot?.n8n_webhook_url

  const handleSave = async () => {
    if (!webhookUrl.trim()) {
      toast({
        title: 'Webhook URL required',
        description: 'Please enter a valid n8n webhook URL',
        variant: 'destructive'
      })
      return
    }

    // Validate URL format
    try {
      new URL(webhookUrl)
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid webhook URL',
        variant: 'destructive'
      })
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('avatars')
        .update({
          n8n_webhook_url: webhookUrl.trim(),
          n8n_enabled: true,
          n8n_configured_at: new Date().toISOString()
        })
        .eq('id', chatbot.id)

      if (error) throw error

      toast({
        title: 'n8n configured',
        description: 'Webhook URL saved successfully. Chatbot will now use n8n for AI responses.'
      })

      onUpdate()
    } catch (error: any) {
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    setIsRemoving(true)

    try {
      const { error } = await supabase
        .from('avatars')
        .update({
          n8n_webhook_url: null,
          n8n_enabled: false
        })
        .eq('id', chatbot.id)

      if (error) throw error

      toast({
        title: 'n8n removed',
        description: 'Chatbot will now use default edge function for responses.'
      })

      setWebhookUrl('')
      onUpdate()
    } catch (error: any) {
      toast({
        title: 'Failed to remove',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsRemoving(false)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Test message from AvatarLab',
          from_number: 'test@test.com',
          chatbot: {
            id: chatbot.id,
            name: chatbot.name
          },
          products: [],
          knowledge_base: [],
          conversation_history: []
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      toast({
        title: 'Test successful',
        description: `n8n responded: ${result.reply || result.response || result.message || 'OK'}`
      })
    } catch (error: any) {
      toast({
        title: 'Test failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const copyWebhookExample = () => {
    const example = `https://your-n8n.com/webhook/chatbot-${chatbot.id}`
    navigator.clipboard.writeText(example)
    toast({
      title: 'Copied to clipboard',
      description: 'Example webhook URL copied'
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-purple-600" />
            <CardTitle>n8n Integration</CardTitle>
          </div>
          {isConfigured && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect this chatbot to an n8n workflow for advanced AI agent capabilities
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Multi-Tenant Setup</AlertTitle>
          <AlertDescription>
            Each chatbot can have its own n8n workflow. Create a workflow in your hosted n8n instance,
            then paste the webhook URL below.
          </AlertDescription>
        </Alert>

        {/* Current Status */}
        {isConfigured && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Webhook URL:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(chatbot.n8n_webhook_url)
                    toast({ title: 'Copied!', description: 'Webhook URL copied to clipboard' })
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <code className="block text-xs bg-white p-2 rounded border break-all">
                {chatbot.n8n_webhook_url}
              </code>
              {chatbot.n8n_configured_at && (
                <p className="text-xs text-gray-500">
                  Configured: {new Date(chatbot.n8n_configured_at).toLocaleString()}
                </p>
              )}
              {chatbot.n8n_last_used_at && (
                <p className="text-xs text-gray-500">
                  Last used: {new Date(chatbot.n8n_last_used_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Configuration Form */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">n8n Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://your-n8n.com/webhook/chatbot-123"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyWebhookExample}
                title="Copy example URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste the webhook URL from your n8n workflow
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !webhookUrl.trim()}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isConfigured ? 'Update' : 'Save & Enable'}
                </>
              )}
            </Button>

            {webhookUrl.trim() && (
              <Button
                onClick={handleTest}
                disabled={isTesting}
                variant="outline"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Test
                  </>
                )}
              </Button>
            )}

            {isConfigured && (
              <Button
                onClick={handleRemove}
                disabled={isRemoving}
                variant="outline"
                className="text-destructive hover:text-destructive"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Help Text */}
        <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <Info className="h-4 w-4" />
          <AlertTitle>Need help setting up n8n?</AlertTitle>
          <AlertDescription className="text-sm space-y-3">
            <p>
              Download our ready-to-use workflow template and import it into n8n.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-white dark:bg-gray-800"
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
              >
                <Download className="h-4 w-4 mr-1" />
                Download Template
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white dark:bg-gray-800"
                onClick={() => window.location.href = '/api-keys'}
              >
                <Key className="h-4 w-4 mr-1" />
                Get API Keys
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              You'll need to configure: API keys, webhook path, and credentials (OpenAI, Postgres)
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
