import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Check,
  X,
  Clock,
  ArrowUp,
  User as UserIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Bot,
  MessageSquare,
  Brain,
  Users,
  Image,
  Video,
  Sparkles,
  Construction,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionTier, TierFeatures } from '@/types/admin';

interface UpgradeRequest {
  id: string;
  user_id: string;
  requested_tier_id: string;
  current_tier_id: string | null;
  status: string;
  created_at: string;
  user: {
    email: string;
    name: string;
  };
  requested_tier: {
    display_name: string;
    price_monthly: number;
  };
  current_tier: {
    display_name: string;
  } | null;
}

const defaultFeatures: TierFeatures = {
  chatbot: {
    knowledge_base: true,
    ai_training: false,
    whatsapp_integration: true,
    contacts_management: true,
    follow_ups: true,
    prompt_engineer: false,
  },
};

interface TierFormData {
  name: string;
  display_name: string;
  description: string;
  price_monthly: string;
  price_quarterly: string;
  discount_percentage: string;
  max_avatars: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: string;
  features: TierFeatures;
}

const defaultTierForm: TierFormData = {
  name: '',
  display_name: '',
  description: '',
  price_monthly: '0',
  price_quarterly: '0',
  discount_percentage: '17',
  max_avatars: '1',
  is_active: true,
  is_featured: false,
  sort_order: '0',
  features: defaultFeatures,
};

// Feature labels for display
const featureLabels = {
  chatbot: {
    knowledge_base: { label: 'Knowledge Base', description: 'Upload documents for AI to reference' },
    ai_training: { label: 'AI Training & Fine-tuning', description: 'Train custom AI models' },
    whatsapp_integration: { label: 'WhatsApp Integration', description: 'Connect to WhatsApp' },
    contacts_management: { label: 'Contacts Management', description: 'Manage customer contacts' },
    follow_ups: { label: 'Smart Follow-ups', description: 'AI-powered follow-up system' },
    prompt_engineer: { label: 'Prompt Engineer', description: 'Advanced prompt optimization' },
  },
};

export const TiersManagementNew = () => {
  const { adminUser } = useAdminAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [deletingTier, setDeletingTier] = useState<SubscriptionTier | null>(null);
  const [formData, setFormData] = useState<TierFormData>(defaultTierForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchUpgradeRequests(),
        fetchTiers(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpgradeRequests = async () => {
    try {
      const { data: requests, error: requestsError } = await supabase
        .from('tier_upgrade_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      const enrichedRequests = await Promise.all(
        (requests || []).map(async (req: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', req.user_id)
            .single();

          const { data: requestedTier } = await supabase
            .from('subscription_tiers')
            .select('display_name, price_monthly')
            .eq('id', req.requested_tier_id)
            .single();

          let currentTier = null;
          if (req.current_tier_id) {
            const { data: current } = await supabase
              .from('subscription_tiers')
              .select('display_name')
              .eq('id', req.current_tier_id)
              .single();
            currentTier = current;
          }

          return {
            id: req.id,
            user_id: req.user_id,
            requested_tier_id: req.requested_tier_id,
            current_tier_id: req.current_tier_id,
            status: req.status,
            created_at: req.created_at,
            user: {
              email: profile?.email || 'Unknown',
              name: profile?.name || 'Unknown',
            },
            requested_tier: requestedTier || { display_name: 'Unknown', price_monthly: 0 },
            current_tier: currentTier,
          };
        })
      );

      setRequests(enrichedRequests);
    } catch (error) {
      console.error('Error fetching upgrade requests:', error);
    }
  };

  const fetchTiers = async () => {
    try {
      const { data: tiersData, error: tiersError } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('sort_order', { ascending: true });

      if (tiersError) throw tiersError;

      // Parse features JSON with deep merge to ensure all properties exist
      const parsedTiers = (tiersData || []).map((tier: any) => ({
        ...tier,
        features: {
          chatbot: {
            ...defaultFeatures.chatbot,
            ...(tier.features?.chatbot || {}),
          },
        },
      }));

      setTiers(parsedTiers);

      const counts: Record<string, number> = {};
      for (const tier of parsedTiers) {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('subscription_tier_id', tier.id);

        counts[tier.id] = count || 0;
      }
      setUserCounts(counts);
    } catch (error) {
      console.error('Error fetching tiers:', error);
    }
  };

  const handleApproveRequest = async (request: UpgradeRequest) => {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ subscription_tier_id: request.requested_tier_id })
        .eq('id', request.user_id);

      if (profileError) throw profileError;

      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: request.user_id,
          tier_id: request.requested_tier_id,
          status: 'active',
          billing_cycle: 'monthly',
          started_at: new Date().toISOString(),
        });

      if (subError) throw subError;

      const { error: requestError } = await supabase
        .from('tier_upgrade_requests')
        .update({
          status: 'approved',
          reviewed_by: adminUser?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (requestError) throw requestError;

      toast({
        title: 'Request Approved',
        description: `${request.user.name} is now on ${request.requested_tier.display_name}`,
      });
      await fetchData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({ title: 'Error', description: 'Failed to approve request', variant: 'destructive' });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('tier_upgrade_requests')
        .update({
          status: 'rejected',
          reviewed_by: adminUser?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({ title: 'Request Rejected' });
      await fetchData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({ title: 'Error', description: 'Failed to reject request', variant: 'destructive' });
    }
  };

  // Calculate quarterly price with custom discount percentage
  const calculateQuarterlyPrice = (monthly: number, discountPercent: number = 17) => {
    const discountMultiplier = (100 - discountPercent) / 100;
    return Math.round(monthly * 3 * discountMultiplier * 100) / 100;
  };

  // Tier CRUD handlers
  const openCreateDialog = () => {
    setEditingTier(null);
    setFormData({
      ...defaultTierForm,
      sort_order: String(tiers.length + 1),
    });
    setIsFormOpen(true);
  };

  const openEditDialog = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    // Deep merge features with defaults to ensure all properties exist
    const mergedFeatures: TierFeatures = {
      chatbot: {
        ...defaultFeatures.chatbot,
        ...(tier.features?.chatbot || {}),
      },
    };
    // Calculate discount percentage from existing prices (if quarterly exists)
    let discountPercent = 17;
    if (tier.price_monthly && tier.price_quarterly && tier.price_monthly > 0) {
      const fullQuarterly = tier.price_monthly * 3;
      discountPercent = Math.round((1 - tier.price_quarterly / fullQuarterly) * 100);
    }
    setFormData({
      name: tier.name || '',
      display_name: tier.display_name || '',
      description: tier.description || '',
      price_monthly: String(tier.price_monthly ?? 0),
      price_quarterly: String(tier.price_quarterly ?? calculateQuarterlyPrice(tier.price_monthly || 0)),
      discount_percentage: String(discountPercent),
      max_avatars: String(tier.max_avatars ?? 1),
      is_active: tier.is_active ?? true,
      is_featured: tier.is_featured ?? false,
      sort_order: String(tier.sort_order ?? 0),
      features: mergedFeatures,
    });
    setIsFormOpen(true);
  };

  const openDeleteDialog = (tier: SubscriptionTier) => {
    setDeletingTier(tier);
    setIsDeleteOpen(true);
  };

  const handleSaveTier = async () => {
    if (!formData.name || !formData.display_name) {
      toast({ title: 'Error', description: 'Name and Display Name are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const monthlyPrice = parseFloat(formData.price_monthly) || 0;
      const tierData = {
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description || null,
        price_monthly: monthlyPrice,
        price_quarterly: parseFloat(formData.price_quarterly) || calculateQuarterlyPrice(monthlyPrice),
        max_avatars: parseInt(formData.max_avatars) || 1,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        sort_order: parseInt(formData.sort_order) || 0,
        features: formData.features,
      };

      if (editingTier) {
        const { error } = await supabase
          .from('subscription_tiers')
          .update(tierData)
          .eq('id', editingTier.id);

        if (error) throw error;
        toast({ title: 'Tier Updated', description: `${formData.display_name} has been updated` });
      } else {
        const { error } = await supabase
          .from('subscription_tiers')
          .insert(tierData);

        if (error) throw error;
        toast({ title: 'Tier Created', description: `${formData.display_name} has been created` });
      }

      setIsFormOpen(false);
      await fetchTiers();
    } catch (error: any) {
      console.error('Error saving tier:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save tier', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = async () => {
    if (!deletingTier) return;

    if (userCounts[deletingTier.id] > 0) {
      toast({
        title: 'Cannot Delete',
        description: `This tier has ${userCounts[deletingTier.id]} users. Move them to another tier first.`,
        variant: 'destructive',
      });
      setIsDeleteOpen(false);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('delete_subscription_tier', {
        tier_id_to_delete: deletingTier.id
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to delete tier');
      }

      toast({ title: 'Tier Deleted', description: `${deletingTier.display_name} has been deleted` });
      setIsDeleteOpen(false);
      await fetchTiers();
    } catch (error: any) {
      console.error('Error deleting tier:', error);
      toast({ title: 'Error', description: error.message || 'Failed to delete tier', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = (category: 'chatbot', feature: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...defaultFeatures,
        ...prev.features,
        [category]: {
          ...defaultFeatures[category],
          ...(prev.features?.[category] || {}),
          [feature]: value,
        },
      },
    }));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: any }> = {
      pending: { variant: 'secondary', icon: Clock },
      approved: { variant: 'default', icon: Check },
      rejected: { variant: 'destructive', icon: X },
    };

    const config = variants[status] || { variant: 'secondary', icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Count enabled features
  const countEnabledFeatures = (features: TierFeatures) => {
    let count = 0;
    Object.values(features.chatbot).forEach(v => v && count++);
    return count;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const reviewedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tier Management</h2>
          <p className="text-muted-foreground">Manage subscription tiers, pricing, and feature access</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="tiers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tiers">Subscription Tiers</TabsTrigger>
          <TabsTrigger value="preview">Pricing Preview</TabsTrigger>
          <TabsTrigger value="requests">
            Upgrade Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Tiers Management Tab */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tier
            </Button>
          </div>

          <div className="grid gap-4">
            {tiers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  No tiers found. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              tiers.map((tier) => (
                <Card key={tier.id} className={tier.is_featured ? 'border-primary' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{tier.display_name}</CardTitle>
                          {tier.is_featured && (
                            <Badge className="bg-primary">Featured</Badge>
                          )}
                          {!tier.is_active && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">{tier.description || tier.name}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(tier)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(tier)}
                          disabled={userCounts[tier.id] > 0}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-6">
                      {/* Pricing */}
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Pricing</h4>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold">RM {tier.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                          {tier.price_quarterly > 0 && tier.price_monthly > 0 && (
                            <div className="text-sm">
                              <span className="text-green-600 font-medium">RM {tier.price_quarterly}/quarter</span>
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Save {Math.round((1 - tier.price_quarterly / (tier.price_monthly * 3)) * 100)}%
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Limits */}
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Limits</h4>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          <span>{tier.max_avatars === -1 ? 'Unlimited' : tier.max_avatars} Chatbots</span>
                        </div>
                      </div>

                      {/* Chatbot Features */}
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Chatbot Features</h4>
                        <div className="space-y-1 text-sm">
                          {Object.entries(tier.features?.chatbot || {}).map(([key, enabled]) => (
                            <div key={key} className="flex items-center gap-2">
                              {enabled ? (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <X className="h-3.5 w-3.5 text-gray-300" />
                              )}
                              <span className={!enabled ? 'text-muted-foreground' : ''}>
                                {featureLabels.chatbot[key as keyof typeof featureLabels.chatbot]?.label || key}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Pricing Preview Tab - Claude-like */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Preview</CardTitle>
              <CardDescription>How pricing will appear to users (Claude-style layout)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {tiers.filter(t => t.is_active).map((tier) => (
                  <div
                    key={tier.id}
                    className={`relative rounded-xl border-2 p-6 ${
                      tier.is_featured ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    {tier.is_featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary">Most Popular</Badge>
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold">{tier.display_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
                    </div>

                    <div className="text-center mb-6">
                      <div className="text-4xl font-bold">RM {tier.price_monthly}</div>
                      <div className="text-muted-foreground">per month</div>
                      {tier.price_quarterly > 0 && tier.price_monthly > 0 && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-green-600 dark:text-green-400 font-medium">
                            RM {tier.price_quarterly}/quarter
                          </div>
                          <div className="text-xs text-green-600/80">
                            Save {Math.round((1 - tier.price_quarterly / (tier.price_monthly * 3)) * 100)}% with quarterly billing
                          </div>
                        </div>
                      )}
                    </div>

                    <Button className="w-full mb-6" variant={tier.is_featured ? 'default' : 'outline'}>
                      Get Started
                    </Button>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 font-medium mb-2">
                          <Bot className="h-4 w-4" />
                          {tier.max_avatars === -1 ? 'Unlimited' : tier.max_avatars} Chatbots
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <div className="flex items-center gap-2 font-medium mb-3">
                          <MessageSquare className="h-4 w-4" />
                          Chatbot Features
                        </div>
                        <div className="space-y-2">
                          {Object.entries(tier.features?.chatbot || {}).map(([key, enabled]) => (
                            <div key={key} className="flex items-center gap-2 text-sm">
                              {enabled ? (
                                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <X className="h-4 w-4 text-gray-300 flex-shrink-0" />
                              )}
                              <span className={!enabled ? 'text-muted-foreground' : ''}>
                                {featureLabels.chatbot[key as keyof typeof featureLabels.chatbot]?.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upgrade Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>User requests waiting for your approval</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending upgrade requests
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Current Tier</TableHead>
                      <TableHead>Requested Tier</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{request.user.name}</div>
                            <div className="text-sm text-muted-foreground">{request.user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {request.current_tier?.display_name || 'No tier'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ArrowUp className="h-4 w-4 text-green-500" />
                            <Badge variant="default">{request.requested_tier.display_name}</Badge>
                            <span className="text-sm text-muted-foreground">
                              RM {request.requested_tier.price_monthly}/mo
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" onClick={() => handleApproveRequest(request)}>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectRequest(request.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {reviewedRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Request History</CardTitle>
                <CardDescription>Previously reviewed upgrade requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Requested Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewedRequests.slice(0, 10).map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="text-sm">{request.user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{request.requested_tier.display_name}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Tier Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTier ? 'Edit Tier' : 'Create New Tier'}</DialogTitle>
            <DialogDescription>
              {editingTier ? 'Update the subscription tier details and features' : 'Add a new subscription tier with pricing and feature access'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Basic Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Internal Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. pro_tier"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name *</Label>
                  <Input
                    id="display_name"
                    placeholder="e.g. Pro Plan"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this tier offers..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-4">
              <h4 className="font-medium">Pricing</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_monthly">Monthly (RM)</Label>
                  <Input
                    id="price_monthly"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price_monthly}
                    onChange={(e) => {
                      const monthly = parseFloat(e.target.value) || 0;
                      const discount = parseFloat(formData.discount_percentage) || 17;
                      setFormData({
                        ...formData,
                        price_monthly: e.target.value,
                        price_quarterly: String(calculateQuarterlyPrice(monthly, discount)),
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_percentage">Quarterly Discount (%)</Label>
                  <Input
                    id="discount_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={formData.discount_percentage}
                    onChange={(e) => {
                      const discount = parseFloat(e.target.value) || 0;
                      const monthly = parseFloat(formData.price_monthly) || 0;
                      setFormData({
                        ...formData,
                        discount_percentage: e.target.value,
                        price_quarterly: String(calculateQuarterlyPrice(monthly, discount)),
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_quarterly">Quarterly Price (RM)</Label>
                  <Input
                    id="price_quarterly"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price_quarterly}
                    onChange={(e) => setFormData({ ...formData, price_quarterly: e.target.value })}
                  />
                  <p className="text-xs text-green-600">{formData.discount_percentage}% discount applied</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_avatars">Max Chatbots</Label>
                  <Input
                    id="max_avatars"
                    type="number"
                    min="-1"
                    value={formData.max_avatars}
                    onChange={(e) => setFormData({ ...formData, max_avatars: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">-1 for unlimited</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Chatbot Features */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chatbot Features
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(featureLabels.chatbot).map(([key, { label, description }]) => (
                  <div key={key} className="flex items-start justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={formData.features?.chatbot?.[key as keyof typeof defaultFeatures.chatbot] ?? defaultFeatures.chatbot[key as keyof typeof defaultFeatures.chatbot]}
                      onCheckedChange={(checked) => updateFeature('chatbot', key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">Settings</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">Show to users</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Featured</Label>
                    <p className="text-xs text-muted-foreground">Highlight tier</p>
                  </div>
                  <Switch
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                </div>
                <div className="space-y-2 p-3 border rounded-lg">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min="0"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveTier} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingTier ? 'Update Tier' : 'Create Tier'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingTier?.display_name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTier}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
