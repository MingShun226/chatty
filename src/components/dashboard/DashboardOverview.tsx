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
  MessageCircle
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
        .select('id, name, company_name, industry, created_at')
        .eq('user_id', user?.id)
        .is('deleted_at', null)
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
          whatsappConnected: whatsappRes.data?.status === 'connected'
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
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back! Here's your overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 py-1.5 px-3">
            <Crown className="h-3 w-3 text-amber-500" />
            {stats?.planName}
            <span className="text-muted-foreground ml-1">
              ({stats?.chatbotsUsed}/{stats?.chatbotsLimit === -1 ? '∞' : stats?.chatbotsLimit})
            </span>
          </Badge>
        </div>
      </div>

      {/* Key Stats - Compact Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/chatbot/overview')}>
          <div className="p-2 bg-purple-100 rounded-lg">
            <Bot className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.chatbotsUsed}</p>
            <p className="text-xs text-muted-foreground">Chatbots</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/chatbot/contacts')}>
          <div className="p-2 bg-green-100 rounded-lg">
            <Users className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.totalContacts}</p>
            <p className="text-xs text-muted-foreground">Contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/chatbot/contacts')}>
          <div className={`p-2 rounded-lg ${stats?.pendingFollowups ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <Clock className={`h-4 w-4 ${stats?.pendingFollowups ? 'text-orange-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.pendingFollowups}</p>
            <p className="text-xs text-muted-foreground">Pending Follow-ups</p>
          </div>
        </div>
      </div>

      {/* My Chatbots Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">My Chatbots</h2>
        </div>

        {chatbots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chatbots.map((chatbot) => (
              <Card
                key={chatbot.id}
                className={`hover:shadow-md transition-shadow ${chatbot.whatsappConnected ? 'bg-green-50 border-green-200' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${chatbot.whatsappConnected ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                        {chatbot.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{chatbot.name}</h3>
                          {chatbot.whatsappConnected && (
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="WhatsApp Connected" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {chatbot.company_name || chatbot.industry || 'No details'}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/chatbot/ai-studio?id=${chatbot.id}`)}>
                          <Bot className="h-4 w-4 mr-2" />
                          AI Studio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/chatbot/content?id=${chatbot.id}`)}>
                          <Package className="h-4 w-4 mr-2" />
                          Content
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/chatbot/whatsapp?id=${chatbot.id}`)}>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/chatbot/contacts?id=${chatbot.id}`)}>
                          <Users className="h-4 w-4 mr-2" />
                          Contacts
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{chatbot.contactCount} contacts</span>
                    </div>
                    {chatbot.whatsappConnected && (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="text-xs">WhatsApp Active</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="font-medium mb-1">No chatbots yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first chatbot to get started</p>
              <Button onClick={() => navigate('/chatbot/overview?create=true')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Chatbot
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/chatbot/content')}
        >
          <Package className="h-4 w-4 text-indigo-600" />
          <div>
            <p className="font-semibold">{stats?.totalProducts}</p>
            <p className="text-xs text-muted-foreground">Products</p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/chatbot/content')}
        >
          <FileText className="h-4 w-4 text-cyan-600" />
          <div>
            <p className="font-semibold">{stats?.totalKnowledgeFiles}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/images-studio')}
        >
          <Image className="h-4 w-4 text-pink-600" />
          <div>
            <p className="font-semibold">{stats?.totalImages}</p>
            <p className="text-xs text-muted-foreground">AI Images</p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/video-studio')}
        >
          <Video className="h-4 w-4 text-red-600" />
          <div>
            <p className="font-semibold">{stats?.totalVideos}</p>
            <p className="text-xs text-muted-foreground">AI Videos</p>
          </div>
        </div>
      </div>

      {/* Recent Conversations */}
      {recentConversations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Conversations
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/chatbot/contacts')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentConversations.map((conv) => (
                <div key={conv.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-lg">{getSentimentEmoji(conv.sentiment)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {conv.contact_name || conv.phone_number}
                      </p>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {conv.chatbot_name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTimeAgo(conv.last_message_at)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
