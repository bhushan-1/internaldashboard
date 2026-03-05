import { getApiBase, getEnvMode, type EnvMode } from "./envConfig";
import { getToken } from "./authApi";

let encryptionKey: CryptoKey | null = null;
let currentEnv: EnvMode | null = null;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function checkEnvChanged() {
  const env = getEnvMode();
  if (currentEnv && currentEnv !== env) {
    encryptionKey = null;
  }
  currentEnv = env;
}

async function ensureEncKey(): Promise<void> {
  checkEnvChanged();
  if (encryptionKey) return;
  const encKeyHex = localStorage.getItem("td_enc_key");
  if (!encKeyHex) throw new Error("Not authenticated");
  encryptionKey = await crypto.subtle.importKey(
    "raw", hexToBytes(encKeyHex), { name: "AES-CBC" }, false, ["decrypt"]
  );
}

async function decryptPayload(encrypted: { iv: string; data: string }): Promise<unknown> {
  if (!encryptionKey) throw new Error("No encryption key");
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, encryptionKey, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function secureFetch(url: string, options: RequestInit = {}): Promise<unknown> {
  await ensureEncKey();
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: "Bearer " + token, "Content-Type": "application/json" },
  });

  if (res.status === 401) throw new Error("Session expired");
  const json = await res.json();
  if (json._enc) return decryptPayload(json.payload);
  return json;
}

// ── Public API ──
export interface MongoAccount { _id: string; [key: string]: unknown; }
export interface MongoPlan { _id: string; planId: string; appName: string; activeNow?: boolean; [key: string]: unknown; }

export async function fetchMongoAccounts(): Promise<MongoAccount[]> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/accounts`) as { success: boolean; data: MongoAccount[]; error?: string };
  if (!r.success) throw new Error(r.error || "Failed to fetch");
  return r.data;
}

export async function updateMongoAccount(id: string, updates: Record<string, unknown>): Promise<void> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/accounts/${id}`, { method: "PUT", body: JSON.stringify(updates) }) as { success: boolean; error?: string };
  if (!r.success) throw new Error(r.error || "Update failed");
}

export async function deleteMongoAccount(id: string): Promise<void> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/accounts/${id}`, { method: "DELETE" }) as { success: boolean; error?: string };
  if (!r.success) throw new Error(r.error || "Delete failed");
}

export async function fetchPlans(): Promise<MongoPlan[]> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/plans`) as { success: boolean; data: MongoPlan[]; error?: string };
  if (!r.success) throw new Error(r.error || "Failed to fetch plans");
  return r.data;
}

export function clearApiAuth() { encryptionKey = null; currentEnv = null; }

export async function checkServerHealth(): Promise<{ ok: boolean; mode?: string; database?: string; error?: string }> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    return { ok: json.success, mode: json.mode, database: json.db };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Connection failed" }; }
}
