import { InsertUser, User, Product, Cart, InsertProduct, InsertCart, Category, InsertCategory } from "@shared/schema";
import { users, products as productsTable, carts, categories, productCategories } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
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
  getProducts(offset?: number, limit?: number): Promise<(Product & { categories?: Category[] })[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Product-Category operations
  getProductCategories(productId: number): Promise<Category[]>;
  setProductCategories(productId: number, categoryIds: number[]): Promise<void>;

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

  async getProducts(pageOffset = 0, pageLimit = 12): Promise<(Product & { categories?: Category[] })[]> {
    console.log(`Getting products with offset ${pageOffset} and limit ${pageLimit}`);
    try {
      const productsResult = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.isAvailable, true),
            sql`true`
          )
        )
        .orderBy(desc(productsTable.createdAt))
        .limit(pageLimit)
        .offset((pageOffset - 1) * pageLimit); // Fix the offset calculation

      // Fetch categories for each product
      const productsWithCategories = await Promise.all(
        productsResult.map(async (product) => ({
          ...product,
          categories: await this.getProductCategories(product.id),
        }))
      );

      console.log(`Retrieved ${productsWithCategories.length} available products`);
      return productsWithCategories;
    } catch (error) {
      console.error('Error in getProducts:', error);
      throw error;
    }
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1);
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(productsTable)
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
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, id))
      .returning();
    if (!product) throw new Error("Product not found");
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(productsTable).where(eq(productsTable.id, id));
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

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getProductCategories(productId: number): Promise<Category[]> {
    const result = await db
      .select({
        id: categories.id,
        name: categories.name,
        createdAt: categories.createdAt,
      })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(eq(productCategories.productId, productId));

    return result;
  }

  async setProductCategories(productId: number, categoryIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      // Remove existing categories
      await tx
        .delete(productCategories)
        .where(eq(productCategories.productId, productId));

      // Add new categories
      if (categoryIds.length > 0) {
        await tx.insert(productCategories).values(
          categoryIds.map(categoryId => ({
            productId,
            categoryId,
          }))
        );
      }
    });
  }
}

export const storage = new DatabaseStorage();