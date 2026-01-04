/**
 * WhatsApp Connection Modal - Simplified Version
 *
 * User-friendly embedded OAuth flow for connecting WhatsApp
 *
 * Features:
 * - Embedded Meta login (no popup!)
 * - Auto-creates WhatsApp Business if needed
 * - Clear 3-step progress
 * - One-click reconnect for existing users
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { MessageCircle, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/integrations/supabase/client'

interface WhatsAppConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatbotId: string
  onConnectionSuccess?: () => void
}

// No longer needed in frontend - OAuth URL comes from backend API
// This keeps the Meta App ID secret (for SaaS platforms)

type ConnectionStep = 'start' | 'login' | 'connecting' | 'success'

export function WhatsAppConnectionModal({
  open,
  onOpenChange,
  chatbotId,
  onConnectionSuccess
}: WhatsAppConnectionModalProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState<ConnectionStep>('start')
  const [progress, setProgress] = useState(0)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setCurrentStep('start')
      setProgress(0)
    }
  }, [open])

  // Meta SDK not needed - we use server-side OAuth URL generation

  const handleQuickConnect = () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in to connect WhatsApp',
        variant: 'destructive'
      })
      return
    }

    if (!chatbotId) {
      toast({
        title: 'No chatbot selected',
        description: 'Please select a chatbot first',
        variant: 'destructive'
      })
      return
    }

    // Start the flow
    setCurrentStep('login')
    setProgress(33)
  }

  const handleMetaLogin = async () => {
    setCurrentStep('connecting')
    setProgress(66)

    try {
      // Call backend API to get OAuth URL (keeps Meta App ID secret)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-get-oauth-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ chatbotId })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get OAuth URL')
      }

      const { oauthUrl, configured } = await response.json()

      if (!configured) {
        toast({
          title: 'Setup Required',
          description: 'WhatsApp integration is not configured yet. Please contact support.',
          variant: 'destructive'
        })
        setCurrentStep('start')
        setProgress(0)
        return
      }

      console.log('Opening Meta OAuth:', oauthUrl)

      // Redirect to Meta OAuth (will redirect back after authorization)
      window.location.href = oauthUrl

    } catch (error: any) {
      console.error('Error initiating OAuth:', error)
      toast({
        title: 'Connection error',
        description: error.message || 'Failed to initiate WhatsApp connection',
        variant: 'destructive'
      })
      setCurrentStep('start')
      setProgress(0)
    }
  }

  const handleCancel = () => {
    setCurrentStep('start')
    setProgress(0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Quick Connect WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          {currentStep !== 'start' && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {currentStep === 'login' && 'Step 1 of 3: Login with Facebook'}
                {currentStep === 'connecting' && 'Step 2 of 3: Connecting to WhatsApp...'}
                {currentStep === 'success' && 'Step 3 of 3: Connected! ✅'}
              </p>
            </div>
          )}

          {/* Step 1: Start */}
          {currentStep === 'start' && (
            <div className="space-y-6">
              {/* Hero */}
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6">
                    <MessageCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold">Connect in 3 Simple Steps</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Connect your WhatsApp Business Account and start chatting with customers automatically
                </p>
              </div>

              {/* Steps Preview */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="rounded-full bg-green-600 text-white w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Login with Facebook</p>
                    <p className="text-xs text-muted-foreground">Use your Facebook account (takes 10 seconds)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="rounded-full bg-green-600 text-white w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Grant Permissions</p>
                    <p className="text-xs text-muted-foreground">Allow us to send/receive WhatsApp messages</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="rounded-full bg-green-600 text-white w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Done!</p>
                    <p className="text-xs text-muted-foreground">Start receiving messages immediately</p>
                  </div>
                </div>
              </div>

              {/* Main CTA */}
              <Button
                onClick={handleQuickConnect}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base"
                size="lg"
              >
                Connect WhatsApp Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              {/* Help Link */}
              <p className="text-xs text-center text-muted-foreground">
                Don't have a WhatsApp Business Account?{' '}
                <a
                  href="https://business.facebook.com/wa/manage/home/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  Create one free
                </a>
              </p>
            </div>
          )}

          {/* Step 2: Login */}
          {currentStep === 'login' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-6">
                    <CheckCircle2 className="h-12 w-12 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold">Login with Facebook</h3>
                <p className="text-sm text-muted-foreground">
                  Click below to login with your Facebook account
                </p>
              </div>

              {/* Embedded Login Area */}
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  You'll be redirected to Facebook to login securely
                </p>

                <Button
                  onClick={handleMetaLogin}
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                  size="lg"
                >
                  <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Continue with Facebook
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Connecting */}
          {currentStep === 'connecting' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <Loader2 className="h-12 w-12 text-green-600 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold">Connecting to WhatsApp...</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we set up your connection
                </p>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Authenticating with Meta</span>
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Getting your WhatsApp Business Account</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                  <span>Setting up webhook</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {currentStep === 'success' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold">Connected Successfully! 🎉</h3>
                <p className="text-sm text-muted-foreground">
                  Your WhatsApp is now connected and ready to receive messages
                </p>
              </div>

              <Button
                onClick={() => {
                  onOpenChange(false)
                  if (onConnectionSuccess) onConnectionSuccess()
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                Start Using WhatsApp
              </Button>
            </div>
          )}

          {/* Security Note */}
          {currentStep === 'start' && (
            <div className="text-xs text-center text-muted-foreground bg-muted/30 p-3 rounded-lg">
              🔒 <strong>Secure & Official:</strong> We use Meta's official WhatsApp Business Cloud API.
              Your credentials are encrypted and never stored on our servers.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
