import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  CheckCircle2,
  Clock,
  RotateCcw,
  Eye,
  Play,
  Brain,
  FileText,
  Image,
  AlertCircle,
  Trash2,
  MessageCircle,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TrainingService, PromptVersion, TrainingData } from '@/services/trainingService';
import { VersionDetailsModal } from './VersionDetailsModal';

interface DatabaseVersionControlProps {
  avatarId: string;
  isTraining: boolean;
}

export const DatabaseVersionControl: React.FC<DatabaseVersionControlProps> = ({
  avatarId,
  isTraining
}) => {
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [trainingSessions, setTrainingSessions] = useState<TrainingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<PromptVersion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState<string>('');
  const [isViewingOriginal, setIsViewingOriginal] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user && avatarId) {
      loadVersionData();
    }
  }, [user, avatarId]);

  const loadVersionData = async () => {
    setIsLoading(true);
    try {
      // Load prompt versions
      const versions = await TrainingService.getPromptVersions(avatarId, user!.id);
      setPromptVersions(versions);

      // Load active version
      const active = await TrainingService.getActivePromptVersion(avatarId, user!.id);
      setActiveVersion(active);

      // Load training sessions
      const sessions = await TrainingService.getAvatarTrainingSessions(avatarId, user!.id);
      setTrainingSessions(sessions);
    } catch (error) {
      console.error('Error loading version data:', error);
      toast({
        title: "Loading Error",
        description: "Could not load version history. Please ensure the training system is set up.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    if (isTraining) {
      toast({
        title: "Cannot Activate",
        description: "Please wait for current training to complete before switching versions.",
        variant: "destructive"
      });
      return;
    }

    try {
      await TrainingService.activatePromptVersion(versionId, avatarId, user!.id);
      await loadVersionData(); // Reload to update UI

      toast({
        title: "Version Activated",
        description: "The selected prompt version is now active for your avatar.",
      });
    } catch (error) {
      console.error('Error activating version:', error);
      toast({
        title: "Activation Failed",
        description: "Failed to activate the selected version.",
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (version: PromptVersion) => {
    setSelectedVersion(version);
    setIsModalOpen(true);
  };

  const handleDeleteVersion = async (version: PromptVersion) => {
    if (isTraining || isDeleting) {
      toast({
        title: "Cannot Delete",
        description: "Please wait for current operations to complete before deleting versions.",
        variant: "destructive"
      });
      return;
    }

    setVersionToDelete(version);
  };

  const confirmDeleteVersion = async () => {
    if (!versionToDelete || !user) return;

    setIsDeleting(true);
    try {
      await TrainingService.deletePromptVersion(versionToDelete.id!, user.id);
      await loadVersionData(); // Reload to update UI
      setVersionToDelete(null);

      toast({
        title: "Version Deleted",
        description: `Version ${versionToDelete.version_number} has been successfully deleted.`,
      });
    } catch (error: any) {
      console.error('Error deleting version:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete the version.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteVersion = () => {
    setVersionToDelete(null);
  };

  const viewOriginalPrompt = async () => {
    if (!user) return;

    try {
      const prompt = await TrainingService.getAvatarSystemPrompt(avatarId, user.id);
      setOriginalPrompt(prompt);
      setIsViewingOriginal(true);
    } catch (error) {
      console.error('Failed to fetch original prompt:', error);
      toast({
        title: "Error",
        description: "Failed to load original prompt",
        variant: "destructive"
      });
    }
  };

  const startEditingName = (version: PromptVersion) => {
    setEditingVersionId(version.id!);
    setEditingName(version.version_name || '');
  };

  const saveVersionName = async () => {
    if (!editingVersionId || !user) return;

    try {
      const { error } = await supabase
        .from('avatar_prompt_versions')
        .update({ version_name: editingName.trim() || null })
        .eq('id', editingVersionId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Name Updated",
        description: "Version name has been updated successfully.",
      });

      setEditingVersionId(null);
      setEditingName('');
      await loadVersionData();
    } catch (error) {
      console.error('Error updating version name:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update version name.",
        variant: "destructive"
      });
    }
  };

  const cancelEditingName = () => {
    setEditingVersionId(null);
    setEditingName('');
  };

  const createV1Version = async () => {
    if (!user) return;

    try {
      // Get avatar data to create v1.0
      const { data: avatar, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', avatarId)
        .eq('user_id', user.id)
        .single();

      if (error || !avatar) {
        throw new Error('Avatar not found');
      }

      const systemPrompt = TrainingService.generateBaseSystemPrompt(avatar);

      // Update avatar with generated system prompt if it doesn't have one
      if (!avatar.system_prompt) {
        await supabase
          .from('avatars')
          .update({ system_prompt: systemPrompt })
          .eq('id', avatarId);
      }

      // Create version 1
      await TrainingService.createPromptVersion({
        avatar_id: avatarId,
        user_id: user.id,
        training_data_id: null,
        version_number: 1,
        version_name: 'Original Avatar Profile',
        description: 'Initial version generated from avatar profile details',
        system_prompt: avatar.system_prompt || systemPrompt,
        personality_traits: avatar.personality_traits || [],
        behavior_rules: [],
        response_style: {
          formality: 'casual',
          emoji_usage: 'minimal',
          response_length: 'adaptive',
          tone: 'friendly'
        },
        is_active: true,
        is_published: false,
        usage_count: 0,
        rating: null,
        feedback_notes: null,
        parent_version_id: null,
        changes_from_parent: null,
        inheritance_type: 'full',
        base_version_id: null
      });

      toast({
        title: "Version Created",
        description: "v1 has been created from your avatar profile",
      });

      // Reload data to show the new version
      loadVersionData();
    } catch (error) {
      console.error('Failed to create v1.0:', error);
      toast({
        title: "Error",
        description: "Failed to create v1.0 version",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ?
      <Play className="h-4 w-4 text-green-600" /> :
      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrainingTypeIcon = (session: TrainingData | undefined) => {
    if (!session) return <Brain className="h-4 w-4" />;

    switch (session.training_type) {
      case 'file_upload':
        return <Image className="h-4 w-4" />;
      case 'conversation_analysis':
        return <FileText className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  const calculateAccuracy = (version: PromptVersion): number => {
    // Simple heuristic based on version features
    let score = 70; // Base score

    if (version.personality_traits && version.personality_traits.length > 0) score += 10;
    if (version.behavior_rules && version.behavior_rules.length > 0) score += 10;
    if (version.response_style && Object.keys(version.response_style).length > 0) score += 10;

    return Math.min(score, 95);
  };

  if (isLoading) {
    return (
      <Card className="card-modern">
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 animate-pulse" />
            <span>Loading version history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-modern">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Training Version History
        </CardTitle>
        <CardDescription>
          Track your avatar's training progress and manage prompt versions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{promptVersions.length}</div>
              <div className="text-sm text-muted-foreground">Total Versions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{trainingSessions.length}</div>
              <div className="text-sm text-muted-foreground">Training Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {activeVersion ? activeVersion.version_number : 'Original'}
              </div>
              <div className="text-sm text-muted-foreground">Active Version</div>
            </div>
          </div>

          {/* Show message only when no versions exist */}
          {promptVersions.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Versions Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create v1.0 from your avatar profile to get started
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => viewOriginalPrompt()}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Original Prompt
                </Button>
                <Button
                  onClick={() => createV1Version()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Create v1.0
                </Button>
              </div>
            </div>
          ) : (
            /* Version List */
            promptVersions.map((version) => {
              const isActive = activeVersion?.id === version.id;
              const trainingSession = trainingSessions.find(s => s.id === version.training_data_id);

              return (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(isActive)}
                        <span className="font-semibold">{version.version_number}</span>
                      </div>
                      <Badge
                        variant={isActive ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {isActive ? 'Active' : 'Available'}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {getTrainingTypeIcon(trainingSession)}
                        <Clock className="h-3 w-3" />
                        {new Date(version.created_at!).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Version Name */}
                  <div className="mb-3">
                    {editingVersionId === version.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Enter version name..."
                          className="text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveVersionName();
                            if (e.key === 'Escape') cancelEditingName();
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={saveVersionName}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditingName}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {version.version_name || 'Unnamed Version'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditingName(version)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {version.description || 'No description available'}
                    </p>
                  </div>



                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(version)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    {!isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivateVersion(version.id!)}
                        disabled={isTraining}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Activate Version
                      </Button>
                    )}
                    {isActive && (
                      <Badge variant="default" className="text-xs">
                        Currently Active
                      </Badge>
                    )}
                    {!isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteVersion(version)}
                        disabled={isTraining || isDeleting}
                        className="hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Version Management</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Switch Versions:</strong> Activate different trained personalities</li>
              <li>• <strong>Edit Names:</strong> Customize version names for easy identification</li>
              <li>• <strong>View Details:</strong> See exactly what changed in each version</li>
              <li>• <strong>Safe Rollback:</strong> Return to previous versions anytime</li>
            </ul>
          </div>
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!versionToDelete} onOpenChange={(open) => !open && cancelDeleteVersion()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Version {versionToDelete?.version_number}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training version? This action cannot be undone.
            </AlertDialogDescription>
            {versionToDelete?.description && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <strong>Version:</strong> {versionToDelete.description}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteVersion} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteVersion}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Version'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version Details Modal */}
      <VersionDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        version={selectedVersion}
        trainingSession={selectedVersion ? trainingSessions.find(s => s.id === selectedVersion.training_data_id) || null : null}
        avatarId={avatarId}
        onVersionUpdated={loadVersionData}
      />

      {/* Original Prompt Viewer */}
      <Dialog open={isViewingOriginal} onOpenChange={setIsViewingOriginal}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Original Avatar System Prompt
            </DialogTitle>
            <DialogDescription>
              This is the system prompt generated from your avatar's profile details
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full">
            <div className="p-4 bg-muted/50 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {originalPrompt}
              </pre>
            </div>
          </ScrollArea>
          <div className="flex justify-end">
            <Button onClick={() => setIsViewingOriginal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};