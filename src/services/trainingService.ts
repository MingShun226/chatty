import { supabase } from '@/integrations/supabase/client';

export interface ConversationPair {
  user_message: string;
  assistant_message: string;
  context?: string;
  pattern_type?: string;
  quality_score?: number;
}

export interface TrainingData {
  id?: string;
  user_id: string;
  avatar_id: string;
  system_prompt?: string;
  user_prompt_template?: string;
  training_instructions?: string;
  training_type: 'prompt_update' | 'conversation_analysis' | 'file_upload';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  generated_prompts?: any;
  analysis_results?: any;
  improvement_notes?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

export interface TrainingFile {
  id?: string;
  training_data_id: string;
  user_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_text?: string;
  analysis_data?: any;
  uploaded_at?: string;
  processed_at?: string;
}

export interface PromptVersion {
  id?: string;
  avatar_id: string;
  user_id: string;
  training_data_id?: string;
  parent_version_id?: string;
  base_version_id?: string;
  version_number: string;
  version_name?: string;
  description?: string;
  system_prompt: string;
  personality_traits?: string[];
  behavior_rules?: string[];
  response_style?: any;
  changes_from_parent?: any;
  inheritance_type?: 'full' | 'incremental' | 'override';
  is_active: boolean;
  is_published: boolean;
  usage_count?: number;
  rating?: number;
  feedback_notes?: string;
  created_at?: string;
  activated_at?: string;
}

export interface TrainingLog {
  id?: string;
  avatar_id: string;
  user_id: string;
  training_data_id: string;
  log_type: 'training_start' | 'processing_step' | 'completion' | 'error';
  message: string;
  details?: any;
  processing_step?: 'file_upload' | 'text_extraction' | 'analysis' | 'prompt_generation';
  progress_percentage?: number;
  created_at?: string;
}

export class TrainingService {

  // =============================================
  // TRAINING DATA MANAGEMENT
  // =============================================

  static async createTrainingSession(data: Omit<TrainingData, 'id' | 'created_at' | 'updated_at'>): Promise<TrainingData> {
    const { data: trainingData, error } = await supabase
      .from('avatar_training_data')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`Failed to create training session: ${error.message}`);
    return trainingData;
  }

  static async updateTrainingData(id: string, updates: Partial<TrainingData>): Promise<TrainingData> {
    const { data, error } = await supabase
      .from('avatar_training_data')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update training data: ${error.message}`);
    return data;
  }

  static async getTrainingSession(id: string): Promise<TrainingData | null> {
    const { data, error } = await supabase
      .from('avatar_training_data')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get training session: ${error.message}`);
    }
    return data;
  }

  static async getAvatarTrainingSessions(avatarId: string, userId: string): Promise<TrainingData[]> {
    const { data, error } = await supabase
      .from('avatar_training_data')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get training sessions: ${error.message}`);
    return data || [];
  }

  // =============================================
  // FILE MANAGEMENT
  // =============================================

  static async uploadTrainingFile(
    trainingDataId: string,
    userId: string,
    file: File
  ): Promise<TrainingFile> {
    // Upload file to storage
    const fileName = `${userId}/${trainingDataId}/${Date.now()}-${file.name}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from('training-files')
      .upload(fileName, file);

    if (storageError) {
      throw new Error(`Failed to upload file: ${storageError.message}`);
    }

    // Save file metadata to database
    const fileData: Omit<TrainingFile, 'id' | 'uploaded_at'> = {
      training_data_id: trainingDataId,
      user_id: userId,
      file_name: fileName,
      original_name: file.name,
      file_path: storageData.path,
      file_size: file.size,
      content_type: file.type,
      processing_status: 'pending'
    };

    const { data, error } = await supabase
      .from('avatar_training_files')
      .insert(fileData)
      .select()
      .single();

    if (error) {
      // Clean up uploaded file if database insertion fails
      await supabase.storage.from('training-files').remove([fileName]);
      throw new Error(`Failed to save file metadata: ${error.message}`);
    }

    return data;
  }

  static async getTrainingFiles(trainingDataId: string): Promise<TrainingFile[]> {
    const { data, error } = await supabase
      .from('avatar_training_files')
      .select('*')
      .eq('training_data_id', trainingDataId)
      .order('uploaded_at', { ascending: false });

    if (error) throw new Error(`Failed to get training files: ${error.message}`);
    return data || [];
  }

  static async updateFileProcessingStatus(
    fileId: string,
    status: TrainingFile['processing_status'],
    extractedText?: string,
    analysisData?: any
  ): Promise<void> {
    const updates: any = {
      processing_status: status,
      processed_at: new Date().toISOString()
    };

    if (extractedText) updates.extracted_text = extractedText;
    if (analysisData) updates.analysis_data = analysisData;

    const { error } = await supabase
      .from('avatar_training_files')
      .update(updates)
      .eq('id', fileId);

    if (error) throw new Error(`Failed to update file status: ${error.message}`);
  }

  // =============================================
  // PROMPT VERSION MANAGEMENT
  // =============================================

  static async createPromptVersion(version: Omit<PromptVersion, 'id' | 'created_at'>): Promise<PromptVersion> {
    const { data, error } = await supabase
      .from('avatar_prompt_versions')
      .insert(version)
      .select()
      .single();

    if (error) throw new Error(`Failed to create prompt version: ${error.message}`);
    return data;
  }

  static async getActivePromptVersion(avatarId: string, userId: string): Promise<PromptVersion | null> {
    try {
      const { data, error } = await supabase
        .from('avatar_prompt_versions')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error querying avatar_prompt_versions:', error);
        throw new Error(`Failed to get active prompt version: ${error.message}`);
      }

      // Return first result or null if no results
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Exception in getActivePromptVersion:', error);
      return null; // Return null on any error to prevent app crashes
    }
  }

  static async getPromptVersions(avatarId: string, userId: string): Promise<PromptVersion[]> {
    try {
      const { data, error } = await supabase
        .from('avatar_prompt_versions')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error querying prompt versions:', error);
        throw new Error(`Failed to get prompt versions: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Exception in getPromptVersions:', error);
      return []; // Return empty array on error to prevent app crashes
    }
  }

  static async activatePromptVersion(versionId: string, avatarId: string, userId: string): Promise<void> {
    // First deactivate all versions for this avatar
    await supabase
      .from('avatar_prompt_versions')
      .update({ is_active: false, activated_at: null })
      .eq('avatar_id', avatarId)
      .eq('user_id', userId);

    // Then activate the specified version
    const { error } = await supabase
      .from('avatar_prompt_versions')
      .update({
        is_active: true,
        activated_at: new Date().toISOString()
      })
      .eq('id', versionId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to activate prompt version: ${error.message}`);
  }

  static async updatePromptVersion(versionId: string, updates: Partial<PromptVersion>, userId?: string): Promise<void> {
    let query = supabase
      .from('avatar_prompt_versions')
      .update(updates)
      .eq('id', versionId);

    // Add user validation if provided
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) throw new Error(`Failed to update prompt version: ${error.message}`);
  }

  // =============================================
  // VERSION LINEAGE METHODS
  // =============================================

  static async getVersionLineage(versionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_version_lineage', { version_uuid: versionId });

    if (error) {
      console.error('Error getting version lineage:', error);
      return [];
    }
    return data || [];
  }

  static async getVersionDescendants(versionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_version_descendants', { version_uuid: versionId });

    if (error) {
      console.error('Error getting version descendants:', error);
      return [];
    }
    return data || [];
  }

  static async createIncrementalVersion(
    avatarId: string,
    userId: string,
    trainingDataId: string,
    parentVersionId: string | null,
    versionData: Partial<PromptVersion>,
    changesFromParent?: any
  ): Promise<PromptVersion> {
    // Get the next version number
    const existingVersions = await this.getPromptVersions(avatarId, userId);
    const versionNumber = `v${existingVersions.length + 1}.0`;

    const version: Omit<PromptVersion, 'id' | 'created_at'> = {
      avatar_id: avatarId,
      user_id: userId,
      training_data_id: trainingDataId,
      parent_version_id: parentVersionId,
      version_number: versionNumber,
      version_name: versionData.version_name || `Training Update ${new Date().toLocaleDateString()}`,
      description: versionData.description || `Generated from training with ${parentVersionId ? 'incremental' : 'new'} data`,
      system_prompt: versionData.system_prompt || '',
      personality_traits: versionData.personality_traits || [],
      behavior_rules: versionData.behavior_rules || [],
      response_style: versionData.response_style || {},
      changes_from_parent: changesFromParent,
      inheritance_type: parentVersionId ? 'incremental' : 'full',
      is_active: false,
      is_published: false
    };

    const { data, error } = await supabase
      .from('avatar_prompt_versions')
      .insert(version)
      .select()
      .single();

    if (error) throw new Error(`Failed to create incremental version: ${error.message}`);
    return data;
  }

  // =============================================
  // LOGGING
  // =============================================

  static async logTrainingEvent(log: Omit<TrainingLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('avatar_training_logs')
      .insert(log);

    if (error) {
      console.error('Failed to log training event:', error);
      // Don't throw error for logging failures
    }
  }

  static async getTrainingLogs(trainingDataId: string): Promise<TrainingLog[]> {
    const { data, error } = await supabase
      .from('avatar_training_logs')
      .select('*')
      .eq('training_data_id', trainingDataId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to get training logs: ${error.message}`);
    return data || [];
  }

  // =============================================
  // PROMPT MODIFICATION (SURGICAL EDITS)
  // =============================================

  /**
   * Apply targeted modifications to specific sections of the prompt
   * This is for prompt-based training where user describes changes to make
   * NO conversation examples, just surgical edits to the prompt
   */
  static async applyPromptModification(
    trainingDataId: string,
    userId: string,
    avatarId: string,
    modificationInstructions: string,
    currentPrompt: string
  ): Promise<any> {
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Call AI to make surgical edits
    const prompt = `You are an expert prompt editor specializing in SURGICAL, TARGETED edits.

CURRENT PROMPT:
${currentPrompt}

USER'S MODIFICATION REQUEST:
${modificationInstructions}

YOUR TASK - SURGICAL EDITING ONLY:

1. **ANALYZE** what the user wants to change:
   - Backstory? Personality? Age? Location? Interests?
   - Be very specific about what sections are affected

2. **PRESERVE EVERYTHING ELSE**:
   - If user says "change backstory", ONLY touch backstory
   - If user says "update age", ONLY touch age-related text
   - Keep ALL other sections 100% unchanged

3. **MAKE MINIMAL CHANGES**:
   - Find the exact section that needs changing
   - Replace ONLY that section with the new content
   - Don't rewrite sections not mentioned

4. **NO ADDITIONS unless requested**:
   - Don't add training sections
   - Don't add few-shot examples
   - Don't add new rules
   - ONLY modify what user explicitly asked to change

EXAMPLES:

User Request: "Change age to 25"
Action: Find age mention → Replace with 25 → Keep everything else

User Request: "Make backstory about being a teacher"
Action: Find backstory section → Rewrite to teacher story → Keep personality, age, etc.

User Request: "Update personality to be more friendly"
Action: Find personality section → Modify to be friendly → Keep backstory, age, etc.

FORMATTING REQUIREMENTS:
- Maintain proper line breaks and spacing
- Use \\n for new lines in JSON
- Keep paragraph separation clear
- Preserve the structure of the original prompt
- Don't squeeze everything together

Return ONLY valid JSON:
{
  "modified_prompt": "The prompt with ONLY the requested sections changed. Use \\n for line breaks to maintain readability.",
  "sections_modified": ["list of specific sections you changed"],
  "sections_preserved": ["list of sections kept unchanged"],
  "change_summary": "brief description of what was changed"
}`;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a surgical prompt editor. You make MINIMAL, TARGETED changes to only the sections requested. You preserve everything else 100%. You do NOT add training sections or examples unless explicitly asked. IMPORTANT: Maintain proper formatting with line breaks (\\n) and spacing to keep the prompt readable and well-structured.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 8000,
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Modification API error: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.choices[0]?.message?.content || '{}';

    try {
      let cleanedText = resultText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanedText);
      const modifiedPrompt = parsed.modified_prompt || currentPrompt;

      // Get existing versions
      const existingVersions = await this.getPromptVersions(avatarId, userId);
      const versionNumber = `v${existingVersions.length + 1}.0`;

      // Create new version with the modified prompt
      const newVersion = await this.createPromptVersion({
        avatar_id: avatarId,
        user_id: userId,
        training_data_id: trainingDataId,
        parent_version_id: existingVersions.find(v => v.is_active)?.id,
        version_number: versionNumber,
        version_name: `Prompt Modification ${new Date().toLocaleDateString()}`,
        description: parsed.change_summary || 'Targeted prompt modifications',
        system_prompt: modifiedPrompt,
        personality_traits: [],
        behavior_rules: [],
        response_style: {},
        changes_from_parent: {
          modification_type: 'surgical_edit',
          sections_modified: parsed.sections_modified || [],
          sections_preserved: parsed.sections_preserved || [],
          user_instructions: modificationInstructions
        },
        inheritance_type: 'incremental',
        is_active: false,
        is_published: false
      });

      // Update training data
      await this.updateTrainingData(trainingDataId, {
        status: 'completed',
        generated_prompts: {
          system_prompt: modifiedPrompt,
          sections_modified: parsed.sections_modified,
          sections_preserved: parsed.sections_preserved
        },
        improvement_notes: parsed.change_summary,
        completed_at: new Date().toISOString()
      });

      return {
        version: newVersion,
        modified_prompt: modifiedPrompt,
        sections_modified: parsed.sections_modified || [],
        change_summary: parsed.change_summary || 'Modifications applied'
      };

    } catch (error) {
      console.error('Error parsing modification result:', error);
      throw new Error('Failed to parse modification result');
    }
  }

  // =============================================
  // AI PROCESSING
  // =============================================

  static async processTrainingData(
    trainingDataId: string,
    userId: string,
    avatarId: string,
    onProgress?: (step: string, percentage: number) => void
  ): Promise<PromptVersion> {
    try {
      // Get the training session
      const trainingData = await this.getTrainingSession(trainingDataId);
      if (!trainingData) throw new Error('Training session not found');

      // Log start of training
      await this.logTrainingEvent({
        avatar_id: avatarId,
        user_id: userId,
        training_data_id: trainingDataId,
        log_type: 'training_start',
        message: 'Training process started',
        progress_percentage: 0
      });

      // Update status to processing
      await this.updateTrainingData(trainingDataId, { status: 'processing' });

      onProgress?.('Initializing training process...', 10);

      // Get uploaded files for analysis
      const files = await this.getTrainingFiles(trainingDataId);

      let extractedContent = '';
      let conversationAnalysis: any = {};

      // First, check if there's directly pasted conversation text
      // This could be in training_instructions field when user pastes conversation examples
      if (trainingData.training_type === 'conversation_analysis' && trainingData.training_instructions) {
        onProgress?.('Processing pasted conversation text...', 25);
        extractedContent = trainingData.training_instructions;
      }

      // Process uploaded files
      if (files.length > 0) {
        onProgress?.('Processing uploaded files...', 30);

        for (const file of files) {
          await this.updateFileProcessingStatus(file.id!, 'processing');

          try {
            if (file.content_type.startsWith('image/')) {
              // Process image files (conversation screenshots)
              const extractedText = await this.extractTextFromImage(file, userId);
              extractedContent += `\n--- From ${file.original_name} ---\n${extractedText}\n`;

              await this.updateFileProcessingStatus(
                file.id!,
                'completed',
                extractedText
              );
            } else if (file.content_type === 'text/plain') {
              // Process text files
              const textContent = await this.readTextFile(file);
              extractedContent += `\n--- From ${file.original_name} ---\n${textContent}\n`;

              await this.updateFileProcessingStatus(
                file.id!,
                'completed',
                textContent
              );
            }
          } catch (fileError) {
            console.error(`Error processing file ${file.original_name}:`, fileError);
            await this.updateFileProcessingStatus(file.id!, 'failed');
          }
        }
      }

      // Check if examples have already been extracted and cached (from analyzeConversationsOnly)
      const { data: existingExamples } = await supabase
        .from('avatar_training_examples')
        .select('*')
        .eq('training_data_id', trainingDataId)
        .eq('user_id', userId);

      const hasExistingExamples = existingExamples && existingExamples.length > 0;

      if (hasExistingExamples) {
        // Examples already cached from Step 1 (analyzeConversationsOnly)
        onProgress?.('Using pre-analyzed conversation examples...', 55);
        console.log(`Found ${existingExamples.length} pre-analyzed examples, skipping analysis`);

        // Try to get the analysis results from training data
        if (trainingData.analysis_results) {
          conversationAnalysis = trainingData.analysis_results;
        }

        // Build extracted content summary from cached examples (for prompt generation)
        extractedContent = existingExamples.map((ex: any, idx: number) =>
          `Example ${idx + 1}:\nUser: ${ex.user_message}\nAssistant: ${ex.assistant_message}\n`
        ).join('\n');

      } else {
        // No cached examples, need to analyze now
        onProgress?.('Analyzing conversation patterns...', 50);

        // Analyze conversation patterns if we have extracted content
        if (extractedContent.trim()) {
          conversationAnalysis = await this.analyzeConversationPatterns(extractedContent, userId);
        }

        onProgress?.('Caching conversation examples...', 55);

        // Get system prompt for caching examples (needed before caching)
        const existingVersionsForPrompt = await this.getPromptVersions(avatarId, userId);
        let systemPromptForCache: string;

        if (existingVersionsForPrompt.length > 0) {
          const activeVersion = existingVersionsForPrompt.find(v => v.is_active);
          const versionToUse = activeVersion || existingVersionsForPrompt.reduce((latest, current) => {
            return new Date(current.created_at!) > new Date(latest.created_at!) ? current : latest;
          });
          systemPromptForCache = versionToUse.system_prompt;
        } else {
          systemPromptForCache = await this.getAvatarSystemPrompt(avatarId, userId);
        }

        // Cache conversation examples to database for fine-tuning eligibility
        let cachedExamplesCount = 0;
        if (conversationAnalysis && Object.keys(conversationAnalysis).length > 0) {
          cachedExamplesCount = await this.cacheConversationExamples(
            conversationAnalysis,
            avatarId,
            userId,
            trainingDataId,
            systemPromptForCache
          );
          console.log(`Cached ${cachedExamplesCount} conversation examples for fine-tuning`);
        }
      }

      onProgress?.('Getting current avatar prompt...', 60);

      // Get the active version's system prompt to build upon (progressive training)
      // This ensures we always build on top of what's currently being used
      const existingVersions = await this.getPromptVersions(avatarId, userId);
      let currentAvatarPrompt: string;
      let parentVersionId: string | undefined;

      if (existingVersions.length > 0) {
        // First try to get the active version
        const activeVersion = existingVersions.find(v => v.is_active);

        // If no active version, use the most recent version
        const versionToUse = activeVersion || existingVersions.reduce((latest, current) => {
          return new Date(current.created_at!) > new Date(latest.created_at!) ? current : latest;
        });

        currentAvatarPrompt = versionToUse.system_prompt;
        parentVersionId = versionToUse.id;

        console.log(`Building on ${activeVersion ? 'active' : 'latest'} version: ${versionToUse.version_number}`);
      } else {
        // No versions exist, use original avatar profile
        currentAvatarPrompt = await this.getAvatarSystemPrompt(avatarId, userId);
        console.log('No existing versions, building from base avatar profile');
      }

      onProgress?.('Generating improved prompts...', 70);

      // Generate improved system prompt based on existing avatar prompt
      // Use training instructions as the main enhancement guide
      const enhancementInstructions = trainingData.training_instructions || 'Analyze the conversation examples and enhance the existing system prompt to match the communication style found in the examples.';

      const generatedPrompts = await this.generateImprovedPrompts(
        currentAvatarPrompt,
        enhancementInstructions,
        extractedContent,
        conversationAnalysis,
        userId
      );

      onProgress?.('Creating new prompt version...', 90);

      // Get current version number for incrementing (we already have existingVersions)
      const versionNumber = `v${existingVersions.length + 1}.0`;

      // Create new prompt version with parent reference and few-shot examples
      const changesSummary = generatedPrompts.changes_summary || {};
      const newVersion = await this.createPromptVersion({
        avatar_id: avatarId,
        user_id: userId,
        training_data_id: trainingDataId,
        parent_version_id: parentVersionId, // Link to parent version for progressive training
        version_number: versionNumber,
        version_name: `Training Update ${new Date().toLocaleDateString()}`,
        description: `Incremental update: ${changesSummary.sections_added?.length || 0} sections added, ${changesSummary.sections_updated?.length || 0} sections updated`,
        system_prompt: generatedPrompts.system_prompt,
        personality_traits: generatedPrompts.personality_traits || [],
        behavior_rules: generatedPrompts.behavior_rules || [],
        response_style: {
          ...(generatedPrompts.response_style || {}),
          few_shot_examples: generatedPrompts.few_shot_examples || []
        },
        changes_from_parent: {
          conversation_learning_applied: true,
          update_type: 'incremental',
          sections_added: changesSummary.sections_added || [],
          sections_updated: changesSummary.sections_updated || [],
          sections_unchanged: changesSummary.sections_unchanged || [],
          conflict_resolution: changesSummary.conflict_resolution || '',
          examples_count: generatedPrompts.few_shot_examples?.length || 0,
          vocabulary_learned: generatedPrompts.response_style?.vocabulary || [],
          signature_phrases: generatedPrompts.response_style?.signature_phrases || []
        },
        inheritance_type: 'incremental', // Mark as incremental improvement
        is_active: false, // Don't auto-activate, let user choose
        is_published: false
      });

      // Update training data with results
      await this.updateTrainingData(trainingDataId, {
        status: 'completed',
        generated_prompts: generatedPrompts,
        analysis_results: conversationAnalysis,
        improvement_notes: generatedPrompts.improvement_notes,
        completed_at: new Date().toISOString()
      });

      // Log completion
      await this.logTrainingEvent({
        avatar_id: avatarId,
        user_id: userId,
        training_data_id: trainingDataId,
        log_type: 'completion',
        message: 'Training completed successfully',
        details: { version_id: newVersion.id, version_number: versionNumber },
        progress_percentage: 100
      });

      onProgress?.('Training completed!', 100);

      return newVersion;

    } catch (error) {
      // Update status to failed
      await this.updateTrainingData(trainingDataId, { status: 'failed' });

      // Log error
      await this.logTrainingEvent({
        avatar_id: avatarId,
        user_id: userId,
        training_data_id: trainingDataId,
        log_type: 'error',
        message: `Training failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error }
      });

      throw error;
    }
  }

  // =============================================
  // AI HELPER METHODS
  // =============================================

  private static async extractTextFromImage(file: TrainingFile, userId: string): Promise<string> {
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Download the image from storage
    const { data: imageBlob, error } = await supabase.storage
      .from('training-files')
      .download(file.file_path);

    if (error) throw new Error(`Failed to download image: ${error.message}`);

    // Convert blob to base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:${file.content_type};base64,${base64Image}`;

    // Use edge function for image analysis
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          imageUrl: dataUrl,
          prompt: 'Extract all text from this conversation screenshot. Return only the conversation text, preserving the format and structure. If this appears to be a chat conversation, include who said what.',
          model: 'gpt-4o',
          detail: 'high'
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.analysis?.description || JSON.stringify(data.analysis) || '';
  }

  private static async readTextFile(file: TrainingFile): Promise<string> {
    const { data: textBlob, error } = await supabase.storage
      .from('training-files')
      .download(file.file_path);

    if (error) throw new Error(`Failed to download text file: ${error.message}`);

    return await textBlob.text();
  }

  private static async analyzeConversationPatterns(content: string, userId: string): Promise<any> {
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert conversation analyst specializing in deep learning from conversational examples. Your task is to extract actionable patterns and concrete examples that can be used to train an AI avatar.'
            },
            {
              role: 'user',
              content: `Analyze this conversation content deeply and extract CONCRETE examples and patterns:

CONVERSATION CONTENT:
${content}

Extract and return a JSON object with:
1. Actual conversation exchange examples (user input → avatar response pairs)
2. Specific vocabulary, phrases, and expressions used
3. Detailed communication patterns with examples
4. Response structure and formatting preferences

Return this exact JSON structure:
{
  "conversation_examples": [
    {
      "user_message": "actual user message from conversation",
      "avatar_response": "actual avatar response from conversation",
      "pattern_demonstrated": "what pattern this shows (e.g., casual greeting, question handling, etc.)"
    }
  ],
  "vocabulary_and_phrases": {
    "common_words": ["specific words used frequently"],
    "signature_phrases": ["exact phrases the avatar uses"],
    "slang_and_colloquialisms": ["regional or casual language used"],
    "filler_words": ["like, um, you know, lah, lor, etc."],
    "exclamations": ["wow, omg, haha, etc."]
  },
  "communication_patterns": {
    "greeting_style": {
      "examples": ["actual greeting examples from conversation"],
      "pattern": "description of how greetings work"
    },
    "question_handling": {
      "examples": ["how questions were answered"],
      "pattern": "direct/elaborative/asks-follow-ups"
    },
    "response_structure": {
      "examples": ["actual response structures"],
      "pattern": "short-punchy/detailed-explanatory/story-telling"
    },
    "emotional_expression": {
      "examples": ["how emotions are expressed"],
      "pattern": "emoji-heavy/text-based/reserved"
    }
  },
  "linguistic_features": {
    "formality_level": "casual/semi-formal/formal with evidence",
    "sentence_structure": "simple/complex/varied with examples",
    "punctuation_style": "heavy emoji/lots of exclamation/minimal",
    "response_length": "average character/word count observed"
  },
  "behavioral_insights": {
    "personality_shown": ["traits with supporting examples"],
    "conversation_flow": "how conversations are maintained",
    "topics_of_interest": ["specific topics discussed"],
    "unique_quirks": ["any distinctive conversational behaviors"]
  }
}`
          }
        ],
          max_tokens: 3000,
          temperature: 0.2
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Analysis API error: ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0]?.message?.content || '{}';

    try {
      return JSON.parse(analysisText);
    } catch {
      return { raw_analysis: analysisText };
    }
  }

  // =============================================
  // DIRECT CONVERSATION PARSING
  // =============================================

  /**
   * Parse conversation pairs from text in "User: ... \n Assistant: ..." format
   * This is a direct parser that doesn't rely on AI and is very fast
   */
  private static parseConversationPairs(text: string): ConversationPair[] {
    const pairs: ConversationPair[] = [];

    // Split by double newlines or single newlines to get conversation blocks
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let currentUser = '';
    let currentAssistant = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line starts with "User:" or "Assistant:"
      if (line.startsWith('User:')) {
        // Save previous pair if we have one
        if (currentUser && currentAssistant) {
          pairs.push({
            user_message: currentUser.trim(),
            assistant_message: currentAssistant.trim(),
            pattern_type: 'statement',
            quality_score: this.calculateQualityScore(currentUser, currentAssistant)
          });
          currentUser = '';
          currentAssistant = '';
        }

        // Extract user message (everything after "User:")
        currentUser = line.substring(5).trim();
      } else if (line.startsWith('Assistant:')) {
        // Extract assistant message (everything after "Assistant:")
        currentAssistant = line.substring(10).trim();
      } else if (currentUser && !currentAssistant) {
        // Continuation of user message
        currentUser += ' ' + line;
      } else if (currentAssistant) {
        // Continuation of assistant message
        currentAssistant += ' ' + line;
      }
    }

    // Don't forget the last pair
    if (currentUser && currentAssistant) {
      pairs.push({
        user_message: currentUser.trim(),
        assistant_message: currentAssistant.trim(),
        pattern_type: 'statement',
        quality_score: this.calculateQualityScore(currentUser, currentAssistant)
      });
    }

    console.log(`Direct parser extracted ${pairs.length} conversation pairs`);
    return pairs;
  }

  /**
   * Calculate quality score for a conversation pair based on length and content
   */
  private static calculateQualityScore(userMsg: string, assistantMsg: string): number {
    const userLen = userMsg.trim().length;
    const assistantLen = assistantMsg.trim().length;

    // Penalize very short exchanges
    if (userLen < 5 || assistantLen < 5) return 0.3;

    // Good quality if both messages have reasonable length
    if (userLen >= 10 && assistantLen >= 15) return 0.85;
    if (userLen >= 5 && assistantLen >= 10) return 0.7;

    return 0.6;
  }

  /**
   * Map pattern demonstrated to pattern type categories
   */
  private static mapPatternType(demonstrated: string): string {
    const lower = demonstrated.toLowerCase();
    if (lower.includes('greeting') || lower.includes('hello')) return 'greeting';
    if (lower.includes('question')) return 'question';
    if (lower.includes('joke') || lower.includes('humor')) return 'joke';
    if (lower.includes('advice') || lower.includes('suggestion')) return 'advice';
    if (lower.includes('story') || lower.includes('narrative')) return 'story';
    if (lower.includes('explanation') || lower.includes('explain')) return 'explanation';
    return 'statement';
  }

  // =============================================
  // ANALYZE CONVERSATIONS WITHOUT TRAINING
  // =============================================

  /**
   * Clear all existing training examples for an avatar
   * This allows fresh training data without accumulation
   */
  static async clearTrainingExamples(avatarId: string, userId: string): Promise<number> {
    const { data: deletedExamples, error } = await supabase
      .from('avatar_training_examples')
      .delete()
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Error clearing training examples:', error);
      throw new Error(`Failed to clear training examples: ${error.message}`);
    }

    const deletedCount = deletedExamples?.length || 0;
    console.log(`Cleared ${deletedCount} existing training examples for avatar ${avatarId}`);
    return deletedCount;
  }

  /**
   * Analyze conversation text and cache examples WITHOUT creating a new prompt version
   * This is used in Step 1 (Upload & Process) to prepare data before choosing training method
   * NOTE: This clears all previous examples before processing new ones
   */
  static async analyzeConversationsOnly(
    trainingDataId: string,
    userId: string,
    avatarId: string,
    onProgress?: (step: string, percentage: number) => void
  ): Promise<{
    examplesCount: number;
    analysis: any;
  }> {
    try {
      // Get the training session
      const trainingData = await this.getTrainingSession(trainingDataId);
      if (!trainingData) throw new Error('Training session not found');

      onProgress?.('Clearing previous training data...', 5);

      // Clear all existing examples for this avatar before processing new ones
      // This ensures each upload replaces previous data instead of accumulating
      await this.clearTrainingExamples(avatarId, userId);

      onProgress?.('Initializing analysis...', 10);

      // Update status to processing
      await this.updateTrainingData(trainingDataId, { status: 'processing' });

      // Get uploaded files
      const files = await this.getTrainingFiles(trainingDataId);

      let extractedContent = '';

      // Check if there's directly pasted conversation text
      if (trainingData.training_type === 'conversation_analysis' && trainingData.training_instructions) {
        onProgress?.('Reading pasted conversation text...', 20);
        extractedContent = trainingData.training_instructions;
      }

      // Process uploaded files
      if (files.length > 0) {
        onProgress?.('Processing uploaded files...', 30);

        for (const file of files) {
          await this.updateFileProcessingStatus(file.id!, 'processing');

          try {
            if (file.content_type.startsWith('image/')) {
              const extractedText = await this.extractTextFromImage(file, userId);
              extractedContent += `\n--- From ${file.original_name} ---\n${extractedText}\n`;
              await this.updateFileProcessingStatus(file.id!, 'completed', extractedText);
            } else if (file.content_type === 'text/plain') {
              const textContent = await this.readTextFile(file);
              extractedContent += `\n--- From ${file.original_name} ---\n${textContent}\n`;
              await this.updateFileProcessingStatus(file.id!, 'completed', textContent);
            }
          } catch (fileError) {
            console.error(`Error processing file ${file.original_name}:`, fileError);
            await this.updateFileProcessingStatus(file.id!, 'failed');
          }
        }
      }

      if (!extractedContent.trim()) {
        throw new Error('No conversation content found to analyze');
      }

      onProgress?.('Parsing conversation examples...', 40);

      // First, use direct parser to extract conversation pairs (fast and reliable)
      const directPairs = this.parseConversationPairs(extractedContent);
      console.log(`Direct parser found ${directPairs.length} conversation pairs`);

      onProgress?.('Analyzing conversation patterns with AI...', 60);

      // Then use AI to get deeper analysis (vocabulary, patterns, etc.)
      let conversationAnalysis: any = {};
      try {
        conversationAnalysis = await this.analyzeConversationPatterns(extractedContent, userId);
      } catch (error) {
        console.error('AI analysis failed, using direct parser only:', error);
        // If AI fails, we still have the direct pairs
        conversationAnalysis = {
          conversation_examples: directPairs.map(pair => ({
            user_message: pair.user_message,
            avatar_response: pair.assistant_message,
            pattern_demonstrated: 'conversation'
          }))
        };
      }

      // Merge direct pairs with AI analysis (prefer direct parser count)
      if (!conversationAnalysis.conversation_examples || conversationAnalysis.conversation_examples.length === 0) {
        conversationAnalysis.conversation_examples = directPairs.map(pair => ({
          user_message: pair.user_message,
          avatar_response: pair.assistant_message,
          pattern_demonstrated: 'conversation'
        }));
      }

      onProgress?.('Caching conversation examples...', 80);

      // Get system prompt for caching
      const existingVersions = await this.getPromptVersions(avatarId, userId);
      let systemPrompt: string;

      if (existingVersions.length > 0) {
        const activeVersion = existingVersions.find(v => v.is_active);
        const versionToUse = activeVersion || existingVersions.reduce((latest, current) => {
          return new Date(current.created_at!) > new Date(latest.created_at!) ? current : latest;
        });
        systemPrompt = versionToUse.system_prompt;
      } else {
        systemPrompt = await this.getAvatarSystemPrompt(avatarId, userId);
      }

      onProgress?.('Caching conversation examples...', 85);

      // Cache conversation examples to database
      let cachedExamplesCount = 0;
      if (conversationAnalysis && Object.keys(conversationAnalysis).length > 0) {
        cachedExamplesCount = await this.cacheConversationExamples(
          conversationAnalysis,
          avatarId,
          userId,
          trainingDataId,
          systemPrompt
        );
      }

      onProgress?.('Analysis complete!', 100);

      // Update training data with analysis results (but don't mark as completed)
      await this.updateTrainingData(trainingDataId, {
        status: 'pending', // Keep as pending, training not done yet
        analysis_results: conversationAnalysis
      });

      // Log completion of analysis
      await this.logTrainingEvent({
        avatar_id: avatarId,
        user_id: userId,
        training_data_id: trainingDataId,
        log_type: 'processing_step',
        message: `Analysis complete: extracted ${cachedExamplesCount} conversation examples`,
        processing_step: 'analysis',
        progress_percentage: 100
      });

      return {
        examplesCount: cachedExamplesCount,
        analysis: conversationAnalysis
      };

    } catch (error) {
      // Update status to failed
      await this.updateTrainingData(trainingDataId, { status: 'failed' });

      // Log error
      await this.logTrainingEvent({
        avatar_id: avatarId,
        user_id: userId,
        training_data_id: trainingDataId,
        log_type: 'error',
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error }
      });

      throw error;
    }
  }

  // =============================================
  // CACHE CONVERSATION EXAMPLES FOR FINE-TUNING
  // =============================================

  /**
   * Save extracted conversation examples to the database for fine-tuning
   * This makes them available for statistics, eligibility checking, and actual fine-tuning
   */
  private static async cacheConversationExamples(
    conversationAnalysis: any,
    avatarId: string,
    userId: string,
    trainingDataId: string,
    systemPrompt: string
  ): Promise<number> {
    // Extract conversation examples from the analysis
    const conversationExamples = conversationAnalysis?.conversation_examples || [];

    if (conversationExamples.length === 0) {
      console.log('No conversation examples found in analysis');
      return 0;
    }

    // Prepare examples for database insertion (no deduplication needed since we cleared first)
    const examplesData = conversationExamples.map((ex: any) => ({
      user_id: userId,
      avatar_id: avatarId,
      training_data_id: trainingDataId,
      system_prompt: systemPrompt,
      user_message: ex.user_message,
      assistant_message: ex.avatar_response,
      source_type: 'uploaded_file' as const,
      quality_score: this.calculateQualityScore(ex.user_message, ex.avatar_response),
      pattern_type: this.mapPatternType(ex.pattern_demonstrated || ''),
      used_in_training: false,
      times_used: 0
    }));

    // Insert all examples into database
    const { error } = await supabase
      .from('avatar_training_examples')
      .insert(examplesData);

    if (error) {
      console.error('Error caching conversation examples:', error);
      throw new Error(`Failed to cache conversation examples: ${error.message}`);
    }

    console.log(`Successfully cached ${examplesData.length} conversation examples`);
    return examplesData.length;
  }

  private static buildAnalysisSummary(conversationAnalysis: any, extractedContent: string): string {
    if (!conversationAnalysis || Object.keys(conversationAnalysis).length === 0) {
      return `CONVERSATION CONTENT:
${extractedContent.substring(0, 8000)}${extractedContent.length > 8000 ? '\n...[truncated for length]' : ''}`;
    }

    let summary = '';

    // Add conversation examples (most important for few-shot learning)
    if (conversationAnalysis.conversation_examples && conversationAnalysis.conversation_examples.length > 0) {
      summary += `\nCONVERSATION EXAMPLES (Few-Shot Learning Data):\n`;
      conversationAnalysis.conversation_examples.slice(0, 10).forEach((ex: any, idx: number) => {
        summary += `\nExample ${idx + 1} - ${ex.pattern_demonstrated || 'Interaction'}:\n`;
        summary += `User: "${ex.user_message}"\n`;
        summary += `Avatar: "${ex.avatar_response}"\n`;
      });
    }

    // Add vocabulary and phrases
    if (conversationAnalysis.vocabulary_and_phrases) {
      summary += `\nVOCABULARY & PHRASES TO ADOPT:\n`;
      const vocab = conversationAnalysis.vocabulary_and_phrases;
      if (vocab.signature_phrases?.length > 0) {
        summary += `Signature Phrases: ${vocab.signature_phrases.join(', ')}\n`;
      }
      if (vocab.slang_and_colloquialisms?.length > 0) {
        summary += `Slang/Colloquialisms: ${vocab.slang_and_colloquialisms.join(', ')}\n`;
      }
      if (vocab.common_words?.length > 0) {
        summary += `Common Words: ${vocab.common_words.join(', ')}\n`;
      }
      if (vocab.filler_words?.length > 0) {
        summary += `Filler Words: ${vocab.filler_words.join(', ')}\n`;
      }
      if (vocab.exclamations?.length > 0) {
        summary += `Exclamations: ${vocab.exclamations.join(', ')}\n`;
      }
    }

    // Add communication patterns
    if (conversationAnalysis.communication_patterns) {
      summary += `\nCOMMUNICATION PATTERNS OBSERVED:\n`;
      const patterns = conversationAnalysis.communication_patterns;

      if (patterns.greeting_style) {
        summary += `\nGreeting Style:\n`;
        summary += `Pattern: ${patterns.greeting_style.pattern}\n`;
        if (patterns.greeting_style.examples?.length > 0) {
          summary += `Examples: ${patterns.greeting_style.examples.join(' | ')}\n`;
        }
      }

      if (patterns.question_handling) {
        summary += `\nQuestion Handling:\n`;
        summary += `Pattern: ${patterns.question_handling.pattern}\n`;
        if (patterns.question_handling.examples?.length > 0) {
          summary += `Examples: ${patterns.question_handling.examples.join(' | ')}\n`;
        }
      }

      if (patterns.response_structure) {
        summary += `\nResponse Structure:\n`;
        summary += `Pattern: ${patterns.response_structure.pattern}\n`;
        if (patterns.response_structure.examples?.length > 0) {
          summary += `Examples: ${patterns.response_structure.examples.join(' | ')}\n`;
        }
      }

      if (patterns.emotional_expression) {
        summary += `\nEmotional Expression:\n`;
        summary += `Pattern: ${patterns.emotional_expression.pattern}\n`;
        if (patterns.emotional_expression.examples?.length > 0) {
          summary += `Examples: ${patterns.emotional_expression.examples.join(' | ')}\n`;
        }
      }
    }

    // Add linguistic features
    if (conversationAnalysis.linguistic_features) {
      summary += `\nLINGUISTIC FEATURES:\n`;
      const features = conversationAnalysis.linguistic_features;
      summary += `Formality: ${features.formality_level || 'not specified'}\n`;
      summary += `Sentence Structure: ${features.sentence_structure || 'not specified'}\n`;
      summary += `Punctuation Style: ${features.punctuation_style || 'not specified'}\n`;
      summary += `Response Length: ${features.response_length || 'not specified'}\n`;
    }

    // Add behavioral insights
    if (conversationAnalysis.behavioral_insights) {
      summary += `\nBEHAVIORAL INSIGHTS:\n`;
      const insights = conversationAnalysis.behavioral_insights;
      if (insights.personality_shown?.length > 0) {
        summary += `Personality Traits: ${insights.personality_shown.join(', ')}\n`;
      }
      if (insights.conversation_flow) {
        summary += `Conversation Flow: ${insights.conversation_flow}\n`;
      }
      if (insights.unique_quirks?.length > 0) {
        summary += `Unique Quirks: ${insights.unique_quirks.join(', ')}\n`;
      }
    }

    return summary;
  }

  private static async generateImprovedPrompts(
    currentSystemPrompt: string,
    trainingInstructions: string,
    extractedContent: string,
    conversationAnalysis: any,
    userId: string
  ): Promise<any> {
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Build detailed analysis summary with examples
    const analysisWithExamples = this.buildAnalysisSummary(conversationAnalysis, extractedContent);

    const prompt = `You are an expert AI prompt engineer specializing in INTELLIGENT prompt refinement and behavioral improvement.

CURRENT AVATAR SYSTEM PROMPT:
${currentSystemPrompt || 'You are a helpful AI assistant. Respond in a friendly and helpful manner.'}

USER'S TRAINING REQUEST:
${trainingInstructions || 'Learn from the conversation examples provided and adopt the communication style demonstrated.'}

${analysisWithExamples}

INTELLIGENT PROMPT REFINEMENT TASK:

You must analyze the user's training request and decide what type of changes are needed:

1. **STRUCTURAL CHANGES** (User wants to modify the avatar's core identity):
   - Backstory changes (e.g., "change the background story to...", "make the avatar a...")
   - Personality changes (e.g., "make them more outgoing", "change personality to...")
   - Demographic changes (e.g., "make them younger", "change origin to...")
   - Identity changes (e.g., "change the name", "make them a different character")
   → For these: REWRITE the affected sections completely while preserving unrelated parts

2. **BEHAVIORAL CHANGES** (User wants to improve conversation style):
   - Conversation style from examples (e.g., "learn from these conversations")
   - Tone/manner adjustments (e.g., "be more casual", "use more emojis")
   - Response patterns (e.g., "answer questions like this")
   → For these: ADD training sections with few-shot examples and style rules

3. **MIXED CHANGES** (Combination of both):
   - Analyze which parts need rewriting vs which need additions
   - Apply appropriate strategy to each section

DECISION PROCESS:
1. Read the user's training instructions carefully
2. Determine if they want to:
   - **REPLACE** content (backstory, personality, identity) → Rewrite those sections
   - **ENHANCE** behavior (conversation style) → Add training sections
   - **BOTH** → Do both strategically

3. Check conversation examples:
   - If examples show a DIFFERENT character/personality than current → Suggest REPLACE
   - If examples show SAME character with better style → Suggest ENHANCE

OUTPUT REQUIREMENTS:

Based on your analysis, create an improved prompt that either:
- **REWRITES** affected sections if user wants structural changes
- **ADDS** training sections if user wants behavioral enhancements
- **DOES BOTH** if the request is mixed

For behavioral training additions, use this format:

═══════════════════════════════════════════════════════
🎯 TRAINING: [Brief Description] - ${new Date().toLocaleDateString()} 🎯
═══════════════════════════════════════════════════════

[Numbered rules and guidelines]

Few-shot examples:
User: "[example]"
You: "[desired response]"
(Demonstrates: [what this teaches])

═══════════════════════════════════════════════════════

CRITICAL RULES:
1. **ANALYZE USER INTENT FIRST** - Don't just append, understand what they want
2. **STRUCTURAL CHANGES** - Rewrite backstory/personality/identity sections completely if requested
3. **BEHAVIORAL TRAINING** - Add few-shot examples and style rules
4. **PRESERVE WHAT'S NOT MENTIONED** - Keep unrelated parts unchanged
5. **BE INTELLIGENT** - If user says "change backstory to X", actually change it, don't just add a note
6. **CONFLICT RESOLUTION** - If new training contradicts old, the new one WINS
7. **FORMATTING** - Maintain proper line breaks (\\n) and spacing for readability

Return ONLY valid JSON:
{
  "system_prompt": "The refined/improved system prompt based on intelligent analysis of user's request",
  "change_type": "structural | behavioral | mixed",
  "changes_summary": {
    "intent_detected": "what the user wanted to achieve",
    "sections_rewritten": ["backstory", "personality", etc. - if REPLACED"],
    "sections_added": ["training rules", "few-shot examples", etc. - if ADDED"],
    "sections_preserved": ["what was kept unchanged"],
    "reasoning": "why you made these specific changes"
  },
  "few_shot_examples": [
    {
      "user": "example user message from training",
      "assistant": "example response showing desired style",
      "demonstrates": "what pattern this teaches"
    }
  ],
  "behavior_rules": [
    "Only NEW or UPDATED rules from this training session"
  ],
  "response_style": {
    "formality": "exact level observed",
    "vocabulary": ["NEW specific words to use"],
    "signature_phrases": ["NEW exact phrases to incorporate"],
    "emoji_usage": "specific pattern observed",
    "response_length": "typical length in words",
    "sentence_structure": "observed pattern with example"
  },
  "improvement_notes": "What was changed and why"
}

EXAMPLE 1 - STRUCTURAL CHANGE (User wants new backstory):
User Request: "Change the backstory - make them a software engineer from Silicon Valley"
Output: Rewrite the backstory section completely, keep personality/other sections if not mentioned

EXAMPLE 2 - BEHAVIORAL CHANGE (User provides conversation examples):
User Request: "Learn from these conversations" + examples
Output: Keep all existing content, ADD training section at end with few-shot examples

EXAMPLE 3 - MIXED (User wants both):
User Request: "Make them more outgoing and change their job to teacher"
Output: REWRITE personality to be outgoing, REWRITE job/backstory, ADD training for behavioral changes`;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI prompt engineer specializing in intelligent prompt refinement. You can detect user intent to either REWRITE core sections (backstory, personality, identity) or ENHANCE behavior (conversation style). You analyze what the user wants and apply the appropriate strategy - not just blindly appending content. Always maintain proper formatting with line breaks (\\n) for readability.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 12000,
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Prompt generation API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || '{}';

    try {
      // Remove markdown code blocks if present
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Try to parse as JSON first
      const parsed = JSON.parse(cleanedText);

      // Return the parsed result in the expected format
      return {
        system_prompt: parsed.system_prompt || parsed.enhanced_system_prompt || currentSystemPrompt,
        change_type: parsed.change_type || 'behavioral',
        personality_traits: [],
        behavior_rules: parsed.behavior_rules || [],
        response_style: parsed.response_style || {},
        few_shot_examples: parsed.few_shot_examples || [],
        changes_summary: parsed.changes_summary || {},
        improvement_notes: parsed.improvement_notes || parsed.changes_summary?.reasoning || 'Prompt refinement applied'
      };
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);

      // If JSON parsing fails, try to extract JSON from the text
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);

          // Return in expected format
          return {
            system_prompt: parsed.system_prompt || parsed.enhanced_system_prompt || currentSystemPrompt,
            change_type: parsed.change_type || 'behavioral',
            personality_traits: [],
            behavior_rules: parsed.behavior_rules || [],
            response_style: parsed.response_style || {},
            few_shot_examples: parsed.few_shot_examples || [],
            changes_summary: parsed.changes_summary || {},
            improvement_notes: parsed.improvement_notes || parsed.changes_summary?.reasoning || 'Prompt refinement applied'
          };
        } catch {
          // Still failed, fall back to extracting system prompt from the text
          console.error('Failed to parse extracted JSON');
        }
      }

      // Last resort: use the generated text as the system prompt
      console.warn('Using raw generated text as system prompt');
      let extractedPrompt = generatedText
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .replace(/^As no conversation examples.*?Here is the enhanced prompt:\s*/i, '')
        .replace(/The improvements aim to.*$/s, '')
        .trim();

      return {
        system_prompt: extractedPrompt,
        improvement_notes: 'Generated prompt (JSON parsing failed, used raw output)',
        personality_traits: [],
        behavior_rules: [],
        response_style: {},
        few_shot_examples: []
      };
    }
  }

  // Delete a prompt version and its associated data
  static async deletePromptVersion(versionId: string, userId: string): Promise<void> {
    try {
      console.log(`Attempting to delete version ${versionId} for user ${userId}`);

      // First check if this is the active version
      const { data: activeCheck, error: activeError } = await supabase
        .from('avatar_prompt_versions')
        .select('is_active, avatar_id, version_number')
        .eq('id', versionId)
        .eq('user_id', userId)
        .single();

      if (activeError) {
        console.error('Error checking active status:', activeError);
        throw new Error(`Failed to verify version status: ${activeError.message}`);
      }

      if (!activeCheck) {
        throw new Error('Version not found or you do not have permission to delete it.');
      }

      if (activeCheck?.is_active) {
        throw new Error(`Cannot delete the active version (${activeCheck.version_number}). Please activate a different version first.`);
      }

      // Check if this version has child versions (descendants)
      const { data: children, error: childError } = await supabase
        .from('avatar_prompt_versions')
        .select('id, version_number')
        .eq('parent_version_id', versionId)
        .eq('user_id', userId);

      if (childError) {
        console.error('Error checking child versions:', childError);
        throw new Error(`Failed to check dependent versions: ${childError.message}`);
      }

      if (children && children.length > 0) {
        const childVersions = children.map(c => c.version_number).join(', ');
        throw new Error(`Cannot delete this version as it has dependent child versions: ${childVersions}. Please delete child versions first.`);
      }

      console.log('Proceeding with deletion...');

      // First, let's verify the record exists and we can see it
      const { data: verifyRecord, error: verifyError } = await supabase
        .from('avatar_prompt_versions')
        .select('id, version_number, user_id')
        .eq('id', versionId)
        .eq('user_id', userId)
        .single();

      if (verifyError || !verifyRecord) {
        console.error('Cannot find record to delete:', verifyError);
        throw new Error('Version not found or access denied');
      }

      console.log('Record found for deletion:', verifyRecord);

      // Delete the prompt version (this will cascade to related training data due to FK constraints)
      const { error, count } = await supabase
        .from('avatar_prompt_versions')
        .delete({ count: 'exact' })
        .eq('id', versionId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting prompt version:', error);
        throw new Error(`Failed to delete version: ${error.message}`);
      }

      console.log(`Deletion result: ${count} rows affected`);

      if (count === 0) {
        throw new Error('No rows were deleted. This may be due to RLS policies or the record may not exist.');
      }

      console.log('Successfully deleted prompt version:', versionId);
    } catch (error) {
      console.error('Error in deletePromptVersion:', error);
      throw error;
    }
  }

  // Get avatar's current system prompt (generated from full profile or stored)
  static async getAvatarSystemPrompt(avatarId: string, userId: string): Promise<string> {
    try {
      const { data: avatar, error } = await supabase
        .from('avatars')
        .select(`
          system_prompt,
          name,
          description,
          age,
          gender,
          origin_country,
          primary_language,
          secondary_languages,
          mbti_type,
          personality_traits,
          backstory,
          hidden_rules,
          favorites,
          lifestyle,
          voice_description
        `)
        .eq('id', avatarId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching avatar data:', error);
        throw new Error(`Failed to fetch avatar data: ${error.message}`);
      }

      // If avatar has a custom system_prompt, use it
      if (avatar?.system_prompt && avatar.system_prompt.trim() !== '') {
        return avatar.system_prompt;
      }

      // Otherwise, generate comprehensive prompt from avatar profile
      return this.generateBaseSystemPrompt(avatar);
    } catch (error) {
      console.error('Error in getAvatarSystemPrompt:', error);
      throw error;
    }
  }

  // Generate base system prompt from avatar profile
  static generateBaseSystemPrompt(avatar: any): string {
    const prompt = [];

    // Core Identity
    prompt.push(`You are ${avatar.name || 'an AI assistant'}.`);

    if (avatar.description) {
      prompt.push(avatar.description);
    }

    // Demographics & Background
    const demographics = [];
    if (avatar.age) demographics.push(`${avatar.age} years old`);
    if (avatar.gender) demographics.push(avatar.gender);
    if (avatar.origin_country) demographics.push(`from ${avatar.origin_country}`);

    if (demographics.length > 0) {
      prompt.push(`You are ${demographics.join(', ')}.`);
    }

    // Languages
    if (avatar.primary_language) {
      prompt.push(`Your primary language is ${avatar.primary_language}.`);
      if (avatar.secondary_languages && avatar.secondary_languages.length > 0) {
        prompt.push(`You also speak: ${avatar.secondary_languages.join(', ')}.`);
      }
    }

    // Personality & MBTI
    if (avatar.mbti_type) {
      prompt.push(`Your MBTI personality type is ${avatar.mbti_type}.`);
    }

    if (avatar.personality_traits && avatar.personality_traits.length > 0) {
      prompt.push(`Your key personality traits include: ${avatar.personality_traits.join(', ')}.`);
    }

    // Backstory
    if (avatar.backstory) {
      prompt.push(`Background: ${avatar.backstory}`);
    }

    // Favorites & Lifestyle
    if (avatar.favorites && avatar.favorites.length > 0) {
      prompt.push(`Things you enjoy: ${avatar.favorites.join(', ')}.`);
    }

    if (avatar.lifestyle && avatar.lifestyle.length > 0) {
      prompt.push(`Your lifestyle: ${avatar.lifestyle.join(', ')}.`);
    }

    // Voice & Communication Style
    if (avatar.voice_description) {
      prompt.push(`Communication style: ${avatar.voice_description}`);
    }

    // Hidden Rules (Important behavioral guidelines)
    if (avatar.hidden_rules) {
      prompt.push(`Important guidelines: ${avatar.hidden_rules}`);
    }

    // Default behavior
    prompt.push(`Always respond in character, maintaining your personality and background throughout the conversation.`);

    return prompt.join(' ');
  }
}