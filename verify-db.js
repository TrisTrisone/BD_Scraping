import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'users.db');

try {
  const db = new Database(dbPath);
  
  console.log('=== Database Verification ===\n');
  
  // Check tables
  console.log('Tables:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  tables.forEach(table => {
    console.log(`  ✓ ${table.name}`);
  });
  
  // Check users
  console.log('\nUsers:');
  const users = db.prepare('SELECT id, username, email, role FROM users').all();
  if (users.length === 0) {
    console.log('  ⚠ No users found (database may need initialization)');
  } else {
    users.forEach(user => {
      console.log(`  ✓ ${user.username} (${user.email}) - ${user.role}`);
    });
  }
  
  // Check API keys
  console.log('\nAPI Keys:');
  const keys = db.prepare('SELECT id, apollo_email, status FROM api_keys').all();
  if (keys.length === 0) {
    console.log('  ℹ No API keys found (add keys via UI)');
  } else {
    keys.forEach(key => {
      console.log(`  ✓ ${key.apollo_email} - ${key.status}`);
    });
  }
  
  console.log('\n✓ Database is healthy');
  db.close();
} catch (error) {
  if (error.code === 'SQLITE_CORRUPT') {
    console.error('✗ Database is corrupted. Delete users.db and restart server.');
  } else if (error.code === 'SQLITE_CANTOPEN') {
    console.log('ℹ Database does not exist yet. Start the server to create it.');
  } else {
    console.error('✗ Error:', error.message);
  }
  process.exit(1);
}

