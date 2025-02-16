import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Cart, Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

type CartItem = {
  productId: number;
  name: string;
  image?: string;
};

export default function AdminCarts() {
  const { user } = useAuth();
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: carts = [] } = useQuery<Cart[]>({
    queryKey: ["/api/carts"],
  });

  // Function to get product image for a cart item
  const getProductImage = (productId: number): string | undefined => {
    const product = products.find(p => p.id === productId);
    return product?.images[0];
  };

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