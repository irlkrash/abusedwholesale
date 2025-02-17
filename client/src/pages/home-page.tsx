import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { ProductCard } from "@/components/product-card";
import { CartOverlay } from "@/components/cart-overlay";
import { Button } from "@/components/ui/button";
import { Menu, ShoppingCart, LogIn, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient"; // Fixed import path


export default function HomePage() {
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    data: products = [],
    isLoading,
    isError,
    error
  } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/products");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Failed to fetch products:", err);
        throw err;
      }
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleAddToCart = (product: Product) => {
    if (cartItems.some(item => item.id === product.id)) {
      toast({
        title: "Item already in cart",
        description: "This item is already in your cart.",
        variant: "destructive",
      });
      return;
    }
    setCartItems([...cartItems, product]);
    toast({
      title: "Added to cart",
      description: "Item has been added to your cart.",
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setCartItems(cartItems.filter(item => item.id !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const NavLinks = () => (
    <>
      {user?.isAdmin ? (
        <Link href="/admin">
          <Button variant="outline">Admin Dashboard</Button>
        </Link>
      ) : (
        <Link href="/auth">
          <Button variant="outline" className="flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            Login / Register
          </Button>
        </Link>
      )}
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setIsCartOpen(true)}
      >
        <ShoppingCart className="h-4 w-4" />
        Cart ({cartItems.length})
      </Button>
    </>
  );

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
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <NavLinks />
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center gap-4">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              {cartItems.length}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-4">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Error loading products. Please try again later. {error?.message}
            </CardContent>
          </Card>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((product: Product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={() => handleAddToCart(product)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No products available.
            </CardContent>
          </Card>
        )}

        <CartOverlay
          isOpen={isCartOpen}
          onOpenChange={setIsCartOpen}
          items={cartItems}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={handleClearCart}
        />
      </main>
    </div>
  );
}