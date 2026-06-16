import React, { useState } from 'react';
import { type Booking } from '../../../api/climate/api';
import { api } from '../../../api/climate/api';
import { Trash2 } from 'lucide-react';
import { C, S, T } from '../../../theme';

interface BookingListProps {
  bookings: Booking[];
  chamberId?: number;
  onBookingDeleted: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: C.surface,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    overflow: 'hidden'
  },
  header: {
    padding: S.lg,
    borderBottom: `1px solid ${C.border}`,
    fontSize: T.size.base,
    fontWeight: T.weight.bold,
    color: C.text
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },
  th: {
    textAlign: 'left' as const,
    padding: `${S.sm} ${S.lg}`,
    borderBottom: `1px solid ${C.border}`,
    fontSize: T.size.sm,
    fontWeight: T.weight.medium,
    color: C.textMuted,
    backgroundColor: '#f8fafc'
  },
  td: {
    padding: `${S.md} ${S.lg}`,
    borderBottom: `1px solid ${C.border}`,
    fontSize: T.size.sm,
    color: C.text,
    verticalAlign: 'top' as const
  },
  status: {
    padding: `${S.xs} ${S.sm}`,
    borderRadius: 6,
    fontSize: T.size.xs,
    fontWeight: T.weight.medium,
    display: 'inline-block'
  },
  statusActive: {
    background: '#d1fae5',
    color: '#065f46'
  },
  statusCancelled: {
    background: '#fee2e2',
    color: '#991b1b'
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: C.textMuted,
    cursor: 'pointer',
    padding: S.xs,
    borderRadius: 6,
    transition: 'all 0.2s'
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: C.surface,
    borderRadius: 16,
    padding: S.xl,
    maxWidth: 500,
    width: '90%',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
  },
  modalTitle: {
    margin: `0 0 ${S.lg}`,
    fontSize: T.size.lg,
    fontWeight: T.weight.bold,
    color: C.text
  },
  textarea: {
    width: '100%',
    padding: S.md,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: T.size.base,
    fontFamily: T.font,
    resize: 'vertical' as const,
    minHeight: 100,
    marginBottom: S.lg,
    boxSizing: 'border-box'
  },
  modalActions: {
    display: 'flex',
    gap: S.md,
    justifyContent: 'flex-end'
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
  },
  reasonText: {
    fontSize: T.size.xs,
    color: C.textMuted,
    marginTop: S.xs,
    fontStyle: 'italic' as const,
    lineHeight: 1.4
  }
};

export function BookingList({ bookings, chamberId, onBookingDeleted }: BookingListProps) {
  const [cancelModal, setCancelModal] = useState<{ open: boolean; bookingId: number | null }>({
    open: false,
    bookingId: null
  });
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredBookings = chamberId
    ? bookings.filter(b => b.chamber_id === chamberId)
    : bookings;

  const handleCancelClick = (bookingId: number) => {
    setCancelModal({ open: true, bookingId });
    setCancelReason('');
  };

  const handleCancelSubmit = async () => {
    if (!cancelModal.bookingId || cancelReason.length < 5) return;
    
    setLoading(true);
    try {
      await api.cancelBooking(cancelModal.bookingId, cancelReason);
      onBookingDeleted();
      setCancelModal({ open: false, bookingId: null });
    } catch (error) {
      console.error('Ошибка отмены:', error);
      alert('Не удалось отменить бронирование');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Обновленный формат даты с годом
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        Бронирования ({filteredBookings.length})
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Образец</th>
              <th style={styles.th}>ФИО</th>
              <th style={styles.th}>Отдел</th>
              <th style={styles.th}>Ячейка</th>
              <th style={styles.th}>Начало</th>
              <th style={styles.th}>Окончание</th>
              <th style={styles.th}>Длительность</th>
              <th style={styles.th}>Статус</th>
              <th style={styles.th}>Причина отмены</th>
              <th style={styles.th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...styles.td, textAlign: 'center', color: C.textMuted }}>
                  Нет бронирований
                </td>
              </tr>
            ) : (
              filteredBookings.map(booking => (
                <tr key={booking.id}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: T.weight.medium }}>{booking.sample_cipher}</div>
                    {booking.project && (
                      <div style={{ fontSize: T.size.xs, color: C.textMuted }}>{booking.project}</div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <div>{booking.full_name}</div>
                  </td>
                  <td style={styles.td}>{booking.department}</td>
                  <td style={styles.td}>{booking.cassette_number}</td>
                  <td style={styles.td}>{formatDate(booking.start_time)}</td>
                  <td style={styles.td}>{formatDate(booking.end_time)}</td>
                  <td style={styles.td}>{booking.duration_hours} ч</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.status,
                      ...(booking.status === 'active' ? styles.statusActive : styles.statusCancelled)
                    }}>
                      {booking.status === 'active' ? 'Активно' : 'Отменено'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {booking.status === 'cancelled' && booking.cancellation_reason ? (
                      <div style={styles.reasonText}>{booking.cancellation_reason}</div>
                    ) : (
                      <span style={{ color: C.textMuted, fontSize: T.size.xs }}>—</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {booking.status === 'active' && (
                      <button
                        style={styles.deleteBtn}
                        onClick={() => handleCancelClick(booking.id)}
                        title="Отменить бронирование"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {cancelModal.open && (
        <div style={styles.modal} onClick={() => setCancelModal({ open: false, bookingId: null })}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Отмена бронирования</h3>
            <p style={{ marginBottom: S.md, color: C.textMuted }}>
              Укажите причину отмены (минимум 5 символов):
            </p>
            <textarea
              style={styles.textarea}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Например: Образец не готов, изменение сроков проекта..."
              autoFocus
            />
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btn, ...styles.btnSecondary }}
                onClick={() => setCancelModal({ open: false, bookingId: null })}
              >
                Отмена
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={handleCancelSubmit}
                disabled={loading || cancelReason.length < 5}
              >
                {loading ? 'Отмена...' : 'Подтвердить отмену'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}