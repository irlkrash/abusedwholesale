import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";

export default function HomePage() {
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const pageSize = 12;

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["/api/products"],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        console.log('Fetching products...');
        const response = await apiRequest(
          "GET",
          `/api/products?page=${pageParam}&limit=${pageSize}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        console.log('Products response:', data);
        return {
          data: Array.isArray(data) ? data : [],
          nextPage: Array.isArray(data) && data.length === pageSize ? pageParam + 1 : undefined,
        };
      } catch (err) {
        console.error("Failed to fetch products:", err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log('Loading next page of products...');
          fetchNextPage();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px' // Load earlier, before reaching the very bottom
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allProducts = data?.pages?.flatMap(page => page.data) ?? [];
  console.log('Available products:', allProducts);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/">
              <img
                src="/assets/logo.png"
                alt="Abused Goods Logo"
                className="h-16 cursor-pointer"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {user?.isAdmin && (
              <Link href="/admin">
                <Button variant="outline">Admin Dashboard</Button>
              </Link>
            )}
            {!user && (
              <Link href="/auth">
                <Button variant="outline" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Login
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
                  {user?.isAdmin && (
                    <Link href="/admin">
                      <Button variant="outline" className="w-full">
                        Admin Dashboard
                      </Button>
                    </Link>
                  )}
                  {!user && (
                    <Link href="/auth">
                      <Button variant="outline" className="w-full flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Login
                      </Button>
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardContent className="p-0">
                  <div className="w-full h-48 bg-muted"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Error loading products. Please try again later.
              {error instanceof Error && <p>{error.message}</p>}
            </CardContent>
          </Card>
        ) : allProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {allProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={() => handleAddToCart(product)}
                  priority={index < 4}
                />
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div 
              ref={loadMoreRef} 
              className="h-20 flex items-center justify-center mt-8"
            >
              {isFetchingNextPage && (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              )}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No products available at the moment.
            </CardContent>
          </Card>
        )}

        <CartOverlay
          isOpen={isCartOpen}
          onOpenChange={setIsCartOpen}
          items={cartItems}
          onRemoveItem={(id) => setCartItems(cartItems.filter(item => item.id !== id))}
          onClearCart={() => setCartItems([])}
        />
      </main>
    </div>
  );
}