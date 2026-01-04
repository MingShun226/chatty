import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id?: string;
  chatbot_id: string;
  user_id?: string;
  sku: string;
  product_name: string;
  description: string | null;
  price: number;
  currency: string;
  category: string | null;
  stock_quantity: number | null;
  in_stock: boolean;
  images: string[] | null;
  tags: string[] | null;
  additional_info: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductUpload {
  id?: string;
  chatbot_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  total_rows: number | null;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_log: any[] | null;
  error_summary: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export class ProductService {
  /**
   * Get all products for a chatbot
   */
  static async getProducts(chatbotId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single product by ID
   */
  static async getProduct(productId: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }

    return data;
  }

  /**
   * Create a new product
   */
  static async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Product> {
    const { data, error } = await supabase
      .from('chatbot_products')
      .insert({
        chatbot_id: product.chatbot_id,
        user_id: userId,
        sku: product.sku,
        product_name: product.product_name,
        description: product.description,
        price: product.price,
        currency: product.currency || 'MYR',
        category: product.category,
        stock_quantity: product.stock_quantity,
        in_stock: product.in_stock,
        images: product.images,
        tags: product.tags,
        additional_info: product.additional_info || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      throw new Error(`Failed to create product: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a product
   */
  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('chatbot_products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw new Error(`Failed to update product: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a product
   */
  static async deleteProduct(productId: string): Promise<void> {
    const { error } = await supabase
      .from('chatbot_products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Error deleting product:', error);
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  /**
   * Bulk import products
   */
  static async bulkImportProducts(
    chatbotId: string,
    userId: string,
    products: Omit<Product, 'id' | 'chatbot_id' | 'user_id' | 'created_at' | 'updated_at'>[]
  ): Promise<{ successful: number; failed: number; errors: any[] }> {
    const errors: any[] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const productsToInsert = batch.map(p => ({
        chatbot_id: chatbotId,
        user_id: userId,
        sku: p.sku,
        product_name: p.product_name,
        description: p.description,
        price: p.price,
        currency: p.currency || 'MYR',
        category: p.category,
        stock_quantity: p.stock_quantity,
        in_stock: p.in_stock,
        images: p.images,
        tags: p.tags,
        additional_info: p.additional_info || {},
      }));

      const { data, error } = await supabase
        .from('chatbot_products')
        .insert(productsToInsert)
        .select();

      if (error) {
        console.error('Batch insert error:', error);
        failed += batch.length;
        errors.push({
          batch: i / batchSize + 1,
          error: error.message,
          products: batch.map(p => p.sku),
        });
      } else {
        successful += data?.length || 0;
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Search products by name or SKU
   */
  static async searchProducts(chatbotId: string, query: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .or(`product_name.ilike.%${query}%,sku.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching products:', error);
      throw new Error(`Failed to search products: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get products by category
   */
  static async getProductsByCategory(chatbotId: string, category: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('chatbot_products')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products by category:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all unique categories for a chatbot
   */
  static async getCategories(chatbotId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('chatbot_products')
      .select('category')
      .eq('chatbot_id', chatbotId)
      .not('category', 'is', null);

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    const categories = [...new Set(data.map(item => item.category).filter(Boolean))];
    return categories as string[];
  }

  /**
   * Track product upload job
   */
  static async trackUpload(upload: Omit<ProductUpload, 'id' | 'created_at'>): Promise<ProductUpload> {
    const { data, error } = await supabase
      .from('chatbot_product_uploads')
      .insert(upload)
      .select()
      .single();

    if (error) {
      console.error('Error tracking upload:', error);
      throw new Error(`Failed to track upload: ${error.message}`);
    }

    return data;
  }

  /**
   * Update upload status
   */
  static async updateUploadStatus(
    uploadId: string,
    updates: Partial<ProductUpload>
  ): Promise<void> {
    const { error } = await supabase
      .from('chatbot_product_uploads')
      .update(updates)
      .eq('id', uploadId);

    if (error) {
      console.error('Error updating upload status:', error);
      throw new Error(`Failed to update upload status: ${error.message}`);
    }
  }
}
