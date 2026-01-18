import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  RefreshCw,
  Trash2,
  XCircle,
  Clock,
  DollarSign,
  User,
  Bot,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Plus,
  MessageSquare,
  Edit,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { FineTuneService } from '@/services/fineTuneService';

interface FineTuneJob {
  id: string;
  user_id: string;
  avatar_id: string;
  openai_job_id: string;
  base_model: string;
  fine_tuned_model: string | null;
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error_message: string | null;
  training_examples_count: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  // Joined data
  user_email?: string;
  avatar_name?: string;
}

interface UserWithAvatars {
  id: string;
  email: string;
  name: string;
  avatars: { id: string; name: string; training_examples_count?: number }[];
}

interface TrainingExample {
  id: string;
  user_id: string;
  avatar_id: string | null;
  user_message: string;
  assistant_message: string;
  system_prompt: string;
  quality_score: number;
  source_type: string;
  created_at: string;
  // Joined data
  avatar_name?: string;
}

export const FineTuningManagement = () => {
  const { adminUser } = useAdminAuth();
  const [jobs, setJobs] = useState<FineTuneJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingJob, setCancellingJob] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [jobToCancel, setJobToCancel] = useState<FineTuneJob | null>(null);
  const [modelToDelete, setModelToDelete] = useState<FineTuneJob | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState(false);

  // Create job dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [trainingScope, setTrainingScope] = useState<'platform' | 'specific'>('platform');
  const [users, setUsers] = useState<UserWithAvatars[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [selectedBaseModel, setSelectedBaseModel] = useState<string>('gpt-4o-mini-2024-07-18');
  const [creatingJob, setCreatingJob] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [createStep, setCreateStep] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [platformExamplesCount, setPlatformExamplesCount] = useState<number>(0);
  const [loadingPlatformStats, setLoadingPlatformStats] = useState(false);

  // Training examples state
  const [trainingExamples, setTrainingExamples] = useState<TrainingExample[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [examplesFilter, setExamplesFilter] = useState<'all' | 'platform' | 'specific'>('all');
  const [showExampleDialog, setShowExampleDialog] = useState(false);
  const [editingExample, setEditingExample] = useState<TrainingExample | null>(null);
  const [exampleForm, setExampleForm] = useState({
    user_message: '',
    assistant_message: '',
    scope: 'platform' as 'platform' | 'specific',
    avatar_id: ''
  });
  const [savingExample, setSavingExample] = useState(false);
  const [deletingExampleId, setDeletingExampleId] = useState<string | null>(null);
  const [allAvatars, setAllAvatars] = useState<{ id: string; name: string; user_email?: string }[]>([]);

  useEffect(() => {
    fetchJobs();
    fetchApiKey();
    fetchTrainingExamples();
    fetchAllAvatars();
  }, []);

  const fetchApiKey = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      // Fetch from admin_assigned_api_keys table
      const { data } = await supabase
        .from('admin_assigned_api_keys')
        .select('api_key_encrypted')
        .eq('user_id', session.session.user.id)
        .eq('service', 'openai')
        .eq('is_active', true)
        .maybeSingle();

      if (data?.api_key_encrypted) {
        // Decode the base64 encoded key
        const decodedKey = atob(data.api_key_encrypted);
        setOpenaiApiKey(decodedKey);
        setHasApiKey(true);
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Fetch jobs with avatar names
      const { data: jobsData, error: jobsError } = await supabase
        .from('avatar_fine_tune_jobs')
        .select(`
          *,
          avatars:avatar_id (name)
        `)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Get unique user IDs
      const userIds = [...new Set((jobsData || []).map(j => j.user_id))];

      // Fetch user emails separately
      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);

        if (profiles) {
          userEmails = profiles.reduce((acc, p) => {
            acc[p.id] = p.email;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Combine data
      const jobsWithDetails: FineTuneJob[] = (jobsData || []).map((job: any) => ({
        ...job,
        user_email: userEmails[job.user_id],
        avatar_name: job.avatars?.name,
      }));

      setJobs(jobsWithDetails);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load fine-tuning jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersWithAvatars = async () => {
    setLoadingUsers(true);
    try {
      // Get all non-admin users with their avatars
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('is_active', true);
      const adminUserIds = new Set(adminUsers?.map(a => a.user_id) || []);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, name')
        .order('email');

      if (profilesError) throw profilesError;

      // Filter out admin users
      const nonAdminProfiles = profiles?.filter(p => !adminUserIds.has(p.id)) || [];

      // Get avatars for each user
      const usersWithAvatars: UserWithAvatars[] = [];

      for (const profile of nonAdminProfiles) {
        const { data: avatars } = await supabase
          .from('avatars')
          .select('id, name')
          .eq('user_id', profile.id)
          .eq('status', 'active');

        // Get training examples count for each avatar
        const avatarsWithCount = await Promise.all(
          (avatars || []).map(async (avatar) => {
            const { count } = await supabase
              .from('avatar_training_examples')
              .select('id', { count: 'exact', head: true })
              .eq('avatar_id', avatar.id)
              .gte('quality_score', 0.5);

            return {
              ...avatar,
              training_examples_count: count || 0
            };
          })
        );

        if (avatarsWithCount.length > 0) {
          usersWithAvatars.push({
            id: profile.id,
            email: profile.email || 'Unknown',
            name: profile.name || 'Unnamed',
            avatars: avatarsWithCount
          });
        }
      }

      setUsers(usersWithAvatars);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPlatformStats = async () => {
    setLoadingPlatformStats(true);
    try {
      const { count } = await supabase
        .from('avatar_training_examples')
        .select('id', { count: 'exact', head: true })
        .gte('quality_score', 0.5);

      setPlatformExamplesCount(count || 0);
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    } finally {
      setLoadingPlatformStats(false);
    }
  };

  // Training examples functions
  const fetchTrainingExamples = async () => {
    setLoadingExamples(true);
    try {
      const { data, error } = await supabase
        .from('avatar_training_examples')
        .select(`
          *,
          avatars:avatar_id (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const examples: TrainingExample[] = (data || []).map((ex: any) => ({
        ...ex,
        avatar_name: ex.avatars?.name
      }));

      setTrainingExamples(examples);
    } catch (error) {
      console.error('Error fetching training examples:', error);
      toast.error('Failed to load training examples');
    } finally {
      setLoadingExamples(false);
    }
  };

  const fetchAllAvatars = async () => {
    try {
      // Get all avatars with their user emails
      const { data: avatars, error: avatarsError } = await supabase
        .from('avatars')
        .select('id, name, user_id')
        .eq('status', 'active');

      if (avatarsError) throw avatarsError;

      // Get user emails
      const userIds = [...new Set((avatars || []).map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const emailMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p.email;
        return acc;
      }, {} as Record<string, string>);

      setAllAvatars((avatars || []).map(a => ({
        id: a.id,
        name: a.name,
        user_email: emailMap[a.user_id]
      })));
    } catch (error) {
      console.error('Error fetching avatars:', error);
    }
  };

  const handleOpenExampleDialog = (example?: TrainingExample) => {
    if (example) {
      setEditingExample(example);
      setExampleForm({
        user_message: example.user_message,
        assistant_message: example.assistant_message,
        scope: example.avatar_id ? 'specific' : 'platform',
        avatar_id: example.avatar_id || ''
      });
    } else {
      setEditingExample(null);
      setExampleForm({
        user_message: '',
        assistant_message: '',
        scope: 'platform',
        avatar_id: ''
      });
    }
    setShowExampleDialog(true);
  };

  const handleSaveExample = async () => {
    if (!exampleForm.user_message.trim() || !exampleForm.assistant_message.trim()) {
      toast.error('Please fill in both user message and assistant response');
      return;
    }

    if (exampleForm.scope === 'specific' && !exampleForm.avatar_id) {
      toast.error('Please select a chatbot for specific training');
      return;
    }

    setSavingExample(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const adminUserId = session?.session?.user?.id;

      if (!adminUserId) {
        throw new Error('Admin session not found');
      }

      // Get avatar's user_id if specific chatbot selected
      let targetUserId = adminUserId;
      if (exampleForm.scope === 'specific' && exampleForm.avatar_id) {
        const avatar = allAvatars.find(a => a.id === exampleForm.avatar_id);
        if (avatar) {
          // Get the avatar's owner user_id from the database
          const { data: avatarData } = await supabase
            .from('avatars')
            .select('user_id')
            .eq('id', exampleForm.avatar_id)
            .single();
          if (avatarData) {
            targetUserId = avatarData.user_id;
          }
        }
      }

      const exampleData = {
        user_id: targetUserId,
        avatar_id: exampleForm.scope === 'platform' ? null : exampleForm.avatar_id,
        user_message: exampleForm.user_message.trim(),
        assistant_message: exampleForm.assistant_message.trim(),
        system_prompt: 'You are a helpful and professional AI assistant for business communications.',
        source_type: 'manual_entry',
        quality_score: 0.9, // High quality for manually curated examples
      };

      if (editingExample) {
        // Update existing
        const { error } = await supabase
          .from('avatar_training_examples')
          .update(exampleData)
          .eq('id', editingExample.id);

        if (error) throw error;
        toast.success('Training example updated');
      } else {
        // Create new
        const { error } = await supabase
          .from('avatar_training_examples')
          .insert(exampleData);

        if (error) throw error;
        toast.success('Training example added');
      }

      setShowExampleDialog(false);
      fetchTrainingExamples();
      fetchPlatformStats();
    } catch (error: any) {
      console.error('Error saving example:', error);
      toast.error(error.message || 'Failed to save training example');
    } finally {
      setSavingExample(false);
    }
  };

  const handleDeleteExample = async (exampleId: string) => {
    setDeletingExampleId(exampleId);
    try {
      const { error } = await supabase
        .from('avatar_training_examples')
        .delete()
        .eq('id', exampleId);

      if (error) throw error;
      toast.success('Training example deleted');
      fetchTrainingExamples();
      fetchPlatformStats();
    } catch (error: any) {
      console.error('Error deleting example:', error);
      toast.error(error.message || 'Failed to delete training example');
    } finally {
      setDeletingExampleId(null);
    }
  };

  const filteredExamples = trainingExamples.filter(ex => {
    if (examplesFilter === 'all') return true;
    if (examplesFilter === 'platform') return !ex.avatar_id;
    if (examplesFilter === 'specific') return !!ex.avatar_id;
    return true;
  });

  const handleOpenCreateDialog = () => {
    setShowCreateDialog(true);
    setTrainingScope('platform');
    setSelectedUserId('');
    setSelectedAvatarId('');
    setSelectedBaseModel('gpt-4o-mini-2024-07-18');
    setCreateProgress(0);
    setCreateStep('');
    fetchPlatformStats();
  };

  const handleCreateJob = async () => {
    if (!openaiApiKey) {
      toast.error('OpenAI API key not configured');
      return;
    }

    if (trainingScope === 'specific' && (!selectedUserId || !selectedAvatarId)) {
      toast.error('Please select a user and chatbot');
      return;
    }

    setCreatingJob(true);
    setCreateProgress(0);
    setCreateStep('Starting...');

    try {
      const { data: session } = await supabase.auth.getSession();
      const adminUserId = session?.session?.user?.id;

      if (!adminUserId) {
        throw new Error('Admin session not found');
      }

      if (trainingScope === 'platform') {
        // Create platform-wide model
        await FineTuneService.createPlatformFineTuneJob(
          adminUserId,
          { baseModel: selectedBaseModel as any },
          (step, percentage) => {
            setCreateStep(step);
            setCreateProgress(percentage);
          }
        );
        toast.success('Platform fine-tuning job created successfully!');
      } else {
        // Create chatbot-specific model
        await FineTuneService.createFineTuneJob(
          '', // trainingDataId - will use cached examples
          selectedUserId,
          selectedAvatarId,
          { baseModel: selectedBaseModel as any },
          (step, percentage) => {
            setCreateStep(step);
            setCreateProgress(percentage);
          }
        );
        toast.success('Fine-tuning job created successfully!');
      }

      setShowCreateDialog(false);
      fetchJobs(); // Refresh the jobs list
    } catch (error: any) {
      console.error('Error creating fine-tune job:', error);
      toast.error(error.message || 'Failed to create fine-tuning job');
    } finally {
      setCreatingJob(false);
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedAvatar = selectedUser?.avatars.find(a => a.id === selectedAvatarId);

  const handleCancelJob = async (job: FineTuneJob) => {
    if (!openaiApiKey) {
      toast.error('OpenAI API key not configured');
      return;
    }

    setCancellingJob(job.id);
    try {
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to cancel job');
      }

      await supabase
        .from('avatar_fine_tune_jobs')
        .update({ status: 'cancelled' })
        .eq('id', job.id);

      toast.success('Fine-tuning job cancelled');
      fetchJobs();
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      toast.error(error.message || 'Failed to cancel job');
    } finally {
      setCancellingJob(null);
      setJobToCancel(null);
    }
  };

  const handleDeleteModel = async (job: FineTuneJob) => {
    if (!job.fine_tuned_model || !openaiApiKey) {
      toast.error('Cannot delete model - missing model ID or API key');
      return;
    }

    setDeletingModel(job.id);
    try {
      const response = await fetch(`https://api.openai.com/v1/models/${job.fine_tuned_model}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete model');
      }

      // Update database
      await supabase
        .from('avatar_fine_tune_jobs')
        .update({ fine_tuned_model: null, status: 'cancelled' })
        .eq('id', job.id);

      // Deactivate from avatar if active
      await supabase
        .from('avatars')
        .update({
          active_fine_tuned_model: null,
          use_fine_tuned_model: false
        })
        .eq('active_fine_tuned_model', job.fine_tuned_model);

      toast.success('Fine-tuned model deleted from OpenAI');
      fetchJobs();
    } catch (error: any) {
      console.error('Error deleting model:', error);
      toast.error(error.message || 'Failed to delete model');
    } finally {
      setDeletingModel(null);
      setModelToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
      'validating_files': { variant: 'secondary', label: 'Validating' },
      'queued': { variant: 'secondary', label: 'Queued' },
      'running': { variant: 'default', label: 'Running', className: 'bg-blue-500' },
      'succeeded': { variant: 'outline', label: 'Succeeded', className: 'text-green-600 border-green-600' },
      'failed': { variant: 'destructive', label: 'Failed' },
      'cancelled': { variant: 'secondary', label: 'Cancelled' },
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const formatCost = (cost: number | null) => {
    if (cost === null || cost === undefined) return '-';
    return `$${cost.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const filteredJobs = jobs.filter(job => {
    if (statusFilter === 'all') return true;
    return job.status === statusFilter;
  });

  const stats = {
    total: jobs.length,
    succeeded: jobs.filter(j => j.status === 'succeeded').length,
    inProgress: jobs.filter(j => j.status === 'running' || j.status === 'queued' || j.status === 'validating_files').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    totalCost: jobs.reduce((sum, j) => sum + (j.actual_cost || j.estimated_cost || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fine-Tuning Management</h2>
          <p className="text-muted-foreground">Manage OpenAI fine-tuning jobs across all users</p>
        </div>
        <Button
          onClick={handleOpenCreateDialog}
          disabled={!hasApiKey}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Fine-Tune Job
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Jobs</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.succeeded}</div>
              <div className="text-sm text-muted-foreground">Succeeded</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">${stats.totalCost.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Cost</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Training Examples Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Training Examples
              </CardTitle>
              <CardDescription>
                Manually curate training examples for fine-tuning. Examples can be platform-wide or specific to a chatbot.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenExampleDialog()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Example
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter Tabs */}
          <Tabs value={examplesFilter} onValueChange={(v) => setExamplesFilter(v as any)} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">All ({trainingExamples.length})</TabsTrigger>
              <TabsTrigger value="platform">
                <Globe className="h-3 w-3 mr-1" />
                Platform ({trainingExamples.filter(e => !e.avatar_id).length})
              </TabsTrigger>
              <TabsTrigger value="specific">
                <Bot className="h-3 w-3 mr-1" />
                Specific ({trainingExamples.filter(e => e.avatar_id).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {loadingExamples ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredExamples.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No training examples yet.</p>
              <p className="text-sm">Add examples to train your AI model.</p>
            </div>
          ) : (
            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Scope</TableHead>
                    <TableHead>User Message</TableHead>
                    <TableHead>Assistant Response</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExamples.map((example) => (
                    <TableRow key={example.id}>
                      <TableCell>
                        {example.avatar_id ? (
                          <Badge variant="outline" className="text-xs">
                            <Bot className="h-3 w-3 mr-1" />
                            {example.avatar_name || 'Chatbot'}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            Platform
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[250px] truncate text-sm" title={example.user_message}>
                          {example.user_message}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px] truncate text-sm" title={example.assistant_message}>
                          {example.assistant_message}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenExampleDialog(example)}
                            title="Edit example"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExample(example.id)}
                            disabled={deletingExampleId === example.id}
                            title="Delete example"
                          >
                            {deletingExampleId === example.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Fine-Tuning Jobs
              </CardTitle>
              <CardDescription>
                All fine-tuning jobs across the platform
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchJobs}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasApiKey && (
            <div className="flex items-center gap-3 p-4 mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">API Key Required</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Configure your OpenAI API key in Settings → API Keys to manage fine-tuning jobs.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {jobs.length === 0 ? (
                <div className="space-y-2">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p>No fine-tuning jobs found.</p>
                  <p className="text-sm">Users can start fine-tuning from their dashboard.</p>
                </div>
              ) : (
                <p>No jobs match the selected filter.</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Chatbot</TableHead>
                    <TableHead>Base Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Examples</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Fine-Tuned Model</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[150px]" title={job.user_email}>
                            {job.user_email || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{job.avatar_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {job.base_model.replace('gpt-', '').replace('-2024-08-06', '').replace('-2024-07-18', '').replace('-0125', '')}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>{job.training_examples_count || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span>{formatCost(job.actual_cost || job.estimated_cost)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="whitespace-nowrap">{formatDate(job.created_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {job.fine_tuned_model ? (
                          <code className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded truncate max-w-[150px] block" title={job.fine_tuned_model}>
                            {job.fine_tuned_model.substring(0, 20)}...
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(job.status === 'queued' || job.status === 'running' || job.status === 'validating_files') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setJobToCancel(job)}
                              disabled={cancellingJob === job.id || !hasApiKey}
                              title="Cancel job"
                            >
                              {cancellingJob === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4 text-orange-500" />
                              )}
                            </Button>
                          )}
                          {job.status === 'succeeded' && job.fine_tuned_model && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setModelToDelete(job)}
                              disabled={deletingModel === job.id || !hasApiKey}
                              title="Delete model from OpenAI"
                            >
                              {deletingModel === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          )}
                          {job.status === 'failed' && job.error_message && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title={job.error_message}
                            >
                              <Info className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Job Confirmation Dialog */}
      <AlertDialog open={!!jobToCancel} onOpenChange={() => setJobToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Fine-Tuning Job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the fine-tuning job for{' '}
              <strong>{jobToCancel?.avatar_name || 'Unknown'}</strong>.
              The job cannot be resumed after cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Running</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => jobToCancel && handleCancelJob(jobToCancel)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Model Confirmation Dialog */}
      <AlertDialog open={!!modelToDelete} onOpenChange={() => setModelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fine-Tuned Model?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the fine-tuned model from OpenAI.
              <br /><br />
              <strong>Model:</strong> <code className="text-xs">{modelToDelete?.fine_tuned_model}</code>
              <br />
              <strong>Chatbot:</strong> {modelToDelete?.avatar_name}
              <br /><br />
              This action cannot be undone. If the chatbot is using this model,
              it will revert to the base model.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => modelToDelete && handleDeleteModel(modelToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Fine-Tune Job Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              New Fine-Tune Job
            </DialogTitle>
            <DialogDescription>
              Create a fine-tuned model using training examples from chatbots.
            </DialogDescription>
          </DialogHeader>

          {creatingJob ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">{createStep}</span>
              </div>
              <Progress value={createProgress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {createProgress}% complete
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Training Scope Selection */}
              <div className="space-y-2">
                <Label>Training Scope</Label>
                <Select value={trainingScope} onValueChange={(value: 'platform' | 'specific') => {
                  setTrainingScope(value);
                  if (value === 'specific' && users.length === 0) {
                    fetchUsersWithAvatars();
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">
                      <div className="flex items-center gap-2">
                        <span>Platform Model (All Chatbots)</span>
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="specific">Specific Chatbot</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {trainingScope === 'platform'
                    ? 'Uses training examples from all chatbots to create a general-purpose model.'
                    : 'Train a custom model for a specific client\'s chatbot.'}
                </p>
              </div>

              {/* Platform Model Info */}
              {trainingScope === 'platform' && (
                <div className="p-3 bg-muted rounded-lg">
                  {loadingPlatformStats ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading platform statistics...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {platformExamplesCount >= 10 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-sm">
                          {platformExamplesCount} training examples available across all chatbots
                        </span>
                      </div>
                      {platformExamplesCount < 10 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          OpenAI requires at least 10 examples for fine-tuning.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Specific Chatbot Selection */}
              {trainingScope === 'specific' && (
                <>
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* User Selection */}
                      <div className="space-y-2">
                        <Label>Select User</Label>
                        <Select value={selectedUserId} onValueChange={(value) => {
                          setSelectedUserId(value);
                          setSelectedAvatarId('');
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user..." />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  <span>{user.email}</span>
                                  <span className="text-muted-foreground">({user.avatars.length} chatbot{user.avatars.length !== 1 ? 's' : ''})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {users.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No users with chatbots found.
                          </p>
                        )}
                      </div>

                      {/* Avatar Selection */}
                      {selectedUserId && (
                        <div className="space-y-2">
                          <Label>Select Chatbot</Label>
                          <Select value={selectedAvatarId} onValueChange={setSelectedAvatarId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a chatbot..." />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedUser?.avatars.map((avatar) => (
                                <SelectItem key={avatar.id} value={avatar.id}>
                                  <div className="flex items-center gap-2">
                                    <Bot className="h-4 w-4" />
                                    <span>{avatar.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {avatar.training_examples_count || 0} examples
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Training Examples Info for specific chatbot */}
                      {selectedAvatar && (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            {(selectedAvatar.training_examples_count || 0) >= 10 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="text-sm">
                              {selectedAvatar.training_examples_count || 0} training examples available
                            </span>
                          </div>
                          {(selectedAvatar.training_examples_count || 0) < 10 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              OpenAI requires at least 10 examples for fine-tuning.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Base Model Selection */}
              <div className="space-y-2">
                <Label>Base Model</Label>
                <Select value={selectedBaseModel} onValueChange={setSelectedBaseModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini-2024-07-18">
                      <div className="flex items-center gap-2">
                        <span>GPT-4o Mini</span>
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-4o-2024-08-06">GPT-4o</SelectItem>
                    <SelectItem value="gpt-3.5-turbo-0125">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  GPT-4o Mini is the most cost-effective option for fine-tuning.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creatingJob}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              disabled={
                creatingJob ||
                (trainingScope === 'platform' && platformExamplesCount < 10) ||
                (trainingScope === 'specific' && (!selectedUserId || !selectedAvatarId || (selectedAvatar?.training_examples_count || 0) < 10))
              }
            >
              {creatingJob ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {trainingScope === 'platform' ? 'Create Platform Model' : 'Start Fine-Tuning'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Training Example Dialog */}
      <Dialog open={showExampleDialog} onOpenChange={setShowExampleDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {editingExample ? 'Edit Training Example' : 'Add Training Example'}
            </DialogTitle>
            <DialogDescription>
              Training examples teach the AI how to respond. Provide a user message and the ideal assistant response.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Scope Selection */}
            <div className="space-y-2">
              <Label>Training Scope</Label>
              <Select
                value={exampleForm.scope}
                onValueChange={(value: 'platform' | 'specific') => setExampleForm({ ...exampleForm, scope: value, avatar_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Platform (All Chatbots)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="specific">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <span>Specific Chatbot</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {exampleForm.scope === 'platform'
                  ? 'This example will be used for training all platform models.'
                  : 'This example will only be used for the selected chatbot.'}
              </p>
            </div>

            {/* Chatbot Selection (for specific scope) */}
            {exampleForm.scope === 'specific' && (
              <div className="space-y-2">
                <Label>Select Chatbot</Label>
                <Select value={exampleForm.avatar_id} onValueChange={(value) => setExampleForm({ ...exampleForm, avatar_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a chatbot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allAvatars.map((avatar) => (
                      <SelectItem key={avatar.id} value={avatar.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <span>{avatar.name}</span>
                          {avatar.user_email && (
                            <span className="text-muted-foreground text-xs">({avatar.user_email})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* User Message */}
            <div className="space-y-2">
              <Label>User Message</Label>
              <Textarea
                value={exampleForm.user_message}
                onChange={(e) => setExampleForm({ ...exampleForm, user_message: e.target.value })}
                placeholder="What the customer/user says..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The message that a user would send to the chatbot.
              </p>
            </div>

            {/* Assistant Response */}
            <div className="space-y-2">
              <Label>Assistant Response</Label>
              <Textarea
                value={exampleForm.assistant_message}
                onChange={(e) => setExampleForm({ ...exampleForm, assistant_message: e.target.value })}
                placeholder="How the AI should respond..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                The ideal response the AI should give.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExampleDialog(false)}
              disabled={savingExample}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveExample}
              disabled={savingExample || !exampleForm.user_message.trim() || !exampleForm.assistant_message.trim()}
            >
              {savingExample ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {editingExample ? 'Update Example' : 'Add Example'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
