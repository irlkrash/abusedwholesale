import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { useState } from "react";
import {
  Package,
  ShoppingBag,
  LogOut,
  PlusCircle,
  CheckCircle,
  XCircle,
  ShoppingCart,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProductCarousel } from "@/components/product-carousel";
import { BulkUpload } from "@/components/admin/bulk-upload";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product created successfully",
        description: "The new product has been added to the catalog.",
      });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: number; isAvailable: boolean }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, { isAvailable });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Abused Goods Admin</h1>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Shop
              </Button>
            </Link>
            <Link href="/admin/carts">
              <Button variant="outline" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                View Carts
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">Product Catalog</h2>
            <p className="text-muted-foreground mt-1">
              Manage your wholesale product listings
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Add Single Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Product</DialogTitle>
              </DialogHeader>
              <ProductForm
                onSubmit={(data) => createProductMutation.mutate(data)}
                isLoading={createProductMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Bulk Upload</h3>
            <BulkUpload />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Product List</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <Card key={product.id}>
                  <CardContent className="p-0">
                    <ProductCarousel images={product.images} />
                    <div className="p-6">
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        {product.description}
                      </p>
                      <div className="mt-4 flex justify-between items-center">
                        <span
                          className={`inline-flex items-center gap-1 text-sm ${
                            product.isAvailable
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {product.isAvailable ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {product.isAvailable ? "Available" : "Unavailable"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            toggleAvailabilityMutation.mutate({
                              id: product.id,
                              isAvailable: !product.isAvailable,
                            })
                          }
                        >
                          Toggle Availability
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}