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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

// Import existing components for dialogs
import { ProductGalleryFull } from '@/components/business-chatbot/ProductGalleryFull';
import { PromotionsGalleryFull } from '@/components/business-chatbot/PromotionsGalleryFull';
import { KnowledgeBase } from '@/components/chatbot-training/KnowledgeBase';
import { BusinessChatbotTest } from '@/components/business-chatbot/BusinessChatbotTest';
import FollowUpsSection from '@/components/dashboard/sections/FollowUpsSection';

import {
  MessageSquare,
  Users,
  Package,
  Gift,
  BookOpen,
  Phone,
  Brain,
  Bell,
  TrendingUp,
  ShoppingCart,
  User,
  Clock,
  ChevronRight,
  Send,
  Plus,
  Upload,
  Megaphone,
  Settings,
  Smile,
  Meh,
  Frown,
  Zap,
  Activity,
  ExternalLink,
  TestTube,
  Wand2
} from 'lucide-react';

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
  recentConversations: Array<{
    phone: string;
    name: string;
    lastMessage: string;
    mood: string;
    time: string;
    intent?: string;
  }>;
  alerts: {
    wantsToBuy: number;
    wantsHuman: number;
  };
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
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [promotionsOpen, setPromotionsOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [aiTrainingOpen, setAiTrainingOpen] = useState(false);
  const [testChatOpen, setTestChatOpen] = useState(false);

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
      const [contactsRes, productsRes, promotionsRes, documentsRes] = await Promise.all([
        supabase.from('contact_profiles').select('*').eq('chatbot_id', chatbotId),
        supabase.from('chatbot_products').select('id').eq('chatbot_id', chatbotId),
        supabase.from('chatbot_promotions').select('id').eq('chatbot_id', chatbotId),
        supabase.from('avatar_knowledge_files').select('id').eq('avatar_id', chatbotId)
      ]);

      const contacts = contactsRes.data || [];
      const moodDistribution = { happy: 0, neutral: 0, unhappy: 0 };
      let pendingFollowups = 0;
      let wantsToBuy = 0;
      let wantsHuman = 0;

      contacts.forEach(c => {
        if (c.ai_sentiment === 'positive') moodDistribution.happy++;
        else if (c.ai_sentiment === 'negative') moodDistribution.unhappy++;
        else moodDistribution.neutral++;

        if (c.followup_due_at && new Date(c.followup_due_at) <= new Date()) {
          pendingFollowups++;
        }

        const analysis = c.ai_analysis as any;
        if (analysis?.wantsToBuy) wantsToBuy++;
        if (analysis?.wantsHumanAgent) wantsHuman++;
      });

      const recentConversations = contacts
        .sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
        .slice(0, 5)
        .map(c => ({
          phone: c.phone_number,
          name: c.contact_name || 'Unknown',
          lastMessage: c.ai_summary || 'No summary',
          mood: c.ai_sentiment || 'neutral',
          time: c.last_message_at ? getTimeAgo(new Date(c.last_message_at)) : 'Unknown',
          intent: (c.ai_analysis as any)?.wantsToBuy ? 'buy' : (c.ai_analysis as any)?.wantsHumanAgent ? 'human' : undefined
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
        recentConversations,
        alerts: { wantsToBuy, wantsHuman },
        whatsappConnected: false, // WhatsApp status checked via n8n service, not database
        whatsappPhone: ''
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatbot?.id) {
      fetchStats(chatbot.id);
    }
  }, [chatbot?.id]);

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
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Want to buy</span>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  {stats.alerts.wantsToBuy}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Want human agent</span>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  {stats.alerts.wantsHuman}
                </Badge>
              </div>
            </div>
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
          {/* Contacts - Sheet */}
          <Sheet open={contactsOpen} onOpenChange={setContactsOpen}>
            <SheetTrigger asChild>
              <div>
                <FeatureCard title="Contacts" icon={Users} iconColor="text-purple-500">
                  <p className="text-2xl font-bold">{stats.totalContacts}</p>
                  <p className="text-sm text-muted-foreground">{stats.pendingFollowups} pending follow-up</p>
                </FeatureCard>
              </div>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] p-0">
              <SheetHeader className="p-6 pb-0">
                <div className="flex items-center justify-between">
                  <SheetTitle>Contact Management</SheetTitle>
                  <Button variant="outline" size="sm" onClick={() => { setContactsOpen(false); navigate('/chatbot/contacts'); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Full Page
                  </Button>
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-100px)]">
                <div className="p-6">
                  <FollowUpsSection chatbot={chatbot} />
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

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
                <div className="flex items-center justify-between">
                  <DialogTitle>Product Catalog</DialogTitle>
                  <Button variant="outline" size="sm" onClick={() => { setProductsOpen(false); navigate('/chatbot/content'); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Full Page
                  </Button>
                </div>
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
                <div className="flex items-center justify-between">
                  <DialogTitle>Promotion Manager</DialogTitle>
                  <Button variant="outline" size="sm" onClick={() => { setPromotionsOpen(false); navigate('/chatbot/content'); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Full Page
                  </Button>
                </div>
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
                <div className="flex items-center justify-between">
                  <DialogTitle>Knowledge Base</DialogTitle>
                  <Button variant="outline" size="sm" onClick={() => { setKnowledgeOpen(false); navigate('/chatbot/content'); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Full Page
                  </Button>
                </div>
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
            <SheetContent className="w-[500px]">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>WhatsApp Integration</SheetTitle>
                  <Button variant="outline" size="sm" onClick={() => { setWhatsappOpen(false); navigate('/chatbot/whatsapp'); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Full Page
                  </Button>
                </div>
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

          {/* AI Training - Dialog with Tabs */}
          <Dialog open={aiTrainingOpen} onOpenChange={setAiTrainingOpen}>
            <DialogTrigger asChild>
              <div>
                <FeatureCard title="AI Training" icon={Brain} iconColor="text-indigo-500">
                  <p className="text-sm text-muted-foreground">Prompt engineering & model training</p>
                </FeatureCard>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-5xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>AI Training Center</DialogTitle>
              </DialogHeader>
              <div className="p-6">
                <Tabs defaultValue="prompt" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="prompt" className="gap-2">
                      <Wand2 className="h-4 w-4" />
                      Prompt Engineer
                    </TabsTrigger>
                    <TabsTrigger value="training" className="gap-2">
                      <Brain className="h-4 w-4" />
                      Model Training
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="prompt" className="mt-4">
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        Use the Prompt Engineer to refine your chatbot's responses.
                      </p>
                      <Button onClick={() => { setAiTrainingOpen(false); navigate('/chatbot/ai-studio'); }}>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Open Prompt Engineer
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="training" className="mt-4">
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        Train custom models with your conversation data.
                      </p>
                      <Button onClick={() => { setAiTrainingOpen(false); navigate('/chatbot/ai-studio'); }}>
                        <Brain className="h-4 w-4 mr-2" />
                        Open Model Training
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Recent Conversations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Conversations
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setContactsOpen(true)}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentConversations.length > 0 ? (
            <div className="space-y-3">
              {stats.recentConversations.map((conv, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setContactsOpen(true)}>
                  <div className="flex items-center gap-3">
                    {getMoodIcon(conv.mood)}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{conv.name}</span>
                        <span className="text-xs text-muted-foreground">({conv.phone})</span>
                        {conv.intent === 'buy' && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <ShoppingCart className="h-3 w-3 mr-1" /> Wants to buy
                          </Badge>
                        )}
                        {conv.intent === 'human' && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            <User className="h-3 w-3 mr-1" /> Wants agent
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-md">{conv.lastMessage}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{conv.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No conversations yet</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => setContactsOpen(true)}>
          <Send className="h-5 w-5" />
          <span>Send Follow-up</span>
        </Button>

        <Dialog open={testChatOpen} onOpenChange={setTestChatOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <TestTube className="h-5 w-5" />
              <span>Test Chatbot</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] p-0">
            <DialogHeader className="p-6 pb-0">
              <div className="flex items-center justify-between">
                <DialogTitle>Test Your Chatbot</DialogTitle>
                <Button variant="outline" size="sm" onClick={() => { setTestChatOpen(false); navigate('/chatbot/ai-studio'); }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Full Page
                </Button>
              </div>
            </DialogHeader>
            <div className="p-6 h-[60vh]">
              <BusinessChatbotTest avatar={chatbot} />
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => setProductsOpen(true)}>
          <Plus className="h-5 w-5" />
          <span>Add Product</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => setKnowledgeOpen(true)}>
          <Upload className="h-5 w-5" />
          <span>Upload Document</span>
        </Button>
      </div>

      {/* Settings Button */}
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => navigate('/chatbot/ai-studio')}>
          <Settings className="h-4 w-4" />
          Chatbot Settings
        </Button>
      </div>
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
