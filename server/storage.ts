import { InsertUser, User, Product, Cart, InsertCart, Category, InsertCategory } from "@shared/schema";
import { users, products as productsTable, carts as cartsTable, categories as categoriesTable, productCategories } from "@shared/schema";
import session from "express-session";
import { db, pool } from "./db";
import { eq, desc, and, inArray } from "drizzle-orm";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin?: boolean }): Promise<User>;
  getProducts(offset?: number, limit?: number, categoryIds?: number[]): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: Omit<Product, 'id'> & { categories?: number[] }): Promise<Product>;
  updateProduct(id: number, product: Partial<Product> & { categories?: number[] }): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getCarts(limit?: number): Promise<Cart[]>;
  createCart(cart: InsertCart): Promise<Cart>;
  updateCart(id: number, cart: Partial<Cart>): Promise<Cart>;
  deleteCart(id: number): Promise<void>;
  getCart(id: number): Promise<Cart | undefined>;
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  addProductCategories(productId: number, categoryIds: number[]): Promise<void>;
  removeProductCategories(productId: number, categoryIds: number[]): Promise<void>;
  getProductCategories(productId: number): Promise<Category[]>;
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

  async getProducts(pageOffset = 0, pageLimit = 12, categoryIds?: number[]): Promise<Product[]> {
    try {
      console.log(`Fetching products with offset: ${pageOffset}, limit: ${pageLimit}`);

      const limit = Math.max(1, Math.min(100, pageLimit));
      let query = db
        .select({
          product: productsTable,
          categories: categoriesTable,
        })
        .from(productsTable)
        .leftJoin(
          productCategories,
          eq(productsTable.id, productCategories.productId)
        )
        .leftJoin(
          categoriesTable,
          eq(productCategories.categoryId, categoriesTable.id)
        );

      if (categoryIds && categoryIds.length > 0) {
        query = query.where(
          inArray(productCategories.categoryId, categoryIds)
        );
      }

      const result = await query
        .orderBy(desc(productsTable.createdAt))
        .offset(pageOffset)
        .limit(limit);

      // Group the results by product
      const productsMap = new Map<number, Product & { categories: Category[] }>();

      result.forEach(({ product, categories }) => {
        if (!productsMap.has(product.id)) {
          productsMap.set(product.id, {
            ...product,
            categories: [],
          });
        }

        if (categories) {
          const existingProduct = productsMap.get(product.id)!;
          if (!existingProduct.categories.some(c => c.id === categories.id)) {
            existingProduct.categories.push(categories);
          }
        }
      });

      return Array.from(productsMap.values());
    } catch (error) {
      console.error('Error in getProducts:', error);
      throw error;
    }
  }

  async getProduct(id: number): Promise<Product | undefined> {
    try {
      const result = await db
        .select({
          product: productsTable,
          categories: categoriesTable,
        })
        .from(productsTable)
        .leftJoin(
          productCategories,
          eq(productsTable.id, productCategories.productId)
        )
        .leftJoin(
          categoriesTable,
          eq(productCategories.categoryId, categoriesTable.id)
        )
        .where(eq(productsTable.id, id));

      if (result.length === 0) return undefined;

      const product = result[0].product;
      const categories = result
        .filter(r => r.categories)
        .map(r => r.categories);

      return {
        ...product,
        categories,
      };
    } catch (error) {
      console.error(`Database error in getProduct(${id}):`, error);
      throw error;
    }
  }

  async createProduct(insertProduct: Omit<Product, 'id'> & { categories?: number[] }): Promise<Product> {
    try {
      console.log('Creating product with data:', insertProduct);
      const { categories: categoryIds, ...productData } = insertProduct;

      const [product] = await db
        .insert(productsTable)
        .values({
          name: productData.name,
          description: productData.description,
          images: productData.images || [],
          fullImages: productData.fullImages || [],
          isAvailable: productData.isAvailable ?? true,
          createdAt: new Date()
        })
        .returning();

      if (categoryIds && categoryIds.length > 0) {
        await this.addProductCategories(product.id, categoryIds);
      }

      return this.getProduct(product.id) as Promise<Product>;
    } catch (error) {
      console.error('Database error in createProduct:', error);
      throw error;
    }
  }

  async updateProduct(id: number, updates: Partial<Product> & { categories?: number[] }): Promise<Product> {
    try {
      const { categories: categoryIds, ...productUpdates } = updates;

      const [product] = await db
        .update(productsTable)
        .set(productUpdates)
        .where(eq(productsTable.id, id))
        .returning();

      if (categoryIds) {
        // Remove existing categories and add new ones
        await db
          .delete(productCategories)
          .where(eq(productCategories.productId, id));

        if (categoryIds.length > 0) {
          await this.addProductCategories(id, categoryIds);
        }
      }

      return this.getProduct(id) as Promise<Product>;
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

  async getCarts(limit: number = 50): Promise<Cart[]> {
    const client = await pool.connect();
    try {
      console.log(`Fetching carts with limit ${limit} from PostgreSQL...`);

      await client.query('BEGIN');
      const result = await db
        .select()
        .from(cartsTable)
        .orderBy(desc(cartsTable.createdAt))
        .limit(limit);
      await client.query('COMMIT');

      console.log(`Found ${result.length} carts in database`);

      return result.map(cart => {
        try {
          // Parse items from JSONB
          const items = typeof cart.items === 'string' 
            ? JSON.parse(cart.items)
            : (Array.isArray(cart.items) ? cart.items : []);

          return {
            id: cart.id,
            customerName: cart.customerName,
            customerEmail: cart.customerEmail,
            items,
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
          };
        } catch (error) {
          console.error(`Error processing cart ${cart.id}:`, error);
          return {
            id: cart.id,
            customerName: cart.customerName,
            customerEmail: cart.customerEmail,
            items: [],
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
          };
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error in getCarts:', error);
      throw new Error('Failed to fetch carts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      client.release();
    }
  }

  async getCart(id: number): Promise<Cart | undefined> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const [cart] = await db
        .select()
        .from(cartsTable)
        .where(eq(cartsTable.id, id));

      await client.query('COMMIT');

      if (!cart) return undefined;

      // Parse items from JSONB
      const items = typeof cart.items === 'string'
        ? JSON.parse(cart.items)
        : (Array.isArray(cart.items) ? cart.items : []);

      return {
        ...cart,
        items
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Database error in getCart(${id}):`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createCart(insertCart: InsertCart): Promise<Cart> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const now = new Date();
      const items = Array.isArray(insertCart.items) ? insertCart.items : [];

      const [cart] = await db
        .insert(cartsTable)
        .values({
          customerName: insertCart.customerName,
          customerEmail: insertCart.customerEmail,
          items: JSON.stringify(items),
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await client.query('COMMIT');

      if (!cart) {
        throw new Error('Failed to create cart in database');
      }

      return {
        ...cart,
        items: items
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating cart:', error);
      throw new Error('Failed to create cart: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      client.release();
    }
  }

  async deleteCart(id: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await db.delete(cartsTable).where(eq(cartsTable.id, id));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Database error in deleteCart(${id}):`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categoriesTable).orderBy(desc(categoriesTable.createdAt));
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .limit(1);
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categoriesTable)
      .values(category)
      .returning();
    return newCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  }

  async addProductCategories(productId: number, categoryIds: number[]): Promise<void> {
    const values = categoryIds.map(categoryId => ({
      productId,
      categoryId,
    }));

    await db.insert(productCategories).values(values);
  }

  async removeProductCategories(productId: number, categoryIds: number[]): Promise<void> {
    await db
      .delete(productCategories)
      .where(
        and(
          eq(productCategories.productId, productId),
          inArray(productCategories.categoryId, categoryIds)
        )
      );
  }

  async getProductCategories(productId: number): Promise<Category[]> {
    const result = await db
      .select({
        category: categoriesTable,
      })
      .from(productCategories)
      .innerJoin(
        categoriesTable,
        eq(productCategories.categoryId, categoriesTable.id)
      )
      .where(eq(productCategories.productId, productId));

    return result.map(r => r.category);
  }
}

export const storage = new DatabaseStorage();