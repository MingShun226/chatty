import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useContactsCache } from '@/contexts/ContactsCacheContext';

// Import existing components for dialogs
import { ProductGalleryFull } from '@/components/business-chatbot/ProductGalleryFull';
import { PromotionsGalleryFull } from '@/components/business-chatbot/PromotionsGalleryFull';
import { KnowledgeBase } from '@/components/chatbot-training/KnowledgeBase';

import {
  MessageSquare,
  Users,
  Package,
  Gift,
  BookOpen,
  Phone,
  Bell,
  TrendingUp,
  ShoppingCart,
  User,
  Clock,
  ChevronRight,
  Smile,
  Meh,
  Frown,
  Zap,
  Activity,
  History,
  CheckCircle2,
  Tag,
  Search
} from 'lucide-react';

interface ContactItem {
  id: string;
  phone: string;
  name: string;
  mood: string;
  tags: string[];
  aiSummary: string;
  lastMessageAt: string;
  lastMessageTime: string;
}

interface OverviewStats {
  totalChats: number;
  todayChats: number;
  totalContacts: number;
  pendingFollowups: number;
  productCount: number;
  promotionCount: number;
  documentCount: number;
  moodDistribution: {
    happy: number;
    neutral: number;
    unhappy: number;
  };
  allContacts: ContactItem[];
  recentConversations: ContactItem[];
  alerts: {
    wantsToBuy: number;
    wantsHuman: number;
    buyContacts: Array<{ id: string; phone: string; name: string }>;
    humanContacts: Array<{ id: string; phone: string; name: string }>;
  };
  followupHistory: Array<{
    id: string;
    contactName: string;
    phone: string;
    triggerType: string;
    triggerTag: string;
    sentAt: string;
    responseReceived: boolean;
  }>;
  whatsappConnected: boolean;
  whatsappPhone: string;
}

// Stats Card Component
const StatsCard = ({
  title,
  value,
  icon: Icon,
  gradient,
  iconColor
}: {
  title: string;
  value: string | number;
  icon: any;
  gradient: string;
  iconColor: string;
}) => (
  <Card className={`${gradient} border-opacity-50`}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
        <Icon className={`h-10 w-10 ${iconColor} opacity-50`} />
      </div>
    </CardContent>
  </Card>
);

// Feature Card Component
const FeatureCard = ({
  title,
  icon: Icon,
  iconColor,
  children,
  onClick,
  className = ""
}: {
  title: string;
  icon: any;
  iconColor: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) => (
  <Card
    className={`cursor-pointer hover:border-primary hover:shadow-md transition-all group ${className}`}
    onClick={onClick}
  >
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </CardTitle>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

// Dashboard Content Component
const OverviewDashboard = ({ chatbot, onRefresh }: { chatbot: any; onRefresh?: () => void }) => {
  const navigate = useNavigate();
  const { prefetchContacts } = useContactsCache();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [promotionsOpen, setPromotionsOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [followupHistoryOpen, setFollowupHistoryOpen] = useState(false);
  const [dismissingAlert, setDismissingAlert] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const fetchStats = async (chatbotId: string) => {
    setLoading(true);
    try {
      const [contactsRes, productsRes, promotionsRes, documentsRes, whatsappRes, historyRes] = await Promise.all([
        supabase.from('contact_profiles').select('*').eq('chatbot_id', chatbotId),
        supabase.from('chatbot_products').select('id').eq('chatbot_id', chatbotId),
        supabase.from('chatbot_promotions').select('id').eq('chatbot_id', chatbotId),
        supabase.from('avatar_knowledge_files').select('id').eq('avatar_id', chatbotId),
        supabase.from('whatsapp_web_sessions').select('status, phone_number').eq('chatbot_id', chatbotId).maybeSingle(),
        supabase.from('followup_history').select('*, contact:contact_profiles(contact_name, phone_number)').eq('chatbot_id', chatbotId).order('sent_at', { ascending: false }).limit(10)
      ]);

      const contacts = contactsRes.data || [];
      const moodDistribution = { happy: 0, neutral: 0, unhappy: 0 };
      let pendingFollowups = 0;
      const buyContacts: Array<{ id: string; phone: string; name: string }> = [];
      const humanContacts: Array<{ id: string; phone: string; name: string }> = [];

      contacts.forEach(c => {
        if (c.ai_sentiment === 'positive') moodDistribution.happy++;
        else if (c.ai_sentiment === 'negative') moodDistribution.unhappy++;
        else moodDistribution.neutral++;

        if (c.followup_due_at && new Date(c.followup_due_at) <= new Date()) {
          pendingFollowups++;
        }

        const analysis = c.ai_analysis as any;
        if (analysis?.wantsToBuy) {
          buyContacts.push({ id: c.id, phone: c.phone_number, name: c.contact_name || 'Unknown' });
        }
        if (analysis?.wantsHumanAgent) {
          humanContacts.push({ id: c.id, phone: c.phone_number, name: c.contact_name || 'Unknown' });
        }
      });

      // All contacts for Contacts listing (sorted by name)
      const allContacts: ContactItem[] = contacts
        .sort((a, b) => (a.contact_name || 'Unknown').localeCompare(b.contact_name || 'Unknown'))
        .map(c => ({
          id: c.id,
          phone: c.phone_number,
          name: c.contact_name || 'Unknown',
          mood: c.ai_sentiment || 'neutral',
          tags: c.tags || [],
          aiSummary: c.ai_summary || 'No summary available',
          lastMessageAt: c.last_message_at || '',
          lastMessageTime: c.last_message_at ? getTimeAgo(new Date(c.last_message_at)) : 'Never'
        }));

      // Recent conversations (sorted by last message time)
      const recentConversations: ContactItem[] = contacts
        .filter(c => c.last_message_at)
        .sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
        .slice(0, 20)
        .map(c => ({
          id: c.id,
          phone: c.phone_number,
          name: c.contact_name || 'Unknown',
          mood: c.ai_sentiment || 'neutral',
          tags: c.tags || [],
          aiSummary: c.ai_summary || 'No summary available',
          lastMessageAt: c.last_message_at || '',
          lastMessageTime: c.last_message_at ? getTimeAgo(new Date(c.last_message_at)) : 'Unknown'
        }));

      const followupHistory = (historyRes.data || []).map((h: any) => ({
        id: h.id,
        contactName: h.contact?.contact_name || 'Unknown',
        phone: h.contact?.phone_number || '',
        triggerType: h.trigger_type,
        triggerTag: h.trigger_tag || '-',
        sentAt: h.sent_at ? getTimeAgo(new Date(h.sent_at)) : 'Unknown',
        responseReceived: h.response_received
      }));

      setStats({
        totalChats: contacts.reduce((sum, c) => sum + (c.message_count || 0), 0),
        todayChats: contacts.filter(c => {
          if (!c.last_message_at) return false;
          const today = new Date();
          const msgDate = new Date(c.last_message_at);
          return msgDate.toDateString() === today.toDateString();
        }).length,
        totalContacts: contacts.length,
        pendingFollowups,
        productCount: productsRes.data?.length || 0,
        promotionCount: promotionsRes.data?.length || 0,
        documentCount: documentsRes.data?.length || 0,
        moodDistribution,
        allContacts,
        recentConversations,
        alerts: { wantsToBuy: buyContacts.length, wantsHuman: humanContacts.length, buyContacts, humanContacts },
        followupHistory,
        whatsappConnected: whatsappRes.data?.status === 'connected',
        whatsappPhone: whatsappRes.data?.phone_number || ''
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dismiss alert (clear wantsToBuy/wantsHumanAgent flag)
  const dismissAlert = async (contactId: string, alertType: 'buy' | 'human') => {
    setDismissingAlert(contactId);
    try {
      // Get current ai_analysis and update the flag
      const { data: contact } = await supabase
        .from('contact_profiles')
        .select('ai_analysis')
        .eq('id', contactId)
        .single();

      const analysis = (contact?.ai_analysis as any) || {};
      if (alertType === 'buy') {
        analysis.wantsToBuy = false;
      } else {
        analysis.wantsHumanAgent = false;
      }

      await supabase
        .from('contact_profiles')
        .update({ ai_analysis: analysis })
        .eq('id', contactId);

      // Refresh stats
      if (chatbot?.id) {
        fetchStats(chatbot.id);
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
    } finally {
      setDismissingAlert(null);
    }
  };

  useEffect(() => {
    if (chatbot?.id) {
      fetchStats(chatbot.id);
      // Start prefetching contacts for faster /chatbot/contacts page load
      prefetchContacts(chatbot.id);
    }
  }, [chatbot?.id, prefetchContacts]);

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'positive': return <Smile className="h-4 w-4 text-green-500" />;
      case 'negative': return <Frown className="h-4 w-4 text-red-500" />;
      default: return <Meh className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Performance Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Performance Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="Total Chats"
            value={stats.totalChats}
            icon={MessageSquare}
            gradient="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800"
            iconColor="text-blue-500"
          />
          <StatsCard
            title="Today"
            value={stats.todayChats}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800"
            iconColor="text-green-500"
          />
          <StatsCard
            title="Contacts"
            value={stats.totalContacts}
            icon={Users}
            gradient="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800"
            iconColor="text-purple-500"
          />
          <StatsCard
            title="Pending"
            value={stats.pendingFollowups}
            icon={Clock}
            gradient="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800"
            iconColor="text-orange-500"
          />
        </div>
      </div>

      {/* Mood Distribution & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Smile className="h-4 w-4" />
              Contact Mood Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.totalContacts > 0 ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Smile className="h-4 w-4 text-green-500" /> Happy
                      </span>
                      <span>{Math.round((stats.moodDistribution.happy / stats.totalContacts) * 100)}%</span>
                    </div>
                    <Progress value={(stats.moodDistribution.happy / stats.totalContacts) * 100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Meh className="h-4 w-4 text-yellow-500" /> Neutral
                      </span>
                      <span>{Math.round((stats.moodDistribution.neutral / stats.totalContacts) * 100)}%</span>
                    </div>
                    <Progress value={(stats.moodDistribution.neutral / stats.totalContacts) * 100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Frown className="h-4 w-4 text-red-500" /> Unhappy
                      </span>
                      <span>{Math.round((stats.moodDistribution.unhappy / stats.totalContacts) * 100)}%</span>
                    </div>
                    <Progress value={(stats.moodDistribution.unhappy / stats.totalContacts) * 100} className="h-2" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No contacts yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={stats.alerts.wantsToBuy + stats.alerts.wantsHuman > 0 ? 'border-amber-300 dark:border-amber-700' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alerts
              {stats.alerts.wantsToBuy + stats.alerts.wantsHuman > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats.alerts.wantsToBuy + stats.alerts.wantsHuman}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {stats.alerts.buyContacts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-green-600 flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" /> Want to buy
                    </p>
                    {stats.alerts.buyContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.phone}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                          onClick={() => dismissAlert(contact.id, 'buy')}
                          disabled={dismissingAlert === contact.id}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {stats.alerts.humanContacts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-blue-600 flex items-center gap-1">
                      <User className="h-3 w-3" /> Want human agent
                    </p>
                    {stats.alerts.humanContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.phone}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                          onClick={() => dismissAlert(contact.id, 'human')}
                          disabled={dismissingAlert === contact.id}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {stats.alerts.wantsToBuy + stats.alerts.wantsHuman === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No alerts</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Feature Cards with Real Content */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Access
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contacts - Dialog with Tags and Moods */}
          <Dialog open={contactsOpen} onOpenChange={setContactsOpen}>
            <DialogTrigger asChild>
              <div>
                <FeatureCard title="Contacts" icon={Users} iconColor="text-purple-500">
                  <p className="text-2xl font-bold">{stats.totalContacts}</p>
                  <p className="text-sm text-muted-foreground">{stats.pendingFollowups} pending follow-up</p>
                </FeatureCard>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-[85vw] lg:max-w-4xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-3">
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Contacts ({stats.allContacts.length})
                </DialogTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts by name or phone..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </DialogHeader>
              <ScrollArea className="h-[calc(90vh-150px)]">
                <div className="px-6 pb-6 space-y-2">
                  {stats.allContacts
                    .filter(c =>
                      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                      c.phone.includes(contactSearch)
                    )
                    .map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getMoodIcon(contact.mood)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{contact.name}</span>
                              <span className="text-xs text-muted-foreground">({contact.phone})</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {contact.tags.length > 0 ? (
                                contact.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No tags</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              contact.mood === 'positive'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : contact.mood === 'negative'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}
                          >
                            {contact.mood === 'positive' ? 'Happy' : contact.mood === 'negative' ? 'Unhappy' : 'Neutral'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  {stats.allContacts.filter(c =>
                    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                    c.phone.includes(contactSearch)
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {contactSearch ? 'No contacts found' : 'No contacts yet'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Products - Dialog */}
          <Dialog open={productsOpen} onOpenChange={setProductsOpen}>
            <DialogTrigger asChild>
              <div>
                <FeatureCard title="Products" icon={Package} iconColor="text-blue-500">
                  <p className="text-2xl font-bold">{stats.productCount}</p>
                  <p className="text-sm text-muted-foreground">products in catalog</p>
                </FeatureCard>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-6xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>Product Catalog</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[calc(90vh-100px)]">
                <div className="p-6">
                  <ProductGalleryFull chatbotId={chatbot.id} chatbotName={chatbot.name} priceVisible={chatbot.price_visible ?? true} />
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Promotions - Dialog */}
          <Dialog open={promotionsOpen} onOpenChange={setPromotionsOpen}>
            <DialogTrigger asChild>
              <div>
                <FeatureCard title="Promotions" icon={Gift} iconColor="text-pink-500">
                  <p className="text-2xl font-bold">{stats.promotionCount}</p>
                  <p className="text-sm text-muted-foreground">active promotions</p>
                </FeatureCard>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-6xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>Promotion Manager</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[calc(90vh-100px)]">
                <div className="p-6">
                  <PromotionsGalleryFull chatbotId={chatbot.id} chatbotName={chatbot.name} />
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Knowledge Base - Dialog */}
          <Dialog open={knowledgeOpen} onOpenChange={setKnowledgeOpen}>
            <DialogTrigger asChild>
              <div>
                <FeatureCard title="Knowledge Base" icon={BookOpen} iconColor="text-amber-500">
                  <p className="text-2xl font-bold">{stats.documentCount}</p>
                  <p className="text-sm text-muted-foreground">documents indexed</p>
                </FeatureCard>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-5xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>Knowledge Base</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[calc(90vh-100px)]">
                <div className="p-6">
                  <KnowledgeBase
                    avatarId={chatbot.id}
                    isTraining={false}
                  />
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* WhatsApp - Sheet */}
          <Sheet open={whatsappOpen} onOpenChange={setWhatsappOpen}>
            <SheetTrigger asChild>
              <div>
                <FeatureCard title="WhatsApp" icon={Phone} iconColor="text-green-500">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stats.whatsappConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">{stats.whatsappConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                  {stats.whatsappPhone && (
                    <p className="text-sm text-muted-foreground mt-1">+{stats.whatsappPhone}</p>
                  )}
                </FeatureCard>
              </div>
            </SheetTrigger>
            <SheetContent className="w-[400px]">
              <SheetHeader>
                <SheetTitle>WhatsApp Integration</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${stats.whatsappConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="font-medium">{stats.whatsappConnected ? 'Connected' : 'Not Connected'}</p>
                      {stats.whatsappPhone && <p className="text-sm text-muted-foreground">+{stats.whatsappPhone}</p>}
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={() => { setWhatsappOpen(false); navigate('/chatbot/whatsapp'); }}>
                  Manage WhatsApp Settings
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Follow-up History - Dialog */}
          <Dialog open={followupHistoryOpen} onOpenChange={setFollowupHistoryOpen}>
            <DialogTrigger asChild>
              <div>
                <FeatureCard title="Follow-up History" icon={History} iconColor="text-indigo-500">
                  <p className="text-2xl font-bold">{stats.followupHistory.length}</p>
                  <p className="text-sm text-muted-foreground">recent follow-ups sent</p>
                </FeatureCard>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-3xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Follow-up History
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[calc(90vh-100px)]">
                <div className="p-6">
                  {stats.followupHistory.length > 0 ? (
                    <div className="space-y-3">
                      {stats.followupHistory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${item.responseReceived ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <div>
                              <p className="font-medium">{item.contactName}</p>
                              <p className="text-xs text-muted-foreground">{item.phone}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {item.triggerType === 'auto' ? 'Auto' : 'Manual'}
                              </Badge>
                              {item.triggerTag !== '-' && (
                                <Badge variant="secondary" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {item.triggerTag}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{item.sentAt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No follow-ups sent yet</p>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Recent Conversations */}
      <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => setConversationsOpen(true)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Conversations
            </CardTitle>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentConversations.length > 0 ? (
            <div className="space-y-2">
              {stats.recentConversations.slice(0, 5).map((conv) => (
                <div key={conv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getMoodIcon(conv.mood)}
                    <span className="font-medium text-sm truncate">{conv.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{conv.lastMessageTime}</span>
                </div>
              ))}
              {stats.recentConversations.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{stats.recentConversations.length - 5} more conversations
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No conversations yet</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Conversations Dialog */}
      <Dialog open={conversationsOpen} onOpenChange={setConversationsOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[85vw] lg:max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Conversations ({stats.recentConversations.length})
            </DialogTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or summary..."
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </DialogHeader>
          <ScrollArea className="h-[calc(90vh-150px)]">
            <div className="px-6 pb-6 space-y-3">
              {stats.recentConversations
                .filter(c =>
                  c.name.toLowerCase().includes(conversationSearch.toLowerCase()) ||
                  c.phone.includes(conversationSearch) ||
                  c.aiSummary.toLowerCase().includes(conversationSearch.toLowerCase())
                )
                .map((conv) => (
                  <div
                    key={conv.id}
                    className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-1">{getMoodIcon(conv.mood)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{conv.name}</span>
                            <span className="text-xs text-muted-foreground">({conv.phone})</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                            {conv.aiSummary}
                          </p>
                          {conv.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {conv.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {conv.lastMessageTime}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {stats.recentConversations.filter(c =>
                c.name.toLowerCase().includes(conversationSearch.toLowerCase()) ||
                c.phone.includes(conversationSearch) ||
                c.aiSummary.toLowerCase().includes(conversationSearch.toLowerCase())
              ).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {conversationSearch ? 'No conversations found' : 'No recent conversations'}
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </div>
  );
};

const ChatbotOverview = () => {
  const [activeSection, setActiveSection] = useState('chatbot-overview');
  const { signOut } = useAuth();
  const { isCollapsed } = useSidebar();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
      />

      <main className={`${isCollapsed ? 'ml-16' : 'ml-56'} overflow-auto transition-all duration-300`}>
        <div className="p-8 max-w-7xl mx-auto">
          <ChatbotPageLayout title="Chatbot Overview">
            {(chatbot, isTraining, onRefresh) => <OverviewDashboard chatbot={chatbot} onRefresh={onRefresh} />}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  );
};

export default ChatbotOverview;
