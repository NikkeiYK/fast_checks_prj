import React, { useState } from 'react';
import { Building2, FlaskConical, CalendarCheck, CalendarDays, ArrowRight } from 'lucide-react';
import type { Center } from '../../../api/climate/api';
import { C, S, T } from '../../../theme';

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: C.surface,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer'
  },
  cardHover: {
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)',
    borderColor: C.primary
  },
  header: {
    padding: S.xl,
    borderBottom: `1px solid ${C.border}`,
    background: `linear-gradient(135deg, #f8fafc 0%, ${C.surface} 100%)`,
    display: 'flex',
    alignItems: 'flex-start',
    gap: S.lg
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    color: C.primary,
    flexShrink: 0
  },
  titleContainer: {
    flex: 1
  },
  title: {
    margin: 0,
    fontSize: T.size.lg,
    fontWeight: T.weight.bold,
    color: C.text,
    letterSpacing: '-0.02em',
    lineHeight: 1.3
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: T.size.sm,
    color: C.textLight,
    fontWeight: T.weight.medium
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: S.lg,
    padding: S.xl,
    flexGrow: 1
  },
  statBase: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: S.lg,
    borderRadius: 12,
    border: '1px solid transparent',
    transition: 'transform 0.2s ease'
  },
  statLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: S.sm,
    marginBottom: S.sm,
    fontSize: T.size.xs,
    fontWeight: T.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  statValue: {
    fontSize: T.size.xl,
    fontWeight: T.weight.bold,
    color: C.text
  },
  btnContainer: {
    display: 'grid',
    placeItems: 'center'
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    width: '100%',
    height: '100%',
    minHeight: 48,
    background: C.primarySoft,
    border: 'none',
    color: C.primary,
    fontWeight: T.weight.bold,
    cursor: 'pointer',
    fontSize: T.size.base,
    borderRadius: 12,
    transition: 'all 0.2s ease',
    padding: `${S.sm} ${S.md}`
  },
  btnHover: {
    background: C.primary,
    color: '#fff'
  }
};

interface CenterStats {
  totalChambers: number;
  totalCassettes: number;
  activeBookings: number;
  totalBookings: number;
}

export function CenterCard({ center, stats }: { center: Center; stats: CenterStats }) {
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <div
      style={hovered ? styles.cardHover : styles.card}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setBtnHovered(false);
      }}
    >
      <div style={styles.header}>
        <div style={styles.iconBox}>
          <Building2 size={22} />
        </div>
        <div style={styles.titleContainer}>
          <h3 style={styles.title}>{center.name}</h3>
          <p style={styles.subtitle}>Научный центр #{center.id}</p>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={{ ...styles.statBase, background: '#ecfdf5' }}>
          <div style={{ ...styles.statLabel, color: '#059669' }}>
            <FlaskConical size={16} />
            Камер / Ячеек
          </div>
          <div style={styles.statValue}>
            {stats.totalChambers} / {stats.totalCassettes}
          </div>
        </div>

        <div style={{ ...styles.statBase, background: '#eff6ff' }}>
          <div style={{ ...styles.statLabel, color: C.primary }}>
            <CalendarCheck size={16} />
            Активных
          </div>
          <div style={styles.statValue}>{stats.activeBookings}</div>
        </div>

        <div style={{ ...styles.statBase, background: '#f8fafc' }}>
          <div style={{ ...styles.statLabel, color: C.textMuted }}>
            <CalendarDays size={16} />
            Всего
          </div>
          <div style={styles.statValue}>{stats.totalBookings}</div>
        </div>

        <div style={styles.btnContainer}>
          <button
            style={btnHovered ? { ...styles.btn, ...styles.btnHover } : styles.btn}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
          >
            Подробнее
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}