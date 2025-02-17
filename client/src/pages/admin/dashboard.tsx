import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Product, Category } from "@shared/schema";
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
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCategorySchema } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label"; // Added import


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
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false); // Added state
  const [bulkEditValue, setBulkEditValue] = useState({ name: "", description: "" }); // Added state
  const [hideDetails, setHideDetails] = useState(false); // Added state

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ["/api/products", selectedCategoryFilter],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const queryParams = new URLSearchParams({
          page: pageParam.toString(),
          limit: '12',
          sort: 'createdAt:desc'
        });
        
        const response = await apiRequest(
          "GET",
          `/api/products?${queryParams.toString()}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const products = await response.json();
        return {
          data: Array.isArray(products) ? products : [],
          nextPage: Array.isArray(products) && products.length === 12 ? pageParam + 1 : undefined,
          lastPage: Array.isArray(products) && products.length < 12
        };
      } catch (err) {
        console.error("Failed to fetch products:", err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.lastPage ? undefined : lastPage.nextPage,
  });

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, selectedCategoryFilter]);

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
      clearSelection();
    } else {
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

  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
  } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      const res = await apiRequest("DELETE", `/api/categories/${categoryId}`);
      if (!res.ok) throw new Error('Failed to delete category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Category deleted",
        description: "The category has been removed.",
      });
      if (selectedCategoryFilter) {
        setSelectedCategoryFilter(null);
      }
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Category created",
        description: "The new category has been added.",
      });
      setIsCreateCategoryDialogOpen(false);
    },
  });

  const assignCategoriesMutation = useMutation({
    mutationFn: async ({ productIds, categoryIds }: { productIds: number[], categoryIds: number[] }) => {
      const results = await Promise.all(
        productIds.map(id =>
          apiRequest("PUT", `/api/products/${id}/categories`, { categoryIds })
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Categories assigned",
        description: "The selected products have been updated with new categories.",
      });
      clearSelection();
    },
  });

  const CategoryDialog = () => {
    const form = useForm({
      resolver: zodResolver(insertCategorySchema),
      defaultValues: {
        name: "",
      },
    });

    const onSubmit = useCallback(async (data: { name: string }) => {
      await createCategoryMutation.mutateAsync(data);
    }, [createCategoryMutation]);

    return (
      <Dialog open={isCreateCategoryDialogOpen} onOpenChange={setIsCreateCategoryDialogOpen}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add Category
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  };

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

  const BulkCategoryAssignment = () => {
    const [categoriesToAssign, setCategoriesToAssign] = useState<number[]>([]);

    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {categories.map((category: Category) => (
            <Button
              key={category.id}
              variant={categoriesToAssign.includes(category.id) ? "default" : "outline"}
              onClick={() => {
                setCategoriesToAssign(prev =>
                  prev.includes(category.id)
                    ? prev.filter(id => id !== category.id)
                    : [...prev, category.id]
                );
              }}
              className="h-8"
            >
              {category.name}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => {
            if (categoriesToAssign.length > 0) {
              assignCategoriesMutation.mutate({
                productIds: Array.from(selectedProducts),
                categoryIds: categoriesToAssign,
              });
            }
          }}
          disabled={assignCategoriesMutation.isPending || categoriesToAssign.length === 0}
        >
          {assignCategoriesMutation.isPending ? "Assigning..." : "Assign Categories"}
        </Button>
      </div>
    );
  };

  const filteredProducts = selectedCategoryFilter
    ? products.filter(product =>
        product.categories?.some((category: Category) => category.id === selectedCategoryFilter)
      )
    : products;

  // Add load more trigger div at the bottom
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentRef = loadMoreTriggerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, selectedCategoryFilter]);

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
                <Button
                  variant="outline"
                  onClick={() => setBulkEditMode(!bulkEditMode)}
                >
                  {bulkEditMode ? "Cancel Bulk Edit" : "Bulk Edit"}
                </Button>
                {bulkEditMode && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>Apply Bulk Edit</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Bulk Edit Products</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name Prefix</Label>
                          <Input
                            value={bulkEditValue.name}
                            onChange={(e) => setBulkEditValue(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="New name prefix..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={bulkEditValue.description}
                            onChange={(e) => setBulkEditValue(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="New description..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={async () => {
                          try {
                            await Promise.all(
                              Array.from(selectedProducts).map(id =>
                                updateProductMutation.mutateAsync({
                                  id,
                                  data: {
                                    name: bulkEditValue.name ? `${bulkEditValue.name} ${id}` : undefined,
                                    description: bulkEditValue.description || undefined,
                                  }
                                })
                              )
                            );
                            setBulkEditMode(false);
                            setBulkEditValue({ name: '', description: '' });
                            clearSelection();
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: "Failed to update products",
                              variant: "destructive",
                            });
                          }
                        }}>
                          Apply Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <Button
                  variant="outline"
                  onClick={() => setHideDetails(!hideDetails)}
                >
                  {hideDetails ? "Show Details" : "Hide Details"}
                </Button>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Bulk Category Assignment</h3>
                    <Button
                      variant="outline"
                      onClick={() => {
                        assignCategoriesMutation.mutate({
                          productIds: Array.from(selectedProducts),
                          categoryIds: [], // Pass empty array to remove all categories
                        });
                      }}
                      disabled={assignCategoriesMutation.isPending}
                    >
                      Remove All Categories
                    </Button>
                  </div>
                  <BulkCategoryAssignment />
                </div>
              </>
            )}
            <CategoryDialog />
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
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Categories</h3>
              <Select
                value={selectedCategoryFilter?.toString() || "all"}
                onValueChange={(value) =>
                  setSelectedCategoryFilter(value === "all" ? null : parseInt(value))
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category: Category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((category: Category) => (
                <Card
                  key={category.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedCategoryFilter === category.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                >
                  <CardHeader className="p-0">
                    <div className="flex justify-between items-center">
                      <CardTitle 
                        className="text-base cursor-pointer" 
                        onClick={() =>
                          setSelectedCategoryFilter(
                            selectedCategoryFilter === category.id ? null : category.id
                          )
                        }
                      >
                        {category.name}
                      </CardTitle>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Category</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{category.name}"? This will remove all associations with products.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCategoryMutation.mutate(category.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>


          <div className="space-y-4">
            <h3 className="text-lg font-medium">Bulk Upload</h3>
            <BulkUpload />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              Product List
              {selectedCategoryFilter && (
                <Badge variant="outline" className="ml-2">
                  Filtered by category: {categories.find(c => c.id === selectedCategoryFilter)?.name}
                </Badge>
              )}
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : isError ? (
              <div>Error: {error?.message}</div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product, index) => (
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
                        <p className="text-sm text-muted-foreground mt-2" style={{ display: hideDetails ? 'none' : 'block' }}>
                          {product.description}
                        </p>
                        {product.categories && product.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2" style={{ display: hideDetails ? 'none' : 'block' }}>
                            {product.categories.map((category: Category) => (
                              <Badge
                                key={category.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                {category.name}
                              </Badge>
                            ))}
                          </div>
                        )}
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
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No products available.
                </CardContent>
              </Card>
            )}
            {(isFetchingNextPage || isLoading) && (
              <div className="col-span-full flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <div ref={loadMoreTriggerRef} className="h-1" />
          </div>
        </div>
      </main>
    </div>
  );
}