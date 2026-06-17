const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface GostNotification {
  id: string;
  prns_code: string | null;
  doc_type: string | null;
  project_name: string | null;
  technical_committee: string | null;
  developer: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  url: string | null;
  is_polymer: boolean;
  matched_keywords: string[] | null;
  fetched_date: string | null;
}

export interface SpNotification {
  id: string;
  notification_type: string | null;
  doc_type: string | null;
  project_name: string | null;
  title: string | null;
  developer: string | null;
  placement_date: string | null;
  url: string | null;
  stakeholders: string[] | null;
  is_polymer: boolean;
  matched_keywords: string[] | null;
}

export interface DashboardStats {
  total_gost: number;
  total_sp: number;
  active_count: number;
  completed_count: number;
  polymer_total: number;
  polymer_commented: number;
  total_npa: number;
  status_labels: string[];
  status_values: number[];
  month_labels: string[];
  month_values: number[];
  all_tk_labels: string[];
  all_tk_values: number[];
}

export interface DashboardResponse {
  gost: GostNotification[];
  sp: SpNotification[];
  stats: DashboardStats;
  my_tks: string[];
  npa: NpaProject[];
  last_updated: string;
  current_year: number;
}

export interface ScrapingResult {
  status: string;
  gost_new: number;
  sp_new: number;
  message: string;
  new_gost_ids: string[];
  new_sp_ids: string[];
  npa_new: number;
  new_npa_ids: string[];
  updated_statuses: Array<{
    id: string;
    type: "gost" | "sp";
    title: string;
    old_status: string;
    new_status: string;
  }>;
}

export interface ScrapingLog {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  gost_new: number;
  sp_new: number;
  new_gost_ids: string[] | null;
  new_sp_ids: string[] | null;
  updated_statuses: Array<{
    id: string;
    type: "gost" | "sp";
    title: string;
    old_status: string;
    new_status: string;
  }> | null;
}

class MonitoringAPI {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка ${res.status}`);
    }
    return res.json();
  }

  async getDashboard(year?: number): Promise<DashboardResponse> {
    const params = year ? `?year=${year}` : "";
    return this.request<DashboardResponse>(`/api/monitoring/dashboard${params}`);
  }

  async getLastScrapingLog(): Promise<ScrapingLog | null> {
    return this.request<ScrapingLog | null>("/api/monitoring/scraping-log/last");
  }

  async runScraping(options: {
    fullBackfill?: boolean;
    year?: number;
    dateFrom?: string;
    dateTo?: string;
    userRole?: string;
  } = {}): Promise<ScrapingResult> {
    const params = new URLSearchParams();
    if (options.fullBackfill !== undefined) params.set("full_backfill", String(options.fullBackfill));
    if (options.year) params.set("year", String(options.year));
    if (options.dateFrom) params.set("date_from", options.dateFrom);
    if (options.dateTo) params.set("date_to", options.dateTo);
    
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.userRole) headers["X-User-Role"] = options.userRole;
    
    const res = await fetch(
      `${API_BASE}/api/monitoring/scrape?${params.toString()}`,
      { method: "POST", headers }
    );
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Ошибка ${res.status}`);
    }
    return res.json();
  }

  
}

export const monitoringApi = new MonitoringAPI();

export interface NpaProject {
  id: string;
  title: string | null;
  developer: string | null;
  doc_type: string | null;
  created_date: string | null;
  published_date: string | null;
  stage: string | null;
  status: string | null;
  procedure: string | null;
  url: string | null;
  is_polymer: boolean;
  matched_keywords: string[] | null;
}