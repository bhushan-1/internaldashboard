// Environment configuration for API connections
export type EnvMode = "development" | "production";

const ENV_STORAGE_KEY = "datahub_env";

const API_PORTS: Record<EnvMode, number> = {
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
  return `http://localhost:${API_PORTS[m]}/api`;
}
