import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Cart, Product, CartItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ShoppingCart, ArrowLeft, Trash2, Loader2 } from "lucide-react";
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

export default function AdminCarts() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    initialData: [],
  });

  const { data: carts = [], isLoading } = useQuery<Cart[]>({
    queryKey: ["/api/carts"],
    initialData: [],
  });

  const deleteCartMutation = useMutation({
    mutationFn: async (cartId: number) => {
      await apiRequest("DELETE", `/api/carts/${cartId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      toast({
        title: "Cart deleted",
        description: "The cart has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting cart",
        description: "Failed to delete the cart. Please try again.",
        variant: "destructive",
      });
    },
  });

  const makeItemsUnavailableMutation = useMutation({
    mutationFn: async (cartId: number) => {
      await apiRequest("POST", `/api/carts/${cartId}/make-items-unavailable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      toast({
        title: "Items marked unavailable",
        description: "All items in the cart have been marked as unavailable.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating items",
        description: "Failed to mark items as unavailable. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getProductImage = (productId: number): string | undefined => {
    const product = products.find(p => p.id === productId);
    return product?.images[0];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
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
                          const image = getProductImage(item.productId);
                          return (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-2 rounded-lg border"
                            >
                              {image && (
                                <img
                                  src={image}
                                  alt={item.name}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  ID: {item.productId}
                                </p>
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
    </div>
  );
}