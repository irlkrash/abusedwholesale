import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Product, CartItem, Category } from "@shared/schema";
import { ProductCard } from "@/components/product-card";
import { CartOverlay } from "@/components/cart-overlay";
import { Button } from "@/components/ui/button";
import { Menu, ShoppingCart, LogIn, Loader2, PackageCheck, Package } from "lucide-react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Update the limit constant to match both queries
const PRODUCTS_PER_PAGE = 24;

export default function HomePage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreSoldRef = useRef<HTMLDivElement>(null);

  // Categories query with available product count
  const { data: categories = [] } = useQuery<(Category & { productCount: number })[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories?countAvailableOnly=true");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Available products query
  const {
    data: availableProductsData,
    fetchNextPage: fetchNextAvailablePage,
    hasNextPage: hasNextAvailablePage,
    isFetchingNextPage: isFetchingNextAvailablePage,
    isLoading: isLoadingAvailable,
    isError: isErrorAvailable,
    error: errorAvailable,
    refetch: refetchAvailable
  } = useInfiniteQuery({
    queryKey: ["/api/products/available", Array.from(selectedCategories)],
    queryFn: async ({ pageParam = 1 }) => {
      console.log("Fetching available products:", { pageParam, queryParams: `page=${pageParam}&limit=${PRODUCTS_PER_PAGE}&isAvailable=true` });

      const queryParams = new URLSearchParams({
        page: pageParam.toString(),
        limit: PRODUCTS_PER_PAGE.toString(),
        isAvailable: 'true'
      });

      if (selectedCategories.size > 0) {
        Array.from(selectedCategories).forEach(categoryId =>
          queryParams.append('categoryId', categoryId.toString())
        );
      }

      const response = await apiRequest(
        "GET",
        `/api/products?${queryParams.toString()}`
      );

      if (!response.ok) throw new Error('Failed to fetch available products');

      const data = await response.json();
      console.log("Available products response:", {
        pageParam,
        dataLength: data.data.length,
        hasMore: !!data.nextPage
      });
      return {
        data: Array.isArray(data.data) ? data.data : [],
        nextPage: data.data && data.data.length === PRODUCTS_PER_PAGE ? pageParam + 1 : undefined,
        lastPage: !data.data || data.data.length < PRODUCTS_PER_PAGE
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  // Sold products query
  const {
    data: soldProductsData,
    fetchNextPage: fetchNextSoldPage,
    hasNextPage: hasNextSoldPage,
    isFetchingNextPage: isFetchingNextSoldPage,
    isLoading: isLoadingSold,
    isError: isErrorSold,
    error: errorSold,
    refetch: refetchSold
  } = useInfiniteQuery({
    queryKey: ["/api/products/sold", Array.from(selectedCategories)],
    queryFn: async ({ pageParam = 1 }) => {
      console.log("Fetching sold products:", { pageParam, queryParams: `page=${pageParam}&limit=${PRODUCTS_PER_PAGE}&isAvailable=false` });

      const queryParams = new URLSearchParams({
        page: pageParam.toString(),
        limit: PRODUCTS_PER_PAGE.toString(),
        isAvailable: 'false'
      });

      if (selectedCategories.size > 0) {
        Array.from(selectedCategories).forEach(categoryId =>
          queryParams.append('categoryId', categoryId.toString())
        );
      }

      const response = await apiRequest(
        "GET",
        `/api/products?${queryParams.toString()}`
      );

      if (!response.ok) throw new Error('Failed to fetch sold products');

      const data = await response.json();
      console.log("Sold products response:", {
        pageParam,
        dataLength: data.data.length,
        hasMore: !!data.nextPage
      });
      return {
        data: Array.isArray(data.data) ? data.data : [],
        nextPage: data.data && data.data.length === PRODUCTS_PER_PAGE ? pageParam + 1 : undefined,
        lastPage: !data.data || data.data.length < PRODUCTS_PER_PAGE
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  // Extract products from query results
  const availableProducts = availableProductsData?.pages?.flatMap(page => page.data) ?? [];
  const soldProducts = soldProductsData?.pages?.flatMap(page => page.data) ?? [];

  console.log("Current product counts:", {
    available: availableProducts.length,
    sold: soldProducts.length,
    hasMoreAvailable: hasNextAvailablePage,
    hasMoreSold: hasNextSoldPage
  });

  // Update the useEffect for available products
  useEffect(() => {
    console.log("Available products pagination state changed:", { 
      hasNextPage: hasNextAvailablePage, 
      isFetching: isFetchingNextAvailablePage,
      productCount: availableProducts.length 
    });
  }, [hasNextAvailablePage, isFetchingNextAvailablePage, availableProducts.length]);

  // Update the useEffect for sold products
  useEffect(() => {
    console.log("Sold products pagination state changed:", { 
      hasNextPage: hasNextSoldPage, 
      isFetching: isFetchingNextSoldPage,
      productCount: soldProducts.length 
    });
  }, [hasNextSoldPage, isFetchingNextSoldPage, soldProducts.length]);

  // Intersection observer setup
  useEffect(() => {
    const observerAvailable = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextAvailablePage && !isFetchingNextAvailablePage) {
          console.log("Loading more available products...");
          void fetchNextAvailablePage();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const observerSold = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextSoldPage && !isFetchingNextSoldPage) {
          console.log("Loading more sold products...");
          void fetchNextSoldPage();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observerAvailable.observe(loadMoreRef.current);
    }
    if (loadMoreSoldRef.current) {
      observerSold.observe(loadMoreSoldRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observerAvailable.unobserve(loadMoreRef.current);
      }
      if (loadMoreSoldRef.current) {
        observerSold.unobserve(loadMoreSoldRef.current);
      }
      observerAvailable.disconnect();
      observerSold.disconnect();
    };
  }, [loadMoreRef.current, hasNextAvailablePage, isFetchingNextAvailablePage, fetchNextAvailablePage,
      loadMoreSoldRef.current, hasNextSoldPage, isFetchingNextSoldPage, fetchNextSoldPage]);

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
      price: String(Number(effectivePrice)),
      createdAt: new Date().toISOString()
    };

    setCartItems(prev => [...prev, cartItem]);
    toast({
      title: "Added to cart",
      description: "Item has been added to your cart.",
    });
  };

  useEffect(() => {
    void refetchAvailable();
    void refetchSold();
  }, [selectedCategories, refetchAvailable, refetchSold]);

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
            <ScrollArea className="w-full">
              <div className="flex flex-wrap gap-2 pb-4">
                {categories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategories.has(category.id) ? "default" : "secondary"}
                    className="cursor-pointer whitespace-nowrap"
                    onClick={() => toggleCategory(category.id)}
                  >
                    {category.name} ({category.productCount})
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Products Tabs */}
        <Tabs 
          defaultValue="available" 
          className="space-y-4"
          onValueChange={(value) => {
            console.log("Tab changed to:", value);
            if (value === "available") {
              console.log("Refetching available products");
              void refetchAvailable();
            } else if (value === "sold") {
              console.log("Refetching sold products");
              void refetchSold();
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="available" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Available Products
            </TabsTrigger>
            <TabsTrigger value="sold" className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              Sold Items
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            {isLoadingAvailable ? (
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
            ) : isErrorAvailable ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Error loading products. Please try again later.
                  {errorAvailable instanceof Error && <p>{errorAvailable.message}</p>}
                </CardContent>
              </Card>
            ) : availableProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {availableProducts.map((product, index) => (
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
                <div ref={loadMoreRef} className="h-24 flex items-center justify-center mt-8">
                  {isFetchingNextAvailablePage ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : hasNextAvailablePage ? (
                    <div className="text-muted-foreground text-sm">Scroll for more products</div>
                  ) : (
                    <div className="text-muted-foreground text-sm">No more products</div>
                  )}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  {selectedCategories.size > 0
                    ? "No available products found in the selected categories."
                    : "No available products found."}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sold">
            {isLoadingSold ? (
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
            ) : soldProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {soldProducts.map((product, index) => (
                    product && (
                      <ProductCard
                        key={`${product.id}-${index}`}
                        product={product}
                        onAddToCart={() => {}}
                        priority={index < 8}
                        showDetails={false}
                        disableAddToCart
                      />
                    )
                  ))}
                </div>
                <div ref={loadMoreSoldRef} className="h-24 flex items-center justify-center mt-8">
                  {isFetchingNextSoldPage ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : hasNextSoldPage ? (
                    <div className="text-muted-foreground text-sm">Scroll for more products</div>
                  ) : (
                    <div className="text-muted-foreground text-sm">No more products</div>
                  )}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No sold items to display.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

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