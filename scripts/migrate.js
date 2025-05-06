// Execute SQL migrations against Neon database
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Using the connection string directly (you'd need to replace this in production)
const DATABASE_URL = 'postgres://neondb_owner:npg_9OEeyh5zIiug@ep-curly-base-a6rv3dpu-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  try {
    // Connect to the Neon database
    const sql = neon(DATABASE_URL);
    
    // Read the migration SQL
    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../src/db/migrations/migration.sql'),
      'utf8'
    );

    // Split the SQL into separate statements (Neon can't execute multiple statements at once)
    console.log('Parsing migration SQL...');
    // This is a simple split that works for most basic SQL scripts
    // For more complex scripts with embedded semicolons, a proper SQL parser would be better
    const sqlStatements = migrationSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`Found ${sqlStatements.length} SQL statements to execute`);

    // Execute each SQL statement separately
    for(let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      try {
        console.log(`Executing statement ${i+1}/${sqlStatements.length}...`);
        console.log(`SQL: ${statement.substring(0, 60)}${statement.length > 60 ? '...' : ''}`);
        
        // Using sql as a template literal function to execute the statement
        await sql`${statement}`;
        console.log(`Statement ${i+1} executed successfully`);
      } catch (err) {
        // Log the error but continue with other statements
        console.error(`Error executing statement ${i+1}: ${err.message}`);
        if (err.code === '42P07') { // duplicate table error
          console.log('Table already exists, continuing...');
        } else if (err.code === '42710') { // duplicate enum error
          console.log('Enum type already exists, continuing...');
        } else {
          throw err; // rethrow other errors
        }
      }
    }
    
    console.log('Migration execution complete!');
    
    // Verify by querying for the tables
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    
    console.log('Tables in the database:');
    tablesResult.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 