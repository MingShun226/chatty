import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ShieldCheck,
  UserPlus,
  Loader2,
  Ban,
  CheckCircle,
  Trash2,
  RefreshCw,
  Crown,
  Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { AdminRole } from '@/types/admin';

interface AdminUserRow {
  id: string;
  user_id: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  email?: string;
  name?: string;
}

interface AvailableUser {
  id: string;
  email: string;
  name: string | null;
}

const rolePermissions: Record<AdminRole, any> = {
  super_admin: {
    users: { read: true, write: true, delete: true },
    chatbots: { read: true, write: true, delete: true },
    tiers: { read: true, write: true, delete: true },
    financial: { read: true, write: true, delete: true },
    settings: { read: true, write: true, delete: true },
    moderation: { read: true, write: true, delete: true },
  },
  admin: {
    users: { read: true, write: true, delete: false },
    chatbots: { read: true, write: true, delete: false },
    tiers: { read: true, write: true, delete: false },
    financial: { read: true, write: false, delete: false },
    settings: { read: true, write: false, delete: false },
    moderation: { read: true, write: true, delete: false },
  },
  moderator: {
    users: { read: true, write: false, delete: false },
    chatbots: { read: true, write: false, delete: false },
    tiers: { read: false, write: false, delete: false },
    financial: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    moderation: { read: true, write: true, delete: false },
  },
  support: {
    users: { read: true, write: false, delete: false },
    chatbots: { read: true, write: false, delete: false },
    tiers: { read: false, write: false, delete: false },
    financial: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    moderation: { read: true, write: false, delete: false },
  },
  analyst: {
    users: { read: true, write: false, delete: false },
    chatbots: { read: true, write: false, delete: false },
    tiers: { read: true, write: false, delete: false },
    financial: { read: true, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    moderation: { read: false, write: false, delete: false },
  },
};

export const AdminManagement = () => {
  const { adminUser, isSuperAdmin } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add admin dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('admin');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; admin: AdminUserRow | null }>({ open: false, admin: null });

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Fetch available users when dialog opens
  useEffect(() => {
    if (addDialogOpen) {
      fetchAvailableUsers();
    }
  }, [addDialogOpen]);

  const fetchAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      // Get all admin user IDs
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('user_id');

      const adminUserIds = new Set(adminData?.map(a => a.user_id) || []);

      // Get all profiles that are not admins
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name')
        .order('email', { ascending: true });

      if (error) throw error;

      // Filter out users who are already admins
      const available = (profiles || [])
        .filter(p => !adminUserIds.has(p.id))
        .map(p => ({
          id: p.id,
          email: p.email || 'No email',
          name: p.name,
        }));

      setAvailableUsers(available);
    } catch (error) {
      console.error('Error fetching available users:', error);
      toast.error('Failed to load available users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      // Fetch admin users with profile info
      const { data: adminData, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile info for each admin
      const adminsWithProfiles = await Promise.all(
        (adminData || []).map(async (admin) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', admin.user_id)
            .single();

          return {
            ...admin,
            email: profile?.email || 'Unknown',
            name: profile?.name || 'Unknown',
          };
        })
      );

      setAdmins(adminsWithProfiles);
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error('Failed to fetch admin users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setAddingAdmin(true);
    try {
      // Create admin user
      const { error } = await supabase
        .from('admin_users')
        .insert({
          user_id: selectedUserId,
          role: newAdminRole,
          permissions: rolePermissions[newAdminRole],
          is_active: true,
          created_by: adminUser?.id,
        });

      if (error) throw error;

      toast.success('Admin user added successfully');
      setAddDialogOpen(false);
      setSelectedUserId('');
      setNewAdminRole('admin');
      fetchAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      toast.error('Failed to add admin user');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleToggleStatus = async (admin: AdminUserRow) => {
    if (admin.user_id === adminUser?.user_id) {
      toast.error('You cannot deactivate yourself');
      return;
    }

    setActionLoading(admin.id);
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !admin.is_active })
        .eq('id', admin.id);

      if (error) throw error;

      setAdmins(prev => prev.map(a =>
        a.id === admin.id ? { ...a, is_active: !a.is_active } : a
      ));
      toast.success(`Admin ${admin.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      console.error('Error toggling admin status:', error);
      toast.error('Failed to update admin status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (admin: AdminUserRow, newRole: AdminRole) => {
    if (admin.user_id === adminUser?.user_id && newRole !== 'super_admin') {
      toast.error('You cannot demote yourself');
      return;
    }

    setActionLoading(admin.id);
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({
          role: newRole,
          permissions: rolePermissions[newRole]
        })
        .eq('id', admin.id);

      if (error) throw error;

      setAdmins(prev => prev.map(a =>
        a.id === admin.id ? { ...a, role: newRole } : a
      ));
      toast.success('Admin role updated');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update admin role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteDialog.admin) return;

    if (deleteDialog.admin.user_id === adminUser?.user_id) {
      toast.error('You cannot delete yourself');
      setDeleteDialog({ open: false, admin: null });
      return;
    }

    setActionLoading(deleteDialog.admin.id);
    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', deleteDialog.admin.id);

      if (error) throw error;

      setAdmins(prev => prev.filter(a => a.id !== deleteDialog.admin!.id));
      toast.success('Admin removed');
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast.error('Failed to remove admin');
    } finally {
      setActionLoading(null);
      setDeleteDialog({ open: false, admin: null });
    }
  };

  const getRoleBadge = (role: AdminRole) => {
    const colors: Record<AdminRole, string> = {
      super_admin: 'bg-purple-600',
      admin: 'bg-blue-600',
      moderator: 'bg-green-600',
      support: 'bg-amber-600',
      analyst: 'bg-cyan-600',
    };

    const icons: Record<AdminRole, typeof Crown> = {
      super_admin: Crown,
      admin: ShieldCheck,
      moderator: Shield,
      support: Shield,
      analyst: Shield,
    };

    const Icon = icons[role];

    return (
      <Badge className={`${colors[role]} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  if (!isSuperAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">Only super admins can access this page</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Admin Management
              </CardTitle>
              <CardDescription>Manage administrator accounts and permissions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchAdmins}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Admin
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Admin</DialogTitle>
                    <DialogDescription>
                      Add a new administrator to the platform. Select from existing users.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="user">Select User</Label>
                      {loadingUsers ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : availableUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No available users to add as admin</p>
                      ) : (
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                <div className="flex flex-col">
                                  <span>{user.email}</span>
                                  {user.name && (
                                    <span className="text-xs text-muted-foreground">{user.name}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Admin Role</Label>
                      <Select value={newAdminRole} onValueChange={(v) => setNewAdminRole(v as AdminRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super Admin (Full Access)</SelectItem>
                          <SelectItem value="admin">Admin (Management Access)</SelectItem>
                          <SelectItem value="moderator">Moderator (Content Moderation)</SelectItem>
                          <SelectItem value="support">Support (Read-only + Basic Support)</SelectItem>
                          <SelectItem value="analyst">Analyst (Read-only Analytics)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddAdmin} disabled={addingAdmin || !selectedUserId || loadingUsers}>
                      {addingAdmin ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Admin'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Admin</TableHead>
                  <TableHead className="w-[150px]">Role</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[150px]">Last Login</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No admin users found
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {admin.name || 'No name'}
                            {admin.user_id === adminUser?.user_id && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{admin.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={admin.role}
                          onValueChange={(v) => handleRoleChange(admin, v as AdminRole)}
                          disabled={actionLoading === admin.id || admin.user_id === adminUser?.user_id}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.is_active ? 'default' : 'destructive'}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {admin.last_login_at
                          ? formatDistanceToNow(new Date(admin.last_login_at), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant={admin.is_active ? 'destructive' : 'default'}
                            size="sm"
                            onClick={() => handleToggleStatus(admin)}
                            disabled={actionLoading === admin.id || admin.user_id === adminUser?.user_id}
                            className="h-8 px-2"
                          >
                            {admin.is_active ? (
                              <Ban className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteDialog({ open: true, admin })}
                            disabled={actionLoading === admin.id || admin.user_id === adminUser?.user_id}
                            className="h-8 px-2"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Total: {admins.length} admin{admins.length !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, admin: open ? deleteDialog.admin : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteDialog.admin?.email}</strong> as an admin?
              This will revoke all their admin privileges.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdmin} className="bg-destructive text-destructive-foreground">
              Remove Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
