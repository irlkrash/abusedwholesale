import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProductSchema, insertCartSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Products routes
  app.get("/api/products", async (_req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.post("/api/products", async (req, res) => {
    // Log authentication status for debugging
    console.log("Auth status:", {
      isAuthenticated: req.isAuthenticated(),
      user: req.user,
      isAdmin: req.user?.isAdmin
    });

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

  const httpServer = createServer(app);
  return httpServer;
}