import React from 'react';
import { Upload, Image as ImageIcon, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface UploadStepProps {
  productImage: string | null;
  productName: string;
  productDescription: string;
  additionalRequirements: string;
  onImageChange: (image: string | null) => void;
  onProductNameChange: (name: string) => void;
  onProductDescriptionChange: (description: string) => void;
  onAdditionalRequirementsChange: (requirements: string) => void;
}

export function UploadStep({
  productImage,
  productName,
  productDescription,
  additionalRequirements,
  onImageChange,
  onProductNameChange,
  onProductDescriptionChange,
  onAdditionalRequirementsChange
}: UploadStepProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      // Validate file size (max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        alert('Image must be smaller than 4MB');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const clearImage = () => {
    onImageChange(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Upload Your Product Image</h3>
        <p className="text-sm text-muted-foreground">
          Upload a clear product photo. Our AI will analyze it and create advertising images tailored to your product.
        </p>
      </div>

      {!productImage ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-purple-500 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('product-upload')?.click()}
        >
          <input
            id="product-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-medium">Drop your product image here</p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse (JPG, PNG, WebP - max 4MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="border rounded-lg overflow-hidden bg-gray-50">
            <div className="aspect-square max-w-md mx-auto relative">
              <img
                src={productImage}
                alt="Product preview"
                className="w-full h-full object-contain"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={clearImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => document.getElementById('product-upload')?.click()}
              className="flex items-center gap-2"
            >
              <ImageIcon className="h-4 w-4" />
              Change Image
            </Button>
            <input
              id="product-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Product Information Section - Optional */}
      <div className="border rounded-lg p-4 mt-6 bg-gray-50">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-4 w-4 text-purple-600" />
          <h4 className="font-medium text-gray-900">Product Information (Optional but Recommended)</h4>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Help our AI generate more accurate advertising images by providing product details.
        </p>

        <div className="space-y-4">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="product-name" className="text-sm font-medium">
              Product Name
            </Label>
            <Input
              id="product-name"
              placeholder="e.g., Samsonite Luggage Set, iPhone 15 Pro Max Case"
              value={productName}
              onChange={(e) => onProductNameChange(e.target.value)}
              className="bg-white"
            />
          </div>

          {/* Product Description */}
          <div className="space-y-2">
            <Label htmlFor="product-description" className="text-sm font-medium">
              Product Description
            </Label>
            <Textarea
              id="product-description"
              placeholder="Describe your product: materials, colors, key features, target audience, etc. e.g., 'Premium 4-piece hardshell luggage set in vibrant orange, teal, pink, and purple colors. Features 360-degree spinner wheels, TSA-approved locks, and expandable design.'"
              value={productDescription}
              onChange={(e) => onProductDescriptionChange(e.target.value)}
              className="bg-white min-h-[100px]"
            />
          </div>

          {/* Additional Requirements */}
          <div className="space-y-2">
            <Label htmlFor="additional-requirements" className="text-sm font-medium">
              Additional Requirements / Style Preferences
            </Label>
            <Textarea
              id="additional-requirements"
              placeholder="Any specific requirements for the ad images. e.g., 'Target Malaysian young professionals, show product in modern urban settings, emphasize premium quality and durability, use warm lighting'"
              value={additionalRequirements}
              onChange={(e) => onAdditionalRequirementsChange(e.target.value)}
              className="bg-white min-h-[80px]"
            />
          </div>
        </div>
      </div>

      {/* Tips section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <h4 className="font-medium text-blue-900 mb-2">Tips for best results:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Use a clear, well-lit product photo</li>
          <li>• White or neutral background works best</li>
          <li>• Show the product from its best angle</li>
          <li>• Higher resolution images produce better results</li>
          <li>• Fill in the product info above for more accurate AI-generated ads</li>
        </ul>
      </div>
    </div>
  );
}

export default UploadStep;
