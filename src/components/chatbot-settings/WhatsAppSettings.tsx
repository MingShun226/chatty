import React, { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WhatsAppSettingsProps {
  chatbotId: string
  currentDelimiter?: string | null
  currentWPM?: number
  currentEnableImages?: boolean
  currentBatchTimeout?: number
  onUpdate?: () => void
}

export function WhatsAppSettings({
  chatbotId,
  currentDelimiter = null,
  currentWPM = 200,
  currentEnableImages = true,
  currentBatchTimeout = 0,
  onUpdate
}: WhatsAppSettingsProps) {
  // Message splitting is enabled if delimiter is set (default to || when enabled)
  const [enableMessageSplit, setEnableMessageSplit] = useState(!!currentDelimiter)
  const [wpm, setWPM] = useState(currentWPM)
  const [enableImages, setEnableImages] = useState(currentEnableImages)
  const [batchTimeout, setBatchTimeout] = useState(currentBatchTimeout)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('avatars')
        .update({
          whatsapp_message_delimiter: enableMessageSplit ? '||' : null,
          whatsapp_typing_wpm: wpm,
          whatsapp_enable_images: enableImages,
          whatsapp_message_batch_timeout: batchTimeout
        })
        .eq('id', chatbotId)

      if (error) throw error

      toast({
        title: 'Settings saved',
        description: 'WhatsApp message settings updated successfully!',
      })
      onUpdate?.()
    } catch (error) {
      console.error('Error saving WhatsApp settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save WhatsApp settings',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Settings2 className="h-5 w-5 text-green-600" />
          WhatsApp Message Settings
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Customize how messages are split and the typing indicator speed
        </p>
      </div>

      {/* Message Splitting Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable-split">Message Splitting</Label>
            <p className="text-xs text-muted-foreground">
              Split long AI responses into multiple messages using <code className="bg-muted px-1 rounded">||</code> delimiter
            </p>
          </div>
          <Switch
            id="enable-split"
            checked={enableMessageSplit}
            onCheckedChange={setEnableMessageSplit}
          />
        </div>
        {enableMessageSplit && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-xs text-green-800 font-medium">How to use in your n8n workflow:</p>
            <p className="text-xs text-green-700 mt-1">
              Configure your AI to include <code className="bg-green-100 px-1 rounded">||</code> where you want splits.
            </p>
            <p className="text-xs text-green-600 mt-1">
              Example: "First message || Second message" → 2 separate messages
            </p>
          </div>
        )}
      </div>

      {/* Typing Speed (WPM) */}
      <div className="space-y-2">
        <Label htmlFor="wpm">Typing Speed (Words Per Minute)</Label>
        <div className="flex items-center space-x-4">
          <input
            id="wpm"
            type="range"
            min="50"
            max="400"
            step="10"
            value={wpm}
            onChange={(e) => setWPM(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm font-medium min-w-[80px] text-center px-3 py-1 bg-green-100 text-green-800 rounded">
            {wpm} WPM
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Slower (50)</span>
          <span className="font-medium text-green-600">Average (200)</span>
          <span>Faster (400)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Controls how long the "typing..." indicator shows before sending messages.
        </p>
      </div>

      {/* Image Sending */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable-images">Enable Image Sending</Label>
            <p className="text-xs text-muted-foreground">
              Allow chatbot to send product images from n8n responses
            </p>
          </div>
          <Switch
            id="enable-images"
            checked={enableImages}
            onCheckedChange={setEnableImages}
          />
        </div>
        {enableImages && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800 font-medium">How to send images from n8n:</p>
            <p className="text-xs text-blue-700 mt-1">
              Include an <code className="bg-blue-100 px-1 rounded">images</code> array in your n8n response
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Example: <code className="bg-blue-100 px-1 rounded">{`{"images": [{"url": "...", "caption": "Product"}]}`}</code>
            </p>
          </div>
        )}
      </div>

      {/* Message Batching */}
      <div className="space-y-2">
        <Label htmlFor="batch-timeout">Message Batching (Combine rapid messages)</Label>
        <div className="flex items-center space-x-4">
          <input
            id="batch-timeout"
            type="range"
            min="0"
            max="15"
            step="1"
            value={batchTimeout}
            onChange={(e) => setBatchTimeout(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm font-medium min-w-[80px] text-center px-3 py-1 bg-blue-100 text-blue-800 rounded">
            {batchTimeout === 0 ? 'OFF' : `${batchTimeout}s`}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Disabled (0)</span>
          <span className="font-medium text-blue-600">Recommended (5-10s)</span>
          <span>Max (15s)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Wait this many seconds to combine multiple user messages into one before sending to n8n.
        </p>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
      >
        {saving ? 'Saving...' : 'Save WhatsApp Settings'}
      </Button>
    </div>
  )
}
