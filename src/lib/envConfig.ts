// Environment configuration for API connections
export type EnvMode = "development" | "production";

const ENV_STORAGE_KEY = "datahub_env";

// In deployed mode, API runs behind nginx on the same domain
// In local dev, API runs on separate ports
function getOrigin(): string {
  return window.location.origin; // e.g. https://dashboard.trajectdata.com or http://localhost:8080
}

const isLocalDev = () => window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const LOCAL_PORTS: Record<EnvMode, number> = {
  development: 3001,
  production: 3002,
};

export function getEnvMode(): EnvMode {
  try {
    const stored = localStorage.getItem(ENV_STORAGE_KEY);
    if (stored === "production" || stored === "development") return stored;
  } catch { /* ignore */ }
  return "development";
}

export function setEnvMode(mode: EnvMode) {
  localStorage.setItem(ENV_STORAGE_KEY, mode);
}

export function getApiBase(_mode?: EnvMode): string {
  // Always use relative /api path — Vite proxy (dev) or nginx (prod) handles routing
  return `/api`;
}
