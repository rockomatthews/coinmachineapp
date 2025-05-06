/**
 * This script uses the pg library to run SQL migrations directly against the database
 * This is needed for creating types and other schema operations that the serverless client
 * doesn't support directly
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database connection parameters
const dbConfig = {
  host: 'ep-curly-base-a6rv3dpu.us-west-2.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_9OEeyh5zIiug',
  ssl: {
    rejectUnauthorized: true,
  },
};

async function createSchema() {
  // Create a new PostgreSQL client - use the UNPOOLED connection
  const client = new Client(dbConfig);
  
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully.');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../src/db/migrations/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration script...');
    // Execute the SQL as a single transaction
    await client.query('BEGIN');
    
    try {
      // Execute the entire migration script in one go
      await client.query(sql);
      await client.query('COMMIT');
      console.log('Migration completed successfully!');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    
    // Verify the tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    
    console.log('\nTables in the database:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Verify the types were created
    const typesResult = await client.query(`
      SELECT typname 
      FROM pg_type 
      JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
      WHERE pg_namespace.nspname = 'public';
    `);
    
    console.log('\nCustom types in the database:');
    typesResult.rows.forEach(row => {
      console.log(`- ${row.typname}`);
    });
    
  } catch (error) {
    console.error('Error creating schema:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

createSchema(); 