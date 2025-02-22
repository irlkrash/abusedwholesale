import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Product, Category } from "@shared/schema";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ShoppingBag,
  LogOut,
  PlusCircle,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";


interface ProductsResponse {
  data: Product[];
  nextPage: number | undefined;
  lastPage: boolean;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditValue, setBulkEditValue] = useState({ name: "", description: "" });
  const [hideDetails, setHideDetails] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<number[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ["/api/products", categoryFilter, sortOrder],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const queryParams = new URLSearchParams({
          page: pageParam.toString(),
          limit: '12',
          sort: `createdAt:${sortOrder}`
        });

        if (categoryFilter.length > 0) {
          categoryFilter.forEach(id => queryParams.append('categories', id.toString()));
        }

        const response = await apiRequest(
          "GET",
          `/api/products?${queryParams.toString()}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const products = await response.json();
        return {
          data: Array.isArray(products.data) ? products.data : [],
          nextPage: products.data && products.data.length === 12 ? pageParam + 1 : undefined,
          lastPage: !products.data || products.data.length < 12
        };
      } catch (err) {
        console.error("Failed to fetch products:", err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const { data: categories = [], refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; defaultPrice: number }) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Category created",
        description: "New category has been added.",
      });
      setNewCategoryName("");
      setNewCategoryPrice("0");
      refetchCategories();
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Category deleted",
        description: "The category has been removed.",
      });
      refetchCategories();
    },
  });

  const updateProductCategoriesMutation = useMutation({
    mutationFn: async ({ productIds, categoryIds }: { productIds: number[]; categoryIds: number[] }) => {
      const results = await Promise.all(
        productIds.map(id =>
          apiRequest("PATCH", `/api/products/${id}`, { categories: categoryIds })
            .then(res => res.json())
            .catch(error => ({ error, id }))
        )
      );
      const errors = results.filter(r => 'error' in r);
      if (errors.length > 0) {
        throw new Error(`Failed to update categories for ${errors.length} products`);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Categories updated",
        description: "Product categories have been updated successfully.",
      });
      clearSelection();
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

  const BulkCategoryActions = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          Update Categories
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Categories</Label>
            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories(prev => [...prev, category.id]);
                        } else {
                          setSelectedCategories(prev =>
                            prev.filter(id => id !== category.id)
                          );
                        }
                      }}
                    />
                    <Label>{category.name}</Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              updateProductCategoriesMutation.mutate({
                productIds: Array.from(selectedProducts),
                categoryIds: selectedCategories,
              })
            }
          >
            Update Categories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const CategoryManagement = () => {
    const [formState, setFormState] = useState({ name: "", price: "0" });

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState(prev => ({ ...prev, name: e.target.value }));
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState(prev => ({ ...prev, price: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        const name = formState.name.trim();
        const price = parseFloat(formState.price);

        if (!name) {
          toast({
            title: "Error",
            description: "Category name is required",
            variant: "destructive",
          });
          return;
        }

        if (isNaN(price) || price < 0) {
          toast({
            title: "Error",
            description: "Please enter a valid price (must be 0 or greater)",
            variant: "destructive",
          });
          return;
        }

        await createCategoryMutation.mutateAsync({
          name: name,
          defaultPrice: price
        });

        // Only clear form after successful creation
        setFormState({ name: "", price: "0" });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create category",
          variant: "destructive",
        });
      }
    };

    return (
      <div className="space-y-4 mb-8">
        <h3 className="text-lg font-medium">Category Management</h3>
        <form onSubmit={handleSubmit} className="flex items-end gap-4">
          <div className="space-y-2 flex-1">
            <Label htmlFor="categoryName">New Category Name</Label>
            <Input
              id="categoryName"
              type="text"
              value={formState.name}
              onChange={handleNameChange}
              placeholder="Enter category name..."
              className="w-full"
            />
          </div>
          <div className="space-y-2 flex-1">
            <Label htmlFor="categoryPrice">Default Price ($)</Label>
            <Input
              id="categoryPrice"
              type="number"
              min="0"
              step="0.01"
              value={formState.price}
              onChange={handlePriceChange}
              placeholder="Enter default price..."
              className="w-full"
            />
          </div>
          <Button
            type="submit"
            disabled={createCategoryMutation.isPending}
          >
            {createCategoryMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Add Category'
            )}
          </Button>
        </form>
        <ScrollArea className="w-full">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant="secondary"
                className="text-sm py-1 px-2"
              >
                {category.name} (${Number(category.defaultPrice).toFixed(2)})
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2"
                  onClick={() => deleteCategoryMutation.mutate(category.id)}
                  disabled={deleteCategoryMutation.isPending}
                >
                  ×
                </Button>
              </Badge>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const CategoryFilter = () => {
    return (
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Filter by Category</h3>
          <Select
            value={sortOrder}
            onValueChange={(value: "asc" | "desc") => setSortOrder(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="h-[200px] w-full rounded-md border p-4">
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={categoryFilter.includes(category.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setCategoryFilter(prev => [...prev, category.id]);
                    } else {
                      setCategoryFilter(prev =>
                        prev.filter(id => id !== category.id)
                      );
                    }
                  }}
                />
                <Label>{category.name} (${Number(category.defaultPrice).toFixed(2)})</Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        {categoryFilter.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setCategoryFilter([])}
            className="w-full"
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  };

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPrice, setNewCategoryPrice] = useState("0");

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
                <BulkCategoryActions/>
              </>
            )}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Add Product
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

        <CategoryManagement />
        <CategoryFilter />

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
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <p className="text-sm text-muted-foreground mt-2" style={{ display: hideDetails ? 'none' : 'block' }}>
                          {product.description}
                        </p>
                        <div className="flex items-center gap-2 mt-4">
                          <Badge
                            variant={product.isAvailable ? "default" : "secondary"}
                          >
                            {product.isAvailable ? "Available" : "Unavailable"}
                          </Badge>
                        </div>
                        <div className="mt-4 flex justify-between items-center">
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

            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
              {isFetchingNextPage && (
                <Loader2 className="w-6 h-6 animate-spin" />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}