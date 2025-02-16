import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Cart, Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ShoppingCart, ArrowLeft, Trash2 } from "lucide-react";
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

type CartItem = {
  productId: number;
  name: string;
  image?: string;
};

export default function AdminCarts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: carts = [], isError } = useQuery<Cart[]>({
    queryKey: ["/api/carts"],
    onError: (error: Error) => {
      toast({
        title: "Error loading carts",
        description: error.message,
        variant: "destructive",
      });
    },
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
    onError: (error: Error) => {
      toast({
        title: "Error deleting cart",
        description: error.message,
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
    onError: (error: Error) => {
      toast({
        title: "Error updating items",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to get product image for a cart item
  const getProductImage = (productId: number): string | undefined => {
    const product = products.find(p => p.id === productId);
    return product?.images[0];
  };

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Cart Management</h1>
            <Link href="/admin">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                Error loading carts. Please try again later.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src="/assets/logo.png"
              alt="Abused Goods Logo" 
              className="h-16"
            />
            <span className="ml-2 text-xl font-semibold">Cart Management</span>
          </div>
          <Link href="/admin">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {carts.map((cart) => (
            <Card key={cart.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Cart #{cart.id}</CardTitle>
                    <CardDescription>
                      Created on {format(new Date(cart.createdAt), "PPP")}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Make Items Unavailable
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Make Items Unavailable</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to mark all items in this cart as unavailable? This will affect the products' availability in the store.
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
                            Are you sure you want to delete this cart? This action cannot be undone.
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
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Customer Information</h3>
                    <p className="text-sm text-muted-foreground">
                      {cart.customerName} ({cart.customerEmail})
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Cart Items</h3>
                    <ScrollArea className="h-[300px] w-full">
                      <div className="space-y-4">
                        {Array.isArray(cart.items) &&
                          (cart.items as CartItem[]).map((item, index) => {
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
                                    Product ID: {item.productId}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {carts.length === 0 && (
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