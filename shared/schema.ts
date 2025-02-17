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

export const productCategories = pgTable("product_categories", {
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey(table.productId, table.categoryId),
  productIdx: index("product_categories_product_id_idx").on(table.productId),
  categoryIdx: index("product_categories_category_id_idx").on(table.categoryId),
}));

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  images: text("images").array().notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("name_idx").on(table.name),
  availabilityIdx: index("availability_idx").on(table.isAvailable),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  items: jsonb("items").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  items: jsonb("items").notNull(),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    password: true,
  })
  .extend({
    secretCode: z.string().optional(),
  });

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  images: true,
  isAvailable: true,
});

export const insertCartSchema = createInsertSchema(carts).pick({
  customerName: true,
  customerEmail: true,
  items: true,
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  customerName: true,
  customerEmail: true,
  items: true,
  status: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertCart = z.infer<typeof insertCartSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type Order = typeof orders.$inferSelect;