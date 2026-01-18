import { supabase } from '@/integrations/supabase/client';

export interface DocumentChunk {
  id: string;
  knowledge_file_id: string;
  chunk_text: string;
  chunk_index: number;
  page_number?: number;
  section_title?: string;
  similarity?: number;
}

export interface SearchResult {
  chunks: DocumentChunk[];
  totalFound: number;
  searchTime: number;
}

export class RAGService {

  // Calculate cosine similarity between two vectors
  static calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // Chunk text into smaller pieces for better retrieval
  static chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.trim().length;

      if (currentSize + sentenceLength > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        // Create overlap by keeping last part of current chunk
        const words = currentChunk.split(' ');
        const overlapWords = Math.min(overlap / 5, words.length); // Approximate word count for overlap
        currentChunk = words.slice(-overlapWords).join(' ') + ' ';
        currentSize = currentChunk.length;
      }

      currentChunk += sentence.trim() + '. ';
      currentSize += sentenceLength + 2;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
  }

  // Generate embeddings using edge function (API key handled server-side)
  static async generateEmbedding(text: string, userId: string): Promise<number[]> {
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          text: text.slice(0, 8000),
          model: 'text-embedding-ada-002'
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  // Process and store document chunks with embeddings
  static async processDocument(
    userId: string,
    avatarId: string,
    knowledgeFileId: string,
    documentText: string,
    fileName: string
  ): Promise<void> {
    try {
      // Clean up existing chunks for this file
      await supabase
        .from('document_chunks')
        .delete()
        .eq('knowledge_file_id', knowledgeFileId);

      // Chunk the document
      const chunks = this.chunkText(documentText);

      console.log(`Processing ${chunks.length} chunks for ${fileName}`);

      // Process chunks in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        const chunkPromises = batch.map(async (chunkText, batchIndex) => {
          const chunkIndex = i + batchIndex;

          try {
            // Generate embedding
            const embedding = await this.generateEmbedding(chunkText, userId);

            // Store chunk with embedding
            const { error } = await supabase
              .from('document_chunks')
              .insert({
                knowledge_file_id: knowledgeFileId,
                user_id: userId,
                avatar_id: avatarId,
                chunk_text: chunkText,
                chunk_index: chunkIndex,
                chunk_size: chunkText.length,
                embedding: embedding,
                chunk_type: 'content'
              });

            if (error) {
              console.error(`Error storing chunk ${chunkIndex}:`, error);
              throw error;
            }

            console.log(`Processed chunk ${chunkIndex + 1}/${chunks.length}`);

          } catch (error) {
            console.error(`Error processing chunk ${chunkIndex}:`, error);
            throw error;
          }
        });

        await Promise.all(chunkPromises);

        // Small delay between batches to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update the knowledge file status
      const { error: updateError } = await supabase
        .from('avatar_knowledge_files')
        .update({
          processing_status: 'processed',
          extracted_text: documentText.slice(0, 5000) // Store preview
        })
        .eq('id', knowledgeFileId);

      if (updateError) {
        console.error('Error updating file status to processed:', updateError);
        // Still throw error so processing status shows as error
        throw new Error(`Failed to update file status: ${updateError.message}`);
      }

      console.log(`Successfully processed ${chunks.length} chunks for ${fileName}`);

    } catch (error) {
      console.error('Error processing document:', error);

      // Update file status to error
      const { error: errorUpdateError } = await supabase
        .from('avatar_knowledge_files')
        .update({ processing_status: 'error' })
        .eq('id', knowledgeFileId);

      if (errorUpdateError) {
        console.error('Could not update file status to error:', errorUpdateError);
      }

      throw error;
    }
  }

  // Search for relevant chunks using semantic similarity
  static async searchRelevantChunks(
    query: string,
    userId: string,
    avatarId: string,
    limit: number = 5,
    similarityThreshold: number = 0.7
  ): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query, userId);

      // First, get linked knowledge files
      const { data: linkedFiles, error: linkedError } = await supabase
        .from('avatar_knowledge_files')
        .select('id')
        .eq('user_id', userId)
        .eq('avatar_id', avatarId)
        .eq('is_linked', true)
        .eq('processing_status', 'processed');

      if (linkedError) {
        console.error('Error getting linked files:', linkedError);
        throw linkedError;
      }

      if (!linkedFiles || linkedFiles.length === 0) {
        // No linked files, return empty result
        return {
          chunks: [],
          totalFound: 0,
          searchTime: Date.now() - startTime
        };
      }

      const linkedFileIds = linkedFiles.map(f => f.id);

      // Search for similar chunks only from linked files
      const { data: chunks, error } = await supabase
        .from('document_chunks')
        .select(`
          id,
          knowledge_file_id,
          chunk_text,
          chunk_index,
          page_number,
          section_title,
          embedding
        `)
        .in('knowledge_file_id', linkedFileIds)
        .eq('user_id', userId)
        .eq('avatar_id', avatarId)
        .limit(limit * 3); // Get more chunks for similarity calculation

      if (error) {
        console.error('Error searching chunks:', error);
        throw error;
      }

      // Calculate similarity scores manually
      const chunksWithSimilarity = chunks?.map(chunk => {
        // Parse embedding if it's stored as a string
        let chunkEmbedding = chunk.embedding;
        if (typeof chunkEmbedding === 'string') {
          try {
            chunkEmbedding = JSON.parse(chunkEmbedding);
          } catch (error) {
            console.error('Failed to parse chunk embedding:', error);
            return null;
          }
        }

        // Skip chunks with invalid embeddings
        if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
          console.warn('Invalid chunk embedding, skipping chunk:', chunk.id);
          return null;
        }

        const similarity = this.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
        return {
          ...chunk,
          similarity
        };
      }).filter(chunk => chunk !== null && chunk.similarity >= similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit) || [];

      const searchTime = Date.now() - startTime;

      // Log the search for analytics
      await supabase
        .from('rag_search_logs')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          query_text: query,
          query_embedding: queryEmbedding,
          chunks_found: chunksWithSimilarity.length,
          top_similarity_score: chunksWithSimilarity[0]?.similarity || 0
        });

      return {
        chunks: chunksWithSimilarity,
        totalFound: chunksWithSimilarity.length,
        searchTime
      };

    } catch (error) {
      console.error('Error in semantic search:', error);
      return {
        chunks: [],
        totalFound: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  // Get formatted context for AI prompt
  static formatRetrievedContext(chunks: DocumentChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }

    let context = '\n\n=== RELEVANT KNOWLEDGE BASE CONTENT ===\n';
    context += 'Based on your query, here are the most relevant sections from your knowledge base:\n\n';

    chunks.forEach((chunk, index) => {
      context += `--- Relevant Section ${index + 1} (Similarity: ${(chunk.similarity! * 100).toFixed(1)}%) ---\n`;
      if (chunk.section_title) {
        context += `Section: ${chunk.section_title}\n`;
      }
      if (chunk.page_number) {
        context += `Page: ${chunk.page_number}\n`;
      }
      context += `${chunk.chunk_text}\n\n`;
    });

    context += '=== END RELEVANT CONTENT ===\n\n';
    context += 'Please use this information to provide accurate, detailed responses. When referencing this content, you can mention that you\'re drawing from your knowledge base.';

    return context;
  }

  // Check if document has been processed for RAG
  static async isDocumentProcessed(knowledgeFileId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('knowledge_file_id', knowledgeFileId)
      .limit(1);

    return !error && data && data.length > 0;
  }

  // Get RAG statistics for an avatar
  static async getRAGStats(userId: string, avatarId: string) {
    const { data: chunksData } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('user_id', userId)
      .eq('avatar_id', avatarId);

    const { data: searchesData } = await supabase
      .from('rag_search_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('avatar_id', avatarId);

    return {
      totalChunks: chunksData?.length || 0,
      totalSearches: searchesData?.length || 0
    };
  }
}