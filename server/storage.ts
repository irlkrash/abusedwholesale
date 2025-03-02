import { InsertUser, User, Product, Cart, InsertCart, Category, InsertCategory, CartItem, cartItems, InsertCartItem } from "@shared/schema";
import { users, products as productsTable, carts as cartsTable, categories as categoriesTable, productCategories } from "@shared/schema";
import session from "express-session";
import { db, pool } from "./db";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
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
  getCategoriesWithCounts(countAvailableOnly?: boolean): Promise<(Category & { productCount: number })[]>;
  addBulkProductCategories(productIds: number[], categoryIds: number[]): Promise<void>;
  refreshCartItems(cartId: number): Promise<void>;
  deleteCartItem(cartId: number, itemId: number): Promise<void>;
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

  async getProducts(pageOffset = 0, pageLimit = 12, categoryIds?: number[], isAvailable?: boolean): Promise<Product[]> {
    try {
      console.log(`Fetching products with offset: ${pageOffset}, limit: ${pageLimit}, categories: ${categoryIds}, isAvailable: ${isAvailable}`);

      const limit = Math.max(1, Math.min(100, pageLimit));

      // Build the base query
      let query = db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          description: productsTable.description,
          images: productsTable.images,
          fullImages: productsTable.fullImages,
          customPrice: productsTable.customPrice,
          categoryPrice: productsTable.categoryPrice,
          isAvailable: productsTable.isAvailable,
          createdAt: productsTable.createdAt,
          updatedAt: productsTable.updatedAt,
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

      // Create an array of conditions to be combined later
      const conditions = [];

      // Add availability filter if provided
      if (isAvailable !== undefined) {
        conditions.push(eq(productsTable.isAvailable, isAvailable));
      }

      // Add category filter if categoryIds is provided
      if (categoryIds && categoryIds.length > 0) {
        // Use a subquery to filter products by category
        const productsInCategories = db
          .select({ productId: productCategories.productId })
          .from(productCategories)
          .where(inArray(productCategories.categoryId, categoryIds));

        conditions.push(inArray(productsTable.id, productsInCategories));
      }

      // Apply all conditions if any exist
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const result = await query
        .orderBy(desc(productsTable.createdAt))
        .offset(pageOffset)
        .limit(limit);

      // Group the results by product
      const productsMap = new Map<number, Product & { categories: Category[] }>();

      result.forEach((row) => {
        const { categories, ...product } = row;
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
          category: categoriesTable,
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
        .filter(r => r.category)
        .map(r => r.category)
        .filter((category): category is Category => category !== null);

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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('Updating product with data:', { id, updates });

      const { categories: categoryIds, ...productUpdates } = updates;
      let categoryPrice = null;

      // Calculate the new category price if either:
      // 1. Categories are being explicitly updated
      // 2. Categories aren't being updated but we need to maintain the current category price
      if (categoryIds !== undefined) {
        if (categoryIds.length > 0) {
          // Get the highest default price from assigned categories
          const categoryPrices = await db
            .select({ defaultPrice: categoriesTable.defaultPrice })
            .from(categoriesTable)
            .where(inArray(categoriesTable.id, categoryIds));
  
          if (categoryPrices.length > 0) {
            categoryPrice = Math.max(...categoryPrices.map(c => Number(c.defaultPrice)));
          }
        }
      } else if (productUpdates.customPrice !== undefined) {
        // If setting a custom price but not changing categories, preserve the current category price
        const currentProduct = await db
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, id))
          .limit(1);
          
        if (currentProduct.length > 0) {
          categoryPrice = currentProduct[0].categoryPrice;
        }
      }

      // Update product details including the new category price
      const [product] = await db
        .update(productsTable)
        .set({
          ...productUpdates,
          categoryPrice: categoryPrice,
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, id))
        .returning();

      if (!product) {
        throw new Error('Product not found');
      }

      // Update category assignments if provided
      if (categoryIds !== undefined) {
        console.log('Updating product categories:', categoryIds);

        // Remove existing categories first
        await db
          .delete(productCategories)
          .where(eq(productCategories.productId, id));

        if (categoryIds.length > 0) {
          // Add new categories
          const categoryEntries = categoryIds.map(categoryId => ({
            productId: id,
            categoryId,
          }));

          await db
            .insert(productCategories)
            .values(categoryEntries);
        }
      } else if (productUpdates.customPrice !== undefined) {
        // If we're just updating the custom price, make sure we don't lose category assignments
        console.log('Setting custom price while preserving categories');
        // No need to modify categories if not explicitly provided
      }

      await client.query('COMMIT');

      // Fetch updated product with categories
      const updatedProduct = await this.getProduct(id);
      if (!updatedProduct) {
        throw new Error('Failed to fetch updated product');
      }

      console.log('Successfully updated product:', updatedProduct);
      return updatedProduct;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Database error in updateProduct(${id}):`, error);
      throw error;
    } finally {
      client.release();
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
            .select({
              id: cartItems.id,
              cartId: cartItems.cartId,
              productId: cartItems.productId,
              name: cartItems.name,
              description: cartItems.description,
              images: cartItems.images,
              fullImages: cartItems.fullImages,
              price: cartItems.price,
              isAvailable: cartItems.isAvailable,
              createdAt: cartItems.createdAt,
            })
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

      // 2. Insert cart items with proper price handling
      const itemsToInsert = insertCart.items.map(item => ({
        cartId: cart.id,
        productId: item.productId,
        name: item.name,
        description: item.description || '',
        images: Array.isArray(item.images) ? item.images : [],
        fullImages: Array.isArray(item.fullImages) ? item.fullImages : [],
        price: typeof item.price === 'number' ? Math.floor(item.price) : 0,
        isAvailable: item.isAvailable !== false,
        createdAt: new Date()
      }));

      // 3. Insert all cart items
      const items = await db
        .insert(cartItems)
        .values(itemsToInsert)
        .returning();

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
    // For single product updates, use the bulk method
    await this.addBulkProductCategories([productId], categoryIds);
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
  async getCategoriesWithCounts(countAvailableOnly: boolean = false): Promise<(Category & { productCount: number })[]> {
    try {
      // Get categories with product counts in a single query using a lateral join
      // If countAvailableOnly is true, only count available products
      const result = await db.execute(
        countAvailableOnly 
          ? sql`
              SELECT 
                c.id, 
                c.name, 
                c.default_price as "defaultPrice",
                c.created_at as "createdAt",
                COUNT(CASE WHEN p.is_available = true THEN pc.product_id END) as "productCount"
              FROM 
                categories c
              LEFT JOIN 
                product_categories pc ON c.id = pc.category_id
              LEFT JOIN
                products p ON pc.product_id = p.id
              GROUP BY 
                c.id
              ORDER BY 
                c.name ASC
            `
          : sql`
              SELECT 
                c.id, 
                c.name, 
                c.default_price as "defaultPrice",
                c.created_at as "createdAt",
                COUNT(pc.product_id) as "productCount"
              FROM 
                categories c
              LEFT JOIN 
                product_categories pc ON c.id = pc.category_id
              GROUP BY 
                c.id
              ORDER BY 
                c.name ASC
            `
      );

      return result.rows as (Category & { productCount: number })[];
    } catch (error) {
      console.error('Error getting categories with counts:', error);
      throw error;
    }
  }

  /**
   * Add multiple categories to multiple products in bulk
   */
  async addBulkProductCategories(productIds: number[], categoryIds: number[]): Promise<void> {
    console.log(`Adding categories ${categoryIds.join(',')} to products ${productIds.join(',')}`);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // First, get category information to access defaultPrice
      const categories = await Promise.all(categoryIds.map(id => this.getCategory(id)));
      const validCategories = categories.filter((c): c is Category => c !== null);

      if (validCategories.length === 0) {
        throw new Error("No valid categories found");
      }

      // Create an array of rows to insert for all product-category combinations
      const values = [];
      for (const productId of productIds) {
        for (const categoryId of categoryIds) {
          values.push({ productId, categoryId });
        }
      }

      // Remove existing category assignments for these products
      await db.delete(productCategories)
        .where(inArray(productCategories.productId, productIds));

      // Insert new category assignments
      if (values.length > 0) {
        await db.insert(productCategories)
          .values(values);
      }

      // For each product, verify if a custom price exists
      // If not, apply the category's default price
      for (const productId of productIds) {
        // Get current product to check for custom price
        const [product] = await db
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, productId));

        if (!product) continue;

        // If no custom price is set, update with highest category price
        if (!product.customPrice) {
          const highestCategoryPrice = Math.max(...validCategories.map(c => c.defaultPrice));

          await db.update(productsTable)
            .set({
              categoryPrice: highestCategoryPrice,
              updatedAt: new Date()
            })
            .where(eq(productsTable.id, productId));
        }
      }

      await client.query('COMMIT');
      console.log(`Successfully added categories to ${productIds.length} products`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding bulk categories:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getCategory(id: number): Promise<Category | null> {
    try {
      const result = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, id))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error fetching category:', error);
      throw error;
    }
  }

async refreshCartItems(cartId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`Starting cart items refresh for cart ${cartId}`);

      // Get the current cart with items
      const cart = await this.getCart(cartId);
      if (!cart) {
        throw new Error("Cart not found");
      }

      // Increase batch size for better throughput
      const batchSize = 50;
      const maxRetries = 3;
      const failedUpdates: number[] = [];
      const totalItems = cart.items.length;

      console.log(`Refreshing availability for ${totalItems} items in cart ${cartId}`);

      // First, fetch all product availability statuses in bulk to minimize database calls
      const productIds = cart.items.map(item => item.productId);

      // Split into reasonable chunks for bulk query
      const productChunkSize = 100;
      const productAvailability = new Map<number, boolean>();

      for (let i = 0; i < productIds.length; i += productChunkSize) {
        const chunkIds = productIds.slice(i, i + productChunkSize);

        try {
          // Get availability status for multiple products at once
          const products = await db
            .select({ id: productsTable.id, isAvailable: productsTable.isAvailable })
            .from(productsTable)
            .where(inArray(productsTable.id, chunkIds));

          // Store in map for quick lookup
          products.forEach(product => {
            productAvailability.set(product.id, !!product.isAvailable);
          });
        } catch (error) {
          console.error(`Error fetching product availability for batch:`, error);
        }
      }

      // Now process cart items with the pre-fetched availability info
      for (let i = 0; i < totalItems; i += batchSize) {
        const batchItems = cart.items.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalItems/batchSize)} with ${batchItems.length} items`);

        // Process items in smaller parallel batches to prevent overwhelming the DB
        const parallelBatchSize = 10;
        for (let j = 0; j < batchItems.length; j += parallelBatchSize) {
          const parallelBatch = batchItems.slice(j, j + parallelBatchSize);

          const batchPromises = parallelBatch.map(async (item) => {
            let retryCount = 0;
            let success = false;

            while (!success && retryCount < maxRetries) {
              try {
                // Use pre-fetched product availability when possible
                let isAvailable = false;

                if (productAvailability.has(item.productId)) {
                  isAvailable = productAvailability.get(item.productId) || false;
                } else {
                  // Fall back to individual query if not in our map
                  const product = await this.getProduct(item.productId);
                  isAvailable = product ? !!product.isAvailable : false;
                }

                // Update the cart item's isAvailable field
                await db.update(cartItems)
                  .set({ isAvailable })
                  .where(eq(cartItems.id, item.id));

                success = true;
                console.log(`Successfully updated cart item ${item.id} availability to ${isAvailable}`);
                return { id: item.id, success: true };
              } catch (error) {
                retryCount++;
                console.error(`Failed attempt ${retryCount} for item ${item.id}:`, error);

                if (retryCount === maxRetries) {
                  return { id: item.id, success: false };
                } else {
                  // Short delay with exponential backoff
                  await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, retryCount - 1)));
                }
              }
            }

            return { id: item.id, success: false };
          });

          // Wait for this smaller parallel batch to complete
          const batchResults = await Promise.all(batchPromises);

          // Track failed updates
          const batchFailures = batchResults.filter(result => !result.success);
          failedUpdates.push(...batchFailures.map(failure => failure.id));
        }
      }

      if (failedUpdates.length > 0) {
        console.warn(`${failedUpdates.length} of ${totalItems} cart items failed to update: ${failedUpdates.join(', ')}`);
        if (failedUpdates.length >= totalItems) {
          throw new Error(`Failed to update all cart items: ${failedUpdates.join(', ')}`);
        }
      } else {
        console.log(`Successfully updated all ${totalItems} cart items`);
      }

      await client.query('COMMIT');
      console.log(`Successfully completed cart items refresh for cart ${cartId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error refreshing cart items for cart ${cartId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteCartItem(cartId: number, itemId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`Deleting item ${itemId} from cart ${cartId}`);

      // Delete the specific cart item
      const result = await db
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cartId),
            eq(cartItems.id, itemId)
          )
        )
        .returning();

      if (result.length === 0) {
        throw new Error(`Cart item ${itemId} not found in cart ${cartId}`);
      }

      console.log(`Successfully deleted item ${itemId} from cart ${cartId}`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error deleting cart item ${itemId} from cart ${cartId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const storage = new DatabaseStorage();