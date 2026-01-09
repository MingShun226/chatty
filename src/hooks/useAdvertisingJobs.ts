import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { COLLECTIONS_KEY } from './useImageCollections';
import { GALLERY_IMAGES_KEY } from './useGalleryImages';

export interface AdvertisingJobItem {
  id: string;
  job_id: string;
  style_id: string;
  style_name: string;
  platform: string;
  series_number: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  image_url: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AdvertisingJob {
  id: string;
  user_id: string;
  collection_id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'partial' | 'cancelled';
  total_images: number;
  completed_images: number;
  failed_images: number;
  progress_percentage: number; // Mapped from database 'progress' column
  input_image_url: string;
  group_name: string;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  items?: AdvertisingJobItem[];
}

// Transform database row to AdvertisingJob interface
function transformJob(row: any): AdvertisingJob {
  return {
    ...row,
    // Map database 'progress' column to 'progress_percentage' for UI
    progress_percentage: row.progress ?? row.progress_percentage ?? 0,
  };
}

export function useAdvertisingJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<AdvertisingJob[]>([]);
  const [activeJobs, setActiveJobs] = useState<AdvertisingJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all jobs
  const fetchJobs = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('advertising_jobs')
        .select(`
          *,
          items:advertising_job_items(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Transform database rows to AdvertisingJob interface
      const typedJobs = (data || []).map(transformJob);
      setJobs(typedJobs);
      setActiveJobs(typedJobs.filter(j =>
        j.status === 'pending' || j.status === 'generating'
      ));
    } catch (error) {
      console.error('Failed to fetch advertising jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Get a specific job by ID
  const getJob = useCallback(async (jobId: string): Promise<AdvertisingJob | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('advertising_jobs')
        .select(`
          *,
          items:advertising_job_items(*)
        `)
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return transformJob(data);
    } catch (error) {
      console.error('Failed to fetch job:', error);
      return null;
    }
  }, [user?.id]);

  // Cancel a job
  const cancelJob = useCallback(async (jobId: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('advertising_jobs')
        .update({
          status: 'cancelled',
          error_message: 'Cancelled by user',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh jobs
      await fetchJobs();
      return true;
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }
  }, [user?.id, fetchJobs]);

  // Delete a job (and its items via cascade)
  const deleteJob = useCallback(async (jobId: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('advertising_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state immediately
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setActiveJobs(prev => prev.filter(j => j.id !== jobId));
      return true;
    } catch (error) {
      console.error('Failed to delete job:', error);
      return false;
    }
  }, [user?.id]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    // Initial fetch
    fetchJobs();

    // Subscribe to job updates
    const jobChannel = supabase
      .channel(`advertising-jobs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'advertising_jobs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Job update:', payload);

          if (payload.eventType === 'INSERT') {
            const newJob = transformJob(payload.new);
            setJobs(prev => [newJob, ...prev]);
            if (newJob.status === 'pending' || newJob.status === 'generating') {
              setActiveJobs(prev => [newJob, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedJob = transformJob(payload.new);

            setJobs(prev =>
              prev.map(j => j.id === updatedJob.id ? updatedJob : j)
            );
            // Update active jobs
            if (updatedJob.status === 'pending' || updatedJob.status === 'generating') {
              setActiveJobs(prev => {
                const existing = prev.find(j => j.id === updatedJob.id);
                if (existing) {
                  return prev.map(j => j.id === updatedJob.id ? updatedJob : j);
                }
                return [updatedJob, ...prev];
              });
            } else {
              setActiveJobs(prev => prev.filter(j => j.id !== updatedJob.id));

              // When job moves out of active state (completed, failed, partial, cancelled),
              // refresh gallery and collections to show new images
              if (updatedJob.status === 'completed' || updatedJob.status === 'partial') {
                console.log('[useAdvertisingJobs] Job completed, refreshing gallery and collections');
                queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
                queryClient.invalidateQueries({ queryKey: GALLERY_IMAGES_KEY });

                // Auto-delete completed jobs from the queue after a short delay
                // (notification will be shown by the database trigger)
                setTimeout(async () => {
                  console.log('[useAdvertisingJobs] Auto-removing completed job from queue:', updatedJob.id);
                  await supabase
                    .from('advertising_jobs')
                    .delete()
                    .eq('id', updatedJob.id);
                }, 3000); // 3 second delay to allow notification to show
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setJobs(prev => prev.filter(j => j.id !== deletedId));
            setActiveJobs(prev => prev.filter(j => j.id !== deletedId));
          }
        }
      )
      .subscribe();

    // Subscribe to job item updates for progress
    const itemChannel = supabase
      .channel(`advertising-job-items-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'advertising_job_items',
        },
        async (payload) => {
          const updatedItem = payload.new as AdvertisingJobItem;

          // Refresh the job to get updated progress
          const job = await getJob(updatedItem.job_id);
          if (job) {
            setJobs(prev =>
              prev.map(j => j.id === job.id ? job : j)
            );
            if (job.status === 'pending' || job.status === 'generating') {
              setActiveJobs(prev =>
                prev.map(j => j.id === job.id ? job : j)
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(itemChannel);
    };
  }, [user?.id, fetchJobs, getJob, queryClient]);

  return {
    jobs,
    activeJobs,
    isLoading,
    fetchJobs,
    getJob,
    cancelJob,
    deleteJob,
    hasActiveJobs: activeJobs.length > 0,
  };
}

export default useAdvertisingJobs;
