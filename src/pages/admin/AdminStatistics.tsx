import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Bot,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Package,
  Key,
  Smartphone,
  FileText,
  Activity,
  Calendar,
  BarChart3,
  Loader2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DailyStats {
  date: string;
  new_users: number;
  new_chatbots: number;
  new_contacts: number;
  new_products: number;
  active_sessions: number;
}

interface TierDistribution {
  tier_name: string;
  count: number;
  percentage: number;
}

interface GrowthMetric {
  label: string;
  current: number;
  previous: number;
  change: number;
  icon: typeof Users;
  color: string;
}

export const AdminStatistics = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [tierDistribution, setTierDistribution] = useState<TierDistribution[]>([]);
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetric[]>([]);
  const [totals, setTotals] = useState({
    totalUsers: 0,
    totalChatbots: 0,
    totalContacts: 0,
    totalProducts: 0,
    totalSessions: 0,
    totalKnowledgeFiles: 0,
    totalApiKeys: 0,
  });

  useEffect(() => {
    fetchStatistics();
  }, [dateRange]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const days = parseInt(dateRange);
      const today = new Date();
      const startDate = subDays(today, days);
      const previousStartDate = subDays(startDate, days);

      // Fetch current period totals
      const [
        { count: totalUsers },
        { count: totalChatbots },
        { count: totalContacts },
        { count: totalProducts },
        { count: totalSessions },
        { count: totalKnowledgeFiles },
        { count: totalApiKeys },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('avatars').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('contact_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('chatbot_products').select('*', { count: 'exact', head: true }),
        supabase.from('whatsapp_web_sessions').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
        supabase.from('avatar_knowledge_files').select('*', { count: 'exact', head: true }),
        supabase.from('platform_api_keys').select('*', { count: 'exact', head: true }),
      ]);

      setTotals({
        totalUsers: totalUsers || 0,
        totalChatbots: totalChatbots || 0,
        totalContacts: totalContacts || 0,
        totalProducts: totalProducts || 0,
        totalSessions: totalSessions || 0,
        totalKnowledgeFiles: totalKnowledgeFiles || 0,
        totalApiKeys: totalApiKeys || 0,
      });

      // Fetch current period new users/chatbots
      const [
        { count: newUsersCurrentPeriod },
        { count: newUsersPreviousPeriod },
        { count: newChatbotsCurrentPeriod },
        { count: newChatbotsPreviousPeriod },
        { count: newContactsCurrentPeriod },
        { count: newContactsPreviousPeriod },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString()),
        supabase.from('avatars').select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .gte('created_at', startDate.toISOString()),
        supabase.from('avatars').select('*', { count: 'exact', head: true })
          .is('deleted_at', null)
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString()),
        supabase.from('contact_profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        supabase.from('contact_profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString()),
      ]);

      // Calculate growth metrics
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      setGrowthMetrics([
        {
          label: 'New Users',
          current: newUsersCurrentPeriod || 0,
          previous: newUsersPreviousPeriod || 0,
          change: calculateChange(newUsersCurrentPeriod || 0, newUsersPreviousPeriod || 0),
          icon: Users,
          color: 'text-blue-500',
        },
        {
          label: 'New Chatbots',
          current: newChatbotsCurrentPeriod || 0,
          previous: newChatbotsPreviousPeriod || 0,
          change: calculateChange(newChatbotsCurrentPeriod || 0, newChatbotsPreviousPeriod || 0),
          icon: Bot,
          color: 'text-purple-500',
        },
        {
          label: 'New Contacts',
          current: newContactsCurrentPeriod || 0,
          previous: newContactsPreviousPeriod || 0,
          change: calculateChange(newContactsCurrentPeriod || 0, newContactsPreviousPeriod || 0),
          icon: MessageSquare,
          color: 'text-green-500',
        },
      ]);

      // Fetch tier distribution
      const { data: profiles } = await supabase
        .from('profiles')
        .select('subscription_tier_id');

      const { data: tiers } = await supabase
        .from('subscription_tiers')
        .select('id, display_name')
        .eq('is_active', true);

      const tierCounts: Record<string, number> = {};
      let noTierCount = 0;

      profiles?.forEach(p => {
        if (p.subscription_tier_id) {
          tierCounts[p.subscription_tier_id] = (tierCounts[p.subscription_tier_id] || 0) + 1;
        } else {
          noTierCount++;
        }
      });

      const totalProfiles = profiles?.length || 1;
      const distribution: TierDistribution[] = [
        {
          tier_name: 'No Plan',
          count: noTierCount,
          percentage: Math.round((noTierCount / totalProfiles) * 100),
        },
      ];

      tiers?.forEach(tier => {
        const count = tierCounts[tier.id] || 0;
        distribution.push({
          tier_name: tier.display_name,
          count,
          percentage: Math.round((count / totalProfiles) * 100),
        });
      });

      setTierDistribution(distribution.filter(d => d.count > 0));

      // Fetch daily stats
      const dailyStatsPromises = [];
      for (let i = 0; i < days; i++) {
        const date = subDays(today, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        dailyStatsPromises.push(
          Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true })
              .gte('created_at', dayStart.toISOString())
              .lte('created_at', dayEnd.toISOString()),
            supabase.from('avatars').select('*', { count: 'exact', head: true })
              .is('deleted_at', null)
              .gte('created_at', dayStart.toISOString())
              .lte('created_at', dayEnd.toISOString()),
            supabase.from('contact_profiles').select('*', { count: 'exact', head: true })
              .gte('created_at', dayStart.toISOString())
              .lte('created_at', dayEnd.toISOString()),
          ]).then(([users, chatbots, contacts]) => ({
            date: format(date, 'MMM dd'),
            new_users: users.count || 0,
            new_chatbots: chatbots.count || 0,
            new_contacts: contacts.count || 0,
            new_products: 0,
            active_sessions: 0,
          }))
        );
      }

      const stats = await Promise.all(dailyStatsPromises);
      setDailyStats(stats.reverse());

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Platform Statistics
          </h2>
          <p className="text-muted-foreground">Analytics and performance metrics</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Total Stats */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Total Users', value: totals.totalUsers, icon: Users, color: 'text-blue-500' },
          { label: 'Chatbots', value: totals.totalChatbots, icon: Bot, color: 'text-purple-500' },
          { label: 'Contacts', value: totals.totalContacts, icon: MessageSquare, color: 'text-green-500' },
          { label: 'Products', value: totals.totalProducts, icon: Package, color: 'text-orange-500' },
          { label: 'WA Sessions', value: totals.totalSessions, icon: Smartphone, color: 'text-emerald-500' },
          { label: 'Knowledge Files', value: totals.totalKnowledgeFiles, icon: FileText, color: 'text-cyan-500' },
          { label: 'API Keys', value: totals.totalApiKeys, icon: Key, color: 'text-amber-500' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Growth Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {growthMetrics.map((metric) => {
          const Icon = metric.icon;
          const isPositive = metric.change >= 0;
          return (
            <Card key={metric.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-3xl font-bold mt-1">{metric.current}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs {metric.previous} previous period
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`p-3 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Icon className={`h-5 w-5 ${metric.color}`} />
                    </div>
                    <div className={`flex items-center gap-1 mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      <span className="text-sm font-medium">{Math.abs(metric.change)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Daily Activity
            </CardTitle>
            <CardDescription>New registrations over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailyStats.slice(-7).map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-muted-foreground">{day.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <Badge variant="outline" className="px-1.5 py-0">
                        {day.new_users} users
                      </Badge>
                      <Badge variant="outline" className="px-1.5 py-0">
                        {day.new_chatbots} bots
                      </Badge>
                      <Badge variant="outline" className="px-1.5 py-0">
                        {day.new_contacts} contacts
                      </Badge>
                    </div>
                    <Progress
                      value={Math.min(100, (day.new_users + day.new_chatbots + day.new_contacts) * 5)}
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Subscription Distribution
            </CardTitle>
            <CardDescription>Users by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tierDistribution.map((tier) => (
                <div key={tier.tier_name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{tier.tier_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {tier.count} users ({tier.percentage}%)
                    </span>
                  </div>
                  <Progress value={tier.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
