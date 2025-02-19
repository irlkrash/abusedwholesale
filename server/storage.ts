import { InsertUser, User, Product, Cart, InsertCart } from "@shared/schema";
import Database from '@replit/database';
const db_client = new Database();
import { users, products as productsTable, carts as cartsTable } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, desc, lte } from "drizzle-orm";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin?: boolean }): Promise<User>;
  getProducts(offset?: number, limit?: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: Product): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
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
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      },
      tableName: 'session_store',
      createTableIfMissing: true,
      pruneSessionInterval: false,
    });
  }

  async getProducts(pageOffset = 0, pageLimit = 12): Promise<Product[]> {
    try {
      console.log(`Fetching products with offset: ${pageOffset}, limit: ${pageLimit}`);

      const limit = Math.max(1, Math.min(100, pageLimit));
      const products = await db
        .select()
        .from(productsTable)
        .orderBy(desc(productsTable.createdAt))
        .offset(pageOffset)
        .limit(limit);

      console.log(`Retrieved ${products.length} products:`, products);
      return products;
    } catch (error) {
      console.error('Error in getProducts:', error);
      throw error; // Let the route handler handle the error
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

  async createProduct(insertProduct: Product): Promise<Product> {
    try {
      console.log('Creating product with data:', insertProduct);
      const [product] = await db
        .insert(productsTable)
        .values({
          name: insertProduct.name,
          description: insertProduct.description,
          images: insertProduct.images || [],
          fullImages: insertProduct.fullImages || [],
          isAvailable: insertProduct.isAvailable ?? true,
          createdAt: new Date(),
        })
        .returning();

      console.log('Successfully created product:', product);
      return product;
    } catch (error) {
      console.error('Database error in createProduct:', error);
      throw error;
    }
  }

  async getProductImage(key: string, type: 'thumbnail' | 'full' = 'thumbnail'): Promise<string | null> {
    try {
      return await db_client.get(key);
    } catch (error) {
      console.error(`Storage error in getProductImage (${type}):`, error);
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
      return carts || [];
    } catch (error) {
      console.error('Database error in getCarts:', error);
      return []; // Return empty array instead of throwing
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

async function storeImage(imageData: string, prefix: string): Promise<{ thumbnail: string; full: string }> {
  const thumbnailKey = `${prefix}_thumb_${Date.now()}`;
  const fullKey = `${prefix}_full_${Date.now()}`;

  await db_client.set(thumbnailKey, imageData);
  await db_client.set(fullKey, imageData); // Store full resolution version

  return {
    thumbnail: thumbnailKey,
    full: fullKey,
  };
}

export const storage = new DatabaseStorage();