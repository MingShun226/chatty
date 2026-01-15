import { useEffect, useState } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
}

export const UsersManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loginAsDialog, setLoginAsDialog] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null });
  const [loginAsLoading, setLoginAsLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchTiers();
  }, []);

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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // First, get all admin user IDs to exclude them from the list
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('user_id');

      const adminUserIds = new Set(adminUsers?.map(a => a.user_id) || []);

      // Fetch profiles with tier info
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          name,
          account_status,
          created_at,
          last_login,
          subscription_tier_id,
          subscription_tiers:subscription_tier_id (
            id,
            display_name
          )
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Filter out admin users - they are managed in Admin Management page
      const nonAdminProfiles = (profiles || []).filter(p => !adminUserIds.has(p.id));

      // Fetch chatbot counts for each user in parallel
      const usersWithCounts = await Promise.all(
        nonAdminProfiles.map(async (profile) => {
          const { count: chatbotsCount } = await supabase
            .from('avatars')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .eq('status', 'active');

          return {
            ...profile,
            subscription_tier: profile.subscription_tiers as any,
            chatbots_count: chatbotsCount || 0,
          };
        })
      );

      setUsers(usersWithCounts);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = async (userId: string, newTierId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier_id: newTierId || null })
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          const newTier = tiers.find(t => t.id === newTierId);
          return {
            ...u,
            subscription_tier_id: newTierId || null,
            subscription_tier: newTier ? { id: newTier.id, display_name: newTier.display_name } : null
          };
        }
        return u;
      }));

      toast({ title: 'Tier Updated', description: 'Subscription tier has been updated.' });
    } catch (error) {
      console.error('Error updating tier:', error);
      toast({ title: 'Error', description: 'Failed to update tier', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (user: UserRow) => {
    const newStatus = user.account_status === 'active' ? 'suspended' : 'active';
    setActionLoading(user.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, account_status: newStatus } : u));
      toast({
        title: newStatus === 'active' ? 'User Activated' : 'User Suspended',
        description: `${user.email} has been ${newStatus === 'active' ? 'activated' : 'suspended'}.`
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: 'Failed to update user status', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleLoginAsUser = async () => {
    if (!loginAsDialog.user) return;

    setLoginAsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { targetUserId: loginAsDialog.user.id, targetEmail: loginAsDialog.user.email }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({ title: 'Login Link Generated', description: 'A new tab has been opened with the user session.' });
      } else {
        throw new Error('No login URL returned');
      }
    } catch (error: any) {
      console.error('Error generating login link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate login link. Ensure the admin-impersonate edge function is deployed.',
        variant: 'destructive'
      });
    } finally {
      setLoginAsLoading(false);
      setLoginAsDialog({ open: false, user: null });
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge variant="default" className="bg-green-600">Active</Badge>;
    }
    if (status === 'suspended') {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage platform users, subscriptions, and access</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">User</TableHead>
                    <TableHead className="w-[160px]">Subscription</TableHead>
                    <TableHead className="text-center w-[80px]">Chatbots</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[120px]">Last Active</TableHead>
                    <TableHead className="text-right w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        {/* User Info */}
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name || 'No name'}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </TableCell>

                        {/* Subscription Tier */}
                        <TableCell>
                          <Select
                            value={user.subscription_tier_id || 'none'}
                            onValueChange={(value) => handleTierChange(user.id, value === 'none' ? '' : value)}
                            disabled={actionLoading === user.id}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="No tier" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No tier</SelectItem>
                              {tiers.map((tier) => (
                                <SelectItem key={tier.id} value={tier.id}>
                                  {tier.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Chatbots Count */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-1 text-sm">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{user.chatbots_count}</span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>{getStatusBadge(user.account_status)}</TableCell>

                        {/* Last Active */}
                        <TableCell className="text-sm text-muted-foreground">
                          {user.last_login
                            ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                            : 'Never'}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Login As */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setLoginAsDialog({ open: true, user })}
                                  disabled={user.account_status !== 'active' || actionLoading === user.id}
                                  className="h-8 px-2"
                                >
                                  <LogIn className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Login as this user</TooltipContent>
                            </Tooltip>

                            {/* Suspend/Activate */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={user.account_status === 'active' ? 'destructive' : 'default'}
                                  size="sm"
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={actionLoading === user.id}
                                  className="h-8 px-2"
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : user.account_status === 'active' ? (
                                    <Ban className="h-3.5 w-3.5" />
                                  ) : (
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.account_status === 'active' ? 'Suspend user' : 'Activate user'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {filteredUsers.length} of {users.length} users</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-600"></span>
                  Active: {users.filter(u => u.account_status === 'active').length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  Suspended: {users.filter(u => u.account_status === 'suspended').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login As Confirmation Dialog */}
        <AlertDialog open={loginAsDialog.open} onOpenChange={(open) => setLoginAsDialog({ open, user: open ? loginAsDialog.user : null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Login As User</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to login as <strong>{loginAsDialog.user?.email}</strong>.
                This will open their dashboard in a new tab.
                <br /><br />
                <span className="text-amber-600">
                  All actions will be attributed to this user's account.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loginAsLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLoginAsUser} disabled={loginAsLoading}>
                {loginAsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Opening...
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
    </TooltipProvider>
  );
};
