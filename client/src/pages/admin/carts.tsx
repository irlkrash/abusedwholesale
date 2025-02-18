import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { ImageViewer } from "@/components/image-viewer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Cart, Product, CartItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ShoppingCart, ArrowLeft, Trash2, Loader2, AlertCircle } from "lucide-react";
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

  // Fetch products with proper error handling
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/products");
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    initialData: [], // Provide initial empty array
  });

  // Create a products lookup map for efficient access
  const productsMap = useMemo(() => {
    const products = Array.isArray(productsData) ? productsData : [];
    return new Map(products.map(product => [product.id, product]));
  }, [productsData]);

  // Fetch carts
  const { data: carts = [], isLoading: cartsLoading, error: cartsError } = useQuery<Cart[]>({
    queryKey: ["/api/carts"],
    staleTime: 1000,
    refetchInterval: 5000,
  });

  const deleteCartMutation = useMutation({
    mutationFn: async (cartId: number) => {
      const response = await apiRequest("DELETE", `/api/carts/${cartId}`);
      if (!response.ok) {
        throw new Error('Failed to delete cart');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      toast({
        title: "Cart deleted",
        description: "The cart has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete cart. Please try again.",
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
          {carts.length > 0 ? (
            carts.map((cart) => {
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
                          const productImage = product?.images?.[0];

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                            >
                              <div
                                className="relative w-24 h-24 overflow-hidden rounded-md border bg-muted cursor-pointer"
                                onClick={() => productImage && setSelectedImage(productImage)}
                              >
                                {productImage ? (
                                  <img
                                    src={productImage}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                                    No image
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