import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Package,
  ShoppingBag,
  LogOut,
  PlusCircle,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Edit,
  Trash2,
  Menu,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProductCarousel } from "@/components/product-carousel";
import { BulkUpload } from "@/components/admin/bulk-upload";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogAction,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHeader2,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ProductsResponse {
  data: Product[];
  nextPage: number | undefined;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ["/api/products"],
    queryFn: async ({ pageParam }) => {
      try {
        const response = await apiRequest(
          "GET",
          `/api/products?page=${pageParam || 1}&limit=12`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const products = await response.json();
        return {
          data: Array.isArray(products) ? products : [],
          nextPage: Array.isArray(products) && products.length === 12 ? (pageParam || 1) + 1 : undefined,
        };
      } catch (err) {
        console.error("Failed to fetch products:", err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const products = data?.pages?.flatMap(page => page.data) ?? [];

  const toggleSelection = (productId: number) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      // If all are selected, deselect all
      clearSelection();
    } else {
      // Select all products
      const allProductIds = products.map(product => product.id);
      setSelectedProducts(new Set(allProductIds));
    }
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product created successfully",
        description: "The new product has been added to the catalog.",
      });
      setIsCreateDialogOpen(false);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product updated successfully",
        description: "The product has been updated.",
      });
      setEditingProduct(null);
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ ids, isAvailable }: { ids: number[]; isAvailable: boolean }) => {
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        batches.push(ids.slice(i, i + batchSize));
      }

      const results = [];
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(id =>
            apiRequest("PATCH", `/api/products/${id}`, { isAvailable })
              .then(res => res.json())
              .catch(error => ({ error, id }))
          )
        );
        results.push(...batchResults);
      }
      return results;
    },
    onMutate: async ({ ids, isAvailable }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/products"] });
      const previousProducts = queryClient.getQueryData<Product[]>(["/api/products"]);
      queryClient.setQueryData<Product[]>(["/api/products"], old => {
        if (!old) return [];
        return old.map(product => {
          if (ids.includes(product.id)) {
            return { ...product, isAvailable };
          }
          return product;
        });
      });
      return { previousProducts };
    },
    onError: (err, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(["/api/products"], context.previousProducts);
      }
      toast({
        title: "Error updating products",
        description: "Failed to update product availability",
        variant: "destructive",
      });
    },
    onSuccess: (results) => {
      const errors = results.filter(r => 'error' in r);
      if (errors.length > 0) {
        toast({
          title: "Some updates failed",
          description: `${errors.length} product(s) failed to update`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Products updated",
          description: "The selected products have been updated.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      clearSelection();
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < productIds.length; i += batchSize) {
        batches.push(productIds.slice(i, i + batchSize));
      }

      const results = [];
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(id =>
            apiRequest("DELETE", `/api/products/${id}`)
              .then(() => ({ success: true, id }))
              .catch(error => ({ error, id }))
          )
        );
        results.push(...batchResults);
      }
      const errors = results.filter(r => 'error' in r);
      if (errors.length > 0) {
        throw new Error(`Failed to delete ${errors.length} products`);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Products deleted",
        description: "The selected products have been removed from the catalog.",
      });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting products",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const NavLinks = () => (
    <>
      <Link href="/">
        <Button variant="outline" className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          Shop
        </Button>
      </Link>
      <Link href="/admin/carts">
        <Button variant="outline" className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          View Carts
        </Button>
      </Link>
      <Button
        variant="ghost"
        onClick={() => logoutMutation.mutate()}
        className="flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Logout
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
            <span className="ml-2 text-xl font-semibold">Admin</span>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <NavLinks />
          </div>

          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader2>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader2>
                <div className="flex flex-col gap-4 mt-4">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold">Product Catalog</h2>
            <p className="text-muted-foreground mt-1">
              Manage your wholesale product listings
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {products.length > 0 && (
              <Button
                variant="outline"
                onClick={toggleSelectAll}
                className="flex items-center gap-2"
              >
                {selectedProducts.size === products.length ? (
                  <>Deselect All</>
                ) : (
                  <>Select All</>
                )}
              </Button>
            )}
            {selectedProducts.size > 0 && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete Selected ({selectedProducts.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Products</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedProducts.size} products? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProductMutation.mutate(Array.from(selectedProducts))}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="outline"
                  onClick={() =>
                    toggleAvailabilityMutation.mutate({
                      ids: Array.from(selectedProducts),
                      isAvailable: true,
                    })
                  }
                >
                  Make Available
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    toggleAvailabilityMutation.mutate({
                      ids: Array.from(selectedProducts),
                      isAvailable: false,
                    })
                  }
                >
                  Make Unavailable
                </Button>
                <Button variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </>
            )}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Add Single Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Product</DialogTitle>
                </DialogHeader>
                <ProductForm
                  onSubmit={(data) => createProductMutation.mutate(data)}
                  isLoading={createProductMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Bulk Upload</h3>
            <BulkUpload />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Product List</h3>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : isError ? (
              <div>Error: {error?.message}</div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {products.map((product, index) => (
                    <Card
                      key={product.id}
                      className={`overflow-hidden ${
                        selectedProducts.has(product.id) ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardContent className="p-0">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm"
                            onClick={() => toggleSelection(product.id)}
                          >
                            {selectedProducts.has(product.id) ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </Button>
                          <ProductCarousel
                            images={product.images}
                            priority={index < 4}
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold">{product.name}</h3>
                          <p className="text-sm text-muted-foreground mt-2">
                            {product.description}
                          </p>
                          <div className="mt-4 flex justify-between items-center">
                            <span
                              className={`inline-flex items-center gap-1 text-sm ${
                                product.isAvailable
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {product.isAvailable ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              {product.isAvailable ? "Available" : "Unavailable"}
                            </span>
                            <div className="flex gap-2">
                              <Dialog
                                open={editingProduct?.id === product.id}
                                onOpenChange={(open) => !open && setEditingProduct(null)}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                    onClick={() => setEditingProduct(product)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Edit Product</DialogTitle>
                                  </DialogHeader>
                                  <ProductForm
                                    initialData={product}
                                    onSubmit={(data) =>
                                      updateProductMutation.mutate({
                                        id: product.id,
                                        data,
                                      })
                                    }
                                    isLoading={updateProductMutation.isPending}
                                  />
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {hasNextPage && (
                  <div 
                    ref={loadMoreRef} 
                    className="h-20 flex items-center justify-center mt-8"
                  >
                    {isFetchingNextPage && (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No products available.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}