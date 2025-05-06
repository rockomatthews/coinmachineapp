import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Check for DATABASE_URL (primary pooled connection from Vercel integration)
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in your environment variables');
}

// Create SQL executor for Neon - configured for serverless environments
const sql = neon(process.env.DATABASE_URL);

// Create the drizzle database instance
// @ts-ignore - Temporary type workaround for compatibility between drizzle and neon
export const db = drizzle(sql, { schema });

// Export a function to test the database connection
export const testConnection = async () => {
  try {
    const version = await sql`SELECT version()`;
    return { connected: true, version: version[0].version };
  } catch (error) {
    console.error('Database connection failed:', error);
    return { connected: false, error };
  }
}; 