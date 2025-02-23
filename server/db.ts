import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('Initializing database connection...');

// Implement retrying pool creation
const createPool = (retries = 5, delay = 5000): Pool => {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false,
    } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 1000,
  });

  pool.on('error', async (err) => {
    console.error('Unexpected error on idle client', err);
    if (retries > 0) {
      console.log(`Attempting to reconnect... (${retries} retries left)`);
      await pool.end();
      setTimeout(() => {
        createPool(retries - 1, delay * 1.5);
      }, delay);
    } else {
      console.error('Max retries reached. Could not establish database connection.');
      process.exit(1);
    }
  });

  return pool;
};

export const pool = createPool();

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing pool...');
  try {
    await pool.end();
    console.log('Pool closed successfully');
  } catch (err) {
    console.error('Error closing pool:', err);
  }
  process.exit(0);
});

export const db = drizzle(pool, { schema });