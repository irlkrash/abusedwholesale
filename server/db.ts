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
  ssl: process.env.NODE_ENV === 'production',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 1000,
});

// Add error handler for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Attempt to reconnect
  setTimeout(() => {
    console.log('Attempting to reconnect to database...');
    pool.connect().catch(console.error);
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

export const db = drizzle({ client: pool, schema });