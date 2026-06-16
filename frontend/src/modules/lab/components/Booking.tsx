import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { API } from "../../../config";

const C = {
  primary: "#008B92",
  primaryDark: "#006B6B",
  primarySoft: "#E6F7F8",
  primarySoft2: "#F0FCFC",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceSoft: "#F9FBFC",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  text: "#0F172A",
  textMuted: "#475569",
  textLight: "#64748B",
  danger: "#DC2626",
  dangerDark: "#B91C1C",
  dangerBg: "#FEE2E2",
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  info: "#2563EB",
  infoBg: "#DBEAFE",
  shadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  shadowSoft: "0 10px 28px rgba(15, 23, 42, 0.06)",
};

const T = {
  font: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
  size: {
    xs: "11px",
    sm: "13px",
    base: "14px",
    md: "15px",
    lg: "16px",
    xl: "20px",
    "2xl": "26px",
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

const S = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "32px",
};

type SlotStatus = "free" | "busy" | "ending_soon" | "unavailable";
type ViewMode = "chambers" | "queue" | "cancellations";

type Chamber = {
  id: string;
  name: string;
  center: string;
  min_temp: number;
  max_temp: number;
  min_humidity: number;
  max_humidity: number;
  is_active: boolean;
  description?: string;
};

type Slot = {
  chamber_id: string;
  chamber_name: string;
  center: string;
  slot_number: number;
  status: SlotStatus;
  label: string;
  booking_id?: string | null;
  ends_at?: string | null;
  progress?: number;
  fio?: string;
  sample_code?: string;
  project?: string;
  next_booking?: string | null;
  specs?: { min_temp: number; max_temp: number; min_humidity: number; max_humidity: number };
};

type QueueRequest = {
  id: string;
  fio: string;
  project: string;
  min_temp?: number;
  max_temp?: number;
  humidity?: number;
  duration_hours: number;
  conditions_text?: string;
  preferred_center?: string;
  created_at: string;
  status: "pending" | "converted" | "cancelled";
};

type CancellationRecord = {
  id: string;
  sample_code: string;
  cancelled_at: string;
  cancelled_by: string;
  reason: string;
};

type BookingForm = {
  fio: string;
  sample_code: string;
  project: string;
  start_time: string;
  duration_hours: number;
  conditions: string;
  comments: string;
  chamber_id: string;
};

type BookingDetails = {
  chamber_id: string;
  chamber_name: string;
  center: string;
  start_time: string;
  end_time: string;
  remaining_days: number;
  remaining_hours: number;
  progress: number;
  sample_code: string;
  project: string;
  fio: string;
  conditions?: string;
  comments?: string;
  duration_hours: number;
  is_cancelled: boolean;
  cancelled_by?: string;
  cancelled_at?: string;
  cancel_reason?: string;
};

type QueueForm = {
  fio: string;
  project: string;
  min_temp: string;
  max_temp: string;
  humidity: string;
  duration_hours: string;
  conditions_text: string;
  preferred_center: string;
};

type CenterSummary = {
  name: string;
  chambers: Chamber[];
  totalSlots: number;
  freeSlots: number;
  busySlots: number;
  earliestStart?: string;
  avgWaitTime: number;
};

const formatRuDateTime = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
};

const formatRuDateInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};


const getSafeClimateUrl = {
  slots: () => API.climate?.slots || "/api/climate/slots",
  book: () => API.climate?.book || "/api/climate/book",
  meta: () => API.climate?.meta || "/api/climate/meta",
  history: () => API.climate?.history || "/api/climate/history",
  chambers: () => "/api/climate/chambers",
  centers: () => "/api/climate/chambers/centers",
  queue: () => "/api/climate/queue",
  matchingChambers: (id: string) => `/api/climate/queue/${id}/matching-chambers`,
  convert: (id: string) => `/api/climate/queue/${id}/convert`,
  cancellations: () => "/api/climate/cancellations",
  booking: (id: string) => API.climate?.booking ? API.climate.booking(id) : `/api/climate/booking/${id}`,
  cancel: (id: string) => API.climate?.cancel ? API.climate.cancel(id) : `/api/climate/cancel/${id}`,
};

export default function Booking() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>("chambers");
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [centers, setCenters] = useState<CenterSummary[]>([]);
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"book" | "details" | "cancel" | "queue" | "matching" | "centerDetail" | null>(null);
  const [activeChamberId, setActiveChamberId] = useState<string | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [queue, setQueue] = useState<QueueRequest[]>([]);
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [matchingData, setMatchingData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [form, setForm] = useState<BookingForm>({
    fio: "",
    sample_code: "",
    project: "",
    start_time: "",
    duration_hours: 1000,
    conditions: "",
    comments: "",
    chamber_id: "",
  });

  const [queueForm, setQueueForm] = useState<QueueForm>({
    fio: "",
    project: "",
    min_temp: "",
    max_temp: "",
    humidity: "",
    duration_hours: "",
    conditions_text: "",
    preferred_center: "",
  });

  const [cancelForm, setCancelForm] = useState({ reason: "", comment: "" });

  const authQuery = `?username=${encodeURIComponent(user?.username || "")}`;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  const loadCentersList = useCallback(async () => {
    try {
      const res = await fetch(`${getSafeClimateUrl.centers()}${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        return data.map((c: any) => c.name);
      }
    } catch (e) {
      console.error("Ошибка загрузки списка центров:", e);
    }
    return [];
  }, [authQuery]);

  const loadChambers = useCallback(async () => {
    try {
      const res = await fetch(`${getSafeClimateUrl.chambers()}${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        setChambers(Array.isArray(data) ? data : []);
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.error("Ошибка загрузки камер:", e);
    }
    return [];
  }, [authQuery]);

  const loadSlots = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      setLoading(true);
      const url = selectedCenter 
        ? `${getSafeClimateUrl.slots()}${authQuery}&center=${encodeURIComponent(selectedCenter)}`
        : `${getSafeClimateUrl.slots()}${authQuery}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Ошибка загрузки слотов: ${res.status}`);
      const data = await res.json();
      setSlots(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить слоты");
    } finally {
      setLoading(false);
    }
  }, [user, authQuery, selectedCenter]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch(`${getSafeClimateUrl.queue()}${authQuery}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        setQueue(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Ошибка загрузки очереди:", e);
    }
  }, [authQuery]);

  const loadCancellations = useCallback(async () => {
    try {
      const res = await fetch(`${getSafeClimateUrl.cancellations()}${authQuery}`);
      if (res.ok) {
        const data = await res.json();
        setCancellations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Ошибка загрузки отмен:", e);
    }
  }, [authQuery]);

  const aggregateCenters = useCallback((slotList: Slot[]) => {
  const centerMap: Record<string, CenterSummary> = {};
  
  // Строим центры из слотов — они уже содержат всю информацию
  slotList.forEach(slot => {
    if (!centerMap[slot.center]) {
      centerMap[slot.center] = {
        name: slot.center,
        chambers: [],
        totalSlots: 0,
        freeSlots: 0,
        busySlots: 0,
        avgWaitTime: 0
      };
    }
    
    const center = centerMap[slot.center];
    center.totalSlots++;
    
    if (slot.status === "free") {
      center.freeSlots++;
    } else {
      center.busySlots++;
    }
    
    // Добавляем камеру, если её ещё нет в списке центра
    const chamberExists = center.chambers.find(c => c.id === slot.chamber_id);
    if (!chamberExists) {
      center.chambers.push({
        id: slot.chamber_id,
        name: slot.chamber_name,
        center: slot.center,
        min_temp: slot.specs?.min_temp ?? 0,
        max_temp: slot.specs?.max_temp ?? 0,
        min_humidity: slot.specs?.min_humidity ?? 0,
        max_humidity: slot.specs?.max_humidity ?? 0,
        is_active: true
      });
    }
    
    // Обновляем ближайший старт
    if (slot.next_booking && (!center.earliestStart || slot.next_booking < center.earliestStart)) {
      center.earliestStart = slot.next_booking;
    }
  });
  
  // Расчёт времени ожидания
  Object.values(centerMap).forEach(center => {
    if (center.freeSlots > 0) {
      center.avgWaitTime = 0;
    } else if (center.earliestStart) {
      const now = new Date();
      const next = new Date(center.earliestStart);
      center.avgWaitTime = Math.max(0, (next.getTime() - now.getTime()) / (1000 * 60 * 60));
    } else {
      center.avgWaitTime = Infinity;
    }
  });
  
  return Object.values(centerMap).sort((a, b) => a.avgWaitTime - b.avgWaitTime);
}, []);

    useEffect(() => {
  const loadData = async () => {
    await loadChambers();
    await loadCentersList();
    await loadSlots();
    await loadQueue();
    await loadCancellations();
  };
  
  loadData();
  
  const id = window.setInterval(() => {
    loadSlots();
    loadQueue();
  }, 30000);
  
  return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // Отдельный эффект для агрегации — срабатывает когда chambers или slots изменились
  useEffect(() => {
  if (slots.length > 0) {
    const aggregated = aggregateCenters(slots);
    setCenters(aggregated);
  } else {
    setCenters([]);
  }
}, [slots, aggregateCenters]);

  const openBook = (chamberId: string) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - (now.getTimezoneOffset() % 60));
    setActiveChamberId(chamberId);
    setActiveBookingId(null);
    setDetails(null);
    setForm({
      fio: user?.username || "",
      sample_code: "",
      project: "",
      start_time: formatRuDateInput(now.toISOString()),
      duration_hours: 1000,
      conditions: "",
      comments: "",
      chamber_id: chamberId,
    });
    setModal("book");
  };

  const openDetails = async (bookingId?: string | null) => { 
    if (!bookingId) return;
    setActiveBookingId(bookingId);
    setModal("details");
    setDetails(null);
    try {
      const res = await fetch(`${getSafeClimateUrl.booking(bookingId)}${authQuery}`);
      if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
      const data = await res.json();
      setDetails(data);
    } catch (e: any) {
      showToast(e?.message || "Не удалось открыть детали", "error");
      setModal(null);
    }
  };

  const submitBook = async () => {
    if (!form.chamber_id || !form.fio.trim() || !form.sample_code.trim() || !form.project.trim() || !form.start_time || !form.duration_hours) {
      showToast("Заполните все обязательные поля", "error");
      return;
    }
    try {
      setSubmitting(true);
      const chamberSlots = slots.filter(s => s.chamber_id === form.chamber_id);
      const freeSlot = chamberSlots.find(s => s.status === "free");
      
      if (!freeSlot) {
        showToast("Нет свободных слотов на этой камере", "error");
        return;
      }
      
      const payload = { ...form, slot_number: freeSlot.slot_number };
      const res = await fetch(`${getSafeClimateUrl.book()}${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `Ошибка: ${res.status}`);
      showToast("Камера успешно забронирована");
      setModal(null);
      await loadSlots();
    } catch (e: any) {
      showToast(e?.message || "Не удалось создать бронирование", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openCancelModal = (bookingId: string) => {
    setActiveBookingId(bookingId);
    setCancelForm({ reason: "", comment: "" });
    setModal("cancel");
  };

  const submitCancel = async () => {
    if (!activeBookingId || !cancelForm.reason.trim()) {
      showToast("Укажите причину отмены", "error");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`${getSafeClimateUrl.cancel(activeBookingId)}${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cancelForm),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `Ошибка: ${res.status}`);
      showToast("Бронирование отменено");
      setModal(null);
      await loadSlots();
      await loadCancellations();
    } catch (e: any) {
      showToast(e?.message || "Не удалось отменить", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openQueueForm = () => {
    setQueueForm({
      fio: user?.username || "",
      project: "",
      min_temp: "",
      max_temp: "",
      humidity: "",
      duration_hours: "",
      conditions_text: "",
      preferred_center: "",
    });
    setModal("queue");
  };

  const submitQueue = async () => {
    if (!queueForm.fio.trim() || !queueForm.project.trim() || !queueForm.duration_hours) {
      showToast("Заполните обязательные поля", "error");
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        fio: queueForm.fio,
        project: queueForm.project,
        min_temp: queueForm.min_temp ? Number(queueForm.min_temp) : null,
        max_temp: queueForm.max_temp ? Number(queueForm.max_temp) : null,
        humidity: queueForm.humidity ? Number(queueForm.humidity) : null,
        duration_hours: Number(queueForm.duration_hours),
        conditions_text: queueForm.conditions_text,
        preferred_center: queueForm.preferred_center || null,
      };
      
      const res = await fetch(`/api/climate/queue${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Ошибка создания заявки:", errorText);
        throw new Error(`Ошибка: ${res.status} - ${errorText}`);
      }
      
      showToast("Заявка создана");
      setModal(null);
      await loadQueue();
    } catch (e: any) {
      showToast(e?.message || "Не удалось создать заявку", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openMatching = async (requestId: string) => {
    setActiveRequestId(requestId);
    setMatchingData(null);
    try {
      const res = await fetch(`${getSafeClimateUrl.matchingChambers(requestId)}${authQuery}`);
      if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
      const data = await res.json();
      setMatchingData(data);
      setModal("matching");
    } catch (e: any) {
      showToast(e?.message || "Не удалось подобрать камеры", "error");
    }
  };

  const convertRequest = async (requestId: string, chamberId: string, slotNumber: number, startTime: string) => {
    const sampleCode = prompt("Введите шифр образца:");
    if (!sampleCode) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${getSafeClimateUrl.convert(requestId)}${authQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chamber_id: chamberId, slot_number: slotNumber, start_time: startTime, sample_code: sampleCode }),
      });
      if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
      showToast("Заявка конвертирована в бронь");
      setModal(null);
      await loadQueue();
      await loadSlots();
    } catch (e: any) {
      showToast(e?.message || "Не удалось конвертировать", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openCenterDetail = (centerName: string) => {
    setSelectedCenter(centerName);
    setModal("centerDetail");
  };

  const closeCenterDetail = () => {
    setSelectedCenter(null);
    setModal(null);
  };

  const totalSlots = slots.length;
  const freeSlots = slots.filter(s => s.status === "free").length;
  const busySlots = slots.filter(s => s.status === "busy" || s.status === "ending_soon").length;

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .booking-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(0, 139, 146, .18); }
        .booking-card:hover { transform: translateY(-3px); box-shadow: 0 18px 42px rgba(15, 23, 42, .10); border-color: rgba(0, 139, 146, .35); }
        .booking-input:focus { border-color: ${C.primary}; box-shadow: 0 0 0 4px rgba(0, 139, 146, .12); outline: none; }
        .booking-ghost:hover { background: ${C.primarySoft}; color: ${C.primaryDark}; }
        .booking-danger:hover { background: ${C.dangerDark}; }
        .booking-secondary:hover { background: #F1F5F9; }
        .center-card { transition: all 0.2s ease; }
        .center-card:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12); }
        .wait-time-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: ${T.size.sm}; font-weight: ${T.weight.semibold}; }
      `}</style>

      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "success" ? C.successBg : C.dangerBg, color: toast.type === "success" ? C.success : C.danger, borderColor: toast.type === "success" ? "rgba(22, 163, 74, .25)" : "rgba(220, 38, 38, .25)" }}>
          <span style={styles.toastIcon}>{toast.type === "success" ? "✓" : "!"}</span>
          {toast.msg}
        </div>
      )}

      <header style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Климатическая камера</div>
          <h1 style={styles.title}>Бронирование испытаний</h1>
          <p style={styles.subtitle}>Выберите центр и камеру для быстрого запуска испытаний</p>
        </div>
      </header>

      <div style={styles.modeSwitcher}>
        <button className={mode === "chambers" ? "booking-btn" : "booking-ghost"} style={{ ...styles.modeBtn, ...(mode === "chambers" ? styles.modeBtnActive : {}) }} onClick={() => setMode("chambers")}>
          🏭 Камеры по центрам
        </button>
        <button className={mode === "queue" ? "booking-btn" : "booking-ghost"} style={{ ...styles.modeBtn, ...(mode === "queue" ? styles.modeBtnActive : {}) }} onClick={() => setMode("queue")}>
          📋 Очередь без образца
        </button>
        <button className={mode === "cancellations" ? "booking-btn" : "booking-ghost"} style={{ ...styles.modeBtn, ...(mode === "cancellations" ? styles.modeBtnActive : {}) }} onClick={() => setMode("cancellations")}>
          ❌ История отмен
        </button>
      </div>

      {mode === "chambers" && (
        <>
          <section style={styles.statsGrid}>
            <StatCard label="Всего слотов" value={totalSlots} tone="info" />
            <StatCard label="Свободно" value={freeSlots} tone="success" />
            <StatCard label="Занято" value={busySlots} tone="primary" />
            <StatCard 
              label="Среднее время ожидания" 
              value={centers.length > 0 ? Math.round(centers.reduce((sum, c) => sum + c.avgWaitTime, 0) / centers.length) : 0} 
              unit="ч" 
              tone="warning" 
            />
          </section>

          {error && (
            <div style={styles.errorBox}>
              <strong>Ошибка загрузки</strong>
              <span>{error}</span>
              <button className="booking-secondary" style={styles.smallBtn} onClick={loadSlots}>Повторить</button>
            </div>
          )}

          {loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              <div><strong>Загружаем данные</strong><p>Пожалуйста, подождите.</p></div>
            </div>
          ) : (
            <div style={styles.centersGrid}>
              {centers.map(center => {
                const utilization = center.totalSlots > 0 ? Math.round((center.busySlots / center.totalSlots) * 100) : 0;
                const waitTime = center.avgWaitTime;
                
                let waitTimeColor = C.success;
                let waitTimeBg = C.successBg;
                let waitTimeLabel = "Сейчас";
                
                if (waitTime > 24) {
                  waitTimeColor = C.danger;
                  waitTimeBg = C.dangerBg;
                  waitTimeLabel = "Более суток";
                } else if (waitTime > 0) {
                  waitTimeColor = C.warning;
                  waitTimeBg = C.warningBg;
                  waitTimeLabel = `${Math.round(waitTime)} ч`;
                }
                
                return (
                  <article 
                    key={center.name} 
                    className="center-card"
                    style={styles.centerCard}
                    onClick={() => openCenterDetail(center.name)}
                  >
                    <div style={styles.centerHeader}>
                      <div style={styles.centerTitle}>
                        <span style={styles.centerIcon}>📍</span>
                        <strong>{center.name}</strong>
                      </div>
                      <div style={styles.centerStats}>
                        <div style={styles.utilizationBar}>
                          <div style={{ ...styles.utilizationFill, width: `${utilization}%` }} />
                        </div>
                        <span style={styles.utilizationText}>{utilization}% загрузка</span>
                      </div>
                    </div>
                    
                    <div style={styles.centerBody}>
                      <div style={styles.centerSpecs}>
                        <div>
                          <div style={styles.specLabel}>Камер</div>
                          <div style={styles.specValue}>{center.chambers.length}</div>
                        </div>
                        <div>
                          <div style={styles.specLabel}>Свободно</div>
                          <div style={styles.specValue}>{center.freeSlots}</div>
                        </div>
                        <div>
                          <div style={styles.specLabel}>Тех. возможности</div>
                          <div style={styles.specValue}>
                            {center.chambers.map(c => `${c.min_temp}°…${c.max_temp}°C`).join(', ')}
                          </div>
                        </div>
                      </div>
                      
                      <div style={styles.waitTimeSection}>
                        <div style={{ ...styles.waitTimeBadge, background: waitTimeBg, color: waitTimeColor }}>
                          ⏱️ {waitTimeLabel}
                        </div>
                        {center.earliestStart && (
                          <div style={styles.earliestStart}>
                            Ближайший старт: {formatRuDateTime(center.earliestStart)}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {mode === "queue" && (
        <div>
          <button className="booking-btn" style={styles.primaryBtn} onClick={openQueueForm}>+ Создать заявку без образца</button>
          <div style={styles.queueList}>
            {queue.length === 0 ? (
              <div style={styles.emptyHistory}>Очередь пуста</div>
            ) : (
              queue.map(req => (
                <div key={req.id} style={styles.queueCard}>
                  <div style={styles.queueInfo}>
                    <strong>{req.project}</strong>
                    <p>{req.fio}</p>
                    <div style={styles.queueSpecs}>
                      {req.min_temp != null && <span>🌡 {req.min_temp}°…{req.max_temp}°C</span>}
                      {req.humidity != null && <span>💧 {req.humidity}%</span>}
                      <span>⏱ {req.duration_hours} ч.</span>
                      {req.preferred_center && <span>📍 {req.preferred_center}</span>}
                    </div>
                  </div>
                  <div style={styles.queueActions}>
                    <button className="booking-secondary" style={styles.secondaryBtn} onClick={() => openMatching(req.id)}>🔍 Подобрать камеру</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {mode === "cancellations" && (
        <div style={styles.historySection}>
          <h2 style={styles.sectionTitle}>История отмен</h2>
          {cancellations.length === 0 ? (
            <div style={styles.emptyHistory}>Отмен пока нет</div>
          ) : (
            <div style={styles.historyList}>
              {cancellations.map(c => (
                <div key={c.id} style={styles.historyItem}>
                  <div style={styles.historyLeft}>
                    <div style={styles.historyMark}>❌</div>
                    <div>
                      <strong>{c.sample_code}</strong>
                      <p>Отменено: {c.cancelled_by}</p>
                    </div>
                  </div>
                  <div style={styles.historyRight}>
                    <span>{c.cancelled_at}</span>
                    <small>Причина: {c.reason}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal === "book" && (
        <div style={styles.modalOverlay} onMouseDown={() => setModal(null)}>
          <div style={styles.modal} onMouseDown={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>Новое бронирование</div>
                <h3 style={styles.modalTitle}>Камера: {chambers.find(c => c.id === activeChamberId)?.name}</h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setModal(null)}>×</button>
            </div>
            <div style={styles.formGrid}>
              <Field label="ФИО" value={form.fio} onChange={v => setForm(p => ({ ...p, fio: v }))} />
              <Field label="Шифр образца" value={form.sample_code} onChange={v => setForm(p => ({ ...p, sample_code: v }))} />
              <Field label="Проект" value={form.project} onChange={v => setForm(p => ({ ...p, project: v }))} />
              <Field label="Старт" type="datetime-local" value={form.start_time} onChange={v => setForm(p => ({ ...p, start_time: v }))} />
              <Field label="Длительность, часов" type="number" value={String(form.duration_hours)} onChange={v => setForm(p => ({ ...p, duration_hours: Number(v) }))} />
              <Field label="Условия" value={form.conditions} onChange={v => setForm(p => ({ ...p, conditions: v }))} />
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Комментарии</label>
                <textarea className="booking-input" style={{ ...styles.input, ...styles.textarea }} value={form.comments} onChange={e => setForm(p => ({ ...p, comments: e.target.value }))} />
              </div>
            </div>
            <div style={styles.modalActions}>
              <button className="booking-secondary" style={styles.secondaryBtn} onClick={() => setModal(null)}>Отмена</button>
              <button className="booking-btn" style={styles.primaryBtn} disabled={submitting} onClick={submitBook}>{submitting ? "Сохранение..." : "Забронировать камеру"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "details" && details && (
        <div style={styles.modalOverlay} onMouseDown={() => setModal(null)}>
          <div style={styles.modal} onMouseDown={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>Детали бронирования</div>
                <h3 style={styles.modalTitle}>{details.chamber_name}</h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setModal(null)}>×</button>
            </div>
            <div style={styles.detailsGrid}>
              <InfoCard label="Центр" value={details.center} />
              <InfoCard label="ФИО" value={details.fio} />
              <InfoCard label="Образец" value={details.sample_code} />
              <InfoCard label="Проект" value={details.project} />
              <InfoCard label="Старт" value={details.start_time} />
              <InfoCard label="Окончание" value={details.end_time} />
              <InfoCard label="Осталось" value={`${details.remaining_days} дн. ${details.remaining_hours} ч.`} />
              <InfoCard label="Условия" value={details.conditions || "—"} />
            </div>
            {details.comments && <div style={styles.commentBox}><strong>Комментарии</strong><p>{details.comments}</p></div>}
            <div style={styles.progressWrap}>
              <div style={styles.progressMeta}><span>Прогресс</span><strong>{Math.round(details.progress)}%</strong></div>
              <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${details.progress}%` }} /></div>
            </div>
            <div style={styles.modalActions}>
              <button className="booking-secondary" style={styles.secondaryBtn} onClick={() => setModal(null)}>Закрыть</button>
              <button className="booking-danger" style={styles.dangerBtn} onClick={() => openCancelModal(activeBookingId!)}>Отменить бронирование</button>
            </div>
          </div>
        </div>
      )}

      {modal === "cancel" && (
        <div style={styles.modalOverlay} onMouseDown={() => setModal(null)}>
          <div style={styles.modal} onMouseDown={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>Отмена бронирования</div>
                <h3 style={styles.modalTitle}>Укажите причину</h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setModal(null)}>×</button>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Причина отмены <span style={{ color: "red" }}>*</span></label>
              <textarea className="booking-input" style={{ ...styles.input, ...styles.textarea }} value={cancelForm.reason} onChange={e => setCancelForm(p => ({ ...p, reason: e.target.value }))} placeholder="Обязательное поле" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Комментарий (опционально)</label>
              <textarea className="booking-input" style={{ ...styles.input, ...styles.textarea }} value={cancelForm.comment} onChange={e => setCancelForm(p => ({ ...p, comment: e.target.value }))} />
            </div>
            <div style={styles.modalActions}>
              <button className="booking-secondary" style={styles.secondaryBtn} onClick={() => setModal(null)}>Назад</button>
              <button className="booking-danger" style={styles.dangerBtn} disabled={submitting || !cancelForm.reason.trim()} onClick={submitCancel}>{submitting ? "Отмена..." : "Отменить бронирование"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "queue" && (
        <div style={styles.modalOverlay} onMouseDown={() => setModal(null)}>
          <div style={styles.modal} onMouseDown={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>Заявка без образца</div>
                <h3 style={styles.modalTitle}>Планирование испытания</h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setModal(null)}>×</button>
            </div>
            <div style={styles.formGrid}>
              <Field label="ФИО" value={queueForm.fio} onChange={v => setQueueForm(p => ({ ...p, fio: v }))} />
              <Field label="Проект" value={queueForm.project} onChange={v => setQueueForm(p => ({ ...p, project: v }))} />
              <Field label="Мин. температура, °C" type="number" value={queueForm.min_temp} onChange={v => setQueueForm(p => ({ ...p, min_temp: v }))} />
              <Field label="Макс. температура, °C" type="number" value={queueForm.max_temp} onChange={v => setQueueForm(p => ({ ...p, max_temp: v }))} />
              <Field label="Влажность, %" type="number" value={queueForm.humidity} onChange={v => setQueueForm(p => ({ ...p, humidity: v }))} />
              <Field label="Длительность, часов" type="number" value={queueForm.duration_hours} onChange={v => setQueueForm(p => ({ ...p, duration_hours: v }))} />
              <Field label="Предпочтительный центр" value={queueForm.preferred_center} onChange={v => setQueueForm(p => ({ ...p, preferred_center: v }))} />
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Условия испытания</label>
                <textarea className="booking-input" style={{ ...styles.input, ...styles.textarea }} value={queueForm.conditions_text} onChange={e => setQueueForm(p => ({ ...p, conditions_text: e.target.value }))} />
              </div>
            </div>
            <div style={styles.modalActions}>
              <button className="booking-secondary" style={styles.secondaryBtn} onClick={() => setModal(null)}>Отмена</button>
              <button className="booking-btn" style={styles.primaryBtn} disabled={submitting} onClick={submitQueue}>{submitting ? "Создание..." : "Создать заявку"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "matching" && matchingData && (
        <div style={styles.modalOverlay} onMouseDown={() => setModal(null)}>
          <div style={styles.modal} onMouseDown={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>Подбор камер</div>
                <h3 style={styles.modalTitle}>Найдено {matchingData.total_matching} подходящих камер</h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setModal(null)}>×</button>
            </div>
            {matchingData.matches.length === 0 ? (
              <div style={styles.emptyHistory}>Нет камер, подходящих под условия</div>
            ) : (
              <div style={styles.matchList}>
                {matchingData.matches.map((m: any) => (
                  <div key={m.chamber_id} style={styles.matchCard}>
                    <div>
                      <strong>{m.chamber_name}</strong> · {m.center}
                      <div style={styles.matchSpecs}>
                        🌡 {m.specs.temp_range[0]}°…{m.specs.temp_range[1]}°C · 💧 {m.specs.humidity_range[0]}…{m.specs.humidity_range[1]}%
                      </div>
                      <div>Доступно слотов: {m.available_count}</div>
                      <div>Ближайший старт: {formatRuDateTime(m.earliest_start)}</div>
                    </div>
                    <button className="booking-btn" style={styles.primaryBtn} onClick={() => convertRequest(activeRequestId!, m.chamber_id, m.available_slots[0].slot_number, m.earliest_start)}>
                      Забронировать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {modal === "centerDetail" && selectedCenter && (
        <div style={styles.modalOverlay} onMouseDown={closeCenterDetail}>
          <div style={{ ...styles.modal, maxWidth: "90vw" }} onMouseDown={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>Детали центра</div>
                <h3 style={styles.modalTitle}>{selectedCenter}</h3>
              </div>
              <button style={styles.closeBtn} onClick={closeCenterDetail}>×</button>
            </div>
            
            <div style={styles.centerDetailGrid}>
              {chambers
                .filter(c => c.center === selectedCenter)
                .map(chamber => {
                  const chamberSlots = slots.filter(s => s.chamber_id === chamber.id);
                  const freeCount = chamberSlots.filter(s => s.status === "free").length;
                  const busyCount = chamberSlots.length - freeCount;
                  const utilization = chamberSlots.length > 0 ? Math.round((busyCount / chamberSlots.length) * 100) : 0;
                  
                  return (
                    <div key={chamber.id} style={styles.chamberDetailCard}>
                      <div style={styles.chamberHeader}>
                        <strong>{chamber.name}</strong>
                        <span style={styles.specsBadge}>
                          🌡 {chamber.min_temp}°…{chamber.max_temp}°C · 💧 {chamber.min_humidity}…{chamber.max_humidity}%
                        </span>
                      </div>
                      
                      <div style={styles.utilizationSection}>
                        <div style={styles.utilizationBar}>
                          <div style={{ ...styles.utilizationFill, width: `${utilization}%` }} />
                        </div>
                        <div style={styles.utilizationText}>{utilization}% загрузка</div>
                      </div>
                      
                      <div style={styles.chamberStats}>
                        <div>
                          <div style={styles.statLabel}>Свободно</div>
                          <div style={styles.statValue}>{freeCount}</div>
                        </div>
                        <div>
                          <div style={styles.statLabel}>Занято</div>
                          <div style={styles.statValue}>{busyCount}</div>
                        </div>
                      </div>
                      {(() => {
                        const chamberBookings = slots.filter(s => 
                          s.chamber_id === chamber.id && 
                          s.status !== "free" && 
                          s.booking_id
                        );
                        return chamberBookings.length > 0 ? (
                          <div style={styles.activeBookings}>
                            <div style={styles.activeBookingsTitle}>Активные бронирования:</div>
                            {chamberBookings.map((booking, idx) => (
                              <div key={booking.booking_id || idx} style={styles.activeBookingItem}>
                                <div>
                                  <strong>{booking.sample_code}</strong> · {booking.fio}
                                  <div style={styles.activeBookingTime}>
                                    до {formatRuDateTime(booking.ends_at)} · {Math.round(booking.progress || 0)}%
                                  </div>
                                </div>
                                <button 
                                  className="booking-secondary" 
                                  style={styles.smallBtn}
                                  onClick={() => openDetails(booking.booking_id)}
                                >
                                  Подробнее
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()
                      }
                      <div style={styles.chamberActions}>
                        {freeCount > 0 ? (
                          <button 
                            className="booking-btn" 
                            style={styles.primaryBtn}
                            onClick={() => {
                              openBook(chamber.id);
                              closeCenterDetail();
                            }}
                          >
                            Забронировать камеру
                          </button>
                        ) : (
                          <button 
                            className="booking-secondary" 
                            style={styles.secondaryBtn}
                            disabled
                          >
                            Нет свободных слотов
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit = "", tone }: { label: string; value: number; unit?: string; tone: "success" | "primary" | "info" | "warning" | "muted" }) {
  const map = { 
    success: { bg: C.successBg, color: C.success }, 
    primary: { bg: C.primarySoft, color: C.primary }, 
    info: { bg: C.infoBg, color: C.info },
    warning: { bg: C.warningBg, color: C.warning },
    muted: { bg: "#F1F5F9", color: C.textMuted } 
  };
  
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: map[tone].bg, color: map[tone].color }}>●</div>
      <div>
        <div style={styles.statValue}>{value}{unit}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value?: string | number | null }) {
  return <div style={styles.infoCard}><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input className="booking-input" style={styles.input} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: S["3xl"], background: `radial-gradient(circle at top left, ${C.primarySoft} 0, transparent 360px), ${C.bg}`, fontFamily: T.font, color: C.text },
  hero: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: S.xl, marginBottom: S["2xl"] },
  eyebrow: { fontSize: T.size.xs, fontWeight: T.weight.bold, letterSpacing: ".09em", textTransform: "uppercase", color: C.primary, marginBottom: S.sm },
  title: { margin: 0, fontSize: T.size["2xl"], fontWeight: T.weight.bold, letterSpacing: "-0.03em" },
  subtitle: { margin: `${S.sm} 0 0`, color: C.textMuted, fontSize: T.size.md, maxWidth: 640, lineHeight: 1.55 },
  modeSwitcher: { display: "flex", gap: S.md, marginBottom: S.xl, padding: S.md, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` },
  modeBtn: { flex: 1, minHeight: 44, padding: "0 18px", borderRadius: 12, border: "none", fontWeight: T.weight.bold, cursor: "pointer", transition: ".18s ease", fontSize: T.size.base },
  modeBtnActive: { background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: "#fff" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.lg, marginBottom: S.xl },
  statCard: { display: "flex", alignItems: "center", gap: S.md, padding: S.lg, background: "rgba(255,255,255,.86)", border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadowSoft },
  statIcon: { width: 38, height: 38, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 13 },
  statValue: { fontSize: T.size.xl, fontWeight: T.weight.bold, lineHeight: 1 },
  statLabel: { marginTop: 4, color: C.textLight, fontSize: T.size.sm },
  centersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: S.xl },
  centerCard: { 
    background: C.surface, 
    border: `1px solid ${C.border}`, 
    borderRadius: 22, 
    padding: S.xl, 
    cursor: "pointer",
    boxShadow: C.shadowSoft,
  },
  centerHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.lg },
  centerTitle: { display: "flex", alignItems: "center", gap: S.md, fontSize: T.size.lg },
  centerIcon: { fontSize: 24 },
  centerStats: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  utilizationBar: { 
    width: 80, 
    height: 8, 
    background: "#EAF0F4", 
    borderRadius: 999, 
    overflow: "hidden" 
  },
  utilizationFill: { 
    height: "100%", 
    background: C.primary, 
    borderRadius: 999,
    transition: "width 0.3s ease"
  },
  utilizationText: { 
    marginTop: S.xs, 
    fontSize: T.size.sm, 
    color: C.textMuted 
  },
  centerBody: { marginTop: S.lg },
  centerSpecs: { 
    display: "grid", 
    gridTemplateColumns: "repeat(3, 1fr)", 
    gap: S.md,
    marginBottom: S.lg
  },
  specLabel: { 
    fontSize: T.size.sm, 
    color: C.textMuted,
    marginBottom: S.xs
  },
  specValue: { 
    fontWeight: T.weight.semibold,
    wordBreak: "break-word"
  },
  waitTimeSection: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  waitTimeBadge: { 
    padding: "4px 10px", 
    borderRadius: 20, 
    fontSize: T.size.sm, 
    fontWeight: T.weight.semibold 
  },
  earliestStart: { 
    fontSize: T.size.sm, 
    color: C.textMuted 
  },
  errorBox: { display: "flex", alignItems: "center", gap: S.md, padding: S.lg, background: C.dangerBg, color: C.danger, border: "1px solid rgba(220, 38, 38, .18)", borderRadius: 16, marginBottom: S.xl },
  loadingBox: { display: "flex", alignItems: "center", gap: S.md, padding: S.xl, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadowSoft },
  spinner: { width: 26, height: 26, borderRadius: "50%", border: `3px solid ${C.primarySoft}`, borderTopColor: C.primary, animation: "spin .8s linear infinite" },
  smallBtn: { marginLeft: "auto", height: 34, padding: "0 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer" },
  queueList: { display: "grid", gap: S.lg, marginTop: S.xl },
  queueCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: S.xl, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: C.shadowSoft },
  queueInfo: { flex: 1 },
  queueSpecs: { display: "flex", gap: S.md, marginTop: S.sm, fontSize: T.size.sm, color: C.textMuted, flexWrap: "wrap" },
  queueActions: { display: "flex", gap: S.md },
  historySection: { padding: S.xl, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 22, boxShadow: C.shadowSoft },
  sectionTitle: { margin: `0 0 ${S.lg} 0`, fontSize: T.size.xl },
  emptyHistory: { padding: S.xl, textAlign: "center", color: C.textLight, background: C.surfaceSoft, borderRadius: 16 },
  historyList: { display: "grid", gap: S.md },
  historyItem: { display: "flex", justifyContent: "space-between", gap: S.lg, padding: S.md, border: `1px solid ${C.border}`, borderRadius: 16, background: C.surface },
  historyLeft: { display: "flex", alignItems: "center", gap: S.md },
  historyMark: { width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: C.dangerBg, color: C.danger, fontWeight: T.weight.bold },
  historyRight: { display: "grid", justifyItems: "end", gap: 4, color: C.textMuted, fontSize: T.size.sm },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: S.xl, background: "rgba(15, 23, 42, .42)", backdropFilter: "blur(5px)" },
  modal: { animation: "modalIn .18s ease both", width: "min(780px, 100%)", maxHeight: "90vh", overflow: "auto", background: C.surface, borderRadius: 24, border: `1px solid ${C.border}`, boxShadow: C.shadow, padding: S["2xl"] },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: S.lg, marginBottom: S.xl },
  closeBtn: { width: 38, height: 38, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, color: C.textMuted, fontSize: 24, cursor: "pointer" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: S.lg },
  field: { marginBottom: S.lg },
  label: { display: "block", marginBottom: S.sm, color: C.textMuted, fontSize: T.size.sm, fontWeight: T.weight.semibold },
  input: { width: "100%", height: 44, boxSizing: "border-box", padding: "0 13px", borderRadius: 13, border: `1px solid ${C.borderStrong}`, background: C.surface, color: C.text, fontSize: T.size.base, transition: ".18s ease", fontFamily: T.font },
  textarea: { height: 98, padding: 13, resize: "vertical" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: S.md, marginTop: S.xl },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: S.md, marginBottom: S.lg },
  infoCard: { padding: S.md, borderRadius: 15, background: C.surfaceSoft, border: `1px solid ${C.border}` },
  commentBox: { marginTop: S.lg, padding: S.lg, borderRadius: 16, background: C.primarySoft2, border: `1px solid rgba(0, 139, 146, .16)` },
  matchList: { display: "grid", gap: S.lg },
  matchCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: S.lg, background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: 16 },
  matchSpecs: { fontSize: T.size.sm, color: C.textMuted, margin: `${S.xs} 0` },
  toast: { position: "fixed", right: S.xl, top: S.xl, zIndex: 100, display: "flex", alignItems: "center", gap: S.sm, padding: "12px 16px", border: "1px solid", borderRadius: 14, boxShadow: C.shadowSoft, fontWeight: T.weight.semibold },
  toastIcon: { width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: "50%", background: "rgba(255,255,255,.7)" },
  centerDetailGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
    gap: S.lg 
  },
  chamberDetailCard: { 
    background: C.surfaceSoft, 
    border: `1px solid ${C.border}`, 
    borderRadius: 18, 
    padding: S.lg 
  },
  chamberHeader: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "flex-start", 
    marginBottom: S.md 
  },
  specsBadge: { 
    padding: "4px 10px", 
    background: C.infoBg, 
    color: C.info, 
    borderRadius: 8, 
    fontSize: T.size.xs, 
    fontWeight: T.weight.semibold 
  },
  utilizationSection: { 
    marginBottom: S.md 
  },
  chamberStats: { 
    display: "grid", 
    gridTemplateColumns: "repeat(2, 1fr)", 
    gap: S.md,
    marginBottom: S.lg
  },
  chamberActions: { 
    display: "flex", 
    justifyContent: "center" 
  },
  activeBookings: { 
  marginTop: S.md,
  paddingTop: S.md,
  borderTop: `1px dashed ${C.border}`
},
activeBookingsTitle: { 
  fontSize: T.size.sm, 
  color: C.textMuted, 
  marginBottom: S.sm,
  fontWeight: T.weight.semibold
},
activeBookingItem: { 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center",
  padding: `${S.sm} 0`,
  borderBottom: `1px solid ${C.border}`,
  gap: S.md
},
activeBookingTime: { 
  fontSize: T.size.xs, 
  color: C.textLight,
  marginTop: 2
},

  primaryBtn: { 
    width: "100%", 
    minHeight: 44, 
    padding: "0 18px", 
    border: "none", 
    borderRadius: 14, 
    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, 
    color: "#fff", 
    fontWeight: T.weight.bold, 
    cursor: "pointer", 
    transition: ".18s ease" 
  },
  secondaryBtn: { 
    width: "100%", 
    minHeight: 44, 
    padding: "0 18px", 
    borderRadius: 14, 
    border: `1px solid ${C.border}`, 
    background: C.surface, 
    color: C.textMuted, 
    fontWeight: T.weight.bold, 
    cursor: "pointer", 
    transition: ".18s ease" 
  },
  dangerBtn: { 
    minHeight: 44, 
    padding: "0 18px", 
    border: "none", 
    borderRadius: 14, 
    background: C.danger, 
    color: "#fff", 
    fontWeight: T.weight.bold, 
    cursor: "pointer", 
    transition: ".18s ease" 
  },
  progressWrap: { 
    marginTop: S.md 
  },
  progressMeta: { 
    display: "flex", 
    justifyContent: "space-between", 
    color: C.textMuted, 
    fontSize: T.size.sm, 
    marginBottom: S.sm 
  },
  progressBar: { 
    height: 9, 
    background: "#EAF0F4", 
    borderRadius: 999, 
    overflow: "hidden" 
  },
  progressFill: { 
    height: "100%", 
    background: C.primary, 
    borderRadius: 999, 
    transition: ".25s ease" 
  },
};