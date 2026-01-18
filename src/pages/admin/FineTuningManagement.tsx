import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    fetchJobs();
    fetchApiKey();
  }, []);

  const fetchApiKey = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'openai_api_key')
        .maybeSingle();

      if (data?.setting_value?.api_key) {
        setOpenaiApiKey(data.setting_value.api_key);
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Fine-Tuning Management</h2>
        <p className="text-muted-foreground">Manage OpenAI fine-tuning jobs across all users</p>
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
    </div>
  );
};
