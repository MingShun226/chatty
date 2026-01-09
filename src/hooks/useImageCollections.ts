import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ImageCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  image_count?: number;
  images?: CollectionImage[];
}

export interface CollectionImage {
  id: string;
  image_url: string;
  prompt: string;
  created_at: string;
  platform?: string;
  style_id?: string;
}

export const COLLECTIONS_KEY = ['image-collections'];

/**
 * Hook to fetch all user's image collections with their images
 */
export function useImageCollections() {
  const { user } = useAuth();

  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: async (): Promise<ImageCollection[]> => {
      if (!user?.id) return [];

      // First fetch all collections
      const { data: collections, error: collectionsError } = await supabase
        .from('image_collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (collectionsError) {
        console.error('Failed to fetch collections:', collectionsError);
        throw collectionsError;
      }

      if (!collections || collections.length === 0) {
        return [];
      }

      // Fetch images directly from generated_images using collection_id
      // This is more reliable than the junction table approach
      const collectionIds = collections.map(c => c.id);
      const { data: images, error: imagesError } = await supabase
        .from('generated_images')
        .select('id, image_url, prompt, created_at, platform, style_id, collection_id')
        .eq('user_id', user.id) // Important: filter by user for RLS
        .in('collection_id', collectionIds)
        .order('created_at', { ascending: false });

      if (imagesError) {
        console.error('Failed to fetch collection images:', imagesError);
        // Don't throw - return collections without images
      }

      // Debug logging
      console.log('[useImageCollections] Collections found:', collections.length);
      console.log('[useImageCollections] Images found with collection_id:', images?.length || 0);
      if (images && images.length > 0) {
        console.log('[useImageCollections] Sample image:', images[0]);
      }

      // Group images by collection_id
      const imagesByCollection: Record<string, CollectionImage[]> = {};
      (images || []).forEach((img: any) => {
        if (!imagesByCollection[img.collection_id]) {
          imagesByCollection[img.collection_id] = [];
        }
        imagesByCollection[img.collection_id].push({
          id: img.id,
          image_url: img.image_url,
          prompt: img.prompt,
          created_at: img.created_at,
          platform: img.platform,
          style_id: img.style_id,
        });
      });

      // Return collections with their images
      return collections.map((collection: any) => ({
        ...collection,
        images: imagesByCollection[collection.id] || [],
        image_count: imagesByCollection[collection.id]?.length || 0,
      }));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to delete a collection
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (collectionId: string) => {
      const { error } = await supabase
        .from('image_collections')
        .delete()
        .eq('id', collectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    },
  });
}

/**
 * Hook to refresh collections
 */
export function useRefreshCollections() {
  const queryClient = useQueryClient();

  return {
    refresh: () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  };
}
