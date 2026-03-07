// Environment configuration for API connections
export type EnvMode = "development" | "production";

const ENV_STORAGE_KEY = "datahub_env";

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

export function getApiBase(mode?: EnvMode): string {
  const m = mode ?? getEnvMode();
  if (isLocalDev()) {
    return `http://localhost:${LOCAL_PORTS[m]}/api`;
  }
  return `/api`;
}

// Auth always goes through dev server (port 3001) — _td_users lives in dev DB only
export function getAuthApiBase(): string {
  if (isLocalDev()) {
    return `http://localhost:${LOCAL_PORTS.development}`;
  }
  return ``;
}