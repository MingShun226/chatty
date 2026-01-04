import React, { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings2, MessageSquare } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WhatsAppSettingsProps {
  chatbotId: string
  currentDelimiter?: string | null
  currentWPM?: number
  onUpdate?: () => void
}

export function WhatsAppSettings({
  chatbotId,
  currentDelimiter = null,
  currentWPM = 200,
  onUpdate
}: WhatsAppSettingsProps) {
  const [delimiter, setDelimiter] = useState(currentDelimiter || '')
  const [wpm, setWPM] = useState(currentWPM)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('avatars')
        .update({
          whatsapp_message_delimiter: delimiter || null,
          whatsapp_typing_wpm: wpm
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

      {/* Message Delimiter */}
      <div className="space-y-2">
        <Label htmlFor="delimiter">Message Split Delimiter (Optional)</Label>
        <Input
          id="delimiter"
          type="text"
          value={delimiter}
          onChange={(e) => setDelimiter(e.target.value)}
          placeholder="Leave empty for auto-split (e.g., ||)"
        />
        <p className="text-xs text-muted-foreground">
          If your n8n AI agent returns a message with this delimiter (e.g., "||"),
          it will split into multiple messages at those points.
        </p>
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-xs text-green-800 font-medium">💡 How to use in your n8n workflow:</p>
          <p className="text-xs text-green-700 mt-1">
            Configure your AI to include "{delimiter || '||'}" where you want splits.
          </p>
          <p className="text-xs text-green-600 mt-1">
            Example: "First message {delimiter || '||'} Second message" → 2 messages
          </p>
        </div>
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
        <div className="p-3 bg-gray-50 border rounded-md space-y-1">
          <p className="text-xs font-medium">Reference speeds:</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">50-100 WPM:</span> Slow, thoughtful responses
          </p>
          <p className="text-xs text-green-600 font-medium">
            ⭐ <span className="font-semibold">200 WPM:</span> Average speed (recommended)
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">300-400 WPM:</span> Fast, efficient responses
          </p>
        </div>
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
