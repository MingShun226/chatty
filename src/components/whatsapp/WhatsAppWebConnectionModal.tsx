/**
 * WhatsApp Web Connection Modal
 *
 * Allows users to connect WhatsApp using QR code scanning (unofficial method).
 * This uses WhatsApp Web protocol instead of official Meta API.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { X, QrCode, CheckCircle, AlertCircle } from 'lucide-react'

interface WhatsAppWebConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  chatbotId: string
  chatbotName: string
}

interface WhatsAppSession {
  id: string
  session_id: string
  status: 'pending' | 'qr_ready' | 'connecting' | 'connected' | 'disconnected' | 'failed'
  qr_code: string | null
  qr_expires_at: string | null
  phone_number: string | null
  connected_at: string | null
  disconnect_reason: string | null
}

const WHATSAPP_SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3001'

export function WhatsAppWebConnectionModal({
  isOpen,
  onClose,
  chatbotId,
  chatbotName
}: WhatsAppWebConnectionModalProps) {
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<WhatsAppSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Poll for session updates
  useEffect(() => {
    if (!isOpen || !session) return

    const pollInterval = setInterval(async () => {
      await fetchSessionStatus()
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [isOpen, session?.session_id])

  /**
   * Fetch current session status from database
   */
  const fetchSessionStatus = async () => {
    if (!session?.session_id) return

    try {
      const { data, error } = await supabase
        .from('whatsapp_web_sessions')
        .select('*')
        .eq('session_id', session.session_id)
        .single()

      if (error) {
        console.error('Error fetching session:', error)
        return
      }

      if (data) {
        setSession(data)

        // If connected, show success and close after 2 seconds
        if (data.status === 'connected' && session.status !== 'connected') {
          setTimeout(() => {
            onClose()
          }, 2000)
        }
      }
    } catch (err) {
      console.error('Error fetching session status:', err)
    }
  }

  /**
   * Check for existing active session
   */
  const checkExistingSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('whatsapp_web_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('chatbot_id', chatbotId)
        .in('status', ['connected', 'qr_ready', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error checking existing session:', error)
        return
      }

      if (data) {
        setSession(data)
      }
    } catch (err) {
      console.error('Error checking existing session:', err)
    }
  }

  // Check for existing session on open
  useEffect(() => {
    if (isOpen) {
      checkExistingSession()
    } else {
      setSession(null)
      setError(null)
    }
  }, [isOpen])

  /**
   * Start new WhatsApp Web session
   */
  const handleStartConnection = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Call WhatsApp service to create session
      const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          chatbotId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create session')
      }

      const { sessionId } = await response.json()

      // Wait a moment then fetch session
      setTimeout(async () => {
        const { data, error } = await supabase
          .from('whatsapp_web_sessions')
          .select('*')
          .eq('session_id', sessionId)
          .single()

        if (error) {
          setError(error.message)
        } else if (data) {
          setSession(data)
        }
      }, 1000)
    } catch (err: any) {
      console.error('Error starting connection:', err)
      setError(err.message || 'Failed to start WhatsApp connection')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Disconnect WhatsApp session
   */
  const handleDisconnect = async () => {
    if (!session) return

    setLoading(true)

    try {
      const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/sessions/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: session.session_id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to disconnect')
      }

      // Update local state
      setSession(null)
      onClose()
    } catch (err: any) {
      console.error('Error disconnecting:', err)
      setError(err.message || 'Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Connect WhatsApp
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Connected Status */}
          {session?.status === 'connected' && (
            <div className="text-center">
              <div className="mb-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Connected!
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                WhatsApp connected: {session.phone_number}
              </p>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* QR Code Display */}
          {session?.status === 'qr_ready' && session.qr_code && (
            <div className="text-center">
              <div className="mb-4">
                <QrCode className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Scan QR Code
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  1. Open WhatsApp on your phone<br />
                  2. Go to Settings → Linked Devices<br />
                  3. Tap "Link a Device"<br />
                  4. Scan this QR code
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                <img
                  src={session.qr_code}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                />
              </div>

              <p className="text-xs text-gray-500 mt-4">
                QR code expires in 60 seconds. If it expires, close and reopen this dialog.
              </p>
            </div>
          )}

          {/* Loading/Pending State */}
          {(session?.status === 'pending' || session?.status === 'connecting' || loading) && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {session?.status === 'connecting' ? 'Connecting...' : 'Generating QR code...'}
              </p>
            </div>
          )}

          {/* Failed State */}
          {session?.status === 'failed' && (
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Connection Failed
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {session.disconnect_reason || 'Failed to connect to WhatsApp'}
              </p>
              <button
                onClick={handleStartConnection}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* No Session - Start Connection */}
          {!session && !loading && (
            <div className="text-center">
              <div className="mb-6">
                <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Connect {chatbotName} to WhatsApp
                </h3>
                <p className="text-sm text-gray-600">
                  Scan a QR code with your phone to connect your WhatsApp account.
                  This allows your chatbot to send and receive messages.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> This is an unofficial WhatsApp integration.
                  Your account may be banned by WhatsApp if detected. Use at your own risk.
                </p>
              </div>

              <button
                onClick={handleStartConnection}
                disabled={loading}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                Start Connection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
