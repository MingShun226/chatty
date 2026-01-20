import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Ban,
  CheckCircle,
  LogIn,
  ExternalLink,
  Loader2,
  Bot,
  RefreshCw,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Key,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionTier } from '@/types/admin';

interface UserRow {
  id: string;
  email: string;
  name: string;
  account_status: string;
  created_at: string;
  last_login: string | null;
  subscription_tier_id: string | null;
  subscription_tier: {
    id: string;
    display_name: string;
  } | null;
  chatbots_count: number;
  activation_status?: 'pending' | 'active' | 'suspended' | null;
  api_key_requested?: boolean;
}

export const UsersManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loginAsDialog, setLoginAsDialog] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null });
  const [loginAsLoading, setLoginAsLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchUsers();
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('price_monthly', { ascending: true });
      if (error) throw error;
      setTiers(data || []);
    } catch (error: any) {
      console.error('Error fetching tiers:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get all admin user IDs to filter them out from the user list
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('is_active', true);
      const adminUserIds = new Set(adminUsers?.map(a => a.user_id) || []);

      // Get all profiles with their subscription tiers
      // Note: api_key_requested may not exist if migration not applied yet
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          name,
          account_status,
          created_at,
          last_login,
          subscription_tier_id,
          subscription_tiers (
            id,
            display_name
          )
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Filter out admin users from the list
      const profiles = allProfiles?.filter(p => !adminUserIds.has(p.id)) || [];

      // Try to fetch api_key_requested separately (column may not exist yet)
      let apiKeyRequestMap: Record<string, boolean> = {};
      try {
        const { data: apiKeyData } = await supabase
          .from('profiles')
          .select('id, api_key_requested')
          .in('id', profiles?.map(p => p.id) || []);

        if (apiKeyData) {
          apiKeyRequestMap = apiKeyData.reduce((acc, p) => {
            acc[p.id] = p.api_key_requested || false;
            return acc;
          }, {} as Record<string, boolean>);
        }
      } catch {
        // Column doesn't exist yet, ignore
      }

      // Get chatbot counts and activation status for each user
      const userIds = profiles?.map(p => p.id) || [];
      const chatbotPromises = userIds.map(async (userId) => {
        const { data, count } = await supabase
          .from('avatars')
          .select('id, activation_status', { count: 'exact' })
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1);
        return {
          userId,
          count: count || 0,
          activation_status: data?.[0]?.activation_status || null
        };
      });
      const chatbotResults = await Promise.all(chatbotPromises);
      const chatbotMap = chatbotResults.reduce((acc, { userId, count, activation_status }) => {
        acc[userId] = { count, activation_status };
        return acc;
      }, {} as Record<string, { count: number; activation_status: string | null }>);

      // Combine all data
      const formattedUsers: UserRow[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email || 'Unknown',
        name: profile.name || 'Unnamed',
        account_status: profile.account_status || 'active',
        created_at: profile.created_at,
        last_login: profile.last_login,
        subscription_tier_id: profile.subscription_tier_id,
        subscription_tier: profile.subscription_tiers ? {
          id: profile.subscription_tiers.id,
          display_name: profile.subscription_tiers.display_name
        } : null,
        chatbots_count: chatbotMap[profile.id]?.count || 0,
        activation_status: chatbotMap[profile.id]?.activation_status as any,
        api_key_requested: apiKeyRequestMap[profile.id] || false
      }));

      setUsers(formattedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setActionLoading(userId);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, account_status: newStatus } : u
      ));

      toast({
        title: 'Success',
        description: `User ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleLoginAs = async (user: UserRow) => {
    setLoginAsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: user.id }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: 'Success',
          description: 'Opening user dashboard in new tab...'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to login as user',
        variant: 'destructive'
      });
    } finally {
      setLoginAsLoading(false);
      setLoginAsDialog({ open: false, user: null });
    }
  };

  const handleDeleteUser = async (user: UserRow) => {
    setDeleteLoading(true);
    try {
      // Call edge function to delete user (handles auth.users and cascades)
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { targetUserId: user.id }
      });

      if (error) throw error;

      // Remove user from local state
      setUsers(prev => prev.filter(u => u.id !== user.id));

      toast({
        title: 'User Deleted',
        description: `${user.name || user.email} has been permanently deleted.`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive'
      });
    } finally {
      setDeleteLoading(false);
      setDeleteDialog({ open: false, user: null });
    }
  };

  const handleChangeTier = async (userId: string, tierId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier_id: tierId || null })
        .eq('id', userId);

      if (error) throw error;

      const tierName = tierId ? tiers.find(t => t.id === tierId)?.display_name : 'Free';
      setUsers(prev => prev.map(u =>
        u.id === userId ? {
          ...u,
          subscription_tier_id: tierId || null,
          subscription_tier: tierId ? { id: tierId, display_name: tierName || 'Unknown' } : null
        } : u
      ));

      toast({
        title: 'Success',
        description: 'Subscription tier updated'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'pending') return matchesSearch && user.activation_status === 'pending';
    if (statusFilter === 'active') return matchesSearch && user.activation_status === 'active';
    if (statusFilter === 'suspended') return matchesSearch && user.account_status === 'suspended';
    if (statusFilter === 'no-chatbot') return matchesSearch && user.chatbots_count === 0;
    if (statusFilter === 'api-key-requested') return matchesSearch && user.api_key_requested;

    return matchesSearch;
  });

  // Stats
  const pendingActivation = users.filter(u => u.activation_status === 'pending').length;
  const activeUsers = users.filter(u => u.activation_status === 'active').length;
  const totalChatbots = users.reduce((sum, u) => sum + u.chatbots_count, 0);
  const apiKeyRequests = users.filter(u => u.api_key_requested).length;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Users Management
            </h1>
            <p className="text-muted-foreground">Manage all platform users and their configurations</p>
          </div>
          <Button onClick={fetchUsers} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-3xl font-bold">{users.length}</p>
                </div>
                <Users className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('pending')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Activation</p>
                  <p className="text-3xl font-bold">{pendingActivation}</p>
                </div>
                <Clock className="h-10 w-10 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('api-key-requested')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">API Key Requests</p>
                  <p className="text-3xl font-bold">{apiKeyRequests}</p>
                </div>
                <Key className="h-10 w-10 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md" onClick={() => setStatusFilter('active')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Chatbots</p>
                  <p className="text-3xl font-bold">{activeUsers}</p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Chatbots</p>
                  <p className="text-3xl font-bold">{totalChatbots}</p>
                </div>
                <Bot className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Click on a user to view and manage their details</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="pending">Pending Activation</SelectItem>
                    <SelectItem value="api-key-requested">API Key Requested</SelectItem>
                    <SelectItem value="active">Active Chatbots</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="no-chatbot">No Chatbot</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[250px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Chatbot Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                            {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.name || 'Unnamed'}</p>
                              {user.api_key_requested && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
                                      <Key className="h-3 w-3 mr-1" /> API Key
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    User requested API key from admin
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.chatbots_count === 0 ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            No Chatbot
                          </Badge>
                        ) : user.activation_status === 'active' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : user.activation_status === 'suspended' ? (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" /> Suspended
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.subscription_tier_id || 'free'}
                          onValueChange={(value) => handleChangeTier(user.id, value === 'free' ? '' : value)}
                          disabled={actionLoading === user.id}
                        >
                          <SelectTrigger className="w-[130px]" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            {tiers.map(tier => (
                              <SelectItem key={tier.id} value={tier.id}>
                                {tier.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.account_status === 'active' ? 'default' : 'destructive'}>
                          {user.account_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/users/${user.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Details</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLoginAsDialog({ open: true, user });
                                }}
                              >
                                <LogIn className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Login as User</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStatus(user.id, user.account_status);
                                }}
                                disabled={actionLoading === user.id}
                              >
                                {actionLoading === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : user.account_status === 'active' ? (
                                  <Ban className="h-4 w-4" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {user.account_status === 'active' ? 'Suspend User' : 'Activate User'}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDialog({ open: true, user });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete User</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Login As Dialog */}
        <AlertDialog open={loginAsDialog.open} onOpenChange={(open) => setLoginAsDialog({ open, user: open ? loginAsDialog.user : null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Login as {loginAsDialog.user?.name || loginAsDialog.user?.email}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will open a new tab where you'll be logged in as this user.
                Use this for troubleshooting or testing purposes only.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => loginAsDialog.user && handleLoginAs(loginAsDialog.user)}
                disabled={loginAsLoading}
              >
                {loginAsLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Open as User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete User Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: open ? deleteDialog.user : null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Delete User Permanently?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  You are about to permanently delete <strong>{deleteDialog.user?.name || deleteDialog.user?.email}</strong>.
                </p>
                <p className="text-destructive font-medium">
                  This action cannot be undone. All of the user's data will be permanently deleted, including:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>User account and profile</li>
                  <li>All chatbots ({deleteDialog.user?.chatbots_count || 0})</li>
                  <li>Products, promotions, and knowledge files</li>
                  <li>Conversation history and contacts</li>
                  <li>API keys and configurations</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDialog.user && handleDeleteUser(deleteDialog.user)}
                disabled={deleteLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};
