import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  Bot,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Package,
  Tag,
  Key,
  Smartphone,
  FileText,
  Activity,
  Calendar,
  UserPlus,
  ShoppingBag
} from 'lucide-react';

interface PlatformStats {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  total_chatbots: number;
  total_conversations: number;
  mrr: number;
  // Extended stats
  total_products: number;
  total_promotions: number;
  total_api_keys: number;
  total_whatsapp_sessions: number;
  total_knowledge_files: number;
  total_contacts: number;
  new_users_today: number;
  new_users_week: number;
}

interface RecentUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  account_status: string;
}

interface RecentChatbot {
  id: string;
  name: string;
  user_email: string;
  created_at: string;
  has_whatsapp: boolean;
}

export const AdminDashboard = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentChatbots, setRecentChatbots] = useState<RecentChatbot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchPlatformStats(),
        fetchRecentUsers(),
        fetchRecentChatbots()
      ]);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformStats = async () => {
    try {
      // Get basic platform stats
      const { data: overviewData, error: overviewError } = await supabase.rpc('get_platform_overview');

      // Get extended stats with individual queries (using correct table names)
      const [
        { count: totalProducts },
        { count: totalPromotions },
        { count: totalApiKeys },
        { count: totalWhatsappSessions },
        { count: totalKnowledgeFiles },
        { count: totalContacts },
        { count: newUsersToday },
        { count: newUsersWeek }
      ] = await Promise.all([
        supabase.from('chatbot_products').select('*', { count: 'exact', head: true }),
        supabase.from('chatbot_promotions').select('*', { count: 'exact', head: true }),
        supabase.from('platform_api_keys').select('*', { count: 'exact', head: true }),
        supabase.from('whatsapp_web_sessions').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
        supabase.from('avatar_knowledge_files').select('*', { count: 'exact', head: true }),
        supabase.from('contact_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const baseStats = overviewData?.[0] || {};

      setStats({
        total_users: baseStats.total_users || 0,
        active_users_7d: baseStats.active_users_7d || 0,
        active_users_30d: baseStats.active_users_30d || 0,
        total_chatbots: baseStats.total_avatars || 0,
        total_conversations: baseStats.total_conversations || 0,
        mrr: baseStats.mrr || 0,
        total_products: totalProducts || 0,
        total_promotions: totalPromotions || 0,
        total_api_keys: totalApiKeys || 0,
        total_whatsapp_sessions: totalWhatsappSessions || 0,
        total_knowledge_files: totalKnowledgeFiles || 0,
        total_contacts: totalContacts || 0,
        new_users_today: newUsersToday || 0,
        new_users_week: newUsersWeek || 0
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    }
  };

  const fetchRecentUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, created_at, account_status')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentUsers(data || []);
    } catch (error) {
      console.error('Error fetching recent users:', error);
    }
  };

  const fetchRecentChatbots = async () => {
    try {
      // First get chatbots with user info
      const { data: chatbotsData, error: chatbotsError } = await supabase
        .from('avatars')
        .select(`
          id,
          name,
          created_at,
          user_id,
          profiles:user_id (email)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (chatbotsError) throw chatbotsError;

      // Get WhatsApp sessions for these chatbots
      const chatbotIds = chatbotsData?.map(c => c.id) || [];
      const { data: sessionsData } = await supabase
        .from('whatsapp_web_sessions')
        .select('chatbot_id, status')
        .in('chatbot_id', chatbotIds)
        .eq('status', 'connected');

      const connectedChatbots = new Set(sessionsData?.map(s => s.chatbot_id) || []);

      const formatted = chatbotsData?.map(item => ({
        id: item.id,
        name: item.name,
        user_email: (item.profiles as any)?.email || 'Unknown',
        created_at: item.created_at,
        has_whatsapp: connectedChatbots.has(item.id)
      })) || [];

      setRecentChatbots(formatted);
    } catch (error) {
      console.error('Error fetching recent chatbots:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const mainStats = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      description: 'Registered accounts',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Chatbots',
      value: stats?.total_chatbots || 0,
      description: 'AI chatbots created',
      icon: Bot,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'WhatsApp Connected',
      value: stats?.total_whatsapp_sessions || 0,
      description: 'Active connections',
      icon: Smartphone,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Contacts',
      value: stats?.total_contacts || 0,
      description: 'WhatsApp contacts',
      icon: MessageSquare,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Products',
      value: stats?.total_products || 0,
      description: 'In product catalogs',
      icon: Package,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
    {
      title: 'API Keys',
      value: stats?.total_api_keys || 0,
      description: 'Platform integrations',
      icon: Key,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  const secondaryStats = [
    { label: 'Active (7d)', value: stats?.active_users_7d || 0, icon: Activity },
    { label: 'Active (30d)', value: stats?.active_users_30d || 0, icon: TrendingUp },
    { label: 'Promotions', value: stats?.total_promotions || 0, icon: Tag },
    { label: 'Knowledge Files', value: stats?.total_knowledge_files || 0, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Overview</h1>
          <p className="text-muted-foreground">
            Chatty Admin Dashboard - Monitor and manage the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">+{stats?.new_users_today || 0} today</span>
            </div>
            <p className="text-xs text-muted-foreground">+{stats?.new_users_week || 0} this week</p>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {mainStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {secondaryStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-lg font-semibold">{stat.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 grid-cols-2">
            <a
              href="/admin/users"
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <Users className="h-5 w-5 text-blue-500" />
              <span className="font-medium text-sm">Manage Users</span>
            </a>
            <a
              href="/admin/tiers"
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="font-medium text-sm">Manage Tiers</span>
            </a>
            <a
              href="/admin/settings"
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <ShoppingBag className="h-5 w-5 text-purple-500" />
              <span className="font-medium text-sm">Platform Settings</span>
            </a>
            <a
              href="/admin/audit-logs"
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <FileText className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-sm">Audit Logs</span>
            </a>
          </CardContent>
        </Card>

        {/* User Activity Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Growth</CardTitle>
            <CardDescription>Registration trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Rate (7d)</span>
                <span className="text-sm font-medium">
                  {stats?.total_users ? Math.round((stats.active_users_7d / stats.total_users) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={stats?.total_users ? (stats.active_users_7d / stats.total_users) * 100 : 0}
                className="h-2"
              />

              <div className="flex items-center justify-between">
                <span className="text-sm">Active Rate (30d)</span>
                <span className="text-sm font-medium">
                  {stats?.total_users ? Math.round((stats.active_users_30d / stats.total_users) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={stats?.total_users ? (stats.active_users_30d / stats.total_users) * 100 : 0}
                className="h-2"
              />

              <div className="flex items-center justify-between">
                <span className="text-sm">Chatbots per User</span>
                <span className="text-sm font-medium">
                  {stats?.total_users ? (stats.total_chatbots / stats.total_users).toFixed(1) : 0}
                </span>
              </div>
              <Progress
                value={Math.min(100, stats?.total_users ? (stats.total_chatbots / stats.total_users) * 50 : 0)}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users & Chatbots */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Recent Users
            </CardTitle>
            <CardDescription>Newly registered accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{user.name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={user.account_status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {user.account_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(user.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Chatbots */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Recent Chatbots
            </CardTitle>
            <CardDescription>Newly created chatbots</CardDescription>
          </CardHeader>
          <CardContent>
            {recentChatbots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No chatbots found</p>
            ) : (
              <div className="space-y-3">
                {recentChatbots.map((chatbot) => (
                  <div key={chatbot.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{chatbot.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{chatbot.user_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {chatbot.has_whatsapp && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          <Smartphone className="w-3 h-3 mr-1" />
                          WA
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(chatbot.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
