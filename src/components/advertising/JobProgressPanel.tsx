import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, Clock, Image, X, ExternalLink, Trash2, Ban, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdvertisingJobs, AdvertisingJob } from '@/hooks/useAdvertisingJobs';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface JobProgressPanelProps {
  onViewCollection?: (collectionId: string) => void;
}

function JobCard({ job, onCancel, onDelete, onRetry, onViewCollection }: {
  job: AdvertisingJob;
  onCancel: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onRetry: (jobId: string) => Promise<void>;
  onViewCollection?: (collectionId: string) => void;
}) {
  const navigate = useNavigate();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry(job.id);
    } finally {
      setIsRetrying(false);
    }
  };

  // Check if job might be stuck (pending/generating for more than 3 minutes with incomplete images)
  const isStuck = (job.status === 'pending' || job.status === 'generating') &&
    job.completed_images < job.total_images &&
    new Date().getTime() - new Date(job.created_at).getTime() > 3 * 60 * 1000;

  const getStatusIcon = () => {
    switch (job.status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'generating':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <Ban className="h-5 w-5 text-gray-500" />;
      case 'partial':
        return <CheckCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (job.status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Queued</Badge>;
      case 'generating':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Generating</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Partial</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const isActive = job.status === 'pending' || job.status === 'generating';
  const progressValue = job.progress_percentage || 0;

  const handleViewCollection = () => {
    if (onViewCollection) {
      onViewCollection(job.collection_id);
    } else {
      // Navigate to gallery with collection filter
      navigate(`/images-studio?collection=${job.collection_id}`);
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Status icon */}
          <div className="mt-1">
            {getStatusIcon()}
          </div>

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium truncate">{job.group_name}</h4>
              {getStatusBadge()}
            </div>

            {/* Progress info */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Image className="h-4 w-4" />
                  {job.completed_images} of {job.total_images} images
                </span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>

            {/* Failed count */}
            {job.failed_images > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {job.failed_images} failed
              </p>
            )}

            {/* Error message */}
            {job.error_message && (
              <p className="text-xs text-red-600 mt-1 truncate">
                {job.error_message}
              </p>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground mt-2">
              Started {new Date(job.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {(job.status === 'completed' || job.status === 'partial') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewCollection}
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </Button>
          )}
          {/* Retry button for stuck jobs */}
          {isStuck && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
              title="Retry remaining images"
            >
              {isRetrying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Retry
            </Button>
          )}
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(job.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Cancel job"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'completed' || job.status === 'partial') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(job.id)}
              className="text-gray-500 hover:text-red-600 hover:bg-red-50"
              title="Delete job"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobProgressPanel({ onViewCollection }: JobProgressPanelProps) {
  const { jobs, activeJobs, isLoading, cancelJob, deleteJob, hasActiveJobs, fetchJobs } = useAdvertisingJobs();

  // Only show failed/cancelled jobs - completed jobs are auto-removed
  const failedJobs = jobs.filter(j =>
    j.status === 'failed' || j.status === 'cancelled'
  );

  // Clear all failed jobs
  const clearFailed = async () => {
    for (const job of failedJobs) {
      await deleteJob(job.id);
    }
  };

  // Retry a stuck job by resetting stuck items and re-invoking the edge function
  const retryJob = async (jobId: string) => {
    try {
      // First, reset any stuck "processing" items back to "pending"
      const { error: resetError } = await supabase
        .from('advertising_job_items')
        .update({ status: 'pending', started_at: null })
        .eq('job_id', jobId)
        .eq('status', 'processing');

      if (resetError) {
        console.error('Failed to reset stuck items:', resetError);
      }

      // Re-invoke the edge function to process remaining items
      const { error: invokeError } = await supabase.functions.invoke(
        'process-advertising-job',
        { body: { jobId } }
      );

      if (invokeError) {
        console.error('Failed to invoke edge function:', invokeError);
        throw invokeError;
      }

      // Refresh job list
      await fetchJobs();
    } catch (error) {
      console.error('Failed to retry job:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading jobs...</p>
        </CardContent>
      </Card>
    );
  }

  // Don't show panel if no active jobs and no failed jobs
  if (activeJobs.length === 0 && failedJobs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            {hasActiveJobs && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            )}
            Generation Queue
          </span>
          <div className="flex items-center gap-2">
            {failedJobs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFailed}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear failed ({failedJobs.length})
              </Button>
            )}
            <Badge variant="outline">
              {activeJobs.length} active
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Show active jobs first */}
        {activeJobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onCancel={cancelJob}
            onDelete={deleteJob}
            onRetry={retryJob}
            onViewCollection={onViewCollection}
          />
        ))}
        {/* Show failed jobs below with dismiss option */}
        {failedJobs.slice(0, 3).map(job => (
          <JobCard
            key={job.id}
            job={job}
            onCancel={cancelJob}
            onDelete={deleteJob}
            onRetry={retryJob}
            onViewCollection={onViewCollection}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// Compact version for sidebar or header
export function JobProgressIndicator() {
  const { activeJobs, hasActiveJobs } = useAdvertisingJobs();

  if (!hasActiveJobs) return null;

  const totalProgress = activeJobs.reduce((acc, job) => acc + (job.progress_percentage || 0), 0) / activeJobs.length;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-blue-800">
          Generating {activeJobs.length} {activeJobs.length === 1 ? 'job' : 'jobs'}
        </p>
        <Progress value={totalProgress} className="h-1 mt-1" />
      </div>
      <span className="text-xs text-blue-600 font-medium">
        {Math.round(totalProgress)}%
      </span>
    </div>
  );
}

export default JobProgressPanel;
