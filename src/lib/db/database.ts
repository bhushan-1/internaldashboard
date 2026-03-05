import initSqlJs, { Database as SqlJsDatabase } from "sql.js";

let db: SqlJsDatabase | null = null;
let dbReady: Promise<SqlJsDatabase> | null = null;

const DB_STORAGE_KEY = "datahub_sqlite_db";

// Pre-computed bcrypt hash of "Admin@123" (cost 10)
const ADMIN_PASSWORD_HASH = "$2b$10$HDc.sSnqxBU.2MjrwWa0nOFbi/BQCPRZhbf9zncplfN4gFn0GRkDu";

/** Helper: run a parameterized INSERT/UPDATE/DELETE using prepared statements */
export function dbRun(database: SqlJsDatabase, sql: string, params: unknown[] = []) {
  const stmt = database.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  stmt.step();
  stmt.free();
}

/** Helper: run a parameterized SELECT using prepared statements */
export function dbQuery(database: SqlJsDatabase, sql: string, params: unknown[] = []) {
  const stmt = database.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  const rows: unknown[][] = [];
  const cols: string[] = stmt.getColumnNames();
  while (stmt.step()) {
    rows.push(stmt.get());
  }
  stmt.free();
  return rows.length ? [{ columns: cols, values: rows }] : [];
}

function saveToLocalStorage(database: SqlJsDatabase) {
  try {
    const data = database.export();
    const arr = Array.from(data);
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error("Failed to save DB to localStorage:", e);
  }
}

function loadFromLocalStorage(): Uint8Array | null {
  try {
    const stored = localStorage.getItem(DB_STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      return new Uint8Array(arr);
    }
  } catch (e) {
    console.error("Failed to load DB from localStorage:", e);
  }
  return null;
}

function seedDefaultAdmin(database: SqlJsDatabase) {
  try {
    const existing = database.exec("SELECT COUNT(*) as cnt FROM auth_users");
    const count = existing[0]?.values[0]?.[0] ?? 0;
    console.log("[DB] Existing user count:", count);
    if (count === 0) {
      const adminId = crypto.randomUUID();
      const roleId = crypto.randomUUID();
      const now = new Date().toISOString();

      dbRun(database,
        "INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        [adminId, "admin@datahub.com", ADMIN_PASSWORD_HASH, now]
      );
      dbRun(database,
        "INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [roleId, adminId, "admin", now, now]
      );
      console.log("[DB] Seeded default admin: admin@datahub.com / Admin@123");
    }
  } catch (e) {
    console.error("[DB] Seed failed:", e);
    throw e;
  }
}

function initSchema(database: SqlJsDatabase) {
  database.run(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES auth_users(id)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      component_name TEXT NOT NULL,
      has_access INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES auth_users(id),
      UNIQUE(user_id, component_name)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      component_name TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT,
      user_user_name TEXT,
      api_key TEXT,
      app_name TEXT,
      plan_id TEXT,
      stripe_customer_id TEXT,
      stripe_customer TEXT,
      stripe_mode TEXT,
      cognito_user_id TEXT,
      third_party_user_id TEXT,
      has_payment_problem INTEGER DEFAULT 0,
      is_admin_blocked INTEGER DEFAULT 0,
      is_multi_free_trial_blocked INTEGER DEFAULT 0,
      is_test_mode INTEGER DEFAULT 0,
      is_user_email_verified INTEGER DEFAULT 0,
      on_yearly_plan INTEGER DEFAULT 0,
      plan_free_top_up_credits INTEGER DEFAULT 0,
      current_period_start INTEGER,
      current_period_end INTEGER,
      additional_billing_emails TEXT,
      email_verification_token TEXT,
      initial_company_name TEXT,
      initial_ip TEXT,
      initial_ip_info TEXT,
      plan_id_updated_at TEXT,
      previous_plan_id TEXT,
      user_email_preferences_error INTEGER DEFAULT 0,
      user_email_preferences_system INTEGER DEFAULT 1,
      user_email_preferences_update INTEGER DEFAULT 1,
      user_email_unsubscribe_token TEXT,
      user_release_notes_last_read_date INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at_epoch INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  if (!dbReady) {
    dbReady = (async () => {
      console.log("[DB] Initializing SQLite...");
      const SQL = await initSqlJs({
        locateFile: () => "/sql-wasm.wasm",
      });
      console.log("[DB] WASM loaded successfully");

      // Try to restore; if it fails, start fresh
      let database: SqlJsDatabase;
      const saved = loadFromLocalStorage();
      if (saved) {
        try {
          database = new SQL.Database(saved);
          // Verify the DB is valid
          database.exec("SELECT COUNT(*) FROM auth_users");
          console.log("[DB] Restored from localStorage");
        } catch (e) {
          console.warn("[DB] Corrupted localStorage DB, starting fresh:", e);
          localStorage.removeItem(DB_STORAGE_KEY);
          database = new SQL.Database();
        }
      } else {
        console.log("[DB] No saved DB, creating new");
        database = new SQL.Database();
      }

      initSchema(database);
      console.log("[DB] Schema initialized");
      seedDefaultAdmin(database);
      console.log("[DB] Seed complete");
      saveToLocalStorage(database);

      db = database;
      return database;
    })().catch((err) => {
      console.error("[DB] Initialization FAILED:", err);
      dbReady = null;
      throw err;
    });
  }

  return dbReady;
}

export function persistDb() {
  if (db) saveToLocalStorage(db);
}

export function resetDb() {
  localStorage.removeItem(DB_STORAGE_KEY);
  db = null;
  dbReady = null;
}
