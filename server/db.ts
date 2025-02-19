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
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false,
  } : false,
  max: 10, // Reduce max connections to prevent overwhelming the database
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increase timeout for production
  keepAlive: true,
  keepAliveInitialDelayMillis: 1000,
});

// Add error handler for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Attempt to reconnect with exponential backoff
  setTimeout(() => {
    console.log('Attempting to reconnect to database...');
    pool.connect()
      .then(() => console.log('Successfully reconnected to database'))
      .catch(error => console.error('Failed to reconnect:', error));
  }, 5000);
});

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