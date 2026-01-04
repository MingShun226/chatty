import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  Plus,
  Search,
  Upload,
  Download,
  PackageX,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductGalleryProps {
  chatbotId: string;
  chatbotName: string;
}

export function ProductGallery({ chatbotId, chatbotName }: ProductGalleryProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
  }, [chatbotId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // TODO: Fetch products from chatbot_products table
      // For now, show empty state
      setProducts([]);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = () => {
    toast({
      title: "Excel Upload",
      description: "Excel product upload feature coming soon!",
    });
  };

  const handleDownloadTemplate = () => {
    // Create CSV template
    const csvContent = `SKU,Product Name,Description,Price,Category,Stock,Image URL
EXAMPLE001,Sample Product,"Product description here",99.00,Category Name,50,https://example.com/image.jpg`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Product template downloaded successfully",
    });
  };

  const handleAddProduct = () => {
    toast({
      title: "Add Product",
      description: "Manual product entry feature coming soon!",
    });
  };

  const filteredProducts = products.filter(product =>
    product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product?.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Product Catalog
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage products for your chatbot to recommend and sell
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <Button onClick={handleExcelUpload} variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel
              </Button>
              <Button onClick={handleAddProduct} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading products...</span>
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <PackageX className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Add products to your chatbot's catalog so it can recommend and answer questions about your inventory.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleDownloadTemplate} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Excel Template
              </Button>
              <Button onClick={handleExcelUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Products
              </Button>
            </div>

            {/* Quick Guide */}
            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg max-w-2xl">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                How to add products:
              </h4>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                <li>Download the Excel template</li>
                <li>Fill in your products (SKU, Name, Description, Price, Category, Stock, Image URL)</li>
                <li>Save as .xlsx or .xls format</li>
                <li>Click "Upload Products" and select your file</li>
              </ol>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                💡 Tip: You can upload 1000+ products at once using Excel!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {filteredProducts.length} Products
              </CardTitle>
              <Badge variant="outline">
                {filteredProducts.length} of {products.length} shown
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <Card key={product.id}>
                  <CardContent className="p-4">
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-40 object-cover rounded-lg mb-3"
                      />
                    )}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold">{product.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {product.sku}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-blue-600">
                          RM {product.price}
                        </span>
                        <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                          Stock: {product.stock}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
