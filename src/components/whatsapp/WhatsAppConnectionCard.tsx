/**
 * WhatsApp Connection Card
 *
 * Displays a connected WhatsApp Business Account with details
 *
 * Features:
 * - Phone number and display name
 * - Quality rating badge (GREEN, YELLOW, RED)
 * - Messaging tier (TIER_50, TIER_1K, etc.)
 * - Last sync timestamp
 * - Disconnect button
 * - Quick stats
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Phone,
  Signal,
  Calendar,
  MessageCircle,
  TrendingUp,
  Settings,
  Unplug,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { WhatsAppConnection } from '@/services/whatsappService'
import { disconnectConnection, getConnectionStats } from '@/services/whatsappService'
import { useEffect } from 'react'

interface WhatsAppConnectionCardProps {
  connection: WhatsAppConnection
  onDisconnect?: () => void
}

export function WhatsAppConnectionCard({ connection, onDisconnect }: WhatsAppConnectionCardProps) {
  const { toast } = useToast()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [stats, setStats] = useState<any>(null)

  // Load stats on mount
  useEffect(() => {
    loadStats()
  }, [connection.id])

  const loadStats = async () => {
    try {
      const statsData = await getConnectionStats(connection.id)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)

    try {
      await disconnectConnection(connection.id)

      toast({
        title: 'WhatsApp disconnected',
        description: `${connection.phone_number} has been disconnected successfully`
      })

      if (onDisconnect) {
        onDisconnect()
      }
    } catch (error: any) {
      toast({
        title: 'Disconnect failed',
        description: error.message || 'Failed to disconnect WhatsApp',
        variant: 'destructive'
      })
    } finally {
      setIsDisconnecting(false)
    }
  }

  // Get quality rating badge color
  const getQualityColor = (rating?: string) => {
    switch (rating) {
      case 'GREEN':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'YELLOW':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'RED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  // Get quality rating icon
  const getQualityIcon = (rating?: string) => {
    switch (rating) {
      case 'GREEN':
        return <CheckCircle2 className="h-3 w-3" />
      case 'YELLOW':
        return <AlertTriangle className="h-3 w-3" />
      case 'RED':
        return <AlertCircle className="h-3 w-3" />
      default:
        return <Signal className="h-3 w-3" />
    }
  }

  // Get messaging tier display
  const getMessagingTierDisplay = (tier?: string) => {
    if (!tier) return 'Unknown'

    // TIER_50 = 50 conversations per 24 hours
    // TIER_250 = 250 conversations per 24 hours
    // etc.
    const match = tier.match(/TIER_(\d+)/)
    if (match) {
      const limit = match[1]
      return limit === 'UNLIMITED' ? 'Unlimited' : `${limit}/day`
    }

    return tier
  }

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-green-600" />
              {connection.display_name || connection.phone_number}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <CardDescription className="font-mono">{connection.phone_number}</CardDescription>
              {connection.is_verified && (
                <Badge variant="outline" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                  Verified
                </Badge>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <Badge
            variant={connection.status === 'active' ? 'default' : 'secondary'}
            className={connection.status === 'active' ? 'bg-green-600' : ''}
          >
            {connection.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quality & Tier Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <Signal className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Quality Rating</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="outline" className={getQualityColor(connection.quality_rating)}>
                  {getQualityIcon(connection.quality_rating)}
                  <span className="ml-1">{connection.quality_rating || 'Unknown'}</span>
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Messaging Tier</p>
              <p className="text-sm font-semibold mt-0.5">
                {getMessagingTierDisplay(connection.messaging_limit)}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats.totalMessages}
              </p>
              <p className="text-xs text-muted-foreground">messages</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Contacts</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats.totalContacts}
              </p>
              <p className="text-xs text-muted-foreground">unique</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Delivery</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats.deliveryRate}%
              </p>
              <p className="text-xs text-muted-foreground">rate</p>
            </div>
          </div>
        )}

        {/* Last Sync */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Last synced {formatDate(connection.last_sync_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1">
            <MessageCircle className="h-4 w-4 mr-2" />
            Messages
          </Button>

          <Button variant="outline" size="sm" className="flex-1">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>

          {/* Disconnect Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Unplug className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect WhatsApp?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to disconnect <strong>{connection.phone_number}</strong>?
                  <br /><br />
                  Your chatbot will stop receiving messages from this number. You can reconnect it later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
