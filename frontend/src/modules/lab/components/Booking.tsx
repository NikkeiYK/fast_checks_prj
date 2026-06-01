import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { API } from "../../../config";

// ─── DESIGN TOKENS (единые с приложением) ───
const C = {
  primary: "#008B92", primaryDark: "#006B6B", primaryBg: "#E6F7F8",
  bg: "#F8FAFC", surface: "#FFFFFF", border: "#E2E8F0",
  text: "#0F172A", textMuted: "#475569", textLight: "#64748B",
  danger: "#DC2626", dangerBg: "#FEE2E2",
  success: "#22c55e", successBg: "#dcfce7",
  warning: "#eab308", warningBg: "#fef3c7",
  info: "#3b82f6", infoBg: "#dbeafe",
};

const T = {
  font: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
  size: { xs: "11px", sm: "13px", base: "14px", lg: "16px", xl: "20px" },
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
};

const S = {
  xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "20px", "2xl": "24px", "3xl": "32px",
};

// ─── TYPES ───
type Slot = {
  slot_number: number;
  status: "free" | "busy" | "ending_soon" | "unavailable";
  label: string;
  booking_id?: string | null;
  ends_at?: string | null;
  progress?: number;
  fio?: string;
  sample_code?: string;
  project?: string;
  next_booking?: string | null;
};

type BookingForm = {
  fio: string; sample_code: string; project: string;
  start_time: string; duration_hours: number;
  conditions: string; comments: string;
};

type BookingDetails = {
  start_time: string; end_time: string;
  remaining_days: number; remaining_hours: number;
  progress: number; sample_code: string; project: string;
  fio: string; conditions?: string; comments?: string;
  duration_hours: number;
};

// ─── UTILS: Русский формат даты ───
const formatRuDateTime = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).replace(",", "");
};

const formatRuDateInput = (iso: string): string => {
  if (!iso) return "";
  return iso.slice(0, 16); // "2026-02-20T16:30"
};

// ─── COMPONENT ───
export default function Booking() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modal, setModal] = useState<"book" | "details" | null>(null);
  const [activeSlotNum, setActiveSlotNum] = useState<number | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
  if (!user) return;
  try {
    // 🔹 Используем API.climate.history если есть, иначе хардкод
    const url = API.climate?.history 
      ? `${API.climate.history}${getAuth()}`
      : `/api/climate/history${getAuth()}`;
      
    console.log("📡 Загрузка истории:", url);
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error("❌ Ошибка истории:", res.status, await res.text());
      return;
    }
    
    const data = await res.json();
    console.log("✅ История загружена:", data.length, "записей");
    setHistory(data);
  } catch (e: any) {
    console.error("💥 Исключение в loadHistory:", e);
  }
};
  
  const [form, setForm] = useState<BookingForm>({
    fio: "", sample_code: "", project: "", start_time: "",
    duration_hours: 1000, conditions: "", comments: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const getAuth = () => `?username=${user?.username || ""}`;

  // ─── Загрузка данных ───
  const loadSlots = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API.climate.slots}${getAuth()}`);
      const ct = res.headers.get("content-type");
      if (!ct?.includes("application/json")) {
        const txt = await res.text();
        if (txt.startsWith("<!doctype")) throw new Error("Бэкенд не отвечает на :8000");
        throw new Error(`Неверный ответ: ${txt.slice(0, 80)}`);
      }
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      setSlots(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e.message || "Не удалось загрузить слоты");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMeta = async () => {
    try {
      const res = await fetch(API.climate.meta);
      if (res.ok) setMeta(await res.json());
    } catch {}
  };

  useEffect(() => {
  // Загружаем данные только если пользователь авторизован
  if (!user) {
    console.log("⏳ Ждём авторизации...");
    return;
  }

  console.log("🔄 Загрузка данных: слоты + история");
  loadSlots();
  loadMeta();
  loadHistory();

  // Автообновление
  const intervalId = setInterval(() => {
    loadSlots();
    loadHistory();
  }, 30000);

  // Cleanup
  return () => clearInterval(intervalId);
}, [user]); 

  // ─── Утилиты ───
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getStatusConfig = (status: Slot["status"]) => {
    const map: Record<string, { bg: string; border: string; text: string; label: string }> = {
      free: { bg: C.successBg, border: C.success, text: C.success, label: "Свободен" },
      busy: { bg: C.dangerBg, border: C.danger, text: C.danger, label: "Занят" },
      ending_soon: { bg: C.warningBg, border: C.warning, text: C.warning, label: "<48 ч" },
      unavailable: { bg: "#f1f5f9", border: C.textLight, text: C.textLight, label: "Недоступен" },
    };
    return map[status] || map.free;
  };

  // ─── Обработчики ───
  const handleSlotClick = (slot: Slot) => {
    if (slot.status === "free") {
      setActiveSlotNum(slot.slot_number);
      setForm(p => ({ ...p, start_time: formatRuDateInput(new Date().toISOString()) }));
      setModal("book");
    } else if (slot.booking_id) {
      setActiveBookingId(slot.booking_id);
      loadDetails(slot.booking_id);
    }
  };

  const loadDetails = async (id: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API.climate.booking(id)}${getAuth()}`);
      if (!res.ok) throw new Error("Не удалось загрузить");
      setDetails(await res.json());
      setModal("details");
    } catch (e: any) { showToast(e.message, "error"); }
  };

  const closeModal = () => {
    setModal(null); setActiveSlotNum(null); setActiveBookingId(null); setDetails(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeSlotNum) return;
    setSubmitting(true);
    try {
      const payload = {
        slot_number: activeSlotNum, fio: form.fio, sample_code: form.sample_code,
        project: form.project, start_time: form.start_time.replace(" ", "T") + ":00",
        duration_hours: form.duration_hours,
        conditions: form.conditions || undefined, comments: form.comments || undefined,
      };
      const res = await fetch(`${API.climate.book}${getAuth()}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Ошибка");
      showToast(`✅ Слот #${activeSlotNum} забронирован`);
      closeModal(); loadSlots();
      setForm({ fio: "", sample_code: "", project: "", start_time: "", duration_hours: 1000, conditions: "", comments: "" });
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSubmitting(false); }
  };

  const handleCancel = async () => {
  if (!user || !activeBookingId) return;
  if (user.role !== "admin") return showToast("Только администратор", "error");
  
  if (!confirm("Освободить этот слот? Эксперимент будет помечен как отменённый.")) return;

  const comment = prompt("Причина отмены (необязательно):") || "";
  try {
    const res = await fetch(`/api/climate/cancel/${activeBookingId}${getAuth()}&comment=${encodeURIComponent(comment)}`, { 
      method: "POST" 
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка отмены");
    
    showToast("🗑️ Слот успешно освобождён");
    closeModal();
    loadSlots();
    loadHistory(); // Обновляем историю сразу
  } catch (e: any) {
    showToast(e.message, "error");
  }
};

  // ─── Рендер ───
  if (!user) return <div style={styles.center}>Загрузка...</div>;
  if (loading && !slots.length) return <div style={styles.center}>Загрузка...</div>;
  if (error) return <div style={{...styles.center, color: C.danger}}>❌ {error}<br/><small>Проверьте запуск бэкенда на :8000</small></div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🌡️ Климатическая камера</h1>
          <p style={styles.subtitle}>Q-LAB QUV/Spray • 24 слота • Бронирование в реальном времени</p>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.userBadge}>
            {user.role === "admin" ? "👑 Админ" : "🔍 Аудитор"}
          </span>
          <button style={styles.refreshBtn} onClick={loadSlots} type="button">↻ Обновить</button>
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(meta.status_info || {}).map(([key, val]: any) => (
          <span key={key} style={styles.legendItem}>
            <span style={{...styles.legendDot, background: val.color}} />
            {val.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div style={styles.grid}>
        {Array.from({length: 24}, (_, i) => i + 1).map(num => {
          const slot = slots.find(s => s.slot_number === num) || { slot_number: num, status: "free", label: "Свободен" } as Slot;
          const cfg = getStatusConfig(slot.status);
          return (
            <button
              key={num}
              style={{...styles.slot, borderLeft: `4px solid ${cfg.border}`, background: cfg.bg}}
              onClick={() => handleSlotClick(slot)}
              disabled={slot.status === "unavailable"}
              type="button"
              title={slot.status === "free" ? "Забронировать" : "Посмотреть детали"}
            >
              <div style={styles.slotTop}>
                <span style={styles.slotNum}>#{num}</span>
                <span style={{...styles.slotStatus, color: cfg.text}}>{cfg.label}</span>
              </div>
              <div style={styles.slotLabel}>{slot.label}</div>
              {/* Progress bar для занятых слотов */}
              {(slot.status === "busy" || slot.status === "ending_soon") && slot.progress !== undefined && (
                <div style={styles.progressWrap}>
                  <div style={{...styles.progressBar, width: `${slot.progress}%`, background: cfg.text}} />
                  <span style={styles.progressText}>{slot.progress}%</span>
                </div>
              )}
              {/* Подсказка о следующем бронировании */}
              {slot.status === "free" && slot.next_booking && (
                <div style={styles.nextBooking}>
                  След.: {formatRuDateTime(slot.next_booking)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={styles.historySection}>
        <h3 style={styles.historyTitle}>📜 История бронирований</h3>
        <div style={styles.historyTableWrap}>
          <table style={styles.historyTable}>
            <thead>
              <tr>
                <th style={styles.th}>Слот</th>
                <th style={styles.th}>Образец</th>
                <th style={styles.th}>Проект</th>
                <th style={styles.th}>ФИО</th>
                <th style={styles.th}>Начало</th>
                <th style={styles.th}>Окончание</th>
                <th style={styles.th}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={7} style={styles.tdEmpty}>История пуста</td></tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id}>
                    <td style={styles.td}>#{h.slot}</td>
                    <td style={styles.td}>{h.sample}</td>
                    <td style={styles.td}>{h.project}</td>
                    <td style={styles.td}>{h.fio}</td>
                    <td style={styles.td}>{h.start}</td>
                    <td style={styles.td}>{h.end}</td>
                    <td style={{...styles.td, color: h.status === "Активна" ? C.primary : h.status === "Завершена" ? C.textLight : C.danger}}>
                      {h.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Booking */}
      {modal === "book" && activeSlotNum && (
        <div style={styles.modalBackdrop} onClick={closeModal}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>📅 Бронь слота #{activeSlotNum}</h2>
              <button style={styles.modalClose} onClick={closeModal} type="button">✕</button>
            </div>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <label style={styles.label}>ФИО*
                  <input style={styles.input} required value={form.fio} onChange={e => setForm(p => ({...p, fio: e.target.value}))} placeholder="Иванов И.И." />
                </label>
                <label style={styles.label}>Образец*
                  <input style={styles.input} required value={form.sample_code} onChange={e => setForm(p => ({...p, sample_code: e.target.value}))} placeholder="Авг-2026-1" />
                </label>
              </div>
              <label style={styles.label}>Проект*
                <input style={styles.input} required value={form.project} onChange={e => setForm(p => ({...p, project: e.target.value}))} placeholder="ГОСТ на рукава" />
              </label>
              <div style={styles.formRow}>
                <label style={styles.label}>Дата начала*
                  <input style={styles.input} type="datetime-local" required value={formatRuDateInput(form.start_time)} onChange={e => setForm(p => ({...p, start_time: e.target.value}))} />
                </label>
                <label style={styles.label}>Длительность, ч*
                  <input style={styles.input} type="number" required min="1" max="8760" value={form.duration_hours} onChange={e => setForm(p => ({...p, duration_hours: +e.target.value || 1}))} />
                </label>
              </div>
              <div style={styles.calcRow}>
                <span>Окончание:</span>
                <b>{formatRuDateTime((form.start_time ? new Date(form.start_time.replace(" ", "T")) : new Date()).toISOString().replace("T", " ") + ":00")}</b>
                <span style={{marginLeft: "auto", fontSize: T.size.xs, color: C.textLight}}>
                  {form.duration_hours} ч = {(form.duration_hours / 24).toFixed(1)} сут.
                </span>
              </div>
              <label style={styles.label}>Условия
                <select style={styles.input} value={form.conditions} onChange={e => setForm(p => ({...p, conditions: e.target.value}))}>
                  <option value="">— Не указано —</option>
                  {meta.conditions?.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={styles.label}>Комментарии
                <textarea style={{...styles.input, ...styles.textarea}} value={form.comments} onChange={e => setForm(p => ({...p, comments: e.target.value}))} rows={2} placeholder="Температура, влажность, особенности..." />
              </label>
              <div style={styles.formActions}>
                <button type="button" style={styles.btnCancel} onClick={closeModal}>Отмена</button>
                <button type="submit" style={styles.btnSubmit} disabled={submitting}>{submitting ? "Сохранение..." : "✅ Забронировать"}</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modal: Details */}
      {modal === "details" && details && (
        <div style={styles.modalBackdrop} onClick={closeModal}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>🔬 Эксперимент</h2>
              <button style={styles.modalClose} onClick={closeModal} type="button">✕</button>
            </div>
            
            {/* Progress bar */}
            <div style={styles.detailsProgress}>
              <div style={styles.progressWrapLarge}>
                <div style={{...styles.progressBarLarge, width: `${details.progress}%`}} />
              </div>
              <div style={styles.progressLabels}>
                <span>Начало</span>
                <span style={{fontWeight: T.weight.bold}}>{details.progress}%</span>
                <span>Окончание</span>
              </div>
            </div>

            <div style={styles.detailsGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Начало</span><b style={styles.detailValue}>{details.start_time}</b></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Окончание</span><b style={styles.detailValue}>{details.end_time}</b></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Осталось</span><b style={styles.detailValue}>{details.remaining_days} дн. {details.remaining_hours} ч</b></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Длительность</span><b style={styles.detailValue}>{details.duration_hours} ч</b></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Образец</span><b style={styles.detailValue}>{details.sample_code}</b></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Проект</span><b style={styles.detailValue}>{details.project}</b></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>ФИО</span><b style={styles.detailValue}>{details.fio}</b></div>
              {details.conditions && <div style={styles.detailItem}><span>Условия</span><b style={styles.detailValue}>{details.conditions}</b></div>}
            </div>
            
            {details.comments && (
              <div style={styles.commentsBox}>
                <small>Комментарий:</small>
                <p style={{margin: "4px 0 0", fontSize: T.size.sm}}>{details.comments}</p>
              </div>
            )}

            {user?.role === "admin" && (
              <button style={styles.btnDanger} onClick={handleCancel} type="button">
                🗑️ Освободить слот (админ)
              </button>
            )}
            <button style={styles.btnClose} onClick={closeModal} type="button">Закрыть</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{...styles.toast, background: toast.type === "error" ? C.danger : C.success}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── STYLES ───
const styles: Record<string, React.CSSProperties> = {
  container: { padding: S["3xl"], maxWidth: "1400px", margin: "0 auto" },
  center: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px", fontSize: T.size.lg, textAlign: "center", color: C.textMuted },
  
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S["2xl"], paddingBottom: S.lg, borderBottom: `1px solid ${C.border}` },
  title: { margin: 0, fontSize: T.size.xl, fontWeight: T.weight.semibold, color: C.text },
  subtitle: { margin: "4px 0 0", fontSize: T.size.sm, color: C.textLight },
  headerActions: { display: "flex", alignItems: "center", gap: S.md },
  userBadge: { padding: `${S.xs} ${S.md}`, background: C.primaryBg, color: C.primaryDark, borderRadius: "20px", fontSize: T.size.xs, fontWeight: T.weight.medium },
  refreshBtn: { padding: `${S.sm} ${S.lg}`, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", color: C.text, cursor: "pointer", fontSize: T.size.sm, fontWeight: T.weight.medium, transition: "all 0.15s" },
  
  legend: { display: "flex", gap: S.lg, marginBottom: S["2xl"], flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: S.xs, fontSize: T.size.sm, color: C.textMuted },
  legendDot: { width: "14px", height: "14px", borderRadius: "4px", display: "inline-block" },
  
  grid: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: S.md, marginBottom: S["3xl"] },
  slot: { aspectRatio: "1/1", borderRadius: "12px", padding: S.lg, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "transform 0.15s, box-shadow 0.15s", border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" },
  slotTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.xs },
  slotNum: { fontWeight: T.weight.bold, fontSize: T.size.lg, color: C.text },
  slotStatus: { fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: `${S.xs} ${S.sm}`, borderRadius: "4px", background: "rgba(255,255,255,0.7)" },
  slotLabel: { fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  
  progressWrap: { marginTop: S.sm, display: "flex", alignItems: "center", gap: S.xs },
  progressBar: { height: "6px", borderRadius: "3px", transition: "width 0.3s ease" },
  progressText: { fontSize: T.size.xs, fontWeight: T.weight.medium, color: C.textMuted },
  
  nextBooking: { marginTop: S.xs, fontSize: T.size.xs, color: C.textLight, fontStyle: "italic" },
  
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: S.lg },
  modal: { background: C.surface, borderRadius: "16px", width: "560px", maxWidth: "95%", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${S.lg} ${S["2xl"]}`, borderBottom: `1px solid ${C.border}`, background: C.bg },
  modalTitle: { margin: 0, fontSize: T.size.lg, fontWeight: T.weight.semibold },
  modalClose: { background: "none", border: "none", fontSize: T.size.lg, cursor: "pointer", color: C.textLight, padding: S.xs, borderRadius: "4px" },
  
  form: { padding: S["2xl"], display: "flex", flexDirection: "column", gap: S.md, overflowY: "auto", flex: 1 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.md },
  label: { display: "flex", flexDirection: "column", gap: S.xs, fontSize: T.size.sm, fontWeight: T.weight.medium, color: C.text },
  input: { padding: `${S.sm} ${S.md}`, border: `1px solid ${C.border}`, borderRadius: "8px", fontSize: T.size.sm, background: C.surface, transition: "border-color 0.15s" },
  textarea: { resize: "vertical", minHeight: "50px", fontFamily: "inherit" },
  calcRow: { display: "flex", alignItems: "center", gap: S.md, background: C.primaryBg, padding: `${S.sm} ${S.md}`, borderRadius: "8px", fontSize: T.size.sm },
  formActions: { display: "flex", gap: S.md, justifyContent: "flex-end", marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.border}` },
  
  btnCancel: { padding: `${S.sm} ${S.lg}`, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", cursor: "pointer", color: C.textMuted, fontWeight: T.weight.medium },
  btnSubmit: { padding: `${S.sm} ${S.lg}`, background: C.primary, border: "none", borderRadius: "8px", cursor: "pointer", color: "#fff", fontWeight: T.weight.medium },
  
  detailsProgress: { padding: `${S.lg} ${S["2xl"]}`, background: C.bg, borderBottom: `1px solid ${C.border}` },
  progressWrapLarge: { height: "8px", background: C.border, borderRadius: "4px", overflow: "hidden", marginBottom: S.xs },
  progressBarLarge: { height: "100%", background: C.primary, borderRadius: "4px", transition: "width 0.5s ease" },
  progressLabels: { display: "flex", justifyContent: "space-between", fontSize: T.size.xs, color: C.textLight },
  
  detailsGrid: { padding: S["2xl"], display: "grid", gridTemplateColumns: "1fr 1fr", gap: `${S.md} ${S["2xl"]}` },
  detailItem: { display: "flex", flexDirection: "column", gap: S.xs },
  detailLabel: { fontSize: T.size.xs, color: C.textLight },  // ← новый стиль для span
  detailValue: { fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.text },  // ← для b
  
  commentsBox: { padding: `0 ${S["2xl"]} ${S["2xl"]}`, borderTop: `1px solid ${C.border}`, background: C.bg },
  
  btnDanger: { margin: `0 ${S["2xl"]} ${S.md}`, padding: `${S.sm} ${S.lg}`, background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: "8px", color: C.danger, cursor: "pointer", fontWeight: T.weight.medium },
  btnClose: { margin: `0 ${S["2xl"]} ${S["2xl"]}`, padding: `${S.sm} ${S.lg}`, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", cursor: "pointer", fontWeight: T.weight.medium },
  
  toast: { position: "fixed", bottom: S["2xl"], right: S["2xl"], padding: `${S.md} ${S.lg}`, borderRadius: "10px", color: "#fff", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", zIndex: 200, animation: "slideIn 0.3s ease" },
  historySection: { marginTop: S["3xl"], borderTop: `1px solid ${C.border}`, paddingTop: S["2xl"] },
  historyTitle: { margin: `0 0 ${S.lg}`, fontSize: T.size.lg, fontWeight: T.weight.semibold },
  historyTableWrap: { overflowX: "auto", borderRadius: "8px", border: `1px solid ${C.border}` },
  historyTable: { width: "100%", borderCollapse: "collapse", fontSize: T.size.sm, background: C.surface },
  th: { padding: `${S.md} ${S.lg}`, textAlign: "left", background: C.bg, fontWeight: T.weight.semibold, color: C.textMuted, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" },
  td: { padding: `${S.md} ${S.lg}`, borderBottom: `1px solid ${C.border}`, color: C.text },
  tdEmpty: { padding: S["2xl"], textAlign: "center", color: C.textLight, fontStyle: "italic" },
};

// ─── ANIMATIONS ───
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .slot:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
    .slot:disabled { cursor: not-allowed; opacity: 0.6; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: ${C.primary}; box-shadow: 0 0 0 3px ${C.primaryBg}; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
}