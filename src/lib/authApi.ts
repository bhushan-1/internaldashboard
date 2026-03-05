import { getEnvMode } from "./envConfig";

function getBase() {
  const mode = getEnvMode();
  return mode === "production" ? "http://localhost:3002" : "http://localhost:3001";
}

const TOKEN_KEY = "td_auth_token";
const ENC_KEY_KEY = "td_enc_key";
const USER_KEY = "td_auth_user";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "user";
  permissions: Record<string, boolean>;
}

// ── Token management ──
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function getEncKey(): string | null {
  return localStorage.getItem(ENC_KEY_KEY);
}
export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ENC_KEY_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Decrypt helper ──
async function decrypt(payload: { iv: string; data: string }): Promise<unknown> {
  const encKeyHex = getEncKey();
  if (!encKeyHex) throw new Error("No encryption key");
  const key = await crypto.subtle.importKey(
    "raw", Uint8Array.from(encKeyHex.match(/.{2}/g)!.map(b => parseInt(b, 16))),
    { name: "AES-CBC" }, false, ["decrypt"]
  );
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plain));
}

async function authFetch(url: string, options: RequestInit = {}): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(getBase() + url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...options.headers },
  });
  if (res.status === 401) { clearAuth(); throw new Error("Session expired"); }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  if (json._enc) return decrypt(json.payload);
  return json;
}

// ══════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(getBase() + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Login failed");
  localStorage.setItem(TOKEN_KEY, json.token);
  localStorage.setItem(ENC_KEY_KEY, json.encKey);
  const user: AuthUser = { ...json.user, permissions: {} };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Fetch full user with permissions
  const me = await fetchMe();
  return me;
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authFetch("/api/auth/me") as { id: string; email: string; role: "admin" | "user"; permissions: Record<string, boolean> };
  const user: AuthUser = { id: data.id, email: data.email, role: data.role, permissions: data.permissions || {} };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function logout() {
  clearAuth();
}

// ── Admin: user management ──
export async function listUsers(): Promise<AuthUser[]> {
  const data = await authFetch("/api/auth/users") as AuthUser[];
  return data;
}

export async function createUser(email: string, password: string, role: "admin" | "user"): Promise<void> {
  await authFetch("/api/auth/users", {
    method: "POST", body: JSON.stringify({ email, password, role }),
  });
}

export async function updateUserRole(userId: string, role: "admin" | "user"): Promise<void> {
  await authFetch(`/api/auth/users/${userId}/role`, {
    method: "PUT", body: JSON.stringify({ role }),
  });
}

export async function updateUserPermissions(userId: string, permissions: Record<string, boolean>): Promise<void> {
  await authFetch(`/api/auth/users/${userId}/permissions`, {
    method: "PUT", body: JSON.stringify({ permissions }),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await authFetch(`/api/auth/users/${userId}`, { method: "DELETE" });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authFetch("/api/auth/password", {
    method: "PUT", body: JSON.stringify({ currentPassword, newPassword }),
  });
}
