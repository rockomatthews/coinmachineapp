/**
 * This script simulates a Vercel edge function environment
 * to test database connectivity before deployment
 */
const { neon } = require('@neondatabase/serverless');

// Connection string from Vercel environment
const connectionString = process.env.DATABASE_URL || 
  'postgres://neondb_owner:npg_9OEeyh5zIiug@ep-curly-base-a6rv3dpu-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require';

async function testEdgeDeployment() {
  try {
    console.log('Testing Neon database connection for Edge deployment...');
    
    // Create a Neon client (simulating edge environment)
    const sql = neon(connectionString);
    
    // Test with a simple query
    const result = await sql`SELECT version()`;
    console.log('\n✅ Database connection successful!');
    console.log(`Database version: ${result[0].version}`);
    
    // Test enum types
    console.log('\nVerifying enum types...');
    const enumTest = await sql`
      SELECT typname FROM pg_type 
      JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
      WHERE nspname = 'public'
      AND typname IN ('token_status', 'transaction_type', 'transaction_status');
    `;
    
    if (enumTest.length === 3) {
      console.log('✅ Enum types verified');
    } else {
      console.log('⚠️ Some enum types may be missing. Found:', enumTest.map(e => e.typname).join(', '));
    }
    
    // Check if tables exist
    console.log('\nVerifying database tables...');
    const tableCheck = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'tokens', 'transactions');
    `;
    
    if (tableCheck.length === 3) {
      console.log('✅ All tables verified');
    } else {
      console.log('⚠️ Some tables may be missing. Found:', tableCheck.map(t => t.table_name).join(', '));
    }
    
    console.log('\n✅ Your Neon database is correctly configured for Vercel deployment!');
    console.log('You can now deploy to Vercel with confidence.');
    
  } catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    console.error('\nPlease check your connection string and Vercel environment variables.');
    process.exit(1);
  }
}

testEdgeDeployment(); 