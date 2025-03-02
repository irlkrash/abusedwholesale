
import React, { useState, useEffect, useRef } from 'react';
import { Product } from '@/types/product';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import ProductList from '@/components/product-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreSoldRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('available');

  // Available products query
  const {
    data: availableProductsData,
    fetchNextPage: fetchNextAvailablePage,
    hasNextPage: hasNextAvailablePage,
    isFetchingNextPage: isFetchingNextAvailablePage,
    refetch: refetchAvailableProducts
  } = useInfiniteQuery({
    queryKey: ['/api/products', true, activeTab === 'available'],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        console.log('Fetching available products:', { pageParam, queryParams: `page=${pageParam}&limit=24&isAvailable=true` });
        const response = await apiRequest(
          'GET',
          `/api/products?page=${pageParam}&limit=24&isAvailable=true`
        );
        const products = await response.json();
        
        console.log('Available products response:', { 
          pageParam, 
          dataLength: products.data.length,
          hasMore: products.data.length === 24 
        });
        
        return {
          products: products.data,
          nextPage: products.data.length === 24 ? pageParam + 1 : undefined
        };
      } catch (err) {
        console.error('Failed to fetch available products:', err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: activeTab === 'available'
  });

  // Sold products query
  const {
    data: soldProductsData,
    fetchNextPage: fetchNextSoldPage,
    hasNextPage: hasNextSoldPage,
    isFetchingNextPage: isFetchingNextSoldPage,
    refetch: refetchSoldProducts
  } = useInfiniteQuery({
    queryKey: ['/api/products', false, activeTab === 'sold'],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        console.log('Fetching sold products:', { pageParam, queryParams: `page=${pageParam}&limit=24&isAvailable=false` });
        const response = await apiRequest(
          'GET',
          `/api/products?page=${pageParam}&limit=24&isAvailable=false`
        );
        const products = await response.json();
        
        console.log('Sold products response:', { 
          pageParam, 
          dataLength: products.data.length,
          hasMore: products.data.length === 24 
        });
        
        return {
          products: products.data,
          nextPage: products.data.length === 24 ? pageParam + 1 : undefined
        };
      } catch (err) {
        console.error('Failed to fetch sold products:', err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: activeTab === 'sold'
  });

  // Flatten the products data
  const availableProducts = availableProductsData?.pages.flatMap(page => page.products) || [];
  const soldProducts = soldProductsData?.pages.flatMap(page => page.products) || [];

  // Effect to log current product counts
  useEffect(() => {
    console.log('Current product counts:', {
      available: availableProducts.length,
      sold: soldProducts.length,
      hasMoreAvailable: hasNextAvailablePage,
      hasMoreSold: hasNextSoldPage
    });
  }, [availableProducts.length, soldProducts.length, hasNextAvailablePage, hasNextSoldPage]);

  // Effect to update available products pagination state
  useEffect(() => {
    console.log('Available products pagination state changed:', {
      hasNextPage: hasNextAvailablePage,
      isFetching: isFetchingNextAvailablePage,
      productCount: availableProducts.length
    });
  }, [hasNextAvailablePage, isFetchingNextAvailablePage, availableProducts.length]);

  // Effect to update sold products pagination state
  useEffect(() => {
    console.log('Sold products pagination state changed:', {
      hasNextPage: hasNextSoldPage,
      isFetching: isFetchingNextSoldPage,
      productCount: soldProducts.length
    });
  }, [hasNextSoldPage, isFetchingNextSoldPage, soldProducts.length]);

  // Intersection observer setup for available products
  useEffect(() => {
    const loadMoreElement = loadMoreRef.current;
    if (!loadMoreElement) return;

    const observerAvailable = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextAvailablePage && !isFetchingNextAvailablePage) {
          fetchNextAvailablePage();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observerAvailable.observe(loadMoreElement);

    return () => {
      if (loadMoreElement) {
        observerAvailable.unobserve(loadMoreElement);
      }
      observerAvailable.disconnect();
    };
  }, [hasNextAvailablePage, isFetchingNextAvailablePage, fetchNextAvailablePage]);

  // Separate intersection observer for sold products
  useEffect(() => {
    const loadMoreSoldElement = loadMoreSoldRef.current;
    if (!loadMoreSoldElement) return;

    const observerSold = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextSoldPage && !isFetchingNextSoldPage) {
          fetchNextSoldPage();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    
    observerSold.observe(loadMoreSoldElement);
    
    return () => {
      if (loadMoreSoldElement) {
        observerSold.unobserve(loadMoreSoldElement);
      }
      observerSold.disconnect();
    };
  }, [hasNextSoldPage, isFetchingNextSoldPage, fetchNextSoldPage]);

  const handleTabChange = (value: string) => {
    console.log('Tab changed to:', value);
    setActiveTab(value);
    
    if (value === 'available') {
      console.log('Refetching available products');
      refetchAvailableProducts();
    } else if (value === 'sold') {
      console.log('Refetching sold products');
      refetchSoldProducts();
    }
  };

  return (
    <div className="container py-8">
      <Tabs defaultValue="available" onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="available">Available Products</TabsTrigger>
          <TabsTrigger value="sold">Sold Items</TabsTrigger>
        </TabsList>
        
        <TabsContent value="available">
          <ProductList 
            products={availableProducts} 
            isLoading={isFetchingNextAvailablePage}
          />
          {hasNextAvailablePage && (
            <div ref={loadMoreRef} className="h-10 mt-4 flex items-center justify-center">
              {isFetchingNextAvailablePage ? 'Loading more...' : 'Scroll for more'}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="sold">
          <ProductList 
            products={soldProducts} 
            isLoading={isFetchingNextSoldPage}
          />
          {hasNextSoldPage && (
            <div ref={loadMoreSoldRef} className="h-10 mt-4 flex items-center justify-center">
              {isFetchingNextSoldPage ? 'Loading more...' : 'Scroll for more'}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HomePage;
