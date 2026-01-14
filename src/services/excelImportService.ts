import * as XLSX from 'xlsx';
import { Product, ProductService } from './productService';
import { ImageUploadService } from './imageUploadService';

export interface ParsedProduct {
  sku: string;
  product_name: string;
  description: string | null;
  price: number;
  currency: string;
  category: string | null;
  in_stock: boolean;
  images: string[] | null;
  tags: string[] | null;
  additional_info: Record<string, any> | null;
}

export interface ExcelParseResult {
  products: ParsedProduct[];
  errors: Array<{ row: number; field: string; message: string }>;
  totalRows: number;
  validRows: number;
}

export class ExcelImportService {
  /**
   * Parse Excel file and extract products
   */
  static async parseExcelFile(file: File): Promise<ExcelParseResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });

          // Get first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Parse and validate products
          const result = this.parseProducts(jsonData);
          resolve(result);
        } catch (error: any) {
          reject(new Error(`Failed to parse Excel file: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsBinaryString(file);
    });
  }

  /**
   * Parse and validate product data from JSON
   */
  private static parseProducts(jsonData: any[]): ExcelParseResult {
    const products: ParsedProduct[] = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];

    jsonData.forEach((row, index) => {
      const rowNumber = index + 2; // Excel rows start at 1, header is row 1

      try {
        // Validate required fields
        const validationErrors = this.validateRow(row, rowNumber);
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          return; // Skip this row
        }

        // Parse product
        const product = this.parseProduct(row);
        products.push(product);
      } catch (error: any) {
        errors.push({
          row: rowNumber,
          field: 'general',
          message: error.message,
        });
      }
    });

    return {
      products,
      errors,
      totalRows: jsonData.length,
      validRows: products.length,
    };
  }

  /**
   * Validate a single row
   */
  private static validateRow(
    row: any,
    rowNumber: number
  ): Array<{ row: number; field: string; message: string }> {
    const errors: Array<{ row: number; field: string; message: string }> = [];

    // Required fields
    if (!row['SKU'] && !row['sku']) {
      errors.push({ row: rowNumber, field: 'SKU', message: 'SKU is required' });
    }

    if (!row['Product Name'] && !row['product_name'] && !row['Product']) {
      errors.push({
        row: rowNumber,
        field: 'Product Name',
        message: 'Product Name is required',
      });
    }

    if (!row['Price'] && !row['price'] && row['Price'] !== 0) {
      errors.push({ row: rowNumber, field: 'Price', message: 'Price is required' });
    }

    // Validate price is a number
    const price = row['Price'] || row['price'];
    if (price !== undefined && isNaN(Number(price))) {
      errors.push({
        row: rowNumber,
        field: 'Price',
        message: 'Price must be a number',
      });
    }

    return errors;
  }

  /**
   * Parse a single product from row data
   */
  private static parseProduct(row: any): ParsedProduct {
    // Handle different column name variations
    const sku = (row['SKU'] || row['sku'] || '').toString().trim();
    const productName = (
      row['Product Name'] ||
      row['product_name'] ||
      row['Product'] ||
      row['Name'] ||
      ''
    ).toString().trim();

    const description = (
      row['Description'] ||
      row['description'] ||
      row['Desc'] ||
      ''
    ).toString().trim();

    const price = parseFloat(row['Price'] || row['price'] || 0);

    const category = (
      row['Category'] ||
      row['category'] ||
      row['Type'] ||
      ''
    ).toString().trim();

    // Parse In Stock (YES/NO or true/false)
    const inStockValue = (row['In Stock'] || row['in_stock'] || row['Available'] || 'YES').toString().trim().toUpperCase();
    const inStock = inStockValue === 'YES' || inStockValue === 'TRUE' || inStockValue === '1';

    // Parse image URL(s)
    const imageUrl = (
      row['Image URL'] ||
      row['image_url'] ||
      row['Image'] ||
      row['ImageURL'] ||
      ''
    ).toString().trim();

    const images = imageUrl ? [imageUrl] : null;

    // Parse tags if provided
    const tagsStr = (row['Tags'] || row['tags'] || '').toString().trim();
    const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : null;

    return {
      sku,
      product_name: productName,
      description: description || null,
      price,
      currency: 'MYR',
      category: category || null,
      in_stock: inStock,
      images,
      tags,
      additional_info: null,
    };
  }

  /**
   * Process and upload image to Supabase Storage
   * Downloads image from URL, compresses it, and uploads to storage
   * Returns { url, success, error } to track failures without noisy logging
   */
  private static async processProductImage(
    imageUrl: string,
    chatbotId: string,
    productSku: string
  ): Promise<{ url: string; success: boolean; error?: string }> {
    try {
      // Skip if no image URL
      if (!imageUrl || imageUrl.trim() === '') {
        return { url: imageUrl, success: true };
      }

      // Skip if already a Supabase Storage URL
      if (imageUrl.includes('supabase.co/storage')) {
        return { url: imageUrl, success: true };
      }

      // Download image from URL
      const imageFile = await ImageUploadService.downloadImageFromUrl(
        imageUrl,
        `${productSku}.jpg`
      );

      // Compress image
      const compressedImage = await ImageUploadService.compressImage(imageFile);

      // Upload to Supabase Storage
      const uploadResult = await ImageUploadService.uploadProductImage(
        compressedImage,
        chatbotId,
        productSku
      );

      return { url: uploadResult.url, success: true };
    } catch (error: any) {
      // Return original URL if processing fails, with error info
      return {
        url: imageUrl,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import products from Excel file
   */
  static async importProducts(chatbotId: string, userId: string, file: File): Promise<{
    successful: number;
    failed: number;
    errors: any[];
    uploadId: string;
  }> {
    try {
      // Parse Excel file
      const parseResult = await this.parseExcelFile(file);

      if (parseResult.products.length === 0) {
        throw new Error('No valid products found in Excel file');
      }

      // Process images: Download from URLs and upload to Supabase Storage
      console.log(`Processing ${parseResult.products.length} product images...`);
      let imageSuccessCount = 0;
      let imageFailCount = 0;
      const imageErrors: string[] = [];

      for (const product of parseResult.products) {
        if (product.images && product.images.length > 0) {
          const originalUrl = product.images[0];
          const result = await this.processProductImage(
            originalUrl,
            chatbotId,
            product.sku
          );

          product.images = [result.url];

          if (result.success) {
            imageSuccessCount++;
          } else if (result.error) {
            imageFailCount++;
            imageErrors.push(`${product.sku}: ${result.error}`);
          }
        }
      }

      // Log summary instead of individual errors
      if (imageSuccessCount > 0) {
        console.log(`✓ Successfully uploaded ${imageSuccessCount} images to Supabase Storage`);
      }
      if (imageFailCount > 0) {
        console.warn(`⚠ ${imageFailCount} images failed to upload (using original URLs):`, imageErrors.slice(0, 3));
        if (imageErrors.length > 3) {
          console.warn(`... and ${imageErrors.length - 3} more`);
        }
      }

      // Track upload
      const upload = await ProductService.trackUpload({
        chatbot_id: chatbotId,
        user_id: userId,
        file_name: file.name,
        file_path: `client-uploads/${file.name}`,
        file_size: file.size,
        total_rows: parseResult.totalRows,
        processed_rows: 0,
        successful_rows: 0,
        failed_rows: 0,
        skipped_rows: 0,
        error_log: parseResult.errors,
        error_summary: null,
        processing_started_at: new Date().toISOString(),
        processing_completed_at: null,
        status: 'processing',
      });

      // Import products in bulk
      const importResult = await ProductService.bulkImportProducts(
        chatbotId,
        userId,
        parseResult.products
      );

      // Update upload status
      await ProductService.updateUploadStatus(upload.id!, {
        processed_rows: parseResult.totalRows,
        successful_rows: importResult.successful,
        failed_rows: importResult.failed,
        skipped_rows: parseResult.errors.length,
        error_log: [...parseResult.errors, ...importResult.errors],
        error_summary: importResult.failed > 0 ? `${importResult.failed} products failed to import` : null,
        processing_completed_at: new Date().toISOString(),
        status: importResult.failed > 0 ? 'completed' : 'completed',
      });

      return {
        successful: importResult.successful,
        failed: importResult.failed + parseResult.errors.length,
        errors: [...parseResult.errors, ...importResult.errors],
        uploadId: upload.id!,
      };
    } catch (error: any) {
      console.error('Error importing products:', error);
      throw error;
    }
  }

  /**
   * Generate Excel template
   */
  static downloadTemplate(): void {
    const template = [
      {
        SKU: 'EXAMPLE001',
        'Product Name': 'Samsung Galaxy S24',
        Description: 'Latest flagship smartphone with amazing camera',
        Price: 5299,
        Category: 'Mobile Phones',
        'In Stock': 'YES',
        'Image URL': 'https://example.com/image.jpg',
      },
      {
        SKU: 'EXAMPLE002',
        'Product Name': 'Dell XPS Laptop',
        Description: 'Premium ultrabook for professionals',
        Price: 6799,
        Category: 'Laptops',
        'In Stock': 'YES',
        'Image URL': 'https://example.com/laptop.jpg',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // SKU
      { wch: 30 }, // Product Name
      { wch: 50 }, // Description
      { wch: 10 }, // Price
      { wch: 20 }, // Category
      { wch: 10 }, // In Stock
      { wch: 40 }, // Image URL
    ];

    XLSX.writeFile(workbook, 'product_template.xlsx');
  }
}
