import { InsertUser, User, Product, Cart, InsertProduct, InsertCart } from "@shared/schema";
import { users, products, carts } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;

  // User operations
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin?: boolean }): Promise<User>;

  // Product operations with pagination
  getProducts(offset?: number, limit?: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  // Cart operations
  getCarts(): Promise<Cart[]>;
  createCart(cart: InsertCart): Promise<Cart>;
  updateCart(id: number, cart: Partial<Cart>): Promise<Cart>;
  deleteCart(id: number): Promise<void>;
  getCart(id: number): Promise<Cart | undefined>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: 'session_store',
      createTableIfMissing: true,
      pruneSessionInterval: false
    });
  }

  // Optimized getProducts with efficient pagination and available-only filter
  async getProducts(pageOffset = 0, pageLimit = 12): Promise<Product[]> {
    console.log(`Getting products with offset ${pageOffset} and limit ${pageLimit}`);
    try {
      const result = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.isAvailable, true),
            sql`true`
          )
        )
        .orderBy(desc(products.createdAt))
        .limit(pageLimit)
        .offset(pageOffset);

      console.log(`Retrieved ${result.length} available products`);
      return result;
    } catch (error) {
      console.error('Error in getProducts:', error);
      throw error;
    }
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values({
        name: insertProduct.name,
        description: insertProduct.description,
        images: insertProduct.images,
        isAvailable: insertProduct.isAvailable ?? true,
      })
      .returning();
    return product;
  }

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    if (!product) throw new Error("Product not found");
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { isAdmin?: boolean }): Promise<User> {
    const existingUsers = await this.getUsers();
    const isFirstUser = existingUsers.length === 0;

    const [user] = await db
      .insert(users)
      .values({
        username: insertUser.username,
        password: insertUser.password,
        isAdmin: insertUser.isAdmin ?? isFirstUser,
      })
      .returning();
    return user;
  }

  async getCarts(): Promise<Cart[]> {
    return await db.select().from(carts).orderBy(desc(carts.createdAt));
  }

  async getCart(id: number): Promise<Cart | undefined> {
    const [cart] = await db.select().from(carts).where(eq(carts.id, id));
    return cart;
  }

  async createCart(insertCart: InsertCart): Promise<Cart> {
    const now = new Date();
    const [cart] = await db
      .insert(carts)
      .values({
        ...insertCart,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return cart;
  }

  async updateCart(id: number, updates: Partial<Cart>): Promise<Cart> {
    const [cart] = await db
      .update(carts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(carts.id, id))
      .returning();
    if (!cart) throw new Error("Cart not found");
    return cart;
  }

  async deleteCart(id: number): Promise<void> {
    await db.delete(carts).where(eq(carts.id, id));
  }
}

export const storage = new DatabaseStorage();