import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProductSchema, insertCartSchema, type Cart } from "@shared/schema";

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
  app.get("/api/products", async (req, res) => {
    try {
      console.log(`Fetching products: page=${req.query.page || 1}, limit=${req.query.limit || 12}`);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = (page - 1) * limit;

      const products = await storage.getProducts(offset, limit);
      console.log(`Retrieved ${products.length} products from database`);
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/products", requireAdmin, async (req, res) => {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const product = await storage.createProduct(parsed.data);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id", requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id);
    const product = await storage.updateProduct(productId, req.body);
    res.json(product);
  });

  app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id);
    await storage.deleteProduct(productId);
    res.sendStatus(200);
  });

  // Cart routes
  app.get("/api/carts", requireAdmin, async (req, res) => {
    const carts = await storage.getCarts();
    res.json(carts);
  });

  app.post("/api/carts", async (req, res) => {
    const parsed = insertCartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const cart = await storage.createCart(parsed.data);
    res.status(201).json(cart);
  });

  app.delete("/api/carts/:id", requireAdmin, async (req, res) => {
    const cartId = parseInt(req.params.id);
    await storage.deleteCart(cartId);
    res.sendStatus(200);
  });

  app.post("/api/carts/:id/make-items-unavailable", requireAdmin, async (req, res) => {
    const cartId = parseInt(req.params.id);
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
  });

  const httpServer = createServer(app);
  return httpServer;
}