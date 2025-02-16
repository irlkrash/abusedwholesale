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

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1523194258983-4ef0203f0c47",
  "https://images.unsplash.com/photo-1525383666937-f1090096ca3a",
  "https://images.unsplash.com/3/www.madebyvadim.com.jpg",
  "https://images.unsplash.com/photo-1565191262855-2e6c531f3867",
  "https://images.unsplash.com/photo-1581922730118-2c9bcc450def",
  "https://images.unsplash.com/photo-1545312981-de7f4d7cb816",
];

interface ProductFormProps {
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export function ProductForm({ onSubmit, isLoading }: ProductFormProps) {
  const form = useForm({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      description: "",
      images: [SAMPLE_IMAGES[0]], // Start with one image
      isAvailable: true,
    },
  });

  const handleAddImage = () => {
    const currentImages = form.getValues("images");
    if (currentImages.length < SAMPLE_IMAGES.length) {
      form.setValue("images", [
        ...currentImages,
        SAMPLE_IMAGES[currentImages.length],
      ]);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
            <Button
              type="button"
              variant="outline"
              onClick={handleAddImage}
              disabled={form.getValues("images").length >= SAMPLE_IMAGES.length}
            >
              Add Image
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {form.getValues("images").map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Product image ${index + 1}`}
                className="w-full h-40 object-cover rounded-lg"
              />
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </Form>
  );
}
