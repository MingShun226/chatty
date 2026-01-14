import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  User,
  Bot,
  Package,
  Users,
  Key,
  Calendar,
  Mail,
  CreditCard,
  Activity,
  Gift,
  MessageSquare,
  FileText,
  Phone,
  Loader2,
  Ban,
  CheckCircle,
  LogIn,
  ExternalLink,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionTier } from '@/types/admin';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  account_status: string;
  subscription_tier_id: string | null;
  created_at: string;
  last_login: string | null;
}

interface UserStats {
  chatbots_count: number;
  products_count: number;
  promotions_count: number;
  contacts_count: number;
  api_keys_count: number;
  whatsapp_sessions_count: number;
  knowledge_files_count: number;
}

interface UserChatbot {
  id: string;
  name: string;
  created_at: string;
  status: string;
  base_model: string;
  has_whatsapp: boolean;
  products_count: number;
  contacts_count: number;
  active_prompt?: {
    system_prompt: string;
    version_name: string;
  } | null;
}

interface UserProduct {
  id: string;
  product_name: string;
  sku: string;
  price: number;
  currency: string;
  in_stock: boolean;
  category: string | null;
  created_at: string;
}

interface UserContact {
  id: string;
  phone_number: string;
  contact_name: string | null;
  tags: string[];
  ai_sentiment: string | null;
  message_count: number;
  last_message_at: string | null;
}

export const UserDetails = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [chatbots, setChatbots] = useState<UserChatbot[]>([]);
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLoginAsDialog, setShowLoginAsDialog] = useState(false);
  const [loginAsLoading, setLoginAsLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchAllData();
    }
  }, [userId]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUserDetails(),
      fetchUserStats(),
      fetchUserChatbots(),
      fetchUserProducts(),
      fetchUserContacts(),
      fetchTiers()
    ]);
    setLoading(false);
  };

  const fetchUserDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
      setSelectedTier(data.subscription_tier_id || '');
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const [
        chatbotsResult,
        productsResult,
        promotionsResult,
        contactsResult,
        apiKeysResult,
        whatsappResult,
        knowledgeResult
      ] = await Promise.all([
        supabase.from('avatars').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('chatbot_products').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('chatbot_promotions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('contact_profiles').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('platform_api_keys').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('whatsapp_web_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('avatar_knowledge_files').select('*', { count: 'exact', head: true }).eq('user_id', userId)
      ]);

      setStats({
        chatbots_count: chatbotsResult.count || 0,
        products_count: productsResult.count || 0,
        promotions_count: promotionsResult.count || 0,
        contacts_count: contactsResult.count || 0,
        api_keys_count: apiKeysResult.count || 0,
        whatsapp_sessions_count: whatsappResult.count || 0,
        knowledge_files_count: knowledgeResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserChatbots = async () => {
    try {
      const { data: chatbotsData, error } = await supabase
        .from('avatars')
        .select('id, name, created_at, status, base_model')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (chatbotsData && chatbotsData.length > 0) {
        const chatbotIds = chatbotsData.map(c => c.id);

        // Get WhatsApp sessions, products count, and contacts count
        const [sessionsData, productsData, contactsData, promptsData] = await Promise.all([
          supabase.from('whatsapp_web_sessions').select('chatbot_id').in('chatbot_id', chatbotIds).eq('status', 'connected'),
          supabase.from('chatbot_products').select('chatbot_id').in('chatbot_id', chatbotIds),
          supabase.from('contact_profiles').select('chatbot_id').in('chatbot_id', chatbotIds),
          supabase.from('avatar_prompt_versions').select('avatar_id, system_prompt, version_name').in('avatar_id', chatbotIds).eq('is_active', true)
        ]);

        const connectedIds = new Set(sessionsData.data?.map(s => s.chatbot_id) || []);
        const productCounts = new Map<string, number>();
        const contactCounts = new Map<string, number>();
        const promptsMap = new Map<string, any>();

        productsData.data?.forEach(p => {
          productCounts.set(p.chatbot_id, (productCounts.get(p.chatbot_id) || 0) + 1);
        });
        contactsData.data?.forEach(c => {
          contactCounts.set(c.chatbot_id, (contactCounts.get(c.chatbot_id) || 0) + 1);
        });
        promptsData.data?.forEach(p => {
          promptsMap.set(p.avatar_id, { system_prompt: p.system_prompt, version_name: p.version_name });
        });

        setChatbots(chatbotsData.map(c => ({
          ...c,
          has_whatsapp: connectedIds.has(c.id),
          products_count: productCounts.get(c.id) || 0,
          contacts_count: contactCounts.get(c.id) || 0,
          active_prompt: promptsMap.get(c.id) || null
        })));
      } else {
        setChatbots([]);
      }
    } catch (error) {
      console.error('Error fetching chatbots:', error);
    }
  };

  const fetchUserProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('chatbot_products')
        .select('id, product_name, sku, price, currency, in_stock, category, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchUserContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_profiles')
        .select('id, phone_number, contact_name, tags, ai_sentiment, message_count, last_message_at')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setTiers(data || []);
    } catch (error) {
      console.error('Error fetching tiers:', error);
    }
  };

  const handleSuspendUser = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: 'suspended' })
        .eq('id', userId);

      if (error) throw error;

      setUser(prev => prev ? { ...prev, account_status: 'suspended' } : null);
      toast({ title: 'User Suspended', description: 'The user has been suspended successfully.' });
    } catch (error) {
      console.error('Error suspending user:', error);
      toast({ title: 'Error', description: 'Failed to suspend user', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateUser = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: 'active' })
        .eq('id', userId);

      if (error) throw error;

      setUser(prev => prev ? { ...prev, account_status: 'active' } : null);
      toast({ title: 'User Activated', description: 'The user has been activated successfully.' });
    } catch (error) {
      console.error('Error activating user:', error);
      toast({ title: 'Error', description: 'Failed to activate user', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLoginAsUser = async () => {
    if (!user?.email) return;

    setLoginAsLoading(true);
    try {
      // Call edge function to generate impersonation link
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: userId, targetEmail: user.email }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({ title: 'Login Link Generated', description: 'A new tab has been opened. You are now logged in as this user.' });
      } else {
        throw new Error('No login URL returned');
      }
    } catch (error: any) {
      console.error('Error generating login link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate login link. Make sure the admin-impersonate edge function is deployed.',
        variant: 'destructive'
      });
    } finally {
      setLoginAsLoading(false);
      setShowLoginAsDialog(false);
    }
  };

  const handleTierChange = async (newTierId: string) => {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ subscription_tier_id: newTierId })
        .eq('id', userId);

      if (profileError) throw profileError;

      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('tier_id', newTierId)
        .single();

      if (!existingSub) {
        await supabase.from('user_subscriptions').upsert({
          user_id: userId,
          tier_id: newTierId,
          status: 'active',
          billing_cycle: 'monthly',
          started_at: new Date().toISOString(),
        });
      }

      setSelectedTier(newTierId);
      await fetchUserDetails();
      toast({ title: 'Tier Updated', description: 'Subscription tier has been updated successfully.' });
    } catch (error) {
      console.error('Error updating tier:', error);
      toast({ title: 'Error', description: 'Failed to update tier', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; text: string }> = {
      active: { variant: 'default', text: 'Active' },
      suspended: { variant: 'destructive', text: 'Suspended' },
      banned: { variant: 'destructive', text: 'Banned' },
      deleted: { variant: 'secondary', text: 'Deleted' },
    };
    const config = variants[status] || { variant: 'secondary', text: status };
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const currentTier = tiers.find((t) => t.id === user?.subscription_tier_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            User not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{user.name || 'Unknown User'}</h2>
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(user.account_status)}

          {/* Login As Button */}
          <Button
            variant="outline"
            onClick={() => setShowLoginAsDialog(true)}
            disabled={user.account_status !== 'active'}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Login As User
          </Button>

          {/* Suspend/Activate */}
          {user.account_status === 'active' ? (
            <Button variant="destructive" onClick={handleSuspendUser} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              Suspend
            </Button>
          ) : (
            <Button variant="default" onClick={handleActivateUser} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Bot className="h-4 w-4" />
              Chatbots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.chatbots_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.products_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Gift className="h-4 w-4" />
              Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.promotions_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.contacts_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Key className="h-4 w-4" />
              API Keys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.api_keys_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.whatsapp_sessions_count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              Knowledge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.knowledge_files_count || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chatbots">Chatbots ({chatbots.length})</TabsTrigger>
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-mono text-xs mt-1 bg-muted px-2 py-1 rounded truncate">{user.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Tier</p>
                  <p className="font-medium mt-1">{currentTier?.display_name || 'No tier'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium mt-1">{format(new Date(user.created_at), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Login</p>
                  <p className="font-medium mt-1">
                    {user.last_login ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true }) : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chatbots Tab */}
        <TabsContent value="chatbots" className="space-y-4">
          {chatbots.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No chatbots created yet
              </CardContent>
            </Card>
          ) : (
            chatbots.map((chatbot) => (
              <Card key={chatbot.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{chatbot.name}</CardTitle>
                      <CardDescription>
                        Created {formatDistanceToNow(new Date(chatbot.created_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {chatbot.has_whatsapp && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Phone className="h-3 w-3 mr-1" />
                          WhatsApp
                        </Badge>
                      )}
                      <Badge>{chatbot.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Model</p>
                      <p className="font-medium">{chatbot.base_model || 'gpt-4o-mini'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Products</p>
                      <p className="font-medium">{chatbot.products_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contacts</p>
                      <p className="font-medium">{chatbot.contacts_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Prompt Version</p>
                      <p className="font-medium">{chatbot.active_prompt?.version_name || 'Default'}</p>
                    </div>
                  </div>

                  {chatbot.active_prompt?.system_prompt && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="h-4 w-4 mr-2" />
                          View System Prompt
                          <ChevronDown className="h-4 w-4 ml-auto" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                          {chatbot.active_prompt.system_prompt}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User's Products</CardTitle>
              <CardDescription>All products created by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No products created yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>{product.category || '-'}</TableCell>
                        <TableCell>{product.currency} {product.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={product.in_stock ? 'default' : 'secondary'}>
                            {product.in_stock ? 'In Stock' : 'Out of Stock'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(product.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User's Contacts</CardTitle>
              <CardDescription>WhatsApp contacts managed by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No contacts yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Mood</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Last Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{contact.contact_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground font-mono">{contact.phone_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.tags?.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                            {contact.tags?.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{contact.tags.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm ${
                            contact.ai_sentiment === 'positive' ? 'text-green-600' :
                            contact.ai_sentiment === 'negative' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {contact.ai_sentiment === 'positive' ? '😊' :
                             contact.ai_sentiment === 'negative' ? '😟' : '😐'} {contact.ai_sentiment || 'Unknown'}
                          </span>
                        </TableCell>
                        <TableCell>{contact.message_count || 0}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {contact.last_message_at
                            ? formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: true })
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Manage Subscription Tier</CardTitle>
              <CardDescription>Assign or change the user's subscription tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Tier</label>
                <Select value={selectedTier} onValueChange={handleTierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        {tier.display_name} - {tier.max_chatbots === -1 ? 'Unlimited' : tier.max_chatbots} chatbots (${tier.price_monthly}/mo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentTier && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="font-semibold">{currentTier.display_name}</p>
                  <p className="text-sm text-muted-foreground">{currentTier.description}</p>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Chatbot Limit:</span>{' '}
                      <span className="font-medium">{currentTier.max_chatbots === -1 ? 'Unlimited' : currentTier.max_chatbots}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monthly Price:</span>{' '}
                      <span className="font-medium">${currentTier.price_monthly}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Login As Confirmation Dialog */}
      <AlertDialog open={showLoginAsDialog} onOpenChange={setShowLoginAsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login As User</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to login as <strong>{user.email}</strong>. This will open a new tab where you'll be logged in as this user.
              <br /><br />
              <span className="text-amber-600">
                Warning: All actions you take will be attributed to this user's account. Use this feature responsibly.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loginAsLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoginAsUser} disabled={loginAsLoading}>
              {loginAsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Link...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Login As User
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserDetails;
