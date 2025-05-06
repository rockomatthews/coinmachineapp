/**
 * This script ensures that all necessary directories for Drizzle migrations exist
 * before attempting to generate migrations, which prevents errors in CI environments
 */
const fs = require('fs');
const path = require('path');

// Define the paths that need to exist
const directories = [
  'src/db/migrations',
  'src/db/migrations/meta'
];

// Create directories if they don't exist
directories.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(fullPath, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

// Create an empty meta snapshot file if it doesn't exist
const snapshotFile = path.join(process.cwd(), 'src/db/migrations/meta/0000_snapshot.json');
if (!fs.existsSync(snapshotFile)) {
  console.log('Creating empty snapshot file');
  fs.writeFileSync(snapshotFile, JSON.stringify({
    version: '5',
    dialect: 'pg',
    id: '0000_snapshot',
    prevId: null,
    tables: {},
    enums: {},
    schemas: {},
    types: {}
  }, null, 2));
}

console.log('Migration directories setup complete'); 