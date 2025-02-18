import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Order } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Package, ArrowLeft } from "lucide-react";
import { ProductCarousel } from "@/components/product-carousel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Product } from "@shared/schema";
import { useMemo } from "react";

export default function AdminOrders() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    initialData: [],
  });

  const productsMap = useMemo(() => {
    if (!Array.isArray(products)) return new Map();
    return new Map(products.map(product => [product.id, product]));
  }, [products]);

  const isLoading = ordersLoading || productsLoading;

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order status updated",
        description: "The order status has been successfully updated.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span>Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/">
              <img
                src="/assets/logo.png"
                alt="Abused Goods Logo"
                className="h-12 cursor-pointer"
              />
            </Link>
            <h1 className="text-2xl font-bold ml-2">Order Management</h1>
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
          {orders && orders.length > 0 ? (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Order #{order.id}</CardTitle>
                      <CardDescription>
                        Placed on {format(new Date(order.createdAt), "PPP")}
                      </CardDescription>
                    </div>
                    <Select
                      defaultValue={order.status}
                      onValueChange={(value) =>
                        updateOrderStatusMutation.mutate({
                          id: order.id,
                          status: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Order Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Customer Information</h3>
                      <p className="text-sm text-muted-foreground">
                        {order.customerName} ({order.customerEmail})
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Order Items</h3>
                      <div className="space-y-2">
                        {order.items && Array.isArray(order.items) &&
                          order.items.map((item: any, index: number) => {
                            const product = productsMap.get(item.productId);
                            const productImages = product?.images || [];
                            return (
                              <div
                                key={index}
                                className="flex items-center gap-4 text-sm"
                              >
                                <div className="relative w-12 h-12 overflow-hidden rounded-md border bg-muted">
                                  {productImages && productImages.length > 0 ? (
                                    <ProductCarousel
                                      images={productImages}
                                      onImageClick={() => {}}
                                      priority={index < 2}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                      <Package className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <span className="flex-1">{item.name}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No orders have been placed yet.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}