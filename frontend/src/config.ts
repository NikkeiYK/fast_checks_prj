export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const API = {
  meta: `${API_BASE}/api/meta`,
  empSearch: `${API_BASE}/api/employees/search`,
  empUpsert: `${API_BASE}/api/employees/upsert`,
  sessions: `${API_BASE}/api/sessions`,
  history: `${API_BASE}/api/history`,
  dashboard: (name: string) =>
    `${API_BASE}/api/dashboard/${encodeURIComponent(name)}`,
  export: `${API_BASE}/api/export-excel`,
} as const;
