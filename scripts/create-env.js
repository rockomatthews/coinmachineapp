// Script to create a .env.local file with Neon database connection details
const fs = require('fs');
const path = require('path');

// Neon connection details
const envVars = {
  DATABASE_URL: 'postgres://neondb_owner:npg_9OEeyh5zIiug@ep-curly-base-a6rv3dpu-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require',
  DATABASE_URL_UNPOOLED: 'postgresql://neondb_owner:npg_9OEeyh5zIiug@ep-curly-base-a6rv3dpu.us-west-2.aws.neon.tech/neondb?sslmode=require',
  PGHOST: 'ep-curly-base-a6rv3dpu-pooler.us-west-2.aws.neon.tech',
  PGHOST_UNPOOLED: 'ep-curly-base-a6rv3dpu.us-west-2.aws.neon.tech',
  PGUSER: 'neondb_owner',
  PGDATABASE: 'neondb',
  PGPASSWORD: 'npg_9OEeyh5zIiug',
  NEXT_PUBLIC_RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
  NEXT_PUBLIC_WS_ENDPOINT: 'wss://api.mainnet-beta.solana.com'
};

// Convert the object to environment variable format
const envContent = Object.entries(envVars)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

// Write to .env.local
fs.writeFileSync(path.join(__dirname, '../.env.local'), envContent);

console.log('.env.local file created with the following variables:');
Object.keys(envVars).forEach(key => {
  console.log(`- ${key}`);
});

console.log('\nThese variables will be available for your local development environment.');
console.log('Your Neon database connection is ready to use!'); 