import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  ArrowLeft,
  Package,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { OnboardingData, OnboardingProduct } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ProductsImportStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const CSV_TEMPLATE = `SKU,Product Name,Description,Price,Category,In Stock,Image URL
"SKU001","Samsung Galaxy S24","Latest flagship smartphone with amazing camera",5299,"Mobile Phones","YES","https://example.com/image.jpg"
"SKU002","Dell XPS Laptop","Premium ultrabook for professionals",6799,"Laptops","YES","https://example.com/laptop.jpg"
"SKU003","Wireless Earbuds","High quality wireless earbuds with noise cancellation",299,"Accessories","YES",""`;

// Map Excel column names to internal field names
const COLUMN_MAPPINGS: Record<string, string> = {
  'sku': 'sku',
  'product name': 'product_name',
  'product': 'product_name',
  'name': 'product_name',
  'description': 'description',
  'desc': 'description',
  'price': 'price',
  'category': 'category',
  'type': 'category',
  'in stock': 'in_stock',
  'in_stock': 'in_stock',
  'available': 'in_stock',
  'image url': 'image_url',
  'image': 'image_url',
  'imageurl': 'image_url',
};

export const ProductsImportStep: React.FC<ProductsImportStepProps> = ({
  data,
  updateData,
  onNext,
  onPrevious
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<OnboardingProduct>>({
    product_name: '',
    sku: '',
    price: 0,
    category: '',
    description: '',
    in_stock: true
  });

  const products = data.products || [];

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Template Downloaded',
      description: 'Fill in the template and upload it back.',
    });
  };

  const parseCSV = (text: string): OnboardingProduct[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must have headers and at least one data row');
    }

    // Parse header row and map to internal field names
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const headers = rawHeaders.map(h => COLUMN_MAPPINGS[h] || h);

    // Check for required fields (allowing various column name formats)
    const hasProductName = headers.includes('product_name');
    const hasPrice = headers.includes('price');

    if (!hasProductName) {
      throw new Error('Missing required column: Product Name (or "Name", "Product")');
    }
    if (!hasPrice) {
      throw new Error('Missing required column: Price');
    }

    const products: OnboardingProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles quoted values)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const product: OnboardingProduct = {
        product_name: '',
        sku: '',
        price: 0,
        category: '',
        description: '',
        in_stock: true
      };

      headers.forEach((header, index) => {
        const value = values[index] || '';
        switch (header) {
          case 'product_name':
            product.product_name = value;
            break;
          case 'sku':
            product.sku = value;
            break;
          case 'price':
            product.price = parseFloat(value) || 0;
            break;
          case 'category':
            product.category = value;
            break;
          case 'description':
            product.description = value;
            break;
          case 'in_stock':
            // Handle YES/NO, true/false, 1/0
            const inStockValue = value.toUpperCase();
            product.in_stock = inStockValue === 'YES' || inStockValue === 'TRUE' || inStockValue === '1';
            break;
          // image_url is parsed but not stored in OnboardingProduct (images are handled separately)
        }
      });

      if (product.product_name) {
        products.push(product);
      }
    }

    return products;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);

        if (parsed.length === 0) {
          throw new Error('No valid products found in the file');
        }

        updateData({ products: [...products, ...parsed] });
        toast({
          title: 'Products Imported',
          description: `Successfully imported ${parsed.length} product(s).`,
        });
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse CSV file');
        toast({
          title: 'Import Failed',
          description: err.message || 'Failed to parse CSV file',
          variant: 'destructive',
        });
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file');
    };

    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddProduct = () => {
    if (!newProduct.product_name || !newProduct.price) {
      toast({
        title: 'Missing Information',
        description: 'Product name and price are required.',
        variant: 'destructive',
      });
      return;
    }

    updateData({
      products: [...products, newProduct as OnboardingProduct]
    });

    setNewProduct({
      product_name: '',
      sku: '',
      price: 0,
      category: '',
      description: '',
      in_stock: true
    });
    setShowManualAdd(false);

    toast({
      title: 'Product Added',
      description: `${newProduct.product_name} has been added.`,
    });
  };

  const handleRemoveProduct = (index: number) => {
    const updated = products.filter((_, i) => i !== index);
    updateData({ products: updated });
  };

  const handleSkip = () => {
    updateData({ products: [] });
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Import Your Products</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Add your products so your chatbot can help customers with pricing and availability.
          This step is optional - you can add products later.
        </p>
      </div>

      {/* Import Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CSV Template Download */}
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Download CSV Template</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get our template, fill it with your products, then upload.
            </p>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </CardContent>
        </Card>

        {/* Upload CSV */}
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Upload Products CSV</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your filled template or existing product list.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button variant="outline" asChild>
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </label>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Import Error */}
      {importError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{importError}</p>
          </CardContent>
        </Card>
      )}

      {/* Manual Add Option */}
      {!showManualAdd ? (
        <div className="text-center">
          <Button variant="ghost" onClick={() => setShowManualAdd(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Or add products manually
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Add Product Manually</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManualAdd(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  placeholder="e.g., iPhone 15 Pro"
                  value={newProduct.product_name}
                  onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  placeholder="e.g., IP15P-256"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (RM) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newProduct.price || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  placeholder="e.g., Electronics"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Brief description of the product"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              />
            </div>
            <Button onClick={handleAddProduct}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Products List */}
      {products.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Products Added ({products.length})</h4>
              <Badge variant="outline" className="text-green-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ready
              </Badge>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {products.map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku && `SKU: ${product.sku} • `}
                      RM {product.price.toFixed(2)}
                      {product.category && ` • ${product.category}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProduct(index)}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onPrevious}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSkip}>
            Skip for Now
          </Button>
          <Button onClick={onNext}>
            {products.length > 0 ? 'Continue' : 'Skip'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductsImportStep;
