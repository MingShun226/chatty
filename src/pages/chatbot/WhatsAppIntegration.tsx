/**
 * WhatsApp Integration Page
 *
 * Page for managing WhatsApp Web (unofficial) integration
 *
 * Features:
 * - Connect WhatsApp via QR code scan
 * - Configure message splitting and typing speed
 * - Configure n8n webhook integration
 */

import { useState, useEffect } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useSidebar } from '@/contexts/SidebarContext'
import { supabase } from '@/integrations/supabase/client'
import { MessageCircle, Settings2 } from 'lucide-react'
import { WhatsAppWebConnectionModal } from '@/components/whatsapp/WhatsAppWebConnectionModal'
import { WhatsAppSettings } from '@/components/chatbot-settings/WhatsAppSettings'
import { N8nConfigurationCard } from '@/components/n8n/N8nConfigurationCard'

// WhatsApp content component
const WhatsAppIntegrationContent = ({ chatbot, onRefresh }: { chatbot: any; onRefresh: () => void }) => {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsappSession, setWhatsappSession] = useState<any>(null)

  useEffect(() => {
    if (chatbot?.id) {
      fetchWhatsAppSession()
    }
  }, [chatbot])

  const fetchWhatsAppSession = async () => {
    if (!chatbot?.id) return

    try {
      const { data, error } = await supabase
        .from('whatsapp_web_sessions')
        .select('*')
        .eq('chatbot_id', chatbot.id)
        .eq('status', 'connected')
        .maybeSingle()

      if (!error && data) {
        setWhatsappSession(data)
      } else {
        setWhatsappSession(null)
      }
    } catch (err) {
      console.error('Error fetching WhatsApp session:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* WhatsApp Web Connection Section */}
      <Card className="p-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Web Connection
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your WhatsApp account via QR code scan (unofficial method)
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          {whatsappSession ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">WhatsApp Connected</p>
                    <p className="text-sm text-gray-600">
                      {whatsappSession.phone_number || 'Phone number connected'}
                    </p>
                    {whatsappSession.connected_at && (
                      <p className="text-xs text-gray-500">
                        Connected {new Date(whatsappSession.connected_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setShowWhatsAppModal(true)}
                  variant="outline"
                  size="sm"
                >
                  Manage
                </Button>
              </div>
              <div className="bg-green-100 border border-green-300 rounded-md p-3">
                <p className="text-sm text-green-800">
                  ✓ Your chatbot is now receiving WhatsApp messages and can reply automatically!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">WhatsApp Not Connected</p>
                  <p className="text-sm text-gray-600">
                    Connect your WhatsApp to enable messaging
                  </p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> This is an unofficial integration using QR code authentication.
                  Your account may be banned by WhatsApp if detected. Use at your own risk.
                </p>
              </div>
              <Button
                onClick={() => setShowWhatsAppModal(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Connect WhatsApp
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* WhatsApp Message Settings */}
      <Card className="p-6">
        {whatsappSession ? (
          <WhatsAppSettings
            chatbotId={chatbot.id}
            currentDelimiter={chatbot.whatsapp_message_delimiter}
            currentWPM={chatbot.whatsapp_typing_wpm}
            onUpdate={onRefresh}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
                <Settings2 className="h-5 w-5 text-gray-400" />
                WhatsApp Message Settings
              </h3>
              <p className="text-sm text-muted-foreground">
                Customize how messages are split and the typing indicator speed
              </p>
            </div>
            <div className="p-6 bg-gray-50 border-2 border-dashed rounded-lg text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                Connect WhatsApp First
              </p>
              <p className="text-xs text-gray-500">
                You need to connect your WhatsApp account before you can customize message settings
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* n8n Integration */}
      <N8nConfigurationCard chatbot={chatbot} onUpdate={onRefresh} />

      {/* WhatsApp Connection Modal */}
      <WhatsAppWebConnectionModal
        isOpen={showWhatsAppModal}
        onClose={() => {
          setShowWhatsAppModal(false)
          fetchWhatsAppSession()
        }}
        chatbotId={chatbot.id}
        chatbotName={chatbot.name}
      />
    </div>
  )
}

const WhatsAppIntegration = () => {
  const [activeSection, setActiveSection] = useState('chatbot-whatsapp')
  const { signOut } = useAuth()
  const { isCollapsed } = useSidebar()

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
      />

      <main className={`${isCollapsed ? 'ml-16' : 'ml-56'} overflow-auto transition-all duration-300`}>
        <div className="p-8 max-w-7xl mx-auto">
          <ChatbotPageLayout title="WhatsApp Integration">
            {(chatbot, isTraining, onRefresh) => (
              <WhatsAppIntegrationContent chatbot={chatbot} onRefresh={onRefresh} />
            )}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  )
}

export default WhatsAppIntegration
