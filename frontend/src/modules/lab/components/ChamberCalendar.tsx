import React, { useState, useMemo } from 'react';
import { type Booking } from '../../../api/climate/api';
import { C, S, T } from '../../../theme';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface ChamberCalendarProps {
  chamberId: number;
  bookings: Booking[];
  cassetteCount: number;
}

interface BookingInfo {
  sample_cipher: string;
  full_name: string;
  start_time: string;
  end_time: string;
}

const CELL_WIDTH = 40;
const CELL_HEIGHT = 28;
const LABEL_WIDTH = 80;
const DEFAULT_DAYS_RANGE = 30; // Диапазон по умолчанию

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: C.surface,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: S.lg
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
    flexWrap: 'wrap' as const,
    gap: S.md
  },
  title: {
    fontSize: T.size.base,
    fontWeight: T.weight.bold,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    gap: S.sm
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: S.sm
  },
  dateInput: {
    padding: `${S.xs} ${S.sm}`,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: T.size.sm,
    fontFamily: T.font,
    color: C.text
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.surface,
    cursor: 'pointer',
    color: C.textMuted,
    transition: 'all 0.2s'
  },
  calendarWrapper: {
    overflowX: 'auto' as const,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    width: '100%'
  },
  cornerCell: {
    position: 'sticky' as const,
    left: 0,
    background: '#f8fafc',
    borderRight: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
    padding: S.sm,
    fontSize: T.size.xs,
    fontWeight: T.weight.bold,
    color: C.textMuted,
    zIndex: 10
  },
  dayHeader: {
    minWidth: CELL_WIDTH,
    height: 40,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 10,
    fontWeight: T.weight.medium,
    color: C.textMuted,
    background: '#f8fafc'
  },
  dayHeaderWeekend: {
    background: '#f1f5f9'
  },
  cassetteLabel: {
    position: 'sticky' as const,
    left: 0,
    background: C.surface,
    borderRight: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
    padding: `${S.xs} ${S.sm}`,
    fontSize: T.size.xs,
    fontWeight: T.weight.medium,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    zIndex: 10,
    minWidth: LABEL_WIDTH
  },
  cell: {
    minWidth: CELL_WIDTH,
    height: CELL_HEIGHT,
    transition: 'all 0.2s',
    cursor: 'pointer',
    boxSizing: 'border-box' as const
  },
  cellFree: {
    background: '#f0fdf4',
    borderRight: `1px solid #86efac`,
    borderBottom: `1px solid #86efac`
  },
  cellBusy: {
    background: '#fee2e2',
    borderRight: `1px solid #fca5a5`,
    borderBottom: `1px solid #fca5a5`
  },
  cellWeekend: {
    background: '#f8fafc',
    borderRight: `1px solid #e2e8f0`,
    borderBottom: `1px solid #e2e8f0`
  },
  legend: {
    display: 'flex',
    gap: S.lg,
    marginTop: S.lg,
    justifyContent: 'center',
    fontSize: T.size.xs,
    color: C.textMuted
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: S.xs
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: `1px solid ${C.border}`
  },
  info: {
    marginTop: S.md,
    padding: S.md,
    background: '#f8fafc',
    borderRadius: 8,
    fontSize: T.size.sm,
    color: C.textMuted,
    textAlign: 'center' as const
  },
  tooltip: {
    position: 'fixed' as const,
    background: C.text,
    color: '#fff',
    padding: `${S.sm} ${S.md}`,
    borderRadius: 8,
    fontSize: T.size.xs,
    zIndex: 1000,
    pointerEvents: 'none' as const,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: 250,
    lineHeight: 1.5
  },
  tooltipTitle: {
    fontWeight: T.weight.bold,
    marginBottom: S.xs,
    borderBottom: '1px solid rgba(255,255,255,0.3)',
    paddingBottom: S.xs
  },
  tooltipRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: S.md,
    marginBottom: S.xs
  },
  tooltipLabel: {
    color: '#94a3b8',
    fontSize: T.size.xs
  },
  tooltipValue: {
    color: '#fff',
    fontWeight: T.weight.medium
  }
};

export function ChamberCalendar({ chamberId, bookings, cassetteCount }: ChamberCalendarProps) {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + DEFAULT_DAYS_RANGE);
    return future.toISOString().split('T')[0];
  });

  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: BookingInfo | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    content: null
  });

  // ✅ При ручном выборе дат - просто принимаем значения без ограничений
  const handleStartDateChange = (newStart: string) => {
    const start = new Date(newStart);
    const end = new Date(endDate);
    
    // Если start >= end, сдвигаем end на день вперед
    if (start >= end) {
      const newEnd = new Date(start);
      newEnd.setDate(newEnd.getDate() + 1);
      setEndDate(newEnd.toISOString().split('T')[0]);
    }
    
    setStartDate(newStart);
  };

  const handleEndDateChange = (newEnd: string) => {
    const start = new Date(startDate);
    const end = new Date(newEnd);
    
    // Если end <= start, сдвигаем start на день назад
    if (end <= start) {
      const newStart = new Date(end);
      newStart.setDate(newStart.getDate() - 1);
      setStartDate(newStart.toISOString().split('T')[0]);
    }
    
    setEndDate(newEnd);
  };

  const days = useMemo(() => {
    const result: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) return result;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      result.push(new Date(d));
    }
    return result;
  }, [startDate, endDate]);

  const occupancyMatrix = useMemo(() => {
    const matrix: Record<string, (BookingInfo | null)[]> = {};
    
    days.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      matrix[dateStr] = Array(cassetteCount).fill(null);
    });

    bookings.forEach(booking => {
      if (booking.chamber_id !== chamberId || booking.status !== 'active') return;
      
      const start = new Date(booking.start_time);
      const end = new Date(booking.end_time);
      const cassetteIdx = booking.cassette_number - 1;
      
      if (cassetteIdx < 0 || cassetteIdx >= cassetteCount) return;
      
      const bookingInfo: BookingInfo = {
        sample_cipher: booking.sample_cipher,
        full_name: booking.full_name,
        start_time: booking.start_time,
        end_time: booking.end_time
      };
      
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (matrix[dateStr]) {
          matrix[dateStr][cassetteIdx] = bookingInfo;
        }
      }
    });
    
    return matrix;
  }, [bookings, chamberId, cassetteCount, days]);

  // ✅ Кнопки навигации сдвигают на 7 дней, сохраняя текущий диапазон
  const shiftDates = (daysShift: number) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setDate(start.getDate() + daysShift);
    end.setDate(end.getDate() + daysShift);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const getDayName = (date: Date) => {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[date.getDay()];
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCellHover = (e: React.MouseEvent, bookingInfo: BookingInfo | null) => {
    if (bookingInfo) {
      setTooltip({
        visible: true,
        x: e.clientX + 10,
        y: e.clientY + 10,
        content: bookingInfo
      });
    }
  };

  const handleCellLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  if (days.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.info}>Выберите корректный диапазон дат</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <Calendar size={18} />
          Расписание бронирований
        </div>
        <div style={styles.controls}>
          <button style={styles.navBtn} onClick={() => shiftDates(-7)} title="Назад на неделю">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            style={styles.dateInput}
            value={startDate}
            onChange={e => handleStartDateChange(e.target.value)}
          />
          <span style={{ color: C.textMuted, fontSize: T.size.sm }}>—</span>
          <input
            type="date"
            style={styles.dateInput}
            value={endDate}
            onChange={e => handleEndDateChange(e.target.value)}
          />
          <button style={styles.navBtn} onClick={() => shiftDates(7)} title="Вперёд на неделю">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={styles.calendarWrapper}>
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: `${LABEL_WIDTH}px repeat(${days.length}, ${CELL_WIDTH}px)`,
            minWidth: `${LABEL_WIDTH + days.length * CELL_WIDTH}px`
          }}
        >
          <div style={styles.cornerCell}>Ячейка</div>
          
          {days.map((date, idx) => {
            const weekend = isWeekend(date);
            return (
              <div 
                key={idx} 
                style={{
                  ...styles.dayHeader,
                  ...(weekend ? styles.dayHeaderWeekend : {})
                }}
              >
                <div>{getDayName(date)}</div>
                <div>{formatDate(date)}</div>
              </div>
            );
          })}

          {Array.from({ length: cassetteCount }, (_, cassetteIdx) => (
            <React.Fragment key={cassetteIdx}>
              <div style={styles.cassetteLabel}>
                Ячейка {cassetteIdx + 1}
              </div>
              {days.map((date, dayIdx) => {
                const dateStr = date.toISOString().split('T')[0];
                const bookingInfo = occupancyMatrix[dateStr]?.[cassetteIdx] || null;
                const isBusy = bookingInfo !== null;
                const weekend = isWeekend(date);
                
                let cellStyle = styles.cellFree;
                if (isBusy) cellStyle = styles.cellBusy;
                else if (weekend) cellStyle = styles.cellWeekend;
                
                return (
                  <div
                    key={dayIdx}
                    style={{ ...styles.cell, ...cellStyle }}
                    onMouseEnter={(e) => handleCellHover(e, bookingInfo)}
                    onMouseLeave={handleCellLeave}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {tooltip.visible && tooltip.content && (
        <div 
          style={{
            ...styles.tooltip,
            left: tooltip.x,
            top: tooltip.y
          }}
        >
          <div style={styles.tooltipTitle}>{tooltip.content.sample_cipher}</div>
          <div style={styles.tooltipRow}>
            <span style={styles.tooltipLabel}>ФИО:</span>
            <span style={styles.tooltipValue}>{tooltip.content.full_name}</span>
          </div>
          <div style={styles.tooltipRow}>
            <span style={styles.tooltipLabel}>Начало:</span>
            <span style={styles.tooltipValue}>{formatDateTime(tooltip.content.start_time)}</span>
          </div>
          <div style={styles.tooltipRow}>
            <span style={styles.tooltipLabel}>Окончание:</span>
            <span style={styles.tooltipValue}>{formatDateTime(tooltip.content.end_time)}</span>
          </div>
        </div>
      )}

      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendBox, background: '#f0fdf4' }} />
          <span>Свободно</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendBox, background: '#fee2e2' }} />
          <span>Занято</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendBox, background: '#f8fafc' }} />
          <span>Выходной</span>
        </div>
      </div>

      <div style={styles.info}>
        Наведите на занятую ячейку для просмотра деталей бронирования
      </div>
    </div>
  );
}