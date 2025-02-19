import { pgTable, text, serial, integer, boolean, jsonb, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  images: text("images").array().notNull(),
  fullImages: text("fullImages").array().notNull().default([]),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("name_idx").on(table.name),
  availabilityIdx: index("availability_idx").on(table.isAvailable),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

// Junction table for product-category relationship
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
  customerEmail: text("customer_email").notNull(),
  items: jsonb("items").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  customerEmailIdx: index("customer_email_idx").on(table.customerEmail),
  createdAtIdx: index("carts_created_at_idx").on(table.createdAt),
  itemsGinIdx: index("items_gin_idx").on(table.items).using('gin')
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

// Schema for category operations
export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
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
});

export const cartItemSchema = z.object({
  productId: z.number(),
  name: z.string(),
  description: z.string(),
  images: z.array(z.string()),
  isAvailable: z.boolean(),
  createdAt: z.string()
});

export const insertCartSchema = createInsertSchema(carts).pick({
  customerName: true,
  customerEmail: true,
}).extend({
  items: z.array(cartItemSchema),
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  customerName: true,
  customerEmail: true,
  items: true,
  status: true,
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type CartItem = z.infer<typeof cartItemSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertCart = z.infer<typeof insertCartSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect & { categories?: Category[] };
export type Cart = typeof carts.$inferSelect;
export type Order = typeof orders.$inferSelect;