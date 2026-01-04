/**
 * WhatsApp Integration Page
 *
 * Main page for managing WhatsApp Business Account integrations
 *
 * Features:
 * - Display all connected WhatsApp numbers
 * - Connect new WhatsApp Business Accounts
 * - Manage connections (view, disconnect)
 * - Show integration status and stats
 * - Handle OAuth callback messages
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '@/components/dashboard/Sidebar'
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { MessageCircle, Plus, Loader2, Phone } from 'lucide-react'
import { WhatsAppConnectionModal } from '@/components/whatsapp/WhatsAppConnectionModal'
import { WhatsAppConnectionCard } from '@/components/whatsapp/WhatsAppConnectionCard'
import { getConnections, WhatsAppConnection } from '@/services/whatsappService'
import { useAuth } from '@/hooks/useAuth'
import { useSidebar } from '@/contexts/SidebarContext'

// Separate component to handle connections UI
const WhatsAppConnectionsContent = ({ chatbot }: { chatbot: any }) => {
  const { toast } = useToast()
  const [connections, setConnections] = useState<WhatsAppConnection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)

  // Load connections when chatbot changes
  useEffect(() => {
    if (chatbot?.id) {
      loadConnections(chatbot.id)
    }
  }, [chatbot?.id])

  const loadConnections = async (chatbotId: string) => {
    setIsLoading(true)

    try {
      const data = await getConnections(chatbotId)
      setConnections(data)
    } catch (error: any) {
      console.error('Error loading connections:', error)
      toast({
        title: 'Error loading connections',
        description: error.message || 'Failed to load WhatsApp connections',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectionSuccess = () => {
    setShowConnectionModal(false)
    loadConnections(chatbot.id)
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 dark:bg-green-900/50 p-3">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-xl">WhatsApp Business Integration</CardTitle>
              <CardDescription className="text-base">
                Connect your WhatsApp Business Account to enable chatbot messaging
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && connections.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6">
                <Phone className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">No WhatsApp Connections</CardTitle>
            <CardDescription className="text-base max-w-md mx-auto">
              Connect your WhatsApp Business Account to start receiving and sending messages
              through your chatbot
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button
              onClick={() => setShowConnectionModal(true)}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="mr-2 h-5 w-5" />
              Connect WhatsApp Business Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connections List */}
      {!isLoading && connections.length > 0 && (
        <>
          {/* Add Connection Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setShowConnectionModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Another Number
            </Button>
          </div>

          {/* Connections Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {connections.map((connection) => (
              <WhatsAppConnectionCard
                key={connection.id}
                connection={connection}
                onDisconnect={() => loadConnections(chatbot.id)}
              />
            ))}
          </div>

          {/* Information Cards */}
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {connections.filter(c => c.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  WhatsApp numbers connected
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Free Tier Limit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">1,000</div>
                <p className="text-xs text-muted-foreground mt-1">
                  conversations per month (Meta)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">&lt;1s</div>
                <p className="text-xs text-muted-foreground mt-1">
                  average chatbot response
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Help Section */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
            <CardHeader>
              <CardTitle className="text-lg">Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white dark:bg-gray-800 p-2">
                  <span className="text-sm font-bold text-blue-600">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Test your chatbot</p>
                  <p className="text-sm text-muted-foreground">
                    Send a message to your WhatsApp number and see the chatbot respond
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white dark:bg-gray-800 p-2">
                  <span className="text-sm font-bold text-blue-600">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Create message templates</p>
                  <p className="text-sm text-muted-foreground">
                    Set up pre-approved templates for broadcasts and notifications
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white dark:bg-gray-800 p-2">
                  <span className="text-sm font-bold text-blue-600">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Sync your product catalog</p>
                  <p className="text-sm text-muted-foreground">
                    Display your products directly in WhatsApp for easy browsing
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Connection Modal */}
      <WhatsAppConnectionModal
        open={showConnectionModal}
        onOpenChange={setShowConnectionModal}
        chatbotId={chatbot.id}
        onConnectionSuccess={handleConnectionSuccess}
      />
    </div>
  )
}

const WhatsAppIntegration = () => {
  const [activeSection, setActiveSection] = useState('chatbot-whatsapp')
  const { signOut } = useAuth()
  const { isCollapsed } = useSidebar()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

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

  // Handle OAuth callback messages
  useEffect(() => {
    const oauthStatus = searchParams.get('whatsapp_oauth')
    const message = searchParams.get('message')

    if (oauthStatus && message) {
      if (oauthStatus === 'success') {
        toast({
          title: 'WhatsApp connected!',
          description: decodeURIComponent(message)
        })
      } else if (oauthStatus === 'error') {
        toast({
          title: 'Connection failed',
          description: decodeURIComponent(message),
          variant: 'destructive'
        })
      }

      // Clear OAuth params from URL
      searchParams.delete('whatsapp_oauth')
      searchParams.delete('message')
      setSearchParams(searchParams)
    }
  }, [searchParams])

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
            {(chatbot) => (
              <WhatsAppConnectionsContent chatbot={chatbot} />
            )}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  )
}

export default WhatsAppIntegration
