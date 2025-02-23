import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Product, CartItem, Category } from "@shared/schema";
import { ProductCard } from "@/components/product-card";
import { CartOverlay } from "@/components/cart-overlay";
import { Button } from "@/components/ui/button";
import { Menu, ShoppingCart, LogIn, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export default function HomePage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Update categories query to get counts
  const { data: categories = [] } = useQuery<(Category & { productCount: number })[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ["/api/products", Array.from(selectedCategories)],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const queryParams = new URLSearchParams({
          page: pageParam.toString(),
          limit: '12'
        });

        // Add category filter parameters
        if (selectedCategories.size > 0) {
          Array.from(selectedCategories).forEach(categoryId =>
            queryParams.append('categoryId', categoryId.toString())
          );
        }

        const response = await apiRequest(
          "GET",
          `/api/products?${queryParams.toString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const data = await response.json();
        return {
          data: Array.isArray(data.data) ? data.data : [],
          nextPage: data.data && data.data.length === 12 ? pageParam + 1 : undefined,
          lastPage: !data.data || data.data.length < 12
        };
      } catch (err) {
        console.error("Failed to fetch products:", err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  // Safely extract products with null checks
  const allProducts = data?.pages?.flatMap(page => page.data ?? []) ?? [];

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleAddToCart = (product: Product) => {
    if (cartItems.some(item => item.productId === product.id)) {
      toast({
        title: "Item already in cart",
        description: "This item is already in your cart.",
        variant: "destructive",
      });
      return;
    }

    // Calculate the effective price (custom price or lowest category price)
    const effectivePrice = product.customPrice ?? 
      (product.categories?.length 
        ? Math.min(...product.categories.map(cat => Number(cat.defaultPrice)))
        : 0);

    const cartItem: CartItem = {
      productId: product.id,
      name: product.name,
      description: product.description,
      images: product.images,
      fullImages: product.fullImages || [],
      isAvailable: product.isAvailable,
      price: String(Math.round(Number(effectivePrice))), // Convert to string after rounding
      createdAt: new Date().toISOString()
    };

    setCartItems(prev => [...prev, cartItem]);
    toast({
      title: "Added to cart",
      description: "Item has been added to your cart.",
    });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
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
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Effect to refetch when categories change
  useEffect(() => {
    void refetch();
  }, [selectedCategories, refetch]);

  const NavMenu = () => (
    <>
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
    </>
  );

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

          <div className="hidden md:flex items-center gap-4">
            <NavMenu />
          </div>

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
                  <NavMenu />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Categories Section */}
        {categories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Categories</h2>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-4">
                {categories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategories.has(category.id) ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(category.id)}
                  >
                    {category.name} ({category.productCount})
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {allProducts.map((product, index) => (
                product && (
                  <ProductCard
                    key={`${product.id}-${index}`}
                    product={product}
                    onAddToCart={() => handleAddToCart(product)}
                    priority={index < 8}
                    showDetails={false}
                  />
                )
              ))}
            </div>

            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
              {isFetchingNextPage && (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              )}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {selectedCategories.size > 0
                ? "No products found in the selected categories."
                : "No products available."}
            </CardContent>
          </Card>
        )}

        <CartOverlay
          isOpen={isCartOpen}
          onOpenChange={setIsCartOpen}
          items={cartItems}
          onRemoveItem={(id) => setCartItems(items => items.filter(item => item.productId !== id))}
          onClearCart={() => setCartItems([])}
        />
      </main>
    </div>
  );
}