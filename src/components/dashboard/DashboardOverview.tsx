import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot,
  Users,
  Clock,
  Image,
  Video,
  Package,
  FileText,
  ArrowRight,
  Plus,
  Crown,
  Activity,
  MoreHorizontal,
  MessageCircle,
  CheckCircle2,
  Clock3,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardOverviewProps {
  userProfile?: any;
  onSectionChange: (section: string) => void;
}

interface DashboardStats {
  totalContacts: number;
  pendingFollowups: number;
  totalImages: number;
  totalVideos: number;
  totalProducts: number;
  totalKnowledgeFiles: number;
  planName: string;
  chatbotsUsed: number;
  chatbotsLimit: number;
}

interface Chatbot {
  id: string;
  name: string;
  company_name: string | null;
  industry: string | null;
  created_at: string;
  contactCount: number;
  whatsappConnected: boolean;
  activation_status: 'pending' | 'active' | 'suspended';
  n8n_webhook_url: string | null;
}

interface RecentConversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  last_message: string;
  last_message_at: string;
  sentiment: string | null;
  chatbot_name: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  userProfile,
  onSectionChange
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get user's chatbots first
      const { data: userChatbots } = await supabase
        .from('avatars')
        .select('id, name, company_name, industry, created_at, activation_status, n8n_webhook_url')
        .eq('user_id', user?.id)
        .eq('status', 'active') // Only show active chatbots (matches RLS policy)
        .order('created_at', { ascending: false });

      // Fetch all stats in parallel
      const [
        contactsResult,
        followupsResult,
        imagesResult,
        videosResult,
        productsResult,
        knowledgeResult,
        planResult,
        recentChatsResult
      ] = await Promise.all([
        // Total contacts
        supabase
          .from('contact_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user?.id),

        // Pending follow-ups
        supabase
          .from('contact_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user?.id)
          .not('followup_due_at', 'is', null)
          .lte('followup_due_at', new Date().toISOString()),

        // Total generated images
        supabase
          .from('generated_images')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user?.id),

        // Total generated videos
        supabase
          .from('generated_videos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user?.id),

        // Total products
        supabase
          .from('chatbot_products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user?.id),

        // Total knowledge files
        supabase
          .from('avatar_knowledge_files')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user?.id),

        // User plan info
        supabase
          .from('profiles')
          .select('subscription_tier_id')
          .eq('id', user?.id)
          .single(),

        // Recent conversations
        supabase
          .from('contact_profiles')
          .select('id, phone_number, contact_name, ai_summary, last_message_at, ai_sentiment, chatbot_id')
          .eq('user_id', user?.id)
          .not('last_message_at', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(5)
      ]);

      // Fetch plan details
      let planName = 'Free';
      let chatbotsLimit = 1;

      if (planResult.data?.subscription_tier_id) {
        const { data: tier } = await supabase
          .from('subscription_tiers')
          .select('display_name, max_avatars')
          .eq('id', planResult.data.subscription_tier_id)
          .single();

        if (tier) {
          planName = tier.display_name;
          chatbotsLimit = tier.max_avatars;
        }
      }

      // Get per-chatbot stats (contacts + WhatsApp status)
      const chatbotStatsPromises = (userChatbots || []).map(async (chatbot) => {
        const [contactRes, whatsappRes] = await Promise.all([
          supabase
            .from('contact_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('chatbot_id', chatbot.id),
          supabase
            .from('whatsapp_web_sessions')
            .select('status')
            .eq('chatbot_id', chatbot.id)
            .maybeSingle()
        ]);

        return {
          ...chatbot,
          contactCount: contactRes.count || 0,
          whatsappConnected: whatsappRes.data?.status === 'connected',
          activation_status: (chatbot as any).activation_status || 'pending',
          n8n_webhook_url: (chatbot as any).n8n_webhook_url || null
        };
      });

      const chatbotsWithStats = await Promise.all(chatbotStatsPromises);

      // Get chatbot names for recent conversations
      const chatbotNames = (userChatbots || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>);

      setStats({
        totalContacts: contactsResult.count || 0,
        pendingFollowups: followupsResult.count || 0,
        totalImages: imagesResult.count || 0,
        totalVideos: videosResult.count || 0,
        totalProducts: productsResult.count || 0,
        totalKnowledgeFiles: knowledgeResult.count || 0,
        planName,
        chatbotsUsed: userChatbots?.length || 0,
        chatbotsLimit
      });

      setChatbots(chatbotsWithStats);

      setRecentConversations(
        (recentChatsResult.data || []).map(c => ({
          id: c.id,
          phone_number: c.phone_number,
          contact_name: c.contact_name,
          last_message: c.ai_summary || 'No summary',
          last_message_at: c.last_message_at,
          sentiment: c.ai_sentiment,
          chatbot_name: chatbotNames[c.chatbot_id] || 'Unknown'
        }))
      );

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentEmoji = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😟';
      default: return '😐';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div>
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 py-2 px-4 text-sm">
            <Crown className="h-4 w-4 text-amber-500" />
            {stats?.planName}
            <span className="text-muted-foreground ml-1">
              ({stats?.chatbotsUsed}/{stats?.chatbotsLimit === -1 ? '∞' : stats?.chatbotsLimit})
            </span>
          </Badge>
        </div>
      </div>

      {/* Performance Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Performance Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/chatbot/overview')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Chatbots</p>
                  <p className="text-3xl font-bold">{stats?.chatbotsUsed}</p>
                </div>
                <Bot className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/chatbot/contacts')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contacts</p>
                  <p className="text-3xl font-bold">{stats?.totalContacts}</p>
                </div>
                <Users className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/chatbot/contacts')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Follow-ups</p>
                  <p className="text-3xl font-bold">{stats?.pendingFollowups}</p>
                </div>
                <Clock className="h-10 w-10 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/chatbot/content')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Products</p>
                  <p className="text-3xl font-bold">{stats?.totalProducts}</p>
                </div>
                <Package className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* My Chatbots Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5" />
          My Chatbots
        </h2>

        {chatbots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chatbots.map((chatbot) => {
              const isActive = chatbot.activation_status === 'active';
              const isPending = chatbot.activation_status === 'pending';
              const isSuspended = chatbot.activation_status === 'suspended';

              return (
                <Card
                  key={chatbot.id}
                  className={`hover:shadow-md transition-shadow cursor-pointer ${
                    isActive && chatbot.whatsappConnected
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : isPending
                      ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                      : isSuspended
                      ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                      : ''
                  }`}
                  onClick={() => navigate(`/chatbot/overview?id=${chatbot.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold ${
                          isActive && chatbot.whatsappConnected
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                            : isPending
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                            : isSuspended
                            ? 'bg-gradient-to-br from-red-500 to-rose-600'
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}>
                          {chatbot.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{chatbot.name}</h3>
                            {isActive && chatbot.whatsappConnected && (
                              <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" title="Active & Running" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {chatbot.company_name || chatbot.industry || 'No details'}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/chatbot/ai-studio?id=${chatbot.id}`); }}>
                            <Bot className="h-4 w-4 mr-2" />
                            AI Studio
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/chatbot/content?id=${chatbot.id}`); }}>
                            <Package className="h-4 w-4 mr-2" />
                            Content
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/chatbot/whatsapp?id=${chatbot.id}`); }}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/chatbot/contacts?id=${chatbot.id}`); }}>
                            <Users className="h-4 w-4 mr-2" />
                            Contacts
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Activation Status Badge */}
                    <div className="mb-3">
                      {isPending && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700">
                          <Clock3 className="h-3 w-3 mr-1" />
                          Waiting for Activation
                        </Badge>
                      )}
                      {isActive && (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active & Running
                        </Badge>
                      )}
                      {isSuspended && (
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Suspended
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{chatbot.contactCount} contacts</span>
                      </div>
                      {chatbot.whatsappConnected && (
                        <div className="flex items-center gap-2 text-green-600">
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-sm">WhatsApp</span>
                        </div>
                      )}
                    </div>

                    {/* Pending status message */}
                    {isPending && (
                      <div className="mt-3 p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded text-xs text-amber-700 dark:text-amber-300">
                        Your chatbot is ready! Our team will activate it shortly.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="font-semibold text-lg mb-2">No chatbots yet</p>
              <p className="text-muted-foreground mb-6">Create your first chatbot to get started</p>
              <Button size="lg" onClick={() => navigate('/chatbot/overview?create=true')}>
                <Plus className="h-5 w-5 mr-2" />
                Create Chatbot
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Access */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Quick Access
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
            onClick={() => navigate('/chatbot/content')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold">{stats?.totalKnowledgeFiles}</p>
                </div>
                <FileText className="h-8 w-8 text-cyan-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
            onClick={() => navigate('/images-studio')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Images</p>
                  <p className="text-2xl font-bold">{stats?.totalImages}</p>
                </div>
                <Image className="h-8 w-8 text-pink-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
            onClick={() => navigate('/video-studio')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Videos</p>
                  <p className="text-2xl font-bold">{stats?.totalVideos}</p>
                </div>
                <Video className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
            onClick={() => navigate('/api-keys')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">API Keys</p>
                  <p className="text-2xl font-bold">→</p>
                </div>
                <FileText className="h-8 w-8 text-indigo-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Conversations */}
      {recentConversations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Conversations
          </h2>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">All Chatbots Activity</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/chatbot/contacts')}>
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentConversations.map((conv) => (
                  <div key={conv.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border">
                    <span className="text-2xl">{getSentimentEmoji(conv.sentiment)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {conv.contact_name || conv.phone_number}
                        </p>
                        <Badge variant="secondary" className="shrink-0">
                          {conv.chatbot_name}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">{conv.last_message}</p>
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formatTimeAgo(conv.last_message_at)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
