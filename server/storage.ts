import { InsertUser, User, Product, Cart, InsertProduct, InsertCart } from "@shared/schema";

import { Client } from '@replit/database';
const db_client = new Client();

import { users, products as productsTable, carts as cartsTable } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
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
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      },
      tableName: 'session_store',
      createTableIfMissing: true,
      pruneSessionInterval: false
    });
  }

  async getProducts(pageOffset = 0, pageLimit = 12, noLimit = false): Promise<Product[]> {
    try {
      console.log(`Getting products with offset ${pageOffset} and limit ${pageLimit}, noLimit: ${noLimit}`);

      let query = db
        .select()
        .from(productsTable)
        .orderBy(desc(productsTable.createdAt));
        
      if (!noLimit) {
        query = query.limit(pageLimit).offset(pageOffset);
      }

      const products = await query;

      if (!products) {
        throw new Error('Failed to fetch products from database');
      }

      console.log(`Retrieved ${products.length} products from database`);
      return products;
    } catch (error) {
      console.error('Database error in getProducts:', error);
      throw error;
    }
  }

  async getProduct(id: number): Promise<Product | undefined> {
    try {
      const [product] = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, id))
        .limit(1);
      return product;
    } catch (error) {
      console.error(`Database error in getProduct(${id}):`, error);
      throw error;
    }
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    try {
      const imageUrls = await Promise.all(
        insertProduct.images.map(async (imageData, index) => {
          const key = `product_image_${Date.now()}_${index}`;
          await db_client.set(key, imageData);
          return key;
        })
      );

      const [product] = await db
        .insert(productsTable)
        .values({
          name: insertProduct.name,
          description: insertProduct.description,
          images: imageUrls,
          isAvailable: insertProduct.isAvailable ?? true,
        })
        .returning();
      return product;
    } catch (error) {
      console.error('Database error in createProduct:', error);
      throw error;
    }
  }

  async getProductImage(key: string): Promise<string | null> {
    try {
      return await db_client.get(key);
    } catch (error) {
      console.error('Storage error in getProductImage:', error);
      return null;
    }
  }

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
    try {
      const [product] = await db
        .update(productsTable)
        .set(updates)
        .where(eq(productsTable.id, id))
        .returning();
      if (!product) throw new Error("Product not found");
      return product;
    } catch (error) {
      console.error(`Database error in updateProduct(${id}):`, error);
      throw error;
    }
  }

  async deleteProduct(id: number): Promise<void> {
    try {
      await db.delete(productsTable).where(eq(productsTable.id, id));
    } catch (error) {
      console.error(`Database error in deleteProduct(${id}):`, error);
      throw error;
    }
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
    try {
      console.log('Fetching all carts from database');
      const carts = await db
        .select()
        .from(cartsTable)
        .orderBy(desc(cartsTable.createdAt));

      console.log(`Retrieved ${carts.length} carts from database:`, carts);
      return carts;
    } catch (error) {
      console.error('Database error in getCarts:', error);
      throw error;
    }
  }

  async getCart(id: number): Promise<Cart | undefined> {
    try {
      const [cart] = await db
        .select()
        .from(cartsTable)
        .where(eq(cartsTable.id, id));
      return cart;
    } catch (error) {
      console.error(`Database error in getCart(${id}):`, error);
      throw error;
    }
  }

  async createCart(insertCart: InsertCart): Promise<Cart> {
    try {
      console.log('Creating new cart:', insertCart);
      const now = new Date();
      const [cart] = await db
        .insert(cartsTable)
        .values({
          customerName: insertCart.customerName,
          customerEmail: insertCart.customerEmail,
          items: insertCart.items,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!cart) {
        throw new Error('Failed to create cart in database');
      }

      console.log('Successfully created cart:', cart);
      return cart;
    } catch (error) {
      console.error('Database error in createCart:', error);
      throw error;
    }
  }

  async updateCart(id: number, updates: Partial<Cart>): Promise<Cart> {
    const [cart] = await db
      .update(cartsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cartsTable.id, id))
      .returning();
    if (!cart) throw new Error("Cart not found");
    return cart;
  }

  async deleteCart(id: number): Promise<void> {
    await db.delete(cartsTable).where(eq(cartsTable.id, id));
  }
}

export const storage = new DatabaseStorage();