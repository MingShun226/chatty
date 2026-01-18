import { supabase } from '@/integrations/supabase/client';

export interface MemoryImage {
  id?: string;
  memory_id: string;
  user_id: string;
  image_url: string;
  image_path: string;
  thumbnail_url?: string;
  image_order: number;
  is_primary: boolean;
  caption?: string;
  image_description?: string;
  extracted_details?: any;
  created_at?: string;
  updated_at?: string;
}

export interface AvatarMemory {
  id?: string;
  avatar_id: string;
  user_id: string;
  title: string;
  memory_date: string; // ISO date string
  image_url: string; // Kept for backward compatibility (primary image)
  image_path: string; // Kept for backward compatibility
  thumbnail_url?: string;
  memory_description: string;
  location?: string;
  people_present?: string[];
  activities?: string[];
  food_items?: string[];
  objects_visible?: string[];
  mood?: string;
  tags?: string[];
  memory_summary: string;
  conversational_hooks?: string[];
  is_favorite?: boolean;
  is_private?: boolean;
  images?: MemoryImage[]; // Multiple images support
  created_at?: string;
  updated_at?: string;
}

export interface MemoryCategory {
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  created_at?: string;
}

export class MemoryService {

  // =============================================
  // MEMORY ANALYSIS (GPT-4 Vision)
  // =============================================

  static async analyzeMemoryPhotoFromUrl(
    imageUrl: string,
    userId: string,
    context?: string
  ): Promise<{
    description: string;
    location?: string;
    people?: string[];
    activities?: string[];
    food_items?: string[];
    objects?: string[];
    mood?: string;
    summary: string;
    conversational_hooks?: string[];
    suggested_title?: string;
  }> {
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const contextPrompt = context ? `\n\nUser context: ${context}` : '';

    const analysisPrompt = `Analyze this memory photo in detail. Extract all relevant information that would help an AI avatar naturally remember and talk about this experience.${contextPrompt}

Return a JSON object with:
{
  "description": "Detailed 2-3 sentence description of what's in the photo",
  "location": "Specific place/restaurant/location if visible or implied",
  "people": ["list of people if visible - use descriptions like 'friend', 'family member' if names unknown"],
  "activities": ["what activities/actions are happening"],
  "food_items": ["specific foods/drinks visible if dining photo"],
  "objects": ["notable objects/items visible"],
  "mood": "overall mood/atmosphere (happy, relaxed, celebratory, etc)",
  "summary": "One sentence summary for quick reference",
  "conversational_hooks": ["3-5 natural phrases the avatar could use to bring up this memory"],
  "suggested_title": "Short catchy title for this memory"
}

Make conversational_hooks sound natural, like:
- "Remember when I went to that Italian place last week?"
- "Oh that reminds me of the birthday dinner!"
- "I tried the most amazing tiramisu recently..."`;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          prompt: analysisPrompt,
          context: context,
          model: 'gpt-4o',
          detail: 'high'
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Memory analysis failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.analysis;
  }

  // =============================================
  // MEMORY STORAGE
  // =============================================

  static async uploadMemoryPhoto(
    file: File,
    userId: string,
    avatarId: string
  ): Promise<{ path: string; url: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${avatarId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('avatar-memories')
      .upload(fileName, file);

    if (error) {
      throw new Error(`Failed to upload memory photo: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatar-memories')
      .getPublicUrl(data.path);

    return {
      path: data.path,
      url: urlData.publicUrl
    };
  }

  static async createMemory(memory: Omit<AvatarMemory, 'id' | 'created_at' | 'updated_at'>): Promise<AvatarMemory> {
    const { data, error } = await supabase
      .from('avatar_memories')
      .insert(memory)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create memory: ${error.message}`);
    }

    return data;
  }

  static async getAvatarMemories(avatarId: string, userId: string): Promise<AvatarMemory[]> {
    const { data, error } = await supabase
      .from('avatar_memories')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .order('memory_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get memories: ${error.message}`);
    }

    return data || [];
  }

  static async getRecentMemories(avatarId: string, userId: string, limit: number = 10): Promise<AvatarMemory[]> {
    const { data, error } = await supabase
      .from('avatar_memories')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('user_id', userId)
      .eq('is_private', false)
      .order('memory_date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent memories: ${error.message}`);
    }

    // Fetch images for each memory
    const memories = data || [];
    for (const memory of memories) {
      const images = await this.getMemoryImages(memory.id!, userId);
      memory.images = images;
    }

    return memories;
  }

  static async updateMemory(memoryId: string, updates: Partial<AvatarMemory>): Promise<void> {
    const { error } = await supabase
      .from('avatar_memories')
      .update(updates)
      .eq('id', memoryId);

    if (error) {
      throw new Error(`Failed to update memory: ${error.message}`);
    }
  }

  static async deleteMemory(memoryId: string, userId: string): Promise<void> {
    // Get memory to find image path
    const { data: memory, error: fetchError } = await supabase
      .from('avatar_memories')
      .select('image_path')
      .eq('id', memoryId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch memory: ${fetchError.message}`);
    }

    // Delete image from storage
    if (memory?.image_path) {
      await supabase.storage
        .from('avatar-memories')
        .remove([memory.image_path]);
    }

    // Delete memory record
    const { error } = await supabase
      .from('avatar_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete memory: ${error.message}`);
    }
  }

  // =============================================
  // MEMORY CATEGORIES
  // =============================================

  static async getCategories(userId: string): Promise<MemoryCategory[]> {
    const { data, error } = await supabase
      .from('memory_categories')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }

    return data || [];
  }

  static async addMemoryToCategory(memoryId: string, categoryId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('memory_category_mappings')
      .insert({
        memory_id: memoryId,
        category_id: categoryId,
        user_id: userId
      });

    if (error && error.code !== '23505') { // Ignore duplicate key error
      throw new Error(`Failed to add memory to category: ${error.message}`);
    }
  }

  // =============================================
  // MEMORY CONTEXT GENERATION FOR AVATAR
  // =============================================

  static buildMemoryContext(memories: AvatarMemory[]): string {
    if (memories.length === 0) {
      return '';
    }

    let context = `\n\n═══════════════════════════════════════════════════════
🧠 YOUR MEMORIES - Reference these naturally in conversation
═══════════════════════════════════════════════════════\n\n`;

    context += `You have ${memories.length} recent memories. Bring them up naturally when relevant:\n\n`;

    memories.forEach((memory, idx) => {
      const date = new Date(memory.memory_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      context += `Memory ${idx + 1} (${date}): ${memory.title}\n`;
      context += `Summary: ${memory.memory_summary}\n`;

      if (memory.location) {
        context += `Location: ${memory.location}\n`;
      }

      if (memory.food_items && memory.food_items.length > 0) {
        context += `Food/Drinks: ${memory.food_items.join(', ')}\n`;
      }

      if (memory.activities && memory.activities.length > 0) {
        context += `Activities: ${memory.activities.join(', ')}\n`;
      }

      if (memory.mood) {
        context += `Mood: ${memory.mood}\n`;
      }

      if (memory.conversational_hooks && memory.conversational_hooks.length > 0) {
        context += `How to reference: ${memory.conversational_hooks[0]}\n`;
      }

      context += `\n`;
    });

    context += `═══════════════════════════════════════════════════════\n\n`;
    context += `IMPORTANT: Reference these memories naturally when the conversation is relevant. `;
    context += `Don't force them, but do bring them up when they fit the context.\n`;

    return context;
  }

  // =============================================
  // MEMORY IMAGES MANAGEMENT
  // =============================================

  static async addImageToMemory(
    memoryId: string,
    userId: string,
    file: File,
    imageOrder: number,
    isPrimary: boolean = false,
    caption?: string
  ): Promise<MemoryImage> {
    // Get memory to find avatar_id
    const { data: memory, error: memError } = await supabase
      .from('avatar_memories')
      .select('avatar_id')
      .eq('id', memoryId)
      .eq('user_id', userId)
      .single();

    if (memError || !memory) {
      throw new Error('Memory not found');
    }

    // Upload image
    const { path, url } = await this.uploadMemoryPhoto(file, userId, memory.avatar_id);

    // Create memory image record
    const { data, error } = await supabase
      .from('memory_images')
      .insert({
        memory_id: memoryId,
        user_id: userId,
        image_url: url,
        image_path: path,
        image_order: imageOrder,
        is_primary: isPrimary,
        caption: caption
      })
      .select()
      .single();

    if (error) {
      // Clean up uploaded file on error
      await supabase.storage.from('avatar-memories').remove([path]);
      throw new Error(`Failed to add image: ${error.message}`);
    }

    return data;
  }

  static async getMemoryImages(memoryId: string, userId: string): Promise<MemoryImage[]> {
    const { data, error } = await supabase
      .from('memory_images')
      .select('*')
      .eq('memory_id', memoryId)
      .eq('user_id', userId)
      .order('image_order')
      .order('created_at');

    if (error) {
      throw new Error(`Failed to get memory images: ${error.message}`);
    }

    return data || [];
  }

  static async deleteMemoryImage(imageId: string, userId: string): Promise<void> {
    // Get image to find path
    const { data: image, error: fetchError } = await supabase
      .from('memory_images')
      .select('image_path')
      .eq('id', imageId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch image: ${fetchError.message}`);
    }

    // Delete from storage
    if (image?.image_path) {
      await supabase.storage
        .from('avatar-memories')
        .remove([image.image_path]);
    }

    // Delete from database
    const { error } = await supabase
      .from('memory_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  static async setPrimaryImage(imageId: string, memoryId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('memory_images')
      .update({ is_primary: true })
      .eq('id', imageId)
      .eq('memory_id', memoryId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to set primary image: ${error.message}`);
    }
  }

  // =============================================
  // FULL WORKFLOW: UPLOAD & ANALYZE
  // =============================================

  static async createMemoryFromPhoto(
    file: File,
    userId: string,
    avatarId: string,
    title: string,
    memoryDate: string,
    context?: string
  ): Promise<AvatarMemory> {
    // 1. Upload photo to Supabase storage FIRST
    const { path, url } = await this.uploadMemoryPhoto(file, userId, avatarId);

    try {
      // 2. Analyze photo using the uploaded URL
      const analysis = await this.analyzeMemoryPhotoFromUrl(url, userId, context);

      // 3. Create memory record
      const memory = await this.createMemory({
        avatar_id: avatarId,
        user_id: userId,
        title: title || analysis.suggested_title || 'Memory',
        memory_date: memoryDate,
        image_url: url,
        image_path: path,
        memory_description: analysis.description,
        location: analysis.location,
        people_present: analysis.people,
        activities: analysis.activities,
        food_items: analysis.food_items,
        objects_visible: analysis.objects,
        mood: analysis.mood,
        memory_summary: analysis.summary,
        conversational_hooks: analysis.conversational_hooks,
        is_favorite: false,
        is_private: false
      });

      // 4. Create the first image record in memory_images table
      await supabase.from('memory_images').insert({
        memory_id: memory.id!,
        user_id: userId,
        image_url: url,
        image_path: path,
        image_order: 0,
        is_primary: true,
        image_description: analysis.description
      });

      return memory;
    } catch (error) {
      // If analysis fails, clean up uploaded image
      await supabase.storage.from('avatar-memories').remove([path]);
      throw error;
    }
  }

  // Create memory from MULTIPLE photos
  static async createMemoryFromPhotos(
    files: File[],
    userId: string,
    avatarId: string,
    title: string,
    memoryDate: string,
    context?: string
  ): Promise<AvatarMemory> {
    if (files.length === 0) {
      throw new Error('At least one photo is required');
    }

    // Upload all photos first
    const uploadedImages: Array<{ path: string; url: string; file: File }> = [];

    try {
      for (const file of files) {
        const { path, url } = await this.uploadMemoryPhoto(file, userId, avatarId);
        uploadedImages.push({ path, url, file });
      }

      // Analyze the first (primary) image
      const primaryImageUrl = uploadedImages[0].url;
      const analysis = await this.analyzeMemoryPhotoFromUrl(primaryImageUrl, userId, context);

      // Create memory record
      const memory = await this.createMemory({
        avatar_id: avatarId,
        user_id: userId,
        title: title || analysis.suggested_title || 'Memory',
        memory_date: memoryDate,
        image_url: primaryImageUrl, // Primary image
        image_path: uploadedImages[0].path,
        memory_description: analysis.description,
        location: analysis.location,
        people_present: analysis.people,
        activities: analysis.activities,
        food_items: analysis.food_items,
        objects_visible: analysis.objects,
        mood: analysis.mood,
        memory_summary: analysis.summary,
        conversational_hooks: analysis.conversational_hooks,
        is_favorite: false,
        is_private: false
      });

      // Create image records for all uploaded photos
      for (let i = 0; i < uploadedImages.length; i++) {
        const img = uploadedImages[i];
        await supabase.from('memory_images').insert({
          memory_id: memory.id!,
          user_id: userId,
          image_url: img.url,
          image_path: img.path,
          image_order: i,
          is_primary: i === 0, // First image is primary
          image_description: i === 0 ? analysis.description : null
        });
      }

      // Load images into memory object
      memory.images = await this.getMemoryImages(memory.id!, userId);

      return memory;
    } catch (error) {
      // Clean up all uploaded images on error
      for (const img of uploadedImages) {
        await supabase.storage.from('avatar-memories').remove([img.path]);
      }
      throw error;
    }
  }
}
