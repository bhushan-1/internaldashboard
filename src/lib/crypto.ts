// Shared crypto utilities — handles non-secure contexts (HTTP, non-localhost)
// where crypto.subtle is unavailable

export const canDecrypt = typeof crypto !== "undefined" && !!crypto.subtle;

export function noEncryptHeaders(): Record<string, string> {
  return canDecrypt ? {} : { "X-No-Encrypt": "1" };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

let cachedKey: CryptoKey | null = null;
let cachedKeyHex: string | null = null;

async function getKey(encKeyHex: string): Promise<CryptoKey> {
  if (cachedKey && cachedKeyHex === encKeyHex) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw", hexToBytes(encKeyHex), { name: "AES-CBC" }, false, ["decrypt"]
  );
  cachedKeyHex = encKeyHex;
  return cachedKey;
}

export async function decryptPayload(payload: { iv: string; data: string }, encKeyHex: string): Promise<unknown> {
  const key = await getKey(encKeyHex);
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function clearCryptoCache() {
  cachedKey = null;
  cachedKeyHex = null;
}
