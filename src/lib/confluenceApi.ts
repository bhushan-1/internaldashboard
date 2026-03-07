import { getApiBase } from "./envConfig";
import { getToken } from "./authApi";
import { noEncryptHeaders, decryptPayload } from "./crypto";

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
