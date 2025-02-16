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
import { useCallback, useState } from "react";
import { ImagePlus, X } from "lucide-react";

interface ProductFormProps {
  onSubmit: (data: any) => void;
  isLoading?: boolean;
  initialImages?: string[];
}

export function ProductForm({ onSubmit, isLoading, initialImages = [] }: ProductFormProps) {
  const [uploadedImages, setUploadedImages] = useState<string[]>(initialImages);

  const form = useForm({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      description: "",
      images: initialImages,
      isAvailable: true,
    },
  });

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImages(prev => [...prev, result]);
        // Update the form value after setting the state
        const updatedImages = [...uploadedImages, result];
        form.setValue("images", updatedImages, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    });
  }, [uploadedImages, form]);

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    form.setValue("images", newImages, { shouldValidate: true });
  };

  const handleSubmit = form.handleSubmit((data) => {
    // Ensure images are included in the form data
    const formData = {
      ...data,
      images: uploadedImages,
    };
    onSubmit(formData);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
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
            <FormItem>
              <FormControl>
                <div className="flex items-center gap-2">
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" className="flex items-center gap-2">
                      <ImagePlus className="h-4 w-4" />
                      Add Images
                    </Button>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              </FormControl>
            </FormItem>
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

        {form.formState.errors.images && (
          <p className="text-sm text-destructive">
            {form.formState.errors.images.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading || uploadedImages.length === 0}>
          {isLoading ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </Form>
  );
}