import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Cart } from "@shared/schema";
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

export default function AdminCarts() {
  const { user } = useAuth();

  const { data: carts = [] } = useQuery<Cart[]>({
    queryKey: ["/api/carts"],
  });

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
                    <div className="space-y-2">
                      {Array.isArray(cart.items) &&
                        cart.items.map((item: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            <span>{item.name}</span>
                          </div>
                        ))}
                    </div>
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
