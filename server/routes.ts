import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProductSchema, insertCartSchema, insertCategorySchema } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Protected admin routes
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }
    next();
  };

  // Add user info endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Cart routes
  app.post("/api/carts", async (req, res) => {
    try {
      console.log('Creating new cart with data:', req.body);
      const parsed = insertCartSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error('Cart validation failed:', parsed.error);
        return res.status(400).json({
          message: "Invalid cart data",
          errors: parsed.error.errors
        });
      }

      // Ensure each item has a valid price stored as a number with 2 decimal precision
      const cartItems = parsed.data.items.map(item => {
        const price = typeof item.price === 'number' ? Math.floor(item.price) : Math.floor(Number(item.price));
        if (isNaN(price)) {
          throw new Error(`Invalid price for item: ${item.name}`);
        }
        return {
          ...item,
          price: price // Store as integer
        };
      });

      const cart = await storage.createCart({
        customerName: parsed.data.customerName,
        items: cartItems
      });

      console.log('Cart created successfully:', cart);
      res.status(201).json(cart);

    } catch (error) {
      console.error('Error creating cart:', error);
      res.status(500).json({ 
        message: "Failed to create cart",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.get("/api/carts", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      console.log(`Fetching carts with limit ${limit}...`);

      const carts = await storage.getCarts(limit);
      console.log(`Successfully retrieved ${carts.length} carts with data:`, carts);

      res.json({
        data: carts,
        count: carts.length
      });
    } catch (error) {
      console.error('Error fetching carts:', error);
      res.status(500).json({ 
        message: "Failed to fetch carts",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });


  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const countAvailableOnly = req.query.countAvailableOnly === 'true';
      const categories = await storage.getCategoriesWithCounts(countAvailableOnly);
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ 
        message: "Failed to fetch categories",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.post("/api/categories", requireAdmin, async (req, res) => {
    try {
      // Detailed request logging
      console.log('Category Creation Request:');
      console.log('- Raw body:', JSON.stringify(req.body, null, 2));
      console.log('- Name:', req.body.name, typeof req.body.name);
      console.log('- Default Price:', req.body.defaultPrice, typeof req.body.defaultPrice);
      console.log('- Parsed Price:', Number(req.body.defaultPrice));
      console.log('- Headers:', req.headers);

      // Convert price to number explicitly
      console.log('Raw request body:', req.body);
      const categoryData = {
        name: String(req.body.name).trim(),
        defaultPrice: Number(req.body.defaultPrice)
      };
      console.log('Processed category data:', {
        data: categoryData,
        types: {
          name: typeof categoryData.name,
          defaultPrice: typeof categoryData.defaultPrice
        },
        values: {
          name: categoryData.name,
          defaultPrice: categoryData.defaultPrice
        }
      });

      console.log('Pre-validation data:', {
        raw: categoryData,
        nameType: typeof categoryData.name,
        priceType: typeof categoryData.defaultPrice,
        nameLength: categoryData.name.length,
        priceValue: categoryData.defaultPrice
      });

      const parsed = insertCategorySchema.safeParse(categoryData);
      console.log('Validation result:', {
        success: parsed.success,
        errors: !parsed.success ? parsed.error.errors : undefined
      });
      if (!parsed.success) {
        console.error('Validation failed:', {
          input: categoryData,
          errors: parsed.error.errors
        });
        const errorDetails = parsed.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }));
        console.error('Validation failed:', errorDetails);
        return res.status(400).json({ 
          message: "Invalid category data",
          errors: errorDetails
        });
      }

      const category = await storage.createCategory({
        name: parsed.data.name,
        defaultPrice: parsed.data.defaultPrice // Already validated as number by schema
      });

      console.log('Successfully created category:', category);
      res.status(201).json(category);
    } catch (error) {
      console.error('Category creation failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        body: req.body
      });
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ 
        message: "Failed to create category: " + errorMessage,
        error: errorMessage,
        details: JSON.stringify(error)
      });
    }
  });

  app.delete("/api/categories/:id", requireAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      await storage.deleteCategory(categoryId);
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ 
        message: "Failed to delete category",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Products routes with pagination - Make GET public, but keep POST/PATCH/DELETE protected
  app.post("/api/products", requireAdmin, async (req, res) => {
    try {
      console.log('Creating new product with data:', req.body);
      const parsed = insertProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(parsed.error);
      }

      // Create the product with type safety
      const product = await storage.createProduct({
        name: parsed.data.name,
        description: parsed.data.description,
        images: parsed.data.images,
        fullImages: parsed.data.fullImages || [],
        isAvailable: parsed.data.isAvailable ?? true,
        createdAt: new Date(),
        categories: parsed.data.categories
      });

      console.log('Successfully created product:', product);
      res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ 
        message: "Failed to create product",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Add new bulk category assignment endpoint
  app.post("/api/products/bulk-assign-category", requireAdmin, async (req, res) => {
    try {
      const { productIds, categoryId } = req.body;
      console.log('Bulk assigning category:', { productIds, categoryId });

      // Validate input
      if (!Array.isArray(productIds) || !productIds.length || typeof categoryId !== 'number') {
        return res.status(400).json({ message: "Invalid request format" });
      }

      // Validate product IDs are numbers
      if (!productIds.every(id => typeof id === 'number')) {
        return res.status(400).json({ message: "All product IDs must be numbers" });
      }

      console.log(`Bulk assigning category ${categoryId} to products:`, productIds);

      // First, get the category to ensure it exists
      const category = await storage.getCategory(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      console.log(`Applying category ${category.name} with price ${category.defaultPrice} to ${productIds.length} products`);

      try {
        // Process in bulk
        await storage.addBulkProductCategories(productIds, [categoryId]);

        // Get updated products
        const updatedProducts = await Promise.all(
          productIds.map(productId => storage.getProduct(productId))
        );

        console.log(`Successfully assigned category ${categoryId} to ${updatedProducts.length} products`);

        res.json({
          message: "Bulk category assignment completed successfully",
          updatedCount: updatedProducts.length,
          products: updatedProducts.filter(p => p !== undefined)
        });
      } catch (error) {
        console.error(`Failed bulk category update:`, error);
        res.status(500).json({ 
          message: "Failed to update categories in bulk",
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } catch (error) {
      console.error('Error in bulk category assignment:', error);
      res.status(500).json({ 
        message: "Failed to assign categories",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Update GET /api/products to handle category filtering and pricing
  app.get("/api/products", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const isAvailable = req.query.isAvailable === 'true' ? true : 
                         (req.query.isAvailable === 'false' ? false : undefined);
      const categoryId = req.query.categoryId ? 
        Array.isArray(req.query.categoryId) ? 
          req.query.categoryId.map(id => parseInt(id as string)) :
          [parseInt(req.query.categoryId as string)] 
        : undefined;
      const offset = (page - 1) * limit;

      console.log(`Fetching products page ${page} with limit ${limit}, categoryId: ${categoryId}, isAvailable: ${isAvailable}`);
      const products = await storage.getProducts(offset, limit, categoryId, isAvailable);
      
      // Log more detailed information for debugging
      console.log(`Found ${products.length} products in categories:`, categoryId);
      if (categoryId && isAvailable !== undefined) {
        const availableCount = products.filter(p => p.isAvailable === true).length;
        console.log(`Available products: ${availableCount}/${products.length}`);
        if (availableCount !== products.length && isAvailable === true) {
          console.warn(`Warning: Found ${products.length - availableCount} unavailable products despite isAvailable=true filter`);
        }
      }

      res.json({
        data: products || [],
        nextPage: products && products.length === limit ? page + 1 : undefined,
        lastPage: !products || products.length < limit
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ 
        message: "Failed to fetch products",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.patch("/api/products/:id", requireAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      console.log('Updating product:', {
        productId,
        body: req.body,
        categories: req.body.categories,
        customPrice: req.body.customPrice
      });

      // Get existing product categories if we're setting a custom price but not changing categories
      let existingCategories = [];
      if (req.body.customPrice !== undefined && !req.body.categories && !req.body.categoryIds) {
        existingCategories = await storage.getProductCategories(productId);
        console.log('Setting custom price while preserving existing categories:', existingCategories);
      }

      // Validate category IDs if present
      if (req.body.categories) {
        if (!Array.isArray(req.body.categories)) {
          return res.status(400).json({ message: "Categories must be an array" });
        }
        for (const categoryId of req.body.categories) {
          if (!Number.isInteger(categoryId)) {
            return res.status(400).json({ message: "Invalid category ID format" });
          }
        }
      }

      // Handle category updates
      const categories = req.body.categories || req.body.categoryIds;
      if (categories || existingCategories.length > 0) {
        let categoryIds = categories;
        
        // If we're setting a custom price but not changing categories, use existing categories
        if (!categories && existingCategories.length > 0) {
          categoryIds = existingCategories.map(c => c.id);
        }
        
        if (categoryIds) {
          console.log('Updating product categories:', {productId, categoryIds});

          // Remove existing categories first
          const currentCategories = await storage.getProductCategories(productId);
          if (currentCategories.length > 0) {
            await storage.removeProductCategories(productId, currentCategories.map(c => c.id));
          }

          // Add new or preserved categories
          if (categoryIds.length > 0) {
            await storage.addProductCategories(productId, categoryIds);
          }
        }
      }

      // Update other product fields excluding category fields
      const {categories: _, categoryIds: __, ...updateFields} = req.body;
      const product = await storage.updateProduct(productId, updateFields);

      // Fetch updated product with categories
      const updatedProduct = await storage.getProduct(productId);
      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ 
        message: "Failed to update product",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      await storage.deleteProduct(productId);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ 
        message: "Failed to delete product",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.delete("/api/carts/:id", requireAdmin, async (req, res) => {
    try {
      const cartId = parseInt(req.params.id);
      if (isNaN(cartId)) {
        return res.status(400).json({ message: "Invalid cart ID" });
      }

      const cart = await storage.getCart(cartId);
      if (!cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      await storage.deleteCart(cartId);
      res.json({ message: "Cart deleted successfully" });
    } catch (error) {
      console.error('Error deleting cart:', error);
      res.status(500).json({ 
        message: "Failed to delete cart",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.post("/api/carts/:id/make-items-unavailable", requireAdmin, async (req, res) => {
    try {
      const cartId = parseInt(req.params.id);
      if (isNaN(cartId)) {
        return res.status(400).json({ message: "Invalid cart ID" });
      }

      const cart = await storage.getCart(cartId);
      if (!cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      console.log(`Making items unavailable for cart ${cartId}`);
      const cartItems = cart.items;

      if (cartItems.length === 0) {
        return res.status(400).json({ message: "No items in cart to update" });
      }

      // Extract all product IDs from cart
      const productIds = cartItems.map(item => item.productId);
      console.log(`Updating availability for ${productIds.length} products: ${productIds.join(', ')}`);

      // Process all products in a single batch
      const results = [];
      const maxRetries = 3;

      // Process all products together for better performance
      for (const productId of productIds) {
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
          try {
            const updated = await storage.updateProduct(productId, { isAvailable: false });
            console.log(`Successfully updated product ${productId} to unavailable`);
            results.push({ productId, success: true, product: updated });
            success = true;
          } catch (error) {
            retryCount++;
            console.error(`Failed attempt ${retryCount} for product ${productId}:`, error);

            if (retryCount >= maxRetries) {
              results.push({ 
                productId, 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
            } else {
              // Short delay before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        }
      }

      const successfulUpdates = results.filter(update => update.success);
      const failedUpdates = results.filter(update => !update.success);

      // Update cart items in background
      storage.refreshCartItems(cartId)
        .then(() => {
          console.log(`Successfully refreshed availability status for all cart items in cart ${cartId}`);
        })
        .catch((refreshError) => {
          console.error('Error refreshing cart items:', refreshError);
        });

      // Return results immediately
      res.json({
        message: `Successfully updated ${successfulUpdates.length} products${failedUpdates.length > 0 ? `, failed to update ${failedUpdates.length} products` : ''}`,
        updatedProducts: successfulUpdates.map(u => u.product),
        failedProducts: failedUpdates.map(f => f.productId)
      });
    } catch (error) {
      console.error('Error updating cart items:', error);
      res.status(500).json({ 
        message: "Failed to update cart items",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.delete("/api/carts/:cartId/items/:itemId", requireAdmin, async (req, res) => {
    try {
      const cartId = parseInt(req.params.cartId);
      const itemId = parseInt(req.params.itemId);

      if (isNaN(cartId) || isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid cart or item ID" });
      }

      const cart = await storage.getCart(cartId);
      if (!cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      await storage.deleteCartItem(cartId, itemId);
      res.json({ message: "Cart item removed successfully" });
    } catch (error) {
      console.error('Error removing cart item:', error);
      res.status(500).json({ 
        message: "Failed to remove cart item",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  console.log('Creating HTTP server...');
  const httpServer = createServer(app);

  // Handle server errors
  httpServer.on('error', (error) => {
    console.error('Server error:', error);
  });

  return httpServer;
}