import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, useRef, useEffect } from "react";

interface ProductFormProps {
  onSubmit: (data: any) => void;
  isLoading?: boolean;
  initialData?: {
    name?: string;
    description?: string;
    images?: string[];
    isAvailable?: boolean;
    categoryIds?: number[];
    customPrice?: number | null;
  };
}

export function ProductForm({ onSubmit, isLoading, initialData }: ProductFormProps) {
  const { toast } = useToast();
  const [uploadedImages, setUploadedImages] = useState<string[]>(initialData?.images || []);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const form = useForm({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      images: initialData?.images || [],
      isAvailable: initialData?.isAvailable ?? true,
      customPrice: initialData?.customPrice ?? null,
    },
  });

  // Initialize selectedCategories when initialData changes
  useEffect(() => {
    if (initialData?.categoryIds) {
      console.log('Setting initial categories:', initialData.categoryIds);
      setSelectedCategories(initialData.categoryIds);
    }
  }, [initialData]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    try {
      const compressedImages = await Promise.all(
        validFiles.map(async (file) => {
          try {
            const compressed = await compressImage(file);
            toast({
              title: "Image processed",
              description: `${file.name} has been compressed and added`,
            });
            return compressed;
          } catch (error) {
            toast({
              title: "Compression failed",
              description: `Failed to process ${file.name}`,
              variant: "destructive",
            });
            return null;
          }
        })
      );

      const newImages = compressedImages.filter((img): img is string => img !== null);
      setUploadedImages(prev => {
        const updated = [...prev, ...newImages];
        form.setValue("images", updated, { shouldValidate: true });
        return updated;
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process images",
        variant: "destructive",
      });
    } finally {
      setIsCompressing(false);
      if (event.target) event.target.value = '';
    }
  }, [form, toast]);

  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      form.setValue("images", newImages, { shouldValidate: true });
      return newImages;
    });
    toast({
      title: "Image removed",
      description: "The image has been removed from the product",
    });
  }, [form, toast]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (data: any) => {
    const formData = {
      ...data,
      categoryIds: selectedCategories,
      customPrice: data.customPrice !== '' && data.customPrice !== null 
        ? parseInt(data.customPrice, 10) 
        : null,
    };
    console.log('Submitting form with data:', formData);
    onSubmit(formData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custom Price (Optional)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="1" 
                  {...field} 
                  value={field.value ?? ''} 
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value ? parseInt(value, 10) : null);
                  }}
                  placeholder="Use category default if not set"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isAvailable"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>Available for Order</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Product Images</h3>
            <Button
              type="button"
              variant="outline"
              onClick={triggerFileInput}
              className="flex items-center gap-2"
              disabled={isCompressing}
            >
              <ImagePlus className="h-4 w-4" />
              {isCompressing ? "Processing..." : "Add Images"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
              disabled={isCompressing}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {uploadedImages.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-40 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <FormItem>
          <FormLabel>Categories</FormLabel>
          <div className="flex flex-wrap gap-2">
            {categories.map((category: any) => (
              <div key={category.id} className="flex items-center space-x-2 bg-secondary p-2 rounded-lg">
                <Button
                  type="button"
                  variant={selectedCategories.includes(category.id) ? "default" : "outline"}
                  onClick={() => {
                    console.log('Toggling category:', category.id);
                    setSelectedCategories(prev => {
                      const isSelected = prev.includes(category.id);
                      const newSelection = isSelected
                        ? prev.filter(id => id !== category.id)
                        : [...prev, category.id];
                      console.log('New category selection:', newSelection);
                      return newSelection;
                    });
                  }}
                  className="h-8"
                >
                  {category.name}
                </Button>
                <span className="text-sm text-muted-foreground">
                  (${category.defaultPrice})
                </span>
              </div>
            ))}
          </div>
        </FormItem>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update Product" : "Create Product")}
        </Button>
      </form>
    </Form>
  );
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      let { width, height } = img;
      const maxDimension = 800;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}