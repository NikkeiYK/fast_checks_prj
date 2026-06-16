import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Center, type Booking } from '../../api/climate/api'; // ✅ Убран ChamberWithAvailability
import { ChamberCalendar } from './components/ChamberCalendar';
import { BookingList } from './components/BookingList';
import { ArrowLeft, Calendar, CheckCircle2 } from 'lucide-react'; // ✅ Убран FlaskConical
import { C, S, T } from '../../theme';
import { BookingForm } from './components/BookingForm';

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: S['3xl'],
    background: C.bg,
    fontFamily: T.font,
    color: C.text
  },
  container: { maxWidth: 1200, margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: S.lg,
    marginBottom: S['2xl']
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: S.sm,
    padding: `${S.sm} ${S.md}`,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: T.size.base,
    color: C.text,
    transition: 'all 0.2s'
  },
  title: {
    margin: 0,
    fontSize: T.size['2xl'],
    fontWeight: T.weight.bold,
    color: C.text
  },
  tabs: {
    display: 'flex',
    gap: S.sm,
    marginBottom: S.xl,
    borderBottom: `1px solid ${C.border}`,
    position: 'relative' as const
  },
  tab: {
    padding: `${S.md} ${S.lg}`,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: T.size.base,
    fontWeight: T.weight.medium,
    color: C.textMuted,
    transition: 'color 0.2s',
    position: 'relative' as const
  },
  tabActive: {
    color: C.primary,
    fontWeight: T.weight.bold
  },
  tabIndicator: {
    position: 'absolute' as const,
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    background: C.primary,
    borderRadius: '2px 2px 0 0'
  },
  chamberCard: {
    background: C.surface,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    padding: S.xl,
    marginBottom: S.xl
  },
  chamberHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: S.lg
  },
  chamberTitle: {
    margin: 0,
    fontSize: T.size.xl,
    fontWeight: T.weight.bold,
    color: C.text
  },
  chamberDescription: {
    margin: `${S.sm} 0`,
    color: C.textMuted,
    fontSize: T.size.sm
  },
  stats: {
    display: 'flex',
    gap: S.xl,
    marginTop: S.md
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: S.sm
  },
  statIcon: {
    width: 20,
    height: 20,
    color: C.primary
  },
  statValue: {
    fontWeight: T.weight.bold,
    color: C.text
  },
  statLabel: {
    fontSize: T.size.sm,
    color: C.textMuted
  },
  specs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: S.lg,
    marginTop: S.lg,
    padding: S.lg,
    background: '#f8fafc',
    borderRadius: 12
  },
  specItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: S.xs
  },
  specLabel: {
    fontSize: T.size.xs,
    color: C.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  specValue: {
    fontSize: T.size.base,
    fontWeight: T.weight.medium,
    color: C.text
  },
  loader: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh'
  },
  error: {
    background: '#fef2f2',
    border: `1px solid #fecaca`,
    color: '#991b1b',
    padding: S.lg,
    borderRadius: 12,
    textAlign: 'center' as const
  }
};

type TabType = 'overview' | 'bookings' | 'history';

export default function CenterDetailPage() {
  const { centerId } = useParams<{ centerId: string }>();
  const navigate = useNavigate();
  const [center, setCenter] = useState<Center | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedChamberId, setSelectedChamberId] = useState<number | null>(null);

  const handleOpenBookingForm = (chamberId: number) => {
  setSelectedChamberId(chamberId);
  setShowBookingForm(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!centerId) return;
      
      try {
        setLoading(true);
        const [centerData, bookingsData] = await Promise.all([
          api.getCenterById(Number(centerId)),
          api.getBookings({ center_id: Number(centerId), status: 'all' })
        ]);
        setCenter(centerData);
        setBookings(bookingsData);
      } catch (err) {
        setError('Не удалось загрузить данные центра');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [centerId]);

  const getChamberAvailability = (chamberId: number) => {
    const chamber = center?.chambers.find(c => c.id === chamberId);
    if (!chamber || !chamber.cassette_count) return { available: 0, total: 0, activeBookings: 0 };
    
    const activeBookings = bookings.filter(
      b => b.chamber_id === chamberId && b.status === 'active'
    );
    
    const bookedCassettes = new Set(activeBookings.map(b => b.cassette_number));
    const available = chamber.cassette_count - bookedCassettes.size;
    
    return {
      available,
      total: chamber.cassette_count,
      activeBookings: activeBookings.length
    };
  };

  const handleBack = () => {
    navigate('/lab/booking'); // ✅ Исправлен путь назад
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loader}>Загрузка...</div>
      </div>
    );
  }

  if (error || !center) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.error}>{error || 'Центр не найден'}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={handleBack}>
            <ArrowLeft size={20} />
            Назад к списку
          </button>
          <h1 style={styles.title}>{center.name}</h1>
        </div>

        <div style={styles.tabs}>
  <button
    style={{
      ...styles.tab,
      ...(activeTab === 'overview' ? styles.tabActive : {})
    }}
    onClick={() => setActiveTab('overview')}
  >
    Обзор камер
    {activeTab === 'overview' && <div style={styles.tabIndicator} />}
  </button>
  <button
    style={{
      ...styles.tab,
      ...(activeTab === 'bookings' ? styles.tabActive : {})
    }}
    onClick={() => setActiveTab('bookings')}
  >
    Все бронирования
    {activeTab === 'bookings' && <div style={styles.tabIndicator} />}
  </button>
  <button
    style={{
      ...styles.tab,
      ...(activeTab === 'history' ? styles.tabActive : {})
    }}
    onClick={() => setActiveTab('history')}
  >
    История отмен
    {activeTab === 'history' && <div style={styles.tabIndicator} />}
  </button>
</div>

        {activeTab === 'overview' && (
          <div>
            {center.chambers.map(chamber => {
              const { available, total, activeBookings } = getChamberAvailability(chamber.id);
              
              return (
                <div key={chamber.id} style={styles.chamberCard}>
                  <div style={styles.chamberHeader}>
    <div>
      <h2 style={styles.chamberTitle}>{chamber.name}</h2>
      {chamber.description && (
        <p style={styles.chamberDescription}>{chamber.description}</p>
      )}
    </div>
    <button
      style={{
        padding: `${S.sm} ${S.lg}`,
        background: C.primary,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: T.size.base,
        fontWeight: T.weight.medium
      }}
      onClick={() => handleOpenBookingForm(chamber.id)}
    >
      Забронировать
    </button>
  </div>

                  <div style={styles.stats}>
                    <div style={styles.stat}>
                      <CheckCircle2 style={styles.statIcon} />
                      <div>
                        <div style={styles.statValue}>{available}/{total}</div>
                        <div style={styles.statLabel}>Свободных ячеек</div>
                      </div>
                    </div>
                    <div style={styles.stat}>
                      <Calendar style={styles.statIcon} />
                      <div>
                        <div style={styles.statValue}>{activeBookings}</div>
                        <div style={styles.statLabel}>Активных броней</div>
                      </div>
                    </div>
                  </div>

                  {chamber.methodologies && chamber.methodologies.length > 0 && (
                    <div style={styles.specs}>
                      <div style={styles.specItem}>
                        <div style={styles.specLabel}>Методики</div>
                        <div style={styles.specValue}>{chamber.methodologies.join(', ')}</div>
                      </div>
                      {chamber.lamps && chamber.lamps.length > 0 && (
                        <div style={styles.specItem}>
                          <div style={styles.specLabel}>Лампы</div>
                          <div style={styles.specValue}>
                            {chamber.lamps.map(l => `${l.name} (${l.intensity_min}-${l.intensity_max} ${l.unit})`).join(', ')}
                          </div>
                        </div>
                      )}
                      {(chamber.condensation_temp_min !== null || chamber.condensation_temp_max !== null) && (
                        <div style={styles.specItem}>
                          <div style={styles.specLabel}>Температура конденсации</div>
                          <div style={styles.specValue}>
                            {chamber.condensation_temp_min}°C — {chamber.condensation_temp_max}°C
                          </div>
                        </div>
                      )}
                      {(chamber.irradiation_temp_min !== null || chamber.irradiation_temp_max !== null) && (
                        <div style={styles.specItem}>
                          <div style={styles.specLabel}>Температура облучения</div>
                          <div style={styles.specValue}>
                            {chamber.irradiation_temp_min}°C — {chamber.irradiation_temp_max}°C
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: S.xl }}>
                    <ChamberCalendar
                      chamberId={chamber.id}
                      bookings={bookings}
                      cassetteCount={chamber.cassette_count || 0}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'bookings' && (
          <BookingList
            bookings={bookings.filter(b => b.status === 'active')}
            onBookingDeleted={() => {
              api.getBookings({ center_id: Number(centerId), status: 'all' })
                .then(setBookings);
            }}
          />
        )}

        {activeTab === 'history' && (
          <BookingList
            bookings={bookings.filter(b => b.status === 'cancelled')}
            onBookingDeleted={() => {}}
          />
        )}
      </div>
      {showBookingForm && selectedChamberId && (
  <BookingForm
    chamberId={selectedChamberId}
    centerId={Number(centerId)}
    onClose={() => setShowBookingForm(false)}
    onSuccess={() => {
      // Перезагружаем данные после успешного бронирования
      api.getBookings({ center_id: Number(centerId), status: 'all' })
        .then(setBookings);
    }}
  />
)}
    </div>
  );
}