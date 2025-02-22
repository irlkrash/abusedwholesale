import { InsertUser, User, Product, Cart, InsertCart, Category, InsertCategory, CartItem, cartItems, InsertCartItem } from "@shared/schema";
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
      errorLog: console.error,
    });

    // Create session store table if it doesn't exist
    pool.query(`
      CREATE TABLE IF NOT EXISTS "session_store" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY NOT DEFERRABLE INITIALLY IMMEDIATE,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `).catch(err => console.error('Error creating session table:', err));
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
      console.log(`Fetching products with offset: ${pageOffset}, limit: ${pageLimit}, categories: ${categoryIds}`);

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

      // Add category filter if categoryIds is provided
      if (categoryIds && categoryIds.length > 0) {
        if (Array.isArray(categoryIds)) {
          query = query.where(inArray(productCategories.categoryId, categoryIds));
        } else {
          query = query.where(eq(productCategories.categoryId, categoryIds));
        }
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
    try {
      console.log(`Fetching carts with limit ${limit} from PostgreSQL...`);

      const carts = await db
        .select()
        .from(cartsTable)
        .orderBy(desc(cartsTable.createdAt))
        .limit(Math.min(limit, 100));

      const cartsWithItems = await Promise.all(
        carts.map(async (cart) => {
          const items = await db
            .select()
            .from(cartItems)
            .where(eq(cartItems.cartId, cart.id));

          return {
            ...cart,
            items: items || []
          };
        })
      );

      return cartsWithItems;
    } catch (error) {
      console.error('Database error in getCarts:', error);
      throw new Error('Failed to fetch carts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getCart(id: number): Promise<Cart | undefined> {
    try {
      const result = await db
        .select({
          cart: cartsTable,
          items: cartItems,
        })
        .from(cartsTable)
        .leftJoin(cartItems, eq(cartsTable.id, cartItems.cartId))
        .where(eq(cartsTable.id, id));

      if (result.length === 0) return undefined;

      const cart = result[0].cart;
      // Filter out null items and ensure type safety
      const items = result
        .filter((r): r is typeof r & { items: NonNullable<typeof r.items> } => r.items !== null)
        .map(r => r.items);

      return {
        ...cart,
        items,
      };
    } catch (error) {
      console.error(`Database error in getCart(${id}):`, error);
      throw error;
    }
  }

  async createCart(insertCart: InsertCart): Promise<Cart> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create the cart
      const [cart] = await db
        .insert(cartsTable)
        .values({
          customerName: insertCart.customerName,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!cart) {
        throw new Error('Failed to create cart');
      }

      console.log('Created cart:', cart);

      // 2. Insert cart items
      const itemsToInsert = insertCart.items.map(item => ({
        cartId: cart.id,
        productId: item.productId,
        name: item.name,
        description: item.description || '',
        images: Array.isArray(item.images) ? item.images : [],
        fullImages: Array.isArray(item.fullImages) ? item.fullImages : [],
        isAvailable: item.isAvailable !== false,
        createdAt: new Date()
      }));

      // 3. Insert all cart items
      const items = await db
        .insert(cartItems)
        .values(itemsToInsert)
        .returning();

      console.log('Inserted cart items:', items);

      await client.query('COMMIT');

      // 4. Return complete cart with items
      return {
        ...cart,
        items
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating cart:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteCart(id: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Due to CASCADE deletion, we only need to delete the cart
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
    try {
      const categories = await db
        .select()
        .from(categoriesTable)
        .orderBy(desc(categoriesTable.createdAt));

      return categories.filter((category): category is Category => category !== null);
    } catch (error) {
      console.error('Error in getCategories:', error);
      throw error;
    }
  }

  async getCategory(id: number): Promise<Category | undefined> {
    try {
      const [category] = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, id))
        .limit(1);
      return category || undefined;
    } catch (error) {
      console.error(`Error in getCategory(${id}):`, error);
      throw error;
    }
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    try {
      console.log('Creating category with data:', category);
      const [newCategory] = await db
        .insert(categoriesTable)
        .values({
          name: category.name,
          defaultPrice: category.defaultPrice,
          createdAt: new Date()
        })
        .returning();

      if (!newCategory) {
        throw new Error('Failed to create category');
      }

      return newCategory;
    } catch (error) {
      console.error('Error in createCategory:', error);
      throw error;
    }
  }

  async deleteCategory(id: number): Promise<void> {
    try {
      await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    } catch (error) {
      console.error(`Error in deleteCategory(${id}):`, error);
      throw error;
    }
  }

  async addProductCategories(productId: number, categoryIds: number[]): Promise<void> {
    try {
      const values = categoryIds.map(categoryId => ({
        productId,
        categoryId,
      }));

      await db.insert(productCategories).values(values);
    } catch (error) {
      console.error('Error in addProductCategories:', error);
      throw error;
    }
  }

  async removeProductCategories(productId: number, categoryIds: number[]): Promise<void> {
    try {
      await db
        .delete(productCategories)
        .where(
          and(
            eq(productCategories.productId, productId),
            inArray(productCategories.categoryId, categoryIds)
          )
        );
    } catch (error) {
      console.error('Error in removeProductCategories:', error);
      throw error;
    }
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
  async updateCart(id: number, updates: Partial<Cart>): Promise<Cart> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If items are being updated, ensure proper formatting
      let updatedItems;
      if (updates.items) {
        updatedItems = (updates.items as CartItem[]).map(item => ({
          productId: item.productId,
          name: item.name,
          description: item.description,
          images: Array.isArray(item.images) ? item.images : [],
          fullImages: Array.isArray(item.fullImages) ? item.fullImages : [],
          isAvailable: !!item.isAvailable,
          createdAt: item.createdAt || new Date().toISOString()
        }));
      }

      const [cart] = await db
        .update(cartsTable)
        .set({
          ...updates,
          items: updatedItems ? JSON.stringify(updatedItems) : undefined,
          updatedAt: new Date()
        })
        .where(eq(cartsTable.id, id))
        .returning();

      await client.query('COMMIT');

      if (!cart) {
        throw new Error('Cart not found');
      }

      return {
        ...cart,
        items: typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Database error in updateCart(${id}):`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const storage = new DatabaseStorage();