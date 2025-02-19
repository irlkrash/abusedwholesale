import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo, useEffect } from "react";
import { ImageViewer } from "@/components/image-viewer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Cart, Product, CartItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ShoppingCart, ArrowLeft, Trash2, Loader2, AlertCircle } from "lucide-react";
import { ProductCarousel } from "@/components/product-carousel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

const AdminCarts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/products");
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      return data;
    },
    refetchInterval: 1000,
    staleTime: 0,
    cacheTime: 0,
  });

  useEffect(() => {
    if (products.length > 0) {
      console.log('Products loaded:', products.length);
    }
  }, [products]);

  const productsMap = useMemo(() => {
    if (!Array.isArray(products)) return new Map();
    const map = new Map(products.map(product => [product.id, product]));
    return map;
  }, [products]);

  const { data: carts = [], isLoading: cartsLoading, error: cartsError } = useQuery<Cart[]>({
    queryKey: ["/api/carts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/carts");
      if (!response.ok) throw new Error('Failed to fetch carts');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000,
    refetchInterval: 5000,
  });

  const sortedCarts = useMemo(() =>
    [...carts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [carts]
  );

  const deleteCartMutation = useMutation({
    mutationFn: async (cartId: number) => {
      const response = await apiRequest("DELETE", `/api/carts/${cartId}`);
      if (!response.ok) throw new Error('Failed to delete cart');
    },
    onSuccess: (_, cartId) => {
      queryClient.setQueryData<Cart[]>(["/api/carts"], (old) =>
        old?.filter(cart => cart.id !== cartId) ?? []
      );
      toast({
        title: "Cart deleted",
        description: "The cart has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete cart",
        variant: "destructive",
      });
    },
  });

  const makeItemsUnavailableMutation = useMutation({
    mutationFn: async (cartId: number) => {
      const response = await apiRequest("POST", `/api/carts/${cartId}/make-items-unavailable`);
      if (!response.ok) {
        throw new Error('Failed to update items');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      toast({
        title: "Items marked unavailable",
        description: "All items in the cart have been marked as unavailable.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update items. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (cartsLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (cartsError || productsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Error Loading Data</h2>
        <p className="text-muted-foreground">
          {cartsError ? "Failed to load cart data." : "Failed to load product data."}
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You need admin privileges to view this page.</p>
        <Link href="/">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <img
                src="/assets/logo.png"
                alt="Abused Goods Logo"
                className="h-12 cursor-pointer"
              />
            </Link>
            <span className="text-lg font-medium">Cart Management</span>
          </div>
          <Link href="/admin">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {sortedCarts.length > 0 ? (
            sortedCarts.map((cart) => {
              const cartItems = cart.items as CartItem[];
              return (
                <Card key={cart.id} className="overflow-hidden">
                  <CardHeader className="space-y-0 pb-4">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">Cart #{cart.id}</CardTitle>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(cart.createdAt), "PPp")}
                          </span>
                        </div>
                        <CardDescription>
                          Customer: {cart.customerName} ({cart.customerEmail})
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Make Unavailable
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Make Items Unavailable</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will mark all items in this cart as unavailable in the store.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => makeItemsUnavailableMutation.mutate(cart.id)}
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Cart</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this cart?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCartMutation.mutate(cart.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="grid gap-4">
                        {cartItems.map((item, index) => {
                          const product = productsMap.get(item.productId);
                          const images = (() => {
                            if (!product || !Array.isArray(product.images)) {
                              return item.image ? [item.image] : [];
                            }
                            return product.images;
                          })();

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                            >
                              <div className="relative w-24 h-24 overflow-hidden rounded-md border bg-muted">
                                {images.length > 0 ? (
                                  <ProductCarousel
                                    images={images}
                                    onImageClick={(image) => setSelectedImage(image)}
                                    priority={index < 2}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-full h-full bg-muted">
                                    <span className="text-xs text-muted-foreground">No image</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Product ID: {item.productId}
                                </p>
                                {product && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Status: {product.isAvailable ? 'Available' : 'Unavailable'}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No carts have been created yet.
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {selectedImage && (
        <ImageViewer
          src={selectedImage}
          alt="Product image"
          isOpen={!!selectedImage}
          onOpenChange={(open) => !open && setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default AdminCarts;