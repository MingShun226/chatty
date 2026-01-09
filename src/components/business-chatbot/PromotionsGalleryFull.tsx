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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tag,
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
  Calendar,
  Percent,
  DollarSign,
  Image as ImageIcon,
  X,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { PromotionService, Promotion } from '@/services/promotionService';
import { ImageUploadService } from '@/services/imageUploadService';

interface PromotionsGalleryFullProps {
  chatbotId: string;
  chatbotName: string;
}

// Memoized Promotion Card Component
const PromotionCard = memo(({
  promotion,
  onEdit,
  onDelete
}: {
  promotion: Promotion;
  onEdit: (promotion: Promotion) => void;
  onDelete: (id: string, title: string) => void;
}) => {
  const status = PromotionService.getPromotionStatus(promotion);
  const discount = PromotionService.formatDiscount(promotion);

  const getStatusBadgeVariant = () => {
    switch (status.status) {
      case 'active': return 'default';
      case 'upcoming': return 'secondary';
      case 'expired': return 'destructive';
      case 'maxed_out': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-150">
      <CardContent className="p-4">
        {promotion.banner_image_url ? (
          <img
            src={promotion.banner_image_url}
            alt={promotion.title}
            loading="lazy"
            className="w-full h-40 object-cover rounded-lg mb-3"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg mb-3 flex items-center justify-center">
            <Tag className="h-12 w-12 text-purple-400" />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold line-clamp-2 flex-1">{promotion.title}</h4>
            <Badge variant={getStatusBadgeVariant()} className="shrink-0">
              {status.statusLabel}
            </Badge>
          </div>

          {promotion.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {promotion.description}
            </p>
          )}

          {/* Discount Display */}
          {discount && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-lg font-bold">
                {discount}
              </Badge>
              {promotion.promo_code && (
                <Badge variant="outline" className="font-mono">
                  {promotion.promo_code}
                </Badge>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {promotion.start_date && promotion.end_date ? (
              <span>
                {new Date(promotion.start_date).toLocaleDateString()} - {new Date(promotion.end_date).toLocaleDateString()}
              </span>
            ) : promotion.start_date ? (
              <span>From {new Date(promotion.start_date).toLocaleDateString()}</span>
            ) : promotion.end_date ? (
              <span>Until {new Date(promotion.end_date).toLocaleDateString()}</span>
            ) : (
              <span>No date limit</span>
            )}
          </div>

          {/* Usage */}
          {promotion.max_uses && (
            <div className="text-xs text-muted-foreground">
              Used: {promotion.current_uses || 0} / {promotion.max_uses}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(promotion)}
              className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(promotion.id!, promotion.title)}
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

PromotionCard.displayName = 'PromotionCard';

export function PromotionsGalleryFull({ chatbotId, chatbotName }: PromotionsGalleryFullProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    promo_code: '',
    discount_type: '' as 'percentage' | 'fixed_amount' | '',
    discount_value: '',
    banner_image_url: '',
    start_date: '',
    end_date: '',
    is_active: true,
    terms_and_conditions: '',
    max_uses: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Filtered promotions
  const filteredPromotions = useMemo(() => {
    if (searchQuery.trim() === '') return promotions;
    const query = searchQuery.toLowerCase();
    return promotions.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.promo_code?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [searchQuery, promotions]);

  const loadPromotions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await PromotionService.getPromotions(chatbotId);
      setPromotions(data);
    } catch (error: any) {
      console.error('Error loading promotions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load promotions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [chatbotId, toast]);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      promo_code: '',
      discount_type: '',
      discount_value: '',
      banner_image_url: '',
      start_date: '',
      end_date: '',
      is_active: true,
      terms_and_conditions: '',
      max_uses: '',
    });
    setImageFile(null);
    setImagePreview('');
  };

  const handleAddNew = () => {
    resetForm();
    setEditingPromotion(null);
    setShowAddDialog(true);
  };

  const handleEdit = useCallback((promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      title: promotion.title,
      description: promotion.description || '',
      promo_code: promotion.promo_code || '',
      discount_type: promotion.discount_type || '',
      discount_value: promotion.discount_value?.toString() || '',
      banner_image_url: promotion.banner_image_url || '',
      start_date: promotion.start_date || '',
      end_date: promotion.end_date || '',
      is_active: promotion.is_active,
      terms_and_conditions: promotion.terms_and_conditions || '',
      max_uses: promotion.max_uses?.toString() || '',
    });
    setImagePreview(promotion.banner_image_url || '');
    setImageFile(null);
    setShowAddDialog(true);
  }, []);

  const handleDelete = useCallback(async (promotionId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await PromotionService.deletePromotion(promotionId);
      toast({
        title: "Promotion Deleted",
        description: `${title} has been deleted`,
      });
      await loadPromotions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete promotion",
        variant: "destructive"
      });
    }
  }, [toast, loadPromotions]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image size must be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
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
      let bannerImageUrl = formData.banner_image_url;

      // Upload image if selected
      if (imageFile) {
        setUploadingImage(true);
        try {
          const compressedImage = await ImageUploadService.compressImage(imageFile);
          const uploadResult = await ImageUploadService.uploadProductImage(
            compressedImage,
            chatbotId,
            `promo_${Date.now()}`
          );
          bannerImageUrl = uploadResult.url;
        } catch (uploadError: any) {
          toast({
            title: "Image Upload Failed",
            description: uploadError.message || "Failed to upload image",
            variant: "destructive"
          });
        } finally {
          setUploadingImage(false);
        }
      }

      const promotionData = {
        chatbot_id: chatbotId,
        title: formData.title,
        description: formData.description || null,
        promo_code: formData.promo_code ? formData.promo_code.toUpperCase() : null,
        discount_type: formData.discount_type || null,
        discount_value: formData.discount_value ? parseFloat(formData.discount_value) : null,
        banner_image_url: bannerImageUrl || null,
        thumbnail_url: bannerImageUrl || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        is_active: formData.is_active,
        terms_and_conditions: formData.terms_and_conditions || null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      };

      if (editingPromotion) {
        await PromotionService.updatePromotion(editingPromotion.id!, promotionData);
        toast({
          title: "Promotion Updated",
          description: `${formData.title} has been updated`,
        });
      } else {
        await PromotionService.createPromotion(promotionData as any, user.id);
        toast({
          title: "Promotion Created",
          description: `${formData.title} has been created`,
        });
      }

      setShowAddDialog(false);
      resetForm();
      await loadPromotions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save promotion",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Promotions & Offers
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {promotions.length} promotions - Manage your sales and discount campaigns
              </p>
            </div>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Promotion
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search promotions by title, code, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Promotions Grid */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading promotions...</span>
          </CardContent>
        </Card>
      ) : filteredPromotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Tag className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No Promotions Found' : 'No Promotions Yet'}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {searchQuery
                ? `No promotions match "${searchQuery}".`
                : 'Create promotions and offers that your chatbot can share with customers when they ask about sales or discounts.'}
            </p>
            {!searchQuery && (
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Promotion
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPromotions.map((promotion) => (
            <PromotionCard
              key={promotion.id}
              promotion={promotion}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && setShowAddDialog(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPromotion ? 'Edit Promotion' : 'Create New Promotion'}
            </DialogTitle>
            <DialogDescription>
              {editingPromotion
                ? 'Update promotion details and click save when done.'
                : 'Create a new promotion that your chatbot can share with customers.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Chinese New Year Sale - 50% OFF!"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your promotion..."
                rows={3}
              />
            </div>

            {/* Promo Code & Discount */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promo_code">Promo Code</Label>
                <Input
                  id="promo_code"
                  value={formData.promo_code}
                  onChange={(e) => setFormData({ ...formData, promo_code: e.target.value.toUpperCase() })}
                  placeholder="e.g., CNY2024"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_type">Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value) => setFormData({ ...formData, discount_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Percentage
                      </div>
                    </SelectItem>
                    <SelectItem value="fixed_amount">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Fixed Amount (RM)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value">
                  {formData.discount_type === 'percentage' ? 'Discount %' : 'Amount (RM)'}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  placeholder={formData.discount_type === 'percentage' ? '50' : '20.00'}
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Max Uses */}
            <div className="space-y-2">
              <Label htmlFor="max_uses">Maximum Uses (optional)</Label>
              <Input
                id="max_uses"
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                placeholder="Leave empty for unlimited"
              />
            </div>

            {/* Banner Image */}
            <div className="space-y-2">
              <Label>Banner Image</Label>
              {imagePreview && (
                <div className="relative w-full h-48 border rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={imagePreview}
                    alt="Banner preview"
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
                      setFormData({ ...formData, banner_image_url: '' });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
              <Input
                value={formData.banner_image_url}
                onChange={(e) => {
                  setFormData({ ...formData, banner_image_url: e.target.value });
                  if (e.target.value) {
                    setImageFile(null);
                    setImagePreview(e.target.value);
                  }
                }}
                placeholder="Or enter image URL"
              />
            </div>

            {/* Terms */}
            <div className="space-y-2">
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={formData.terms_and_conditions}
                onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                placeholder="e.g., Valid for orders above RM50. Cannot be combined with other offers."
                rows={3}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Promotion is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingImage}>
              {uploadingImage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingPromotion ? 'Save Changes' : 'Create Promotion'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
