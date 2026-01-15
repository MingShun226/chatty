import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Settings, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { UserProfile } from '@/components/settings/UserProfile';
import ReferralSection from '@/components/settings/ReferralSection';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SettingsSection = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch profile data for referral section
  const { data: profileData } = useQuery({
    queryKey: ['profile-referral', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code, referrer_id')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        throw error;
      }

      return data || { referral_code: '', referrer_id: null };
    },
    enabled: !!user?.id
  });

  const handleReferralUpdate = (data: { referrerCode: string }) => {
    // This will be handled by the ReferralSection component
    console.log('Referral updated:', data);
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || deleteConfirmation !== 'DELETE') return;

    setIsDeleting(true);
    try {
      // Delete storage files first (not handled by the RPC function)
      try {
        const { data: avatarFiles } = await supabase.storage
          .from('avatars')
          .list(user.id);
        if (avatarFiles && avatarFiles.length > 0) {
          await supabase.storage
            .from('avatars')
            .remove(avatarFiles.map(f => `${user.id}/${f.name}`));
        }

        const { data: knowledgeFiles } = await supabase.storage
          .from('knowledge-base')
          .list(user.id);
        if (knowledgeFiles && knowledgeFiles.length > 0) {
          await supabase.storage
            .from('knowledge-base')
            .remove(knowledgeFiles.map(f => `${user.id}/${f.name}`));
        }
      } catch (storageError) {
        console.error('Error deleting storage files:', storageError);
        // Continue with account deletion even if storage deletion fails
      }

      // Call the database function to delete all user data and auth record
      const { error } = await supabase.rpc('delete_user_account');

      if (error) {
        throw error;
      }

      toast({
        title: 'Account Deleted',
        description: 'Your account and all associated data have been permanently deleted.',
      });

      // Sign out the user (session will be invalid anyway)
      await signOut();

    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete account. Please contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmation('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and referral settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="referral">Referral</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* Profile Management Tab */}
        <TabsContent value="profile" className="space-y-4">
          <UserProfile />
        </TabsContent>

        {/* Referral System Tab */}
        <TabsContent value="referral" className="space-y-4">
          {profileData && (
            <ReferralSection
              profileData={{
                referralCode: profileData.referral_code || '',
                referrerCode: profileData.referrer_id || ''
              }}
              onUpdate={handleReferralUpdate}
            />
          )}
        </TabsContent>

        {/* Account Management Tab */}
        <TabsContent value="account" className="space-y-4">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h4 className="font-semibold text-destructive mb-2">Delete Account</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. This action will permanently delete:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mb-4 space-y-1">
                  <li>Your profile and personal information</li>
                  <li>All your chatbots and their configurations</li>
                  <li>All products, promotions, and knowledge base files</li>
                  <li>All conversation history and contacts</li>
                  <li>All API keys and WhatsApp connections</li>
                  <li>All training data and prompt versions</li>
                </ul>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Account Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Delete Account Permanently?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      This action cannot be undone. All your data will be permanently deleted from our servers.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="delete-confirmation">
                        Type <span className="font-bold text-destructive">DELETE</span> to confirm:
                      </Label>
                      <Input
                        id="delete-confirmation"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value.toUpperCase())}
                        placeholder="Type DELETE"
                        className="border-destructive/50"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setDeleteConfirmation('');
                    setShowDeleteDialog(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Forever
                    </>
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsSection;
