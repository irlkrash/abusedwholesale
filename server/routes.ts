import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProductSchema, insertCartSchema, type Cart } from "@shared/schema";

// Simple in-memory cache with 5-minute TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Products routes with pagination and caching
  app.get("/api/products", async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const offset = (page - 1) * limit;

    const cacheKey = `products:${page}:${limit}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    try {
      const products = await storage.getProducts(offset, limit);
      // Cache the response
      cache.set(cacheKey, { data: products, timestamp: Date.now() });
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const product = await storage.createProduct(parsed.data);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    const productId = parseInt(req.params.id);
    const product = await storage.updateProduct(productId, req.body);
    res.json(product);
  });

  app.delete("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    const productId = parseInt(req.params.id);
    await storage.deleteProduct(productId);
    res.sendStatus(200);
  });

  // Cart routes
  app.get("/api/carts", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

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

  app.delete("/api/carts/:id", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    const cartId = parseInt(req.params.id);
    await storage.deleteCart(cartId);
    res.sendStatus(200);
  });

  app.post("/api/carts/:id/make-items-unavailable", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

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