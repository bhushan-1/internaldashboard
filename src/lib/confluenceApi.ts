import { getApiBase } from "./envConfig";
import { getToken } from "./authApi";

let encryptionKey: CryptoKey | null = null;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function ensureEncKey(): Promise<void> {
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

export interface KBDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
}

export async function fetchDocuments(): Promise<KBDocument[]> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/confluence/documents`) as { success: boolean; data: KBDocument[] };
  if (!r.success) throw new Error("Failed to fetch documents");
  return r.data;
}

export async function uploadDocument(title: string, content: string, category: string): Promise<string> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/confluence/documents`, {
    method: "POST", body: JSON.stringify({ title, content, category }),
  }) as { success: boolean; id: string };
  if (!r.success) throw new Error("Failed to upload document");
  return r.id;
}

export async function deleteDocument(id: string): Promise<void> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/confluence/documents/${id}`, { method: "DELETE" }) as { success: boolean };
  if (!r.success) throw new Error("Failed to delete document");
}

export interface SourceDoc {
  id: string;
  title: string;
  category: string;
  excerpt: string;
}

export async function askQuestion(question: string): Promise<{ answer: string; matchCount: number; totalDocs: number; sourceDocs: SourceDoc[] }> {
  const base = getApiBase();
  const r = await secureFetch(`${base}/confluence/ask`, {
    method: "POST", body: JSON.stringify({ question }),
  }) as { success: boolean; answer: string; matchCount: number; totalDocs: number; sourceDocs?: SourceDoc[] };
  if (!r.success) throw new Error("Failed to search");
  return { answer: r.answer, matchCount: r.matchCount, totalDocs: r.totalDocs, sourceDocs: r.sourceDocs || [] };
}
