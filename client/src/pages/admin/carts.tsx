import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Cart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, Trash2, Loader2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

const AdminCarts = () => {
  const { user } = useAuth();
  const { toast } = useToast();

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

  if (!user.isAdmin) {
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

  const sortedCarts = [...carts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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
              const cartTotal = cart.items.reduce((sum, item) => 
                sum + Math.round(Number(item.price || 0)), 0
              );

              return (
                <Card key={cart.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-xl">Cart #{cart.id}</CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                          Customer: {cart.customerName} | {format(new Date(cart.createdAt), "PPp")}
                        </div>
                      </div>
                      <div className="text-xl font-bold">
                        Total: ${cartTotal}
                      </div>
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
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {cart.items.map((item) => {
                        const itemPrice = Math.round(Number(item.price || 0));
                        return (
                          <div
                            key={item.id}
                            className="flex justify-between items-center p-2 rounded-lg border"
                          >
                            <div className="font-semibold">${itemPrice}</div>
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
    </div>
  );
};

export default AdminCarts;