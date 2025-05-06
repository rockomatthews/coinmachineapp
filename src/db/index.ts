import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be a Neon postgres connection string');
}

// Connection optimized for edge functions
const sql = neon(process.env.DATABASE_URL, { 
  fetchOptions: { cache: 'no-store' }
});

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