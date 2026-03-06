import { getApiBase } from "./envConfig";
import { getToken } from "./authApi";
import { canDecrypt, noEncryptHeaders, decryptPayload } from "./crypto";

async function secureFetch(url: string, options: RequestInit = {}): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: "Bearer " + token, "Content-Type": "application/json", ...noEncryptHeaders() },
  });

  if (res.status === 401) throw new Error("Session expired");
  const json = await res.json();
  if (json._enc) {
    const encKeyHex = localStorage.getItem("td_enc_key");
    if (!encKeyHex) throw new Error("No encryption key");
    return decryptPayload(json.payload, encKeyHex);
  }
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

export function clearApiAuth() { /* no-op, crypto cache handled centrally */ }

export async function checkServerHealth(): Promise<{ ok: boolean; mode?: string; database?: string; error?: string }> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    return { ok: json.success, mode: json.mode, database: json.db };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Connection failed" }; }
}
