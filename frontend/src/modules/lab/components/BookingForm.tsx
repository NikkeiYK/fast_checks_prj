import React, { useState } from 'react';
import { api, type BookingCreate } from '../../../api/climate/api';
import { X, Calendar, Clock, User, Building2, FileText } from 'lucide-react';
import { C, S, T } from '../../../theme';

interface BookingFormProps {
  chamberId: number;
  centerId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: S.lg
  },
  modal: {
    background: C.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: S.xl,
    borderBottom: `1px solid ${C.border}`
  },
  title: {
    margin: 0,
    fontSize: T.size.xl,
    fontWeight: T.weight.bold,
    color: C.text
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: C.textMuted,
    padding: S.xs
  },
  body: {
    padding: S.xl
  },
  formGroup: {
    marginBottom: S.lg
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: S.xs,
    fontSize: T.size.sm,
    fontWeight: T.weight.medium,
    color: C.text,
    marginBottom: S.sm
  },
  input: {
    width: '100%',
    padding: `${S.sm} ${S.md}`,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: T.size.base,
    fontFamily: T.font,
    boxSizing: 'border-box' as const,
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  textarea: {
    width: '100%',
    padding: `${S.sm} ${S.md}`,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: T.size.base,
    fontFamily: T.font,
    resize: 'vertical' as const,
    minHeight: 80,
    boxSizing: 'border-box' as const,
    outline: 'none'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: S.md
  },
  timeMode: {
    display: 'flex',
    gap: S.sm,
    marginBottom: S.sm
  },
  timeModeBtn: {
    flex: 1,
    padding: `${S.sm} ${S.md}`,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: C.surface,
    cursor: 'pointer',
    fontSize: T.size.sm,
    fontWeight: T.weight.medium,
    color: C.textMuted,
    transition: 'all 0.2s'
  },
  timeModeBtnActive: {
    background: C.primarySoft,
    borderColor: C.primary,
    color: C.primary
  },
  error: {
    background: '#fef2f2',
    border: `1px solid #fecaca`,
    color: '#991b1b',
    padding: S.md,
    borderRadius: 8,
    fontSize: T.size.sm,
    marginBottom: S.lg
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: S.md,
    padding: S.xl,
    borderTop: `1px solid ${C.border}`
  },
  btn: {
    padding: `${S.sm} ${S.lg}`,
    borderRadius: 8,
    border: 'none',
    fontSize: T.size.base,
    fontWeight: T.weight.medium,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  btnPrimary: {
    background: C.primary,
    color: '#fff'
  },
  btnSecondary: {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.textMuted
  }
};

type TimeMode = 'duration' | 'end_date';

export  function BookingForm({ chamberId, centerId, onClose, onSuccess }: BookingFormProps) {
  const [timeMode, setTimeMode] = useState<TimeMode>('duration');
  const [formData, setFormData] = useState({
    department: '',
    full_name: '',
    sample_cipher: '',
    description: '',
    project: '',
    lims_request_id: '',
    start_time: '',
    duration_hours: '',
    end_time: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    
    // Валидация
    if (!formData.department.trim()) return setError('Укажите отдел');
    if (!formData.full_name.trim()) return setError('Укажите ФИО');
    if (!formData.sample_cipher.trim()) return setError('Укажите шифр образца');
    if (!formData.start_time) return setError('Укажите дату и время начала');
    
    let duration_hours: number;
    
    if (timeMode === 'duration') {
      duration_hours = Number(formData.duration_hours);
      if (!duration_hours || duration_hours <= 0) return setError('Укажите корректную продолжительность');
    } else {
      if (!formData.end_time) return setError('Укажите дату и время окончания');
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);
      if (end <= start) return setError('Дата окончания должна быть позже даты начала');
      duration_hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    }

    const bookingData: BookingCreate = {
      center_id: centerId,
      chamber_id: chamberId,
      department: formData.department.trim(),
      full_name: formData.full_name.trim(),
      sample_cipher: formData.sample_cipher.trim(),
      description: formData.description.trim() || undefined,
      project: formData.project.trim() || undefined,
      lims_request_id: formData.lims_request_id.trim() || undefined,
      duration_hours,
      start_time: new Date(formData.start_time).toISOString()
    };

    setLoading(true);
    try {
      await api.createBooking(bookingData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка создания бронирования');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Бронирование камеры</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {/* Отдел и ФИО */}
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <Building2 size={16} />
                Отдел *
              </label>
              <input
                style={styles.input}
                value={formData.department}
                onChange={e => updateField('department', e.target.value)}
                placeholder="Например: Лаборатория №3"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <User size={16} />
                ФИО *
              </label>
              <input
                style={styles.input}
                value={formData.full_name}
                onChange={e => updateField('full_name', e.target.value)}
                placeholder="Иванов Иван Иванович"
              />
            </div>
          </div>

          {/* Шифр образца и Проект */}
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <FileText size={16} />
                Шифр образца *
              </label>
              <input
                style={styles.input}
                value={formData.sample_cipher}
                onChange={e => updateField('sample_cipher', e.target.value)}
                placeholder="ОБ-2024-001"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <FileText size={16} />
                Проект
              </label>
              <input
                style={styles.input}
                value={formData.project}
                onChange={e => updateField('project', e.target.value)}
                placeholder="Название проекта"
              />
            </div>
          </div>

          {/* Описание */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <FileText size={16} />
              Описание
            </label>
            <textarea
              style={styles.textarea}
              value={formData.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="Дополнительная информация об испытании"
            />
          </div>

          {/* Заявка в ЛИМС */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <FileText size={16} />
              Заявка в ЛИМС
            </label>
            <input
              style={styles.input}
              value={formData.lims_request_id}
              onChange={e => updateField('lims_request_id', e.target.value)}
              placeholder="Номер заявки"
            />
          </div>

          {/* Время */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <Calendar size={16} />
              Дата и время начала *
            </label>
            <input
              type="datetime-local"
              style={styles.input}
              value={formData.start_time}
              onChange={e => updateField('start_time', e.target.value)}
            />
          </div>

          {/* Режим выбора времени */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <Clock size={16} />
              Режим указания времени
            </label>
            <div style={styles.timeMode}>
              <button
                style={{
                  ...styles.timeModeBtn,
                  ...(timeMode === 'duration' ? styles.timeModeBtnActive : {})
                }}
                onClick={() => setTimeMode('duration')}
              >
                По продолжительности
              </button>
              <button
                style={{
                  ...styles.timeModeBtn,
                  ...(timeMode === 'end_date' ? styles.timeModeBtnActive : {})
                }}
                onClick={() => setTimeMode('end_date')}
              >
                По дате окончания
              </button>
            </div>

            {timeMode === 'duration' ? (
              <input
                type="number"
                style={styles.input}
                value={formData.duration_hours}
                onChange={e => updateField('duration_hours', e.target.value)}
                placeholder="Продолжительность в часах"
                min="1"
              />
            ) : (
              <input
                type="datetime-local"
                style={styles.input}
                value={formData.end_time}
                onChange={e => updateField('end_time', e.target.value)}
              />
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Создание...' : 'Забронировать'}
          </button>
        </div>
      </div>
    </div>
  );
}