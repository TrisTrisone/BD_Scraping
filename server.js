// import express from 'express';
// import cors from 'cors';
// import bcrypt from 'bcryptjs';
// import Database from 'better-sqlite3';
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path';
// import https from 'https';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const app = express();
// const PORT = 3001;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Initialize SQLite database
// const dbPath = join(__dirname, 'users.db');
// let db;

// // Initialize database with error handling for corrupted/invalid files
// const initializeDatabase = async () => {
//   const fs = await import('fs');
  
//   // Check if file exists and might be corrupted
//   if (fs.default.existsSync(dbPath)) {
//     try {
//       // Try to open it to check if it's valid
//       const testDb = new Database(dbPath);
//       testDb.prepare('SELECT 1').get();
//       testDb.close();
//     } catch (err) {
//       // If it's corrupted or invalid, delete it
//       if (err.code === 'SQLITE_CORRUPT' || err.code === 'SQLITE_NOTADB') {
//         console.log('⚠️  Removing corrupted database file...');
//         try {
//           fs.default.unlinkSync(dbPath);
//         } catch (e) {
//           console.error('Could not delete corrupted file:', e);
//         }
//       }
//     }
//   }
  
//   // Now initialize the database
//   try {
//     db = new Database(dbPath);
    
//     // Create users table if it doesn't exist
//     db.exec(`
//       CREATE TABLE IF NOT EXISTS users (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         username TEXT NOT NULL UNIQUE,
//         email TEXT NOT NULL UNIQUE,
//         password TEXT NOT NULL,
//         role TEXT NOT NULL CHECK(role IN ('user', 'admin'))
//       )
//     `);

//     // Create API keys table if it doesn't exist
//     db.exec(`
//       CREATE TABLE IF NOT EXISTS api_keys (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         apollo_email TEXT NOT NULL,
//         api_key TEXT NOT NULL UNIQUE,
//         status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('used', 'unused'))
//       )
//     `);
    
//     console.log('✓ Database initialized');
//   } catch (error) {
//     console.error('Failed to initialize database:', error);
//     throw error;
//   }
// };

// // Initialize with default admin user if database is empty
// const initializeDefaultUsers = async () => {
//   try {
//     const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
//     if (userCount.count === 0) {
//       const defaultAdminPassword = await bcrypt.hash('admin123', 10);
//       db.prepare(`
//         INSERT INTO users (username, email, password, role)
//         VALUES (?, ?, ?, ?)
//       `).run('admin', 'admin@tristone-partners.com', defaultAdminPassword, 'admin');
      
//       const defaultUserPassword = await bcrypt.hash('user123', 10);
//       db.prepare(`
//         INSERT INTO users (username, email, password, role)
//         VALUES (?, ?, ?, ?)
//       `).run('user', 'user@tristone-partners.com', defaultUserPassword, 'user');
      
//       console.log('✓ Default users created:');
//       console.log('  Admin: admin@tristone-partners.com / admin123');
//       console.log('  User: user@tristone-partners.com / user123');
//     } else {
//       console.log('✓ Users table already has data');
//     }
    
//     // Verify API keys table exists
//     const apiKeyCount = db.prepare('SELECT COUNT(*) as count FROM api_keys').get();
//     console.log(`✓ API keys table ready (${apiKeyCount.count} keys)`);
//   } catch (error) {
//     console.error('Error initializing database:', error);
//     throw error;
//   }
// };


// // Helper function to validate email domain
// const validateEmailDomain = (email) => {
//   return email && email.toLowerCase().endsWith('@tristone-partners.com');
// };

// // Login endpoint
// app.post('/api/login', async (req, res) => {
//   try {
//     const { email, password, role } = req.body;

//     if (!email || !password || !role) {
//       return res.status(400).json({ error: 'Email, password, and role are required' });
//     }

//     // Validate email domain
//     if (!validateEmailDomain(email)) {
//       return res.status(400).json({ error: 'Email must be from @tristone-partners.com domain' });
//     }

//     const user = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, role);

//     if (!user) {
//       return res.status(401).json({ error: 'Invalid credentials or role mismatch' });
//     }

//     const isValidPassword = await bcrypt.compare(password, user.password);

//     if (!isValidPassword) {
//       return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     // Return user info (excluding password)
//     res.json({
//       id: user.id,
//       username: user.username,
//       email: user.email,
//       role: user.role
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Get all users (admin only)
// app.get('/api/users', (req, res) => {
//   try {
//     const users = db.prepare('SELECT id, username, email, role FROM users ORDER BY id').all();
//     res.json(users);
//   } catch (error) {
//     console.error('Get users error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Create new user (admin only)
// app.post('/api/users', async (req, res) => {
//   try {
//     const { username, email, password, role } = req.body;

//     if (!username || !email || !password || !role) {
//       return res.status(400).json({ error: 'Username, email, password, and role are required' });
//     }

//     // Validate email domain
//     if (!validateEmailDomain(email)) {
//       return res.status(400).json({ error: 'Email must be from @tristone-partners.com domain' });
//     }

//     if (role !== 'user' && role !== 'admin') {
//       return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
//     }

//     // Check if username or email already exists
//     const existingUser = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, email);
//     if (existingUser) {
//       return res.status(400).json({ error: 'Username or email already exists' });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert new user
//     const result = db.prepare(`
//       INSERT INTO users (username, email, password, role)
//       VALUES (?, ?, ?, ?)
//     `).run(username, email, hashedPassword, role);

//     res.json({
//       id: result.lastInsertRowid,
//       username,
//       email,
//       role
//     });
//   } catch (error) {
//     console.error('Create user error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Delete user (admin only)
// app.delete('/api/users/:id', (req, res) => {
//   try {
//     const { id } = req.params;
//     const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);

//     if (result.changes === 0) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     res.json({ message: 'User deleted successfully' });
//   } catch (error) {
//     console.error('Delete user error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // API Key Management Endpoints

// // Get all API keys
// app.get('/api/api-keys', (req, res) => {
//   try {
//     const keys = db.prepare('SELECT * FROM api_keys ORDER BY id').all();
//     res.json(keys);
//   } catch (error) {
//     console.error('Get API keys error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Get next unused API key
// app.get('/api/api-keys/next-unused', (req, res) => {
//   try {
//     const key = db.prepare('SELECT * FROM api_keys WHERE status = ? ORDER BY id LIMIT 1').get('unused');
//     if (!key) {
//       return res.status(404).json({ error: 'No unused API keys available' });
//     }
//     res.json(key);
//   } catch (error) {
//     console.error('Get next unused API key error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Add new API key
// app.post('/api/api-keys', (req, res) => {
//   try {
//     const { apollo_email, api_key } = req.body;

//     if (!apollo_email || !api_key) {
//       return res.status(400).json({ error: 'Apollo email and API key are required' });
//     }

//     // Validate email domain
//     // if (!validateEmailDomain(apollo_email)) {
//     //   return res.status(400).json({ error: 'Apollo email must be from @tristone-partners.com domain' });
//     // }

//     // Check if API key already exists
//     const existingKey = db.prepare('SELECT * FROM api_keys WHERE api_key = ?').get(api_key);
//     if (existingKey) {
//       return res.status(400).json({ error: 'API key already exists' });
//     }

//     const result = db.prepare(`
//       INSERT INTO api_keys (apollo_email, api_key, status)
//       VALUES (?, ?, ?)
//     `).run(apollo_email, api_key, 'unused');

//     res.json({
//       id: result.lastInsertRowid,
//       apollo_email,
//       api_key,
//       status: 'unused'
//     });
//   } catch (error) {
//     console.error('Add API key error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Mark API key as used
// app.put('/api/api-keys/:id/mark-used', (req, res) => {
//   try {
//     const { id } = req.params;
//     const result = db.prepare('UPDATE api_keys SET status = ? WHERE id = ?').run('used', id);

//     if (result.changes === 0) {
//       return res.status(404).json({ error: 'API key not found' });
//     }

//     res.json({ message: 'API key marked as used' });
//   } catch (error) {
//     console.error('Mark API key as used error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Reset API key status to unused
// app.put('/api/api-keys/:id/reset', (req, res) => {
//   try {
//     const { id } = req.params;
//     const result = db.prepare('UPDATE api_keys SET status = ? WHERE id = ?').run('unused', id);

//     if (result.changes === 0) {
//       return res.status(404).json({ error: 'API key not found' });
//     }

//     res.json({ message: 'API key reset to unused' });
//   } catch (error) {
//     console.error('Reset API key error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Delete API key
// app.delete('/api/api-keys/:id', (req, res) => {
//   try {
//     const { id } = req.params;
//     const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);

//     if (result.changes === 0) {
//       return res.status(404).json({ error: 'API key not found' });
//     }

//     res.json({ message: 'API key deleted successfully' });
//   } catch (error) {
//     console.error('Delete API key error:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Apollo Proxy (avoids browser CORS; server-side fetch)
// const apolloAgent = new https.Agent({ keepAlive: true });

// const forwardToApollo = async ({ url, method = 'POST', apolloApiKey, body }) => {
//   const headers = {
//     'accept': 'application/json',
//     'cache-control': 'no-cache',
//     'content-type': 'application/json',
//     'x-api-key': apolloApiKey
//   };
//   const resp = await fetch(url, {
//     method,
//     headers,
//     body: body ? JSON.stringify(body) : undefined,
//     // Keep-alive agent helps on Windows
//     agent: apolloAgent
//   });
//   const text = await resp.text();
//   let json = null;
//   try { json = text ? JSON.parse(text) : null; } catch (_) {}
//   return { status: resp.status, ok: resp.ok, json, text };
// };

// // POST /api/apollo/bulk_match
// app.post('/api/apollo/bulk_match', async (req, res) => {
//   try {
//     const { apiKey, details } = req.body || {};
//     if (!apiKey || !Array.isArray(details)) {
//       return res.status(400).json({ error: 'apiKey and details[] are required' });
//     }
//     const url = 'https://api.apollo.io/api/v1/people/bulk_match?reveal_personal_emails=false&reveal_phone_number=false';
//     console.debug('[Apollo Proxy] bulk_match →', { count: details.length });
//     const { status, ok, json, text } = await forwardToApollo({ url, apolloApiKey: apiKey, body: { details } });
//     console.debug('[Apollo Proxy] bulk_match ←', { status, ok });
//     if (!ok) return res.status(status).json(json || { error: text || 'Apollo error' });
//     return res.status(200).json(json || {});
//   } catch (err) {
//     console.error('[Apollo Proxy] bulk_match error:', err);
//     return res.status(502).json({ error: 'Upstream error', details: err?.message || String(err) });
//   }
// });

// // POST /api/apollo/single_match
// app.post('/api/apollo/single_match', async (req, res) => {
//   try {
//     const { apiKey, first_name, last_name, organization_name } = req.body || {};
//     if (!apiKey || !first_name || !last_name) {
//       return res.status(400).json({ error: 'apiKey, first_name, last_name are required' });
//     }
//     const url = 'https://api.apollo.io/api/v1/people/match?reveal_personal_emails=false&reveal_phone_number=false';
//     const payload = { first_name, last_name };
//     if (organization_name) payload.organization_name = organization_name;
//     console.debug('[Apollo Proxy] single_match →', { first_name, last_name, hasOrg: !!organization_name });
//     const { status, ok, json, text } = await forwardToApollo({ url, apolloApiKey: apiKey, body: payload });
//     console.debug('[Apollo Proxy] single_match ←', { status, ok });
//     if (!ok) return res.status(status).json(json || { error: text || 'Apollo error' });
//     return res.status(200).json(json || {});
//   } catch (err) {
//     console.error('[Apollo Proxy] single_match error:', err);
//     return res.status(502).json({ error: 'Upstream error', details: err?.message || String(err) });
//   }
// });

// // Start server after database initialization
// (async () => {
//   try {
//     // First initialize the database
//     await initializeDatabase();
    
//     // Then initialize default users
//     await initializeDefaultUsers();
//     console.log('✓ Default users initialized\n');
    
//     // Finally start the server
//     app.listen(PORT, () => {
//       console.log(`✓ Server running on http://localhost:${PORT}`);
//       console.log('\nDefault credentials:');
//       console.log('  Admin: admin@tristone-partners.com / admin123');
//       console.log('  User: user@tristone-partners.com / user123\n');
//     });
//   } catch (error) {
//     console.error('Failed to initialize:', error);
//     process.exit(1);
//   }
// })();

// ------------------------- Imports -------------------------
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { fileURLToPath } from "url";
import { dirname } from "path";
import https from "https";
import dotenv from "dotenv";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// ------------------------- Config -------------------------
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ------------------------- Middleware -------------------------
app.use(express.json());
app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// ------------------------- Env Variables -------------------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

// ------------------------- Encryption Utils -------------------------
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES block size = 16 bytes

function getEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY || "";
  // Prefer hex input (backward compatible). If invalid, derive key via SHA-256 of raw string.
  try {
    const asHex = Buffer.from(raw, "hex");
    if (asHex.length === 32) return asHex;
  } catch (_) {}
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function decrypt(text) {
  const key = getEncryptionKey();
  const [ivHex, encryptedData] = text.split(":");
  if (!ivHex || !encryptedData) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(ivHex, "hex");
  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ------------------------- Postgres Initialization -------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RENDER || process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

async function query(sql, params) {
  const res = await pool.query(sql, params);
  return res;
}

const initializeDatabase = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','admin'))
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      apollo_email TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('used','unused'))
    );
  `);
  console.log("✓ Database initialized");
};

// ------------------------- Default Users -------------------------
const initializeDefaultUsers = async () => {
  const { rows } = await query("SELECT COUNT(*)::int AS count FROM users");
  const count = rows[0]?.count || 0;
  if (count === 0) {
    const adminEmail = ADMIN_EMAIL || "admin@tristone-partners.com";
    const adminPassword = ADMIN_PASSWORD || "admin123";
    const hashedAdmin = await bcrypt.hash(adminPassword, 10);
    await query(
      "INSERT INTO users (username, email, password, role) VALUES ($1,$2,$3,$4)",
      ["admin", adminEmail, hashedAdmin, "admin"]
    );

    const hashedUser = await bcrypt.hash("user123", 10);
    await query(
      "INSERT INTO users (username, email, password, role) VALUES ($1,$2,$3,$4)",
      ["user", "user@tristone-partners.com", hashedUser, "user"]
    );

    console.log("✓ Default users created");
  } else {
    console.log("✓ Users table already populated");
  }
};

// ------------------------- JWT Middleware -------------------------
const requireAuth = (roles = []) => {
  return (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: "Forbidden: insufficient role" });
      }
      next();
    } catch (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
  };
};

// ------------------------- Auth Routes -------------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role)
      return res
        .status(400)
        .json({ error: "Email, password, and role are required" });

    const { rows } = await query(
      "SELECT * FROM users WHERE email = $1 AND role = $2",
      [email, role]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------- User Management -------------------------
app.get("/api/users", requireAuth(["admin", "user"]), async (req, res) => {
  const { rows } = await query(
    "SELECT id, username, email, role FROM users ORDER BY id"
  );
  res.json(rows);
});

app.post("/api/users", requireAuth(["admin", "user"]), async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role)
    return res.status(400).json({ error: "All fields required" });

  const { rows: exists } = await query(
    "SELECT 1 FROM users WHERE username = $1 OR email = $2",
    [username, email]
  );
  if (exists.length) return res.status(400).json({ error: "User exists" });

  const hashed = await bcrypt.hash(password, 10);
  const { rows } = await query(
    "INSERT INTO users (username, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id",
    [username, email, hashed, role]
  );
  res.json({ id: rows[0].id, username, email, role });
});

app.delete("/api/users/:id", requireAuth(["admin", "user"]), async (req, res) => {
  const result = await query("DELETE FROM users WHERE id = $1", [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });
  res.json({ message: "User deleted" });
});

// ------------------------- API Key Management -------------------------
app.get("/api/api-keys", requireAuth(["admin", "user"]), async (req, res) => {
  const { rows } = await query(
    "SELECT id, apollo_email, status FROM api_keys ORDER BY id"
  );
  res.json(rows);
});

app.post("/api/api-keys", requireAuth(["admin", "user"]), async (req, res) => {
  const { apollo_email, api_key } = req.body;
  if (!apollo_email || !api_key)
    return res.status(400).json({ error: "Apollo email and API key required" });

  const encrypted = encrypt(api_key);
  const { rows } = await query(
    "INSERT INTO api_keys (apollo_email, api_key, status) VALUES ($1,$2,'unused') RETURNING id",
    [apollo_email, encrypted]
  );
  res.json({ id: rows[0].id, apollo_email, status: "unused" });
});

app.put("/api/api-keys/:id/mark-used", requireAuth(["admin", "user"]), async (req, res) => {
  const result = await query(
    "UPDATE api_keys SET status='used' WHERE id=$1",
    [req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Key not found" });
  res.json({ message: "Marked as used" });
});

app.put("/api/api-keys/:id/reset", requireAuth(["admin", "user"]), async (req, res) => {
  const result = await query(
    "UPDATE api_keys SET status='unused' WHERE id=$1",
    [req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Key not found" });
  res.json({ message: "Reset to unused" });
});

app.delete("/api/api-keys/:id", requireAuth(["admin", "user"]), async (req, res) => {
  const result = await query(
    "DELETE FROM api_keys WHERE id=$1",
    [req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Key not found" });
  res.json({ message: "Deleted" });
});

// ------------------------- Apollo Proxy -------------------------
const apolloAgent = new https.Agent({ keepAlive: true });
async function nodeFetch(url, options) {
  const f = globalThis.fetch || (await import("node-fetch")).default;
  return f(url, options);
}
const forwardToApollo = async ({ url, apolloApiKey, body }) => {
  const resp = await nodeFetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": apolloApiKey,
    },
    body: JSON.stringify(body),
    // keep-alive agent for Node HTTPS
    agent: apolloAgent,
  });
  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { status: resp.status, ok: resp.ok, json, text };
};

app.post("/api/apollo/bulk_match", requireAuth(["admin", "user"]), async (req, res) => {
  const { apiKeyId, details } = req.body || {};
  if (!apiKeyId || !Array.isArray(details))
    return res.status(400).json({ error: "apiKeyId and details required" });

  const { rows } = await query(
    "SELECT api_key FROM api_keys WHERE id=$1",
    [apiKeyId]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Key not found" });

  let decrypted = row.api_key;
  // Backward compatibility: accept plaintext keys (no IV prefix)
  if (typeof decrypted === "string" && decrypted.includes(":")) {
    try {
      const [ivHex] = decrypted.split(":");
      if (/^[0-9a-fA-F]{32}$/.test(ivHex)) {
        decrypted = decrypt(decrypted);
      }
    } catch (e) {
      return res.status(500).json({ error: "Failed to decrypt API key" });
    }
  }
  const url = "https://api.apollo.io/api/v1/people/bulk_match?reveal_personal_emails=false&reveal_phone_number=false";
  try {
    const { status, ok, json, text } = await forwardToApollo({ url, apolloApiKey: decrypted, body: { details } });
    if (!ok) return res.status(status).json(json || { error: text || "Apollo error" });
    return res.status(200).json(json || {});
  } catch (err) {
    return res.status(502).json({ error: "Upstream error", details: err.message });
  }
});

app.post("/api/apollo/single_match", requireAuth(["admin", "user"]), async (req, res) => {
  const { apiKeyId, first_name, last_name, organization_name } = req.body || {};
  if (!apiKeyId || !first_name || !last_name)
    return res.status(400).json({ error: "Missing fields" });

  const { rows } = await query(
    "SELECT api_key FROM api_keys WHERE id=$1",
    [apiKeyId]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Key not found" });

  let decrypted = row.api_key;
  // Backward compatibility: accept plaintext keys (no IV prefix)
  if (typeof decrypted === "string" && decrypted.includes(":")) {
    try {
      const [ivHex] = decrypted.split(":");
      if (/^[0-9a-fA-F]{32}$/.test(ivHex)) {
        decrypted = decrypt(decrypted);
      }
    } catch (e) {
      return res.status(500).json({ error: "Failed to decrypt API key" });
    }
  }
  const url = "https://api.apollo.io/api/v1/people/match?reveal_personal_emails=false&reveal_phone_number=false";
  const payload = { first_name, last_name };
  if (organization_name) payload.organization_name = organization_name;

  try {
    const { status, ok, json, text } = await forwardToApollo({ url, apolloApiKey: decrypted, body: payload });
    if (!ok) return res.status(status).json(json || { error: text || "Apollo error" });
    return res.status(200).json(json || {});
  } catch (err) {
    return res.status(502).json({ error: "Upstream error", details: err.message });
  }
});

// ------------------------- Start Server -------------------------
(async () => {
  // Validate critical env before serving requests
  if (!JWT_SECRET) {
    console.error("JWT_SECRET is required. Set it in your environment (e.g., .env).");
    process.exit(1);
  }
  try {
    // Validate encryption key format early (will derive if not hex)
    getEncryptionKey();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  // Ensure DB connectivity early
  try {
    await pool.query("SELECT 1");
  } catch (e) {
    console.error("Failed to connect to Postgres:", e.message);
    process.exit(1);
  }

  await initializeDatabase();
  await initializeDefaultUsers();
  app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));
})();
