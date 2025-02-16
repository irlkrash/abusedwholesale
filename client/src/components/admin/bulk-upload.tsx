import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

export function BulkUpload() {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const bulkUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const products = await Promise.all(
        files.map(async (file) => {
          return new Promise<any>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const imageData = e.target?.result as string;
                const res = await apiRequest("POST", "/api/products", {
                  name: file.name.split('.')[0],
                  description: `Product created from ${file.name}`,
                  images: [imageData],
                  isAvailable: true,
                });

                if (!res.ok) {
                  const errorData = await res.json();
                  throw new Error(errorData.message || 'Failed to create product');
                }

                resolve(await res.json());
              } catch (error) {
                reject(error);
              }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
        })
      );
      return products;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: `Created ${uploadedFiles.length} new products`,
      });
      setUploadedFiles([]);
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
                disabled={bulkUploadMutation.isPending}
              />
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={bulkUploadMutation.isPending}
              >
                <ImagePlus className="h-4 w-4" />
                Select Images
              </Button>
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploadedFiles.length === 0 || bulkUploadMutation.isPending}
              className="flex items-center gap-2"
            >
              {bulkUploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create {uploadedFiles.length} Products
            </Button>
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