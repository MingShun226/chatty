import { supabase } from '@/integrations/supabase/client';

export interface ImageUploadResult {
  url: string;
  path: string;
}

export class ImageUploadService {
  private static readonly BUCKET_NAME = 'product-images';
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Upload a single product image to Supabase Storage
   */
  static async uploadProductImage(
    file: File,
    chatbotId: string,
    productSku: string
  ): Promise<ImageUploadResult> {
    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error('Image size must be less than 5MB');
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const sanitizedSku = productSku.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${chatbotId}/${sanitizedSku}_${timestamp}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  }

  /**
   * Upload multiple product images
   */
  static async uploadProductImages(
    files: File[],
    chatbotId: string,
    productSku: string
  ): Promise<ImageUploadResult[]> {
    const uploadPromises = files.map((file) =>
      this.uploadProductImage(file, chatbotId, productSku)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Delete a product image from storage
   */
  static async deleteProductImage(imagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .remove([imagePath]);

    if (error) {
      console.error('Error deleting image:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Delete multiple product images
   */
  static async deleteProductImages(imagePaths: string[]): Promise<void> {
    const { error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .remove(imagePaths);

    if (error) {
      console.error('Error deleting images:', error);
      throw new Error(`Failed to delete images: ${error.message}`);
    }
  }

  /**
   * Extract storage path from public URL
   */
  static extractPathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/product-images\/(.+)$/);
      return pathMatch ? pathMatch[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Download image from URL and convert to File
   */
  static async downloadImageFromUrl(url: string, filename: string = 'image.jpg'): Promise<File> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // Validate it's an image
      if (!blob.type.startsWith('image/')) {
        throw new Error('Downloaded file is not an image');
      }

      // Create File from blob
      return new File([blob], filename, { type: blob.type });
    } catch (error: any) {
      // Don't log full error trace - just throw the error
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * Compress and resize image before upload
   */
  static async compressImage(file: File, maxWidth: number = 1200): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            file.type,
            0.8 // 80% quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  }
}
