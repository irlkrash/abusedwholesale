
import { db } from "../server/db";
import { categories } from "../shared/schema";
import { eq } from "drizzle-orm";

async function updateCategoryPrice() {
  try {
    console.log("Updating Heavy Jackets category price to $0.24...");
    
    // Find the Heavy Jackets category
    const categoryResult = await db
      .select()
      .from(categories)
      .where(eq(categories.name, "Heavy Jackets"));
    
    if (categoryResult.length === 0) {
      console.error("Category 'Heavy Jackets' not found");
      process.exit(1);
    }
    
    const category = categoryResult[0];
    console.log(`Found category: ${category.name} (ID: ${category.id}) with current price: $${category.defaultPrice}`);
    
    // Update the category price (stored in cents, so $0.24 = 24 cents)
    const result = await db
      .update(categories)
      .set({ defaultPrice: 24 })
      .where(eq(categories.id, category.id));
    
    console.log(`Successfully updated 'Heavy Jackets' price to $0.24`);
  } catch (error) {
    console.error("Error updating category price:", error);
  } finally {
    process.exit(0);
  }
}

updateCategoryPrice();
