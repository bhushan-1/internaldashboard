import bcrypt from "bcryptjs";
import { getDb, persistDb, dbRun, dbQuery } from "./database";

export interface LocalUser {
  id: string;
  email: string;
  created_at: string;
}

export interface LocalSession {
  user: LocalUser;
  token: string;
}

const SESSION_KEY = "datahub_session";

function saveSession(session: LocalSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export async function signInWithPassword(email: string, password: string): Promise<{ session: LocalSession | null; error: string | null }> {
  console.log("[Auth] signInWithPassword called for:", email);
  const db = await getDb();
  console.log("[Auth] DB ready, querying user...");
  const result = dbQuery(db, "SELECT id, email, password_hash, created_at FROM auth_users WHERE email = ?", [email]);
  console.log("[Auth] Query result rows:", result.length ? result[0].values.length : 0);
  if (!result.length || !result[0].values.length) {
    return { session: null, error: "Invalid email or password" };
  }

  const [id, userEmail, passwordHash, createdAt] = result[0].values[0] as [string, string, string, string];
  console.log("[Auth] Found user, comparing password...");
  const valid = bcrypt.compareSync(password, passwordHash);
  console.log("[Auth] Password valid:", valid);
  if (!valid) {
    return { session: null, error: "Invalid email or password" };
  }

  const user: LocalUser = { id, email: userEmail, created_at: createdAt };
  const token = crypto.randomUUID();
  const session: LocalSession = { user, token };
  saveSession(session);
  return { session, error: null };
}

export async function signOut(): Promise<void> {
  clearSession();
}

export async function updatePassword(userId: string, newPassword: string): Promise<{ error: string | null }> {
  const db = await getDb();
  const hashed = bcrypt.hashSync(newPassword, 10);
  dbRun(db, "UPDATE auth_users SET password_hash = ? WHERE id = ?", [hashed, userId]);
  persistDb();
  return { error: null };
}

export async function createUser(email: string, password: string): Promise<{ user: LocalUser | null; error: string | null }> {
  const db = await getDb();
  const existing = dbQuery(db, "SELECT id FROM auth_users WHERE email = ?", [email]);
  if (existing.length && existing[0].values.length) {
    return { user: null, error: "User already exists" };
  }

  const id = crypto.randomUUID();
  const hashed = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  dbRun(db, "INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)", [id, email, hashed, now]);
  persistDb();
  return { user: { id, email, created_at: now }, error: null };
}

export async function listUsers(): Promise<LocalUser[]> {
  const db = await getDb();
  const result = db.exec("SELECT id, email, created_at FROM auth_users ORDER BY created_at DESC");
  if (!result.length) return [];
  return result[0].values.map(([id, email, created_at]) => ({
    id: id as string,
    email: email as string,
    created_at: created_at as string,
  }));
}
