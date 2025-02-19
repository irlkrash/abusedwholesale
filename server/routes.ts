import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProductSchema, insertCartSchema } from "@shared/schema";

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

  // Products routes with pagination - Make GET public, but keep POST/PATCH/DELETE protected
  app.get("/api/images/:key", async (req, res) => {
    try {
      const imageData = await storage.getProductImage(req.params.key);
      if (!imageData) {
        return res.status(404).send('Image not found');
      }
      res.send(imageData);
    } catch (error) {
      console.error('Error serving image:', error);
      res.status(500).json({ 
        message: "Failed to serve image",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.post("/api/products", requireAdmin, async (req, res) => {
    try {
      console.log('Creating new product with data:', req.body);
      const parsed = insertProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(parsed.error);
      }

      // Create the product with type safety
      const newProduct = {
        ...parsed.data,
        createdAt: new Date(),
        images: parsed.data.images || [],
        fullImages: parsed.data.fullImages || [],
        isAvailable: parsed.data.isAvailable ?? true
      };

      const product = await storage.createProduct(newProduct);
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

  app.get("/api/products", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = (page - 1) * limit;

      console.log(`Fetching products page ${page} with limit ${limit}`);
      const products = await storage.getProducts(offset, limit);
      console.log(`Found ${products.length} products`);

      // Always return the same data structure
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
      const product = await storage.updateProduct(productId, req.body);
      res.json(product);
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

  // Cart routes
  app.get("/api/carts", requireAdmin, async (req, res) => {
    try {
      console.log('GET /api/carts - Auth check passed, fetching carts...');
      console.log('User info:', req.user);

      const carts = await storage.getCarts();
      console.log('Carts fetched from storage:', carts);

      if (!Array.isArray(carts)) {
        console.error('Invalid carts data format:', carts);
        return res.status(500).json({ 
          message: "Invalid cart data format",
          error: "Expected array of carts" 
        });
      }

      res.json(carts);
    } catch (error) {
      console.error('Error fetching carts:', error);
      res.status(500).json({ 
        message: "Failed to fetch carts",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.post("/api/carts", async (req, res) => {
    try {
      const parsed = insertCartSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(parsed.error);
      }

      const cart = await storage.createCart(parsed.data);
      res.status(201).json(cart);
    } catch (error) {
      console.error('Error creating cart:', error);
      res.status(500).json({ 
        message: "Failed to create cart",
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
      await storage.deleteCart(cartId);
      res.sendStatus(200);
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

      const cartItems = cart.items as { productId: number }[];
      const updates = await Promise.all(
        cartItems.map(item =>
          storage.updateProduct(item.productId, { isAvailable: false })
        )
      );

      res.json(updates);
    } catch (error) {
      console.error('Error updating cart items:', error);
      res.status(500).json({ 
        message: "Failed to update cart items",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}