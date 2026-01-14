import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShoppingBag,
  Plus,
  Search,
  Upload,
  Download,
  PackageX,
  Loader2,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  LayoutGrid,
  List,
  Eye,
  EyeOff,
  Bell
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ProductService, Product } from '@/services/productService';
import { ExcelImportService } from '@/services/excelImportService';
import { ImageUploadService } from '@/services/imageUploadService';
import { PromotionService, Promotion } from '@/services/promotionService';
import { supabase } from '@/integrations/supabase/client';

// Extended product with promotion pricing
interface ProductWithPromo extends Product {
  original_price: number;
  sale_price: number | null;
  has_discount: boolean;
  discount_display: string | null;
  applied_promotion: string | null;
}

interface ProductGalleryFullProps {
  chatbotId: string;
  chatbotName: string;
  priceVisible?: boolean;
  onPriceVisibleChange?: (visible: boolean) => void;
}

// Memoized Product Card Component for better performance (Grid View)
const ProductCard = memo(({
  product,
  priceVisible,
  onEdit,
  onDelete
}: {
  product: ProductWithPromo;
  priceVisible: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow duration-150" style={{ willChange: 'box-shadow' }}>
      <CardContent className="p-4" style={{ contain: 'layout style paint' }}>
        <div className="relative">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.product_name}
              loading="lazy"
              decoding="async"
              className="w-full h-40 object-cover rounded-lg mb-3"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
              }}
            />
          ) : (
            <div className="w-full h-40 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
              <PackageX className="h-12 w-12 text-gray-400" />
            </div>
          )}
          {/* Discount Badge on Image */}
          {product.has_discount && product.discount_display && (
            <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold">
              {product.discount_display}
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold line-clamp-2 flex-1">{product.product_name}</h4>
            <Badge variant="secondary" className="text-xs shrink-0">
              {product.sku}
            </Badge>
          </div>

          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              {product.has_discount && product.sale_price !== null ? (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    RM {product.original_price.toFixed(2)}
                  </span>
                  <span className="text-lg font-bold text-red-600">
                    RM {product.sale_price.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-blue-600">
                  RM {product.price.toFixed(2)}
                </span>
              )}
            </div>
            <Badge variant={product.in_stock ? "default" : "destructive"} className="text-xs">
              {product.in_stock ? 'In Stock' : 'Out of Stock'}
            </Badge>
          </div>

          {/* Applied Promotion Name */}
          {product.applied_promotion && (
            <p className="text-xs text-green-600 font-medium">
              🎉 {product.applied_promotion}
            </p>
          )}

          {product.category && (
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(product)}
              className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(product.id!, product.product_name)}
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

// Product List Item Component (List View)
const ProductListItem = memo(({
  product,
  priceVisible,
  onEdit,
  onDelete
}: {
  product: ProductWithPromo;
  priceVisible: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
}) => {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-sm transition-shadow bg-card">
      <div className="relative shrink-0">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.product_name}
            loading="lazy"
            className="w-16 h-16 object-cover rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="10" fill="%23999"%3ENo Img%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
            <PackageX className="h-6 w-6 text-gray-400" />
          </div>
        )}
        {/* Discount Badge */}
        {product.has_discount && product.discount_display && (
          <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 py-0">
            {product.discount_display}
          </Badge>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold truncate">{product.product_name}</h4>
          <Badge variant="secondary" className="text-xs shrink-0">
            {product.sku}
          </Badge>
        </div>
        {product.description && (
          <p className="text-sm text-muted-foreground truncate mb-1">
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {product.category && (
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
          )}
          <Badge variant={product.in_stock ? "default" : "destructive"} className="text-xs">
            {product.in_stock ? 'In Stock' : 'Out of Stock'}
          </Badge>
          {product.applied_promotion && (
            <span className="text-xs text-green-600 font-medium">
              🎉 {product.applied_promotion}
            </span>
          )}
        </div>
      </div>

      {priceVisible && (
        <div className="text-right shrink-0 min-w-[120px]">
          {product.has_discount && product.sale_price !== null ? (
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground line-through">
                RM {product.original_price.toFixed(2)}
              </span>
              <span className="text-lg font-bold text-red-600">
                RM {product.sale_price.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-lg font-bold text-blue-600">
              RM {product.price.toFixed(2)}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1 shrink-0 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(product)}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(product.id!, product.product_name)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

ProductListItem.displayName = 'ProductListItem';

// Helper function to find applicable promotions for a product
const findApplicablePromotions = (product: Product, promotions: Promotion[]): Promotion[] => {
  return promotions.filter(promo => {
    const appliesTo = promo.applies_to || 'all';
    if (appliesTo === 'all') return true;
    else if (appliesTo === 'category' && promo.applies_to_categories) {
      return product.category && promo.applies_to_categories.includes(product.category);
    } else if (appliesTo === 'products' && promo.applies_to_product_ids) {
      return product.id && promo.applies_to_product_ids.includes(product.id);
    }
    return false;
  });
};

// Helper function to calculate discounted price
const calculateDiscountedPrice = (originalPrice: number, promo: Promotion): number => {
  if (!originalPrice || !promo.discount_type || !promo.discount_value) return originalPrice;

  let discount = 0;
  if (promo.discount_type === 'percentage') {
    discount = originalPrice * (promo.discount_value / 100);
  } else if (promo.discount_type === 'fixed_amount') {
    discount = promo.discount_value;
  }

  return Math.round(Math.max(0, originalPrice - discount) * 100) / 100;
};

// Apply promotions to products
const applyPromotionsToProducts = (products: Product[], promotions: Promotion[]): ProductWithPromo[] => {
  return products.map(product => {
    const applicablePromos = findApplicablePromotions(product, promotions);

    if (applicablePromos.length === 0 || !product.price) {
      return {
        ...product,
        original_price: product.price,
        sale_price: null,
        has_discount: false,
        discount_display: null,
        applied_promotion: null,
      };
    }

    // Find the best promotion (highest discount)
    let bestPromo: Promotion | null = null;
    let bestSalePrice = product.price;

    for (const promo of applicablePromos) {
      const salePrice = calculateDiscountedPrice(product.price, promo);
      if (salePrice < bestSalePrice) {
        bestSalePrice = salePrice;
        bestPromo = promo;
      }
    }

    if (bestPromo && bestSalePrice < product.price) {
      let discountDisplay = '';
      if (bestPromo.discount_type === 'percentage') {
        discountDisplay = `${bestPromo.discount_value}% OFF`;
      } else if (bestPromo.discount_type === 'fixed_amount') {
        discountDisplay = `RM${bestPromo.discount_value} OFF`;
      }

      return {
        ...product,
        original_price: product.price,
        sale_price: bestSalePrice,
        has_discount: true,
        discount_display: discountDisplay,
        applied_promotion: bestPromo.title,
      };
    }

    return {
      ...product,
      original_price: product.price,
      sale_price: null,
      has_discount: false,
      discount_display: null,
      applied_promotion: null,
    };
  });
};

export function ProductGalleryFull({ chatbotId, chatbotName, priceVisible: initialPriceVisible = true, onPriceVisibleChange }: ProductGalleryFullProps) {
  const [products, setProducts] = useState<ProductWithPromo[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    show: boolean;
    filename: string;
    successful: number;
    failed: number;
    total: number;
  }>({ show: false, filename: '', successful: 0, failed: 0, total: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Global price visibility state
  const [priceVisible, setPriceVisible] = useState(initialPriceVisible);
  const [updatingPriceVisible, setUpdatingPriceVisible] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Add/Edit product state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    sku: '',
    product_name: '',
    description: '',
    price: 0,
    category: '',
    in_stock: true,
    images: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [displayCount, setDisplayCount] = useState(24);
  const ITEMS_PER_PAGE = 24;

  // Memoize filtered products for better performance
  const filteredProducts = useMemo(() => {
    if (searchQuery.trim() === '') {
      return products;
    }
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
    );
  }, [searchQuery, products]);

  // Displayed products with limit
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayCount);
  }, [filteredProducts, displayCount]);

  const hasMore = filteredProducts.length > displayCount;

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch products and promotions in parallel
      const [productsData, promotionsData] = await Promise.all([
        ProductService.getProducts(chatbotId),
        PromotionService.getActivePromotions(chatbotId)
      ]);

      setPromotions(promotionsData);

      // Apply promotions to products
      const productsWithPromo = applyPromotionsToProducts(productsData, promotionsData);
      setProducts(productsWithPromo);
    } catch (error: any) {
      console.error('Error loading products:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [chatbotId, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Sync price visible with prop changes
  useEffect(() => {
    setPriceVisible(initialPriceVisible);
  }, [initialPriceVisible]);

  // Handle price visibility toggle
  const handlePriceVisibleToggle = async (checked: boolean) => {
    try {
      setUpdatingPriceVisible(true);

      // Update in database
      const { error } = await supabase
        .from('avatars')
        .update({ price_visible: checked })
        .eq('id', chatbotId);

      if (error) throw error;

      setPriceVisible(checked);
      onPriceVisibleChange?.(checked);

      toast({
        title: checked ? "Prices Visible" : "Prices Hidden",
        description: checked
          ? "Customers can now see product prices"
          : "Customers will be notified to contact you for pricing",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update price visibility",
        variant: "destructive"
      });
    } finally {
      setUpdatingPriceVisible(false);
    }
  };

  // Reset display count when search query changes
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [searchQuery]);

  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const handleShowAll = useCallback(() => {
    setDisplayCount(filteredProducts.length);
  }, [filteredProducts.length]);

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Invalid File",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to upload products",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress({
        show: true,
        filename: file.name,
        successful: 0,
        failed: 0,
        total: 0,
      });

      // Import products
      const result = await ExcelImportService.importProducts(chatbotId, user.id, file);

      setUploadProgress({
        show: true,
        filename: file.name,
        successful: result.successful,
        failed: result.failed,
        total: result.successful + result.failed,
      });

      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.successful} products${
          result.failed > 0 ? `, ${result.failed} failed` : ''
        }`,
      });

      // Reload products
      await loadProducts();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading products:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to import products",
        variant: "destructive"
      });
      setUploadProgress({ show: false, filename: '', successful: 0, failed: 0, total: 0 });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    ExcelImportService.downloadTemplate();
    toast({
      title: "Template Downloaded",
      description: "Product template downloaded successfully",
    });
  };

  const handleDeleteProduct = useCallback(async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
      return;
    }

    try {
      await ProductService.deleteProduct(productId);
      toast({
        title: "Product Deleted",
        description: `${productName} has been deleted`,
      });
      await loadProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive"
      });
    }
  }, [toast, loadProducts]);

  const resetForm = useCallback(() => {
    setEditForm({
      sku: '',
      product_name: '',
      description: '',
      price: 0,
      category: '',
      in_stock: true,
      images: '',
    });
    setImageFile(null);
    setImagePreview('');
  }, []);

  const handleAddProduct = useCallback(() => {
    resetForm();
    setEditingProduct(null);
    setShowAddDialog(true);
  }, [resetForm]);

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setEditForm({
      sku: product.sku,
      product_name: product.product_name,
      description: product.description || '',
      price: product.price,
      category: product.category || '',
      in_stock: product.in_stock,
      images: product.images?.[0] || '',
    });
    setImageFile(null);
    setImagePreview(product.images?.[0] || '');
    setShowAddDialog(true);
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image size must be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleSaveProduct = async () => {
    // Validate required fields
    if (!editForm.sku.trim() || !editForm.product_name.trim()) {
      toast({
        title: "Validation Error",
        description: "SKU and Product Name are required",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      let imageUrl = editForm.images;

      // If a new image file was selected, upload it to Supabase Storage
      if (imageFile) {
        setUploadingImage(true);
        try {
          // Compress image first
          const compressedImage = await ImageUploadService.compressImage(imageFile);

          // Upload to Supabase Storage
          const uploadResult = await ImageUploadService.uploadProductImage(
            compressedImage,
            chatbotId,
            editForm.sku
          );

          imageUrl = uploadResult.url;

          // Delete old image from storage if editing and old image exists
          if (editingProduct?.images?.[0]) {
            const oldImagePath = ImageUploadService.extractPathFromUrl(editingProduct.images[0]);
            if (oldImagePath) {
              try {
                await ImageUploadService.deleteProductImage(oldImagePath);
              } catch (err) {
                console.error('Error deleting old image:', err);
              }
            }
          }
        } catch (uploadError: any) {
          toast({
            title: "Image Upload Failed",
            description: uploadError.message || "Failed to upload image. Using URL instead.",
            variant: "destructive"
          });
        } finally {
          setUploadingImage(false);
        }
      }

      const productData = {
        sku: editForm.sku,
        product_name: editForm.product_name,
        description: editForm.description || null,
        price: editForm.price,
        category: editForm.category || null,
        in_stock: editForm.in_stock,
        images: imageUrl ? [imageUrl] : null,
      };

      if (editingProduct) {
        // Update existing product
        await ProductService.updateProduct(editingProduct.id!, productData);
        toast({
          title: "Product Updated",
          description: `${editForm.product_name} has been updated successfully`,
        });
      } else {
        // Create new product
        await ProductService.createProduct({
          ...productData,
          chatbot_id: chatbotId,
          currency: 'MYR',
          tags: null,
          additional_info: null,
        } as any, user.id);
        toast({
          title: "Product Created",
          description: `${editForm.product_name} has been added to your catalog`,
        });
      }

      setShowAddDialog(false);
      setEditingProduct(null);
      resetForm();
      await loadProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const closeUploadProgress = () => {
    setUploadProgress({ show: false, filename: '', successful: 0, failed: 0, total: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Upload Progress Modal */}
      {uploadProgress.show && (
        <Card className="border-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : uploadProgress.failed === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                Excel Import {uploading ? 'In Progress' : 'Complete'}
              </CardTitle>
              {!uploading && (
                <Button onClick={closeUploadProgress} variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">File: {uploadProgress.filename}</p>
              </div>
              {!uploading && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{uploadProgress.successful}</p>
                    <p className="text-xs text-green-700 dark:text-green-400">Successful</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{uploadProgress.failed}</p>
                    <p className="text-xs text-red-700 dark:text-red-400">Failed</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{uploadProgress.total}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">Total Rows</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Product Catalog
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredProducts.length === products.length
                  ? `${products.length} products`
                  : `${filteredProducts.length} of ${products.length} products`} • Manage your product inventory
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleAddProduct} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
              <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Excel'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Price Visibility Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              {priceVisible ? (
                <Eye className="h-5 w-5 text-green-600" />
              ) : (
                <EyeOff className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <Label htmlFor="price-visible-toggle" className="font-medium cursor-pointer">
                  Show prices to customers
                </Label>
                <p className="text-xs text-muted-foreground">
                  {priceVisible
                    ? "Customers can see product prices in chat"
                    : "Prices are hidden. You'll be notified when customers ask about pricing"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!priceVisible && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <Bell className="h-3 w-3 mr-1" />
                  Notify on inquiry
                </Badge>
              )}
              <Switch
                id="price-visible-toggle"
                checked={priceVisible}
                onCheckedChange={handlePriceVisibleToggle}
                disabled={updatingPriceVisible}
              />
            </div>
          </div>

          {/* Search Bar and View Toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name, SKU, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid/List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading products...</span>
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <PackageX className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No Products Found' : 'No Products Yet'}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {searchQuery
                ? `No products match "${searchQuery}". Try a different search term.`
                : 'Add products to your chatbot\'s catalog so it can recommend and answer questions about your inventory.'}
            </p>
            {!searchQuery && (
              <div className="flex gap-3 flex-wrap justify-center">
                <Button onClick={handleAddProduct}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
                <Button onClick={handleDownloadTemplate} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Excel Template
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Excel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priceVisible={priceVisible}
                  onEdit={handleEditProduct}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {displayedProducts.map((product) => (
                <ProductListItem
                  key={product.id}
                  product={product}
                  priceVisible={priceVisible}
                  onEdit={handleEditProduct}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center gap-3 pt-6">
              <Button onClick={handleLoadMore} variant="outline" size="lg">
                Load More ({filteredProducts.length - displayCount} remaining)
              </Button>
              <Button onClick={handleShowAll} variant="ghost" size="lg">
                Show All
              </Button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingProduct(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update product details and click save when you\'re done.'
                : 'Add a new product to your catalog. Fill in the details below.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU *</Label>
                <Input
                  id="edit-sku"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  placeholder="e.g., PROD-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  placeholder="e.g., Electronics"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Product Name *</Label>
              <Input
                id="edit-name"
                value={editForm.product_name}
                onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                placeholder="Enter product name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Enter product description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-price">Price (RM) *</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Product Image</Label>

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative w-full h-48 border rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                      setEditForm({ ...editForm, images: '' });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Or use URL */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or enter URL</span>
                </div>
              </div>

              <Input
                id="edit-image"
                value={editForm.images}
                onChange={(e) => {
                  setEditForm({ ...editForm, images: e.target.value });
                  if (e.target.value) {
                    setImageFile(null);
                    setImagePreview(e.target.value);
                  }
                }}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground">
                Upload an image (max 5MB) or provide an image URL
              </p>
            </div>

            {/* Product Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Product Settings</h4>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="in-stock">Product is in stock</Label>
                  <p className="text-xs text-muted-foreground">
                    Uncheck if product is currently unavailable
                  </p>
                </div>
                <Switch
                  id="in-stock"
                  checked={editForm.in_stock}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, in_stock: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              setEditingProduct(null);
              resetForm();
            }} disabled={saving || uploadingImage}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct} disabled={saving || uploadingImage}>
              {uploadingImage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading Image...
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingProduct ? 'Save Changes' : 'Add Product'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
