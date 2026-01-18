/**
 * Fine-Tuning Service
 *
 * Handles real machine learning fine-tuning of models using OpenAI's Fine-Tuning API.
 * This creates custom models that deeply learn user's communication style.
 */

import { supabase } from '@/integrations/supabase/client';
import { apiKeyService } from './apiKeyService';

// Note: Fine-tuning features require direct OpenAI API access.
// The apiKeyService is still used here for fine-tuning operations.
// Consider creating a dedicated edge function for fine-tuning if needed.

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FineTuneExample {
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
}

export interface ConversationPair {
  user_message: string;
  assistant_message: string;
  context?: string;
  pattern_type?: string;
  quality_score?: number;
}

export interface FineTuneJob {
  id: string;
  user_id: string;
  avatar_id: string;
  training_data_id?: string;
  openai_job_id: string;
  openai_training_file_id?: string;
  openai_validation_file_id?: string;
  base_model: string;
  fine_tuned_model?: string;
  model_suffix?: string;
  hyperparameters: {
    n_epochs?: number | 'auto';
    learning_rate_multiplier?: number | 'auto';
    batch_size?: number | 'auto';
  };
  training_examples_count?: number;
  validation_examples_count?: number;
  total_tokens_trained?: number;
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error_message?: string;
  result_files?: any;
  trained_tokens?: number;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  estimated_finish_at?: string;
  final_loss?: number;
  final_accuracy?: number;
  estimated_cost?: number;
  actual_cost?: number;
}

export interface TrainingExample {
  id: string;
  user_id: string;
  avatar_id: string;
  training_data_id?: string;
  system_prompt: string;
  user_message: string;
  assistant_message: string;
  source_type: 'uploaded_file' | 'chat_history' | 'manual_entry';
  source_file_name?: string;
  quality_score: number;
  pattern_type?: string;
  tags?: string[];
  used_in_training: boolean;
  times_used: number;
  created_at?: string;
}

export interface FineTuneConfig {
  baseModel?: 'gpt-4o-2024-08-06' | 'gpt-4o-mini-2024-07-18' | 'gpt-3.5-turbo-0125';
  nEpochs?: number | 'auto';
  learningRateMultiplier?: number | 'auto';
  batchSize?: number | 'auto';
  validationSplit?: number; // 0-1, default 0.1 (10%)
  suffix?: string;
}

// ============================================================================
// Fine-Tuning Service
// ============================================================================

export class FineTuneService {

  // --------------------------------------------------------------------------
  // Training Data Preparation
  // --------------------------------------------------------------------------

  /**
   * Prepare training data from avatar's training sessions
   * Converts conversation pairs into OpenAI fine-tuning format
   */
  static async prepareFineTuningData(
    trainingDataId: string,
    userId: string,
    avatarId: string,
    config: FineTuneConfig = {}
  ): Promise<{
    training: FineTuneExample[];
    validation: FineTuneExample[];
    systemPrompt: string;
    examplesCount: number;
  }> {
    // 1. Get all training examples for this avatar
    const { data: cachedExamples, error: cacheError } = await supabase
      .from('avatar_training_examples')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .gte('quality_score', 0.5) // Only use decent quality examples
      .order('quality_score', { ascending: false });

    if (cacheError) throw cacheError;

    let examples: ConversationPair[] = [];

    // If we have cached examples, use them
    if (cachedExamples && cachedExamples.length > 0) {
      examples = cachedExamples.map(ex => ({
        user_message: ex.user_message,
        assistant_message: ex.assistant_message,
        context: ex.system_prompt,
        pattern_type: ex.pattern_type || undefined,
        quality_score: ex.quality_score
      }));
    } else {
      // Otherwise, extract from training data files
      const { data: trainingData, error: tdError } = await supabase
        .from('avatar_training_data')
        .select('*')
        .eq('id', trainingDataId)
        .single();

      if (tdError) throw tdError;

      const { data: files, error: filesError } = await supabase
        .from('avatar_training_files')
        .select('*')
        .eq('training_data_id', trainingDataId)
        .eq('processing_status', 'completed');

      if (filesError) throw filesError;

      // Extract conversation pairs from files
      for (const file of files || []) {
        if (file.extracted_text) {
          const pairs = await this.extractConversationPairs(
            file.extracted_text,
            trainingData.analysis_results
          );
          examples.push(...pairs);
        }
      }

      // Cache the examples for future use
      await this.cacheTrainingExamples(examples, avatarId, userId, trainingDataId);
    }

    if (examples.length === 0) {
      throw new Error('No training examples found. Please upload conversation samples first.');
    }

    // 2. Get system prompt
    const { data: activeVersion } = await supabase
      .from('avatar_prompt_versions')
      .select('system_prompt')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const { data: avatar } = await supabase
      .from('avatars')
      .select('system_prompt')
      .eq('id', avatarId)
      .single();

    const systemPrompt = activeVersion?.system_prompt ||
                        avatar?.system_prompt ||
                        'You are a helpful AI assistant.';

    // 3. Format as OpenAI training examples
    const formattedExamples: FineTuneExample[] = examples.map(pair => ({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: pair.user_message },
        { role: 'assistant', content: pair.assistant_message }
      ]
    }));

    // 4. Shuffle for better training
    const shuffled = this.shuffleArray(formattedExamples);

    // 5. Split into training and validation sets
    const validationSplit = config.validationSplit || 0.1;
    const splitIndex = Math.floor(shuffled.length * (1 - validationSplit));

    return {
      training: shuffled.slice(0, splitIndex),
      validation: shuffled.slice(splitIndex),
      systemPrompt,
      examplesCount: examples.length
    };
  }

  /**
   * Extract conversation pairs from raw text using AI
   */
  private static async extractConversationPairs(
    conversationText: string,
    analysisResults: any
  ): Promise<ConversationPair[]> {
    const apiKey = await this.getOpenAIKey();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Extract conversation pairs from the provided text. Return a JSON object with a "conversations" array.
Each conversation should have:
- user_message: What the user said
- assistant_message: How the assistant responded
- pattern_type: One of [greeting, question, statement, story, joke, advice, explanation]
- quality_score: 0-1 score (filter out very short messages, incomplete thoughts, or low-quality exchanges)

Only include complete, meaningful exchanges. Skip greetings/goodbyes unless they show personality.
Aim for quality over quantity.`
            },
            {
              role: 'user',
              content: conversationText
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result = await response.json();
      const parsed = JSON.parse(result.choices[0].message.content);
      return parsed.conversations || [];
    } catch (error) {
      console.error('Error extracting conversation pairs:', error);
      return [];
    }
  }

  /**
   * Cache training examples for reuse
   */
  private static async cacheTrainingExamples(
    examples: ConversationPair[],
    avatarId: string,
    userId: string,
    trainingDataId: string
  ): Promise<void> {
    const { data: activeVersion } = await supabase
      .from('avatar_prompt_versions')
      .select('system_prompt')
      .eq('avatar_id', avatarId)
      .eq('is_active', true)
      .single();

    const systemPrompt = activeVersion?.system_prompt || 'You are a helpful AI assistant.';

    const examplesData = examples.map(ex => ({
      user_id: userId,
      avatar_id: avatarId,
      training_data_id: trainingDataId,
      system_prompt: systemPrompt,
      user_message: ex.user_message,
      assistant_message: ex.assistant_message,
      source_type: 'uploaded_file' as const,
      quality_score: ex.quality_score || 0.8,
      pattern_type: ex.pattern_type,
      used_in_training: false,
      times_used: 0
    }));

    await supabase
      .from('avatar_training_examples')
      .insert(examplesData);
  }

  // --------------------------------------------------------------------------
  // Fine-Tuning Job Management
  // --------------------------------------------------------------------------

  /**
   * Create a new fine-tuning job
   * This uploads data to OpenAI and starts the training process
   */
  static async createFineTuneJob(
    trainingDataId: string,
    userId: string,
    avatarId: string,
    config: FineTuneConfig = {},
    onProgress?: (step: string, percentage: number) => void
  ): Promise<string> {
    const apiKey = await this.getOpenAIKey();

    try {
      // Step 1: Prepare training data (0-20%)
      onProgress?.('Preparing training data...', 10);

      const { training, validation, systemPrompt, examplesCount } =
        await this.prepareFineTuningData(trainingDataId, userId, avatarId, config);

      // Validate minimum examples
      if (training.length < 10) {
        throw new Error(
          `At least 10 training examples required for fine-tuning. You have ${training.length}. ` +
          `Please upload more conversation samples.`
        );
      }

      onProgress?.('Data prepared successfully', 20);

      // Step 2: Convert to JSONL format (20-30%)
      onProgress?.('Converting to training format...', 25);

      const trainingJSONL = training.map(ex => JSON.stringify(ex)).join('\n');
      const validationJSONL = validation.length > 0
        ? validation.map(ex => JSON.stringify(ex)).join('\n')
        : null;

      // Step 3: Upload training file to OpenAI (30-50%)
      onProgress?.('Uploading training data to OpenAI...', 35);

      const formData = new FormData();
      formData.append('purpose', 'fine-tune');
      formData.append(
        'file',
        new Blob([trainingJSONL], { type: 'application/jsonl' }),
        'training.jsonl'
      );

      const trainingFileResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!trainingFileResponse.ok) {
        const error = await trainingFileResponse.json();
        throw new Error(`Failed to upload training file: ${error.error?.message || 'Unknown error'}`);
      }

      const trainingFileData = await trainingFileResponse.json();
      onProgress?.('Training data uploaded', 50);

      // Step 4: Upload validation file if exists (50-60%)
      let validationFileId = null;
      if (validationJSONL) {
        onProgress?.('Uploading validation data...', 55);

        const validationFormData = new FormData();
        validationFormData.append('purpose', 'fine-tune');
        validationFormData.append(
          'file',
          new Blob([validationJSONL], { type: 'application/jsonl' }),
          'validation.jsonl'
        );

        const validationFileResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: validationFormData
        });

        if (validationFileResponse.ok) {
          const validationFileData = await validationFileResponse.json();
          validationFileId = validationFileData.id;
        }
      }

      onProgress?.('Validation data uploaded', 60);

      // Step 5: Create fine-tuning job (60-70%)
      onProgress?.('Creating fine-tuning job...', 65);

      const baseModel = config.baseModel || 'gpt-4o-mini-2024-07-18';
      const suffix = config.suffix || `avatar-${avatarId.slice(0, 8)}`;

      const fineTuneBody: any = {
        training_file: trainingFileData.id,
        model: baseModel,
        suffix: suffix,
        hyperparameters: {}
      };

      if (validationFileId) {
        fineTuneBody.validation_file = validationFileId;
      }

      // Only include hyperparameters if they're explicitly set
      if (config.nEpochs !== undefined) {
        fineTuneBody.hyperparameters.n_epochs = config.nEpochs;
      }
      if (config.learningRateMultiplier !== undefined) {
        fineTuneBody.hyperparameters.learning_rate_multiplier = config.learningRateMultiplier;
      }
      if (config.batchSize !== undefined) {
        fineTuneBody.hyperparameters.batch_size = config.batchSize;
      }

      // If no hyperparameters were set, use OpenAI's defaults
      if (Object.keys(fineTuneBody.hyperparameters).length === 0) {
        fineTuneBody.hyperparameters = {
          n_epochs: 'auto'
        };
      }

      const fineTuneResponse = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fineTuneBody)
      });

      if (!fineTuneResponse.ok) {
        const error = await fineTuneResponse.json();
        throw new Error(`Failed to create fine-tuning job: ${error.error?.message || 'Unknown error'}`);
      }

      const fineTuneJob = await fineTuneResponse.json();
      onProgress?.('Fine-tuning job created', 70);

      // Step 6: Save to database (70-90%)
      onProgress?.('Saving job details...', 80);

      const { data: job, error: dbError } = await supabase
        .from('avatar_fine_tune_jobs')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          training_data_id: trainingDataId,
          openai_job_id: fineTuneJob.id,
          openai_training_file_id: trainingFileData.id,
          openai_validation_file_id: validationFileId,
          base_model: baseModel,
          model_suffix: suffix,
          status: fineTuneJob.status,
          hyperparameters: fineTuneJob.hyperparameters,
          training_examples_count: training.length,
          validation_examples_count: validation.length,
          created_at: new Date(fineTuneJob.created_at * 1000).toISOString()
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Step 7: Update training data status (90-100%)
      await supabase
        .from('avatar_training_data')
        .update({
          fine_tune_job_id: fineTuneJob.id,
          fine_tune_status: 'queued'
        })
        .eq('id', trainingDataId);

      // Mark examples as used in training
      // First get current examples to increment times_used
      const { data: examples } = await supabase
        .from('avatar_training_examples')
        .select('id, times_used')
        .eq('avatar_id', avatarId)
        .eq('user_id', userId);

      if (examples && examples.length > 0) {
        // Update each example to increment times_used
        for (const example of examples) {
          await supabase
            .from('avatar_training_examples')
            .update({
              used_in_training: true,
              times_used: (example.times_used || 0) + 1
            })
            .eq('id', example.id);
        }
      }

      onProgress?.('Fine-tuning job created successfully!', 100);

      return job.id;

    } catch (error: any) {
      console.error('Error creating fine-tune job:', error);
      throw new Error(error.message || 'Failed to create fine-tuning job');
    }
  }

  /**
   * Check the status of a fine-tuning job
   * Syncs with OpenAI's API and updates local database
   */
  static async checkFineTuneStatus(
    jobId: string,
    userId: string
  ): Promise<{
    status: string;
    fineTunedModel?: string;
    trainedTokens?: number;
    error?: string;
    estimatedFinish?: string;
    progress?: number;
  }> {
    // 1. Get job from database
    const { data: job, error } = await supabase
      .from('avatar_fine_tune_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    // 2. Fetch latest status from OpenAI
    const apiKey = await this.getOpenAIKey();
    const response = await fetch(
      `https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch job status from OpenAI');
    }

    const jobData = await response.json();

    // 3. Update database with latest info
    const updates: any = {
      status: jobData.status,
      trained_tokens: jobData.trained_tokens
    };

    if (jobData.status === 'succeeded') {
      updates.fine_tuned_model = jobData.fine_tuned_model;
      updates.finished_at = new Date(jobData.finished_at * 1000).toISOString();
      updates.result_files = jobData.result_files;

      // Update avatar profile to use the new fine-tuned model
      await supabase
        .from('avatars')
        .update({
          active_fine_tuned_model: jobData.fine_tuned_model,
          use_fine_tuned_model: true
        })
        .eq('id', job.avatar_id);

      // Update training data
      await supabase
        .from('avatar_training_data')
        .update({
          fine_tuned_model_id: jobData.fine_tuned_model,
          fine_tune_status: 'succeeded'
        })
        .eq('id', job.training_data_id);

    } else if (jobData.status === 'failed') {
      updates.error_message = jobData.error?.message || 'Unknown error';
      updates.finished_at = jobData.finished_at
        ? new Date(jobData.finished_at * 1000).toISOString()
        : new Date().toISOString();

      // Update training data
      await supabase
        .from('avatar_training_data')
        .update({
          fine_tune_status: 'failed',
          fine_tune_error: jobData.error?.message
        })
        .eq('id', job.training_data_id);

    } else if (jobData.status === 'running') {
      if (jobData.started_at) {
        updates.started_at = new Date(jobData.started_at * 1000).toISOString();
      }
      if (jobData.estimated_finish) {
        updates.estimated_finish_at = new Date(jobData.estimated_finish * 1000).toISOString();
      }

      await supabase
        .from('avatar_training_data')
        .update({ fine_tune_status: 'running' })
        .eq('id', job.training_data_id);
    }

    await supabase
      .from('avatar_fine_tune_jobs')
      .update(updates)
      .eq('id', jobId);

    // Calculate progress percentage
    let progress = 0;
    switch (jobData.status) {
      case 'validating_files': progress = 10; break;
      case 'queued': progress = 20; break;
      case 'running': progress = 50; break;
      case 'succeeded': progress = 100; break;
      case 'failed': progress = 100; break;
      case 'cancelled': progress = 100; break;
    }

    return {
      status: jobData.status,
      fineTunedModel: jobData.fine_tuned_model,
      trainedTokens: jobData.trained_tokens,
      error: jobData.error?.message,
      estimatedFinish: jobData.estimated_finish
        ? new Date(jobData.estimated_finish * 1000).toISOString()
        : undefined,
      progress
    };
  }

  /**
   * List all fine-tune jobs for an avatar
   */
  static async listFineTuneJobs(
    avatarId: string,
    userId: string
  ): Promise<FineTuneJob[]> {
    const { data, error } = await supabase
      .from('avatar_fine_tune_jobs')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get active (in-progress) fine-tuning jobs for an avatar
   * Returns only jobs that are validating, queued, or running
   */
  static async getActiveJobs(
    avatarId: string,
    userId: string
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('avatar_fine_tune_jobs')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .in('status', ['validating_files', 'queued', 'running'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Cancel a running fine-tune job
   */
  static async cancelFineTuneJob(
    jobId: string,
    userId: string
  ): Promise<void> {
    const { data: job } = await supabase
      .from('avatar_fine_tune_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (!job) {
      throw new Error('Job not found');
    }

    if (!['queued', 'running', 'validating_files'].includes(job.status)) {
      throw new Error('Can only cancel jobs that are queued or running');
    }

    const apiKey = await this.getOpenAIKey();
    const response = await fetch(
      `https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to cancel job');
    }

    await supabase
      .from('avatar_fine_tune_jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId);

    await supabase
      .from('avatar_training_data')
      .update({ fine_tune_status: 'cancelled' })
      .eq('fine_tune_job_id', job.openai_job_id);
  }

  /**
   * Delete a fine-tuned model from OpenAI
   */
  static async deleteFineTunedModel(
    modelId: string,
    userId: string
  ): Promise<void> {
    const apiKey = await this.getOpenAIKey();

    const response = await fetch(
      `https://api.openai.com/v1/models/${modelId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete model from OpenAI');
    }

    // Update database
    await supabase
      .from('avatars')
      .update({
        active_fine_tuned_model: null,
        use_fine_tuned_model: false
      })
      .eq('active_fine_tuned_model', modelId);

    await supabase
      .from('avatar_fine_tune_jobs')
      .update({
        fine_tuned_model: null
      })
      .eq('fine_tuned_model', modelId)
      .eq('user_id', userId);
  }

  /**
   * Activate a fine-tuned model for an avatar
   */
  static async activateFineTunedModel(
    avatarId: string,
    modelId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('avatars')
      .update({
        active_fine_tuned_model: modelId,
        use_fine_tuned_model: true
      })
      .eq('id', avatarId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Deactivate fine-tuned model (revert to base model)
   */
  static async deactivateFineTunedModel(
    avatarId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('avatars')
      .update({
        use_fine_tuned_model: false
      })
      .eq('id', avatarId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // --------------------------------------------------------------------------
  // Training Examples Management
  // --------------------------------------------------------------------------

  /**
   * Get all training examples for an avatar
   */
  static async getTrainingExamples(
    avatarId: string,
    userId: string
  ): Promise<TrainingExample[]> {
    const { data, error } = await supabase
      .from('avatar_training_examples')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .order('quality_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get training examples count by pattern type
   */
  static async getExamplesStatistics(
    avatarId: string,
    userId: string
  ): Promise<{
    total: number;
    byPatternType: Record<string, number>;
    averageQuality: number;
    usedInTraining: number;
  }> {
    const examples = await this.getTrainingExamples(avatarId, userId);

    const stats = {
      total: examples.length,
      byPatternType: {} as Record<string, number>,
      averageQuality: 0,
      usedInTraining: 0
    };

    let totalQuality = 0;

    examples.forEach(ex => {
      if (ex.pattern_type) {
        stats.byPatternType[ex.pattern_type] =
          (stats.byPatternType[ex.pattern_type] || 0) + 1;
      }
      totalQuality += ex.quality_score;
      if (ex.used_in_training) {
        stats.usedInTraining++;
      }
    });

    stats.averageQuality = examples.length > 0
      ? totalQuality / examples.length
      : 0;

    return stats;
  }

  /**
   * Check if avatar has enough examples for fine-tuning
   */
  static async checkFineTuneEligibility(
    avatarId: string,
    userId: string
  ): Promise<{
    eligible: boolean;
    currentExamples: number;
    requiredExamples: number;
    qualityScore: number;
    recommendation: string;
  }> {
    const stats = await this.getExamplesStatistics(avatarId, userId);

    const requiredExamples = 10; // OpenAI minimum
    const recommendedExamples = 50; // For good results

    let recommendation = '';
    if (stats.total < requiredExamples) {
      recommendation = `You need at least ${requiredExamples - stats.total} more conversation examples to start fine-tuning.`;
    } else if (stats.total < recommendedExamples) {
      recommendation = `You can start fine-tuning, but ${recommendedExamples - stats.total} more examples would improve quality.`;
    } else if (stats.averageQuality < 0.6) {
      recommendation = 'Consider improving the quality of your training examples for better results.';
    } else {
      recommendation = 'You have enough high-quality examples for fine-tuning!';
    }

    return {
      eligible: stats.total >= requiredExamples && stats.averageQuality >= 0.5,
      currentExamples: stats.total,
      requiredExamples,
      qualityScore: stats.averageQuality,
      recommendation
    };
  }

  // --------------------------------------------------------------------------
  // Utility Functions
  // --------------------------------------------------------------------------

  /**
   * Get OpenAI API key (admin-assigned priority > user's key)
   */
  private static async getOpenAIKey(): Promise<string> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Priority 1: Check for admin-assigned API key
    const { data: adminKey } = await supabase
      .from('admin_assigned_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .eq('service', 'openai')
      .eq('is_active', true)
      .maybeSingle();

    if (adminKey?.api_key_encrypted) {
      try {
        return atob(adminKey.api_key_encrypted);
      } catch (e) {
        console.error('Failed to decrypt admin-assigned API key');
      }
    }

    // Priority 2: Fall back to user's own key (for backward compatibility)
    const apiKey = await apiKeyService.getDecryptedApiKey(user.id, 'OpenAI');

    if (apiKey) {
      return apiKey;
    }

    throw new Error('No OpenAI API key configured. Please contact your administrator.');
  }

  /**
   * Shuffle array for better training distribution
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Estimate cost of fine-tuning
   * NOTE: This is a ROUGH estimate. Actual cost depends on real token count.
   */
  static estimateFineTuningCost(
    examplesCount: number,
    baseModel: string,
    epochs: number = 3
  ): {
    trainingCost: number;
    inputCostPer1M: number;
    outputCostPer1M: number;
    totalEstimate: number;
    estimatedLow: number;
    estimatedHigh: number;
    warning: string;
  } {
    // REALISTIC token estimates per example (system + user + assistant)
    // Short examples: ~500 tokens (simple Q&A)
    // Medium examples: ~1500 tokens (normal conversations)
    // Long examples: ~3000 tokens (detailed conversations with context)
    const avgTokensPerExampleLow = 500;   // Conservative estimate
    const avgTokensPerExampleHigh = 3000; // Realistic for conversation data

    const totalTrainingTokensLow = examplesCount * avgTokensPerExampleLow * epochs;
    const totalTrainingTokensHigh = examplesCount * avgTokensPerExampleHigh * epochs;

    // OpenAI pricing (as of Jan 2025)
    let trainingPricePer1M = 0;
    let inputPricePer1M = 0;
    let outputPricePer1M = 0;
    let modelName = '';

    if (baseModel.includes('gpt-4o-mini')) {
      trainingPricePer1M = 3.00; // $3 per 1M tokens
      inputPricePer1M = 0.30;
      outputPricePer1M = 1.20;
      modelName = 'GPT-4o-mini';
    } else if (baseModel.includes('gpt-4o')) {
      trainingPricePer1M = 25.00; // $25 per 1M tokens
      inputPricePer1M = 3.75;
      outputPricePer1M = 15.00;
      modelName = 'GPT-4o';
    } else if (baseModel.includes('gpt-3.5-turbo')) {
      trainingPricePer1M = 8.00; // $8 per 1M tokens
      inputPricePer1M = 3.00;
      outputPricePer1M = 6.00;
      modelName = 'GPT-3.5-turbo';
    }

    const trainingCostLow = (totalTrainingTokensLow / 1000000) * trainingPricePer1M;
    const trainingCostHigh = (totalTrainingTokensHigh / 1000000) * trainingPricePer1M;
    const trainingCostMid = (trainingCostLow + trainingCostHigh) / 2;

    // Generate warning based on model and cost
    let warning = '';
    if (baseModel.includes('gpt-4o') && !baseModel.includes('mini')) {
      if (trainingCostHigh > 5) {
        warning = `⚠️ WARNING: ${modelName} is EXPENSIVE! Consider using gpt-4o-mini instead (8x cheaper, $${(trainingCostHigh / 8).toFixed(2)} vs $${trainingCostHigh.toFixed(2)}). GPT-4o-mini works great for conversation style training!`;
      } else {
        warning = `💡 TIP: ${modelName} is costly. Consider gpt-4o-mini for conversation training (8x cheaper).`;
      }
    } else if (baseModel.includes('gpt-4o-mini')) {
      warning = `✅ Good choice! GPT-4o-mini is cost-effective for conversation training.`;
    }

    return {
      trainingCost: Math.round(trainingCostMid * 100) / 100,
      inputCostPer1M: inputPricePer1M,
      outputCostPer1M: outputPricePer1M,
      totalEstimate: Math.round(trainingCostMid * 100) / 100,
      estimatedLow: Math.round(trainingCostLow * 100) / 100,
      estimatedHigh: Math.round(trainingCostHigh * 100) / 100,
      warning
    };
  }
}
