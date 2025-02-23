import { pgTable, text, serial, integer, boolean, jsonb, timestamp, index, primaryKey, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  defaultPrice: integer("default_price").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  images: text("images").array().notNull(),
  fullImages: text("fullImages").array().notNull().default([]),
  customPrice: integer("custom_price"),
  categoryPrice: integer("category_price"), 
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("name_idx").on(table.name),
  availabilityIdx: index("availability_idx").on(table.isAvailable),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export const productCategories = pgTable("product_categories", {
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey(table.productId, table.categoryId),
  productIdx: index("product_idx").on(table.productId),
  categoryIdx: index("category_idx").on(table.categoryId),
}));

export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  createdAtIdx: index("carts_created_at_idx").on(table.createdAt),
}));

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull().references(() => carts.id, { onDelete: 'cascade' }),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  images: text("images").array().notNull(),
  fullImages: text("full_images").array().notNull().default([]),
  price: integer("price").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  cartIdIdx: index("cart_items_cart_id_idx").on(table.cartId),
  productIdIdx: index("cart_items_product_id_idx").on(table.productId),
}));

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  items: jsonb("items").notNull(),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
}));

export const productsToCategories = relations(products, ({ many }) => ({
  categories: many(productCategories),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesToProducts = relations(categories, ({ many }) => ({
  products: many(productCategories),
}));

export const insertCategorySchema = createInsertSchema(categories)
  .pick({
    name: true,
    defaultPrice: z.number().int().min(0),
  });

export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    password: true,
  })
  .extend({
    secretCode: z.string().optional(),
  });

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  images: true,
  fullImages: true,
  isAvailable: true,
}).extend({
  categories: z.array(z.number()).optional(),
  customPrice: z.number().nullable().optional(),
});

export const cartItemSchema = z.object({
  productId: z.number(),
  name: z.string().min(1, "Product name is required"),
  description: z.string(),
  images: z.array(z.string()),
  fullImages: z.array(z.string()).optional(),
  price: z.number().min(0, "Price must be non-negative").transform(val => Number(val.toFixed(2))),
  isAvailable: z.boolean().optional(),
  createdAt: z.string().or(z.date()).optional()
});

export const insertCartItemSchema = createInsertSchema(cartItems);

export const insertCartSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  items: z.array(cartItemSchema)
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  customerName: true,
  customerEmail: true,
  items: true,
  status: true,
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertCart = z.infer<typeof insertCartSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect & { categories?: Category[] };
export type Cart = typeof carts.$inferSelect & { items: CartItem[] };
export type Order = typeof orders.$inferSelect;