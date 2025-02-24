import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Helper function for image compression remains unchanged
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

      // Calculate dimensions while maintaining aspect ratio
      let { width, height } = img;
      const maxDimension = 1200;

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

      // Apply smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with 50% quality
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

export function BulkUpload() {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Add categories query
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const products = await Promise.all(
        files.map(async (file) => {
          return new Promise(async (resolve) => {
            try {
              const imageData = await compressImage(file);
              const productData = {
                name: file.name.split('.')[0],
                description: `Product created from ${file.name}`,
                images: [imageData],
                isAvailable: true,
                categories: selectedCategory ? [parseInt(selectedCategory)] : [],
              };

              const res = await apiRequest("POST", "/api/products", productData);
              resolve(await res.json());
            } catch (error) {
              console.error("Failed to process image:", error);
              toast({
                title: "Image processing failed",
                description: `Failed to process ${file.name}`,
                variant: "destructive",
              });
              resolve(null);
            }
          });
        })
      );
      return products.filter(Boolean);
    },
    onSuccess: (products) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: `Created ${products.length} new products`,
      });
      setUploadedFiles([]);
      setSelectedCategory("");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setUploadedFiles(Array.from(files));
  }, []);

  const handleUpload = () => {
    if (uploadedFiles.length > 0) {
      bulkUploadMutation.mutate(uploadedFiles);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                id="bulk-upload"
                type="file"
                accept="image/*"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileSelect}
              />
              <Button variant="outline" className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Select Images
              </Button>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="flex items-center gap-4 flex-1">
                <div className="flex-1">
                  <Label htmlFor="category-select" className="text-sm font-medium mb-1 block">
                    Assign Category (Optional)
                  </Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name} (${category.defaultPrice})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={bulkUploadMutation.isPending}
                  className="flex items-center gap-2 mt-6"
                >
                  {bulkUploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create {uploadedFiles.length} Products
                </Button>
              </div>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {Array.from(uploadedFiles).map((file, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}