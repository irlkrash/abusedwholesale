import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { ImageViewer } from "@/components/image-viewer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Cart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, Trash2, Loader2, AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge"; // Added import for Badge component

const AdminCarts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: carts = [], isLoading: cartsLoading, error: cartsError } = useQuery<Cart[]>({
    queryKey: ["/api/carts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/carts");
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch carts');
      }
      const data = await response.json();
      return Array.isArray(data.data) ? data.data : [];
    },
  });

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

  const removeItemMutation = useMutation({
    mutationFn: async ({ cartId, itemId }: { cartId: number; itemId: number }) => {
      const response = await apiRequest("DELETE", `/api/carts/${cartId}/items/${itemId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove item");
      }
    },
    onSuccess: () => {
      // Force refetch all carts to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      toast({
        title: "Item removed",
        description: "The item has been successfully removed from the cart.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove item",
        variant: "destructive",
      });
    },
  });


  if (!user) {
    return null;
  }

  if (cartsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (cartsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Error Loading Data</h2>
        <p className="text-muted-foreground">Failed to load cart data.</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  const sortedCarts = [...carts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <img src="/assets/logo.png" alt="Abused Goods Logo" className="h-12 cursor-pointer" />
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
              // Calculate total price from stored prices
              const cartTotal = cart.items.reduce((sum, item) => {
                const itemPrice = typeof item.price === 'number' ? Math.floor(item.price) : 0;
                return sum + itemPrice;
              }, 0);

              return (
                <Card key={cart.id} className="overflow-hidden">
                  <CardHeader className="space-y-0 pb-4">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                          Cart #{cart.id} - ${cartTotal}
                          <span className="text-base font-normal text-muted-foreground">
                            • {cart.customerName}
                          </span>
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(cart.createdAt), "PPp")}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            const totalItems = cart.items.length;

                            // Show toast with item count
                            toast({
                              title: "Updating Products",
                              description: `Marking ${totalItems} products as unavailable...`,
                            });

                            // Show loading toast to indicate lengthy operation
                            const loadingToast = toast({
                              title: "Processing Request",
                              description: "This may take a moment for large carts...",
                              duration: 30000, // 30 seconds
                            });

                            apiRequest("POST", `/api/carts/${cart.id}/make-items-unavailable`, {}, 120000) // 2 minute timeout
                              .then(async (response) => {
                                // Dismiss the loading toast
                                if (loadingToast) {
                                  toast.dismiss(loadingToast);
                                }

                                if (!response.ok) {
                                  const errorData = await response.json();
                                  throw new Error(errorData.message || "Failed to update products");
                                }
                                return response.json();
                              })
                              .then((data) => {
                                // Force refetch both queries to ensure UI is updated
                                queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/carts"] });

                                // Show success message with details
                                const failedCount = data.failedProducts ? data.failedProducts.length : 0;
                                const successCount = data.updatedProducts ? data.updatedProducts.length : 0;

                                if (failedCount > 0) {
                                  toast({
                                    title: "Products Updated",
                                    description: `${successCount} products marked as unavailable. ${failedCount} products failed to update.`,
                                    variant: "default",
                                    duration: 5000,
                                  });
                                } else {
                                  toast({
                                    title: "Products Updated",
                                    description: `${successCount} products marked as unavailable`,
                                  });
                                }
                              })
                              .catch((error) => {
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to update products",
                                  variant: "destructive",
                                });
                              });
                          }}
                        >
                          Make Unavailable
                        </Button>
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
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {cart.items.map((item, index) => {
                        const itemPrice = typeof item.price === 'number' ? Math.floor(item.price) : 0;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center space-x-4 p-2 rounded-lg border bg-card"
                          >
                            <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                              {item.images && item.images.length > 0 ? (
                                <ProductCarousel
                                  images={item.images}
                                  onImageClick={(image) => setSelectedImage(image)}
                                  priority={index < 6}
                                />
                              ) : (
                                <div className="flex items-center justify-center w-full h-full bg-muted">
                                  <span className="text-xs text-muted-foreground">No image</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-lg font-semibold">${itemPrice}</span>
                                <span className="text-xs text-muted-foreground">
                                  <Badge variant={item.isAvailable ? "default" : "destructive"}>
                                    {item.isAvailable ? "Available" : "Unavailable"}
                                  </Badge>
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeItemMutation.mutate({cartId: cart.id, itemId: item.id})}
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
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