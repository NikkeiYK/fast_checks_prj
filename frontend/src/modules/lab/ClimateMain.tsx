import React, { useState, useEffect } from 'react';
import { api, type Center, type Booking, type Chamber, type ChamberFilters } from '../../api/climate/api';
import { CenterCard } from './components/CenterCard';
import { ChamberFilters as FiltersComponent } from './components/Filters';
import { Loader2, AlertCircle } from 'lucide-react';
import { C, S, T } from '../../theme';
import { useNavigate } from 'react-router-dom';

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: S["3xl"],
    background: C.bg,
    fontFamily: T.font,
    color: C.text
  },
  container: { maxWidth: 1200, margin: "0 auto" },
  header: { marginBottom: S["2xl"] },
  title: { margin: 0, fontSize: T.size["2xl"], fontWeight: T.weight.bold, letterSpacing: "-0.03em" },
  subtitle: { margin: `${S.sm} 0 0`, color: C.textMuted, fontSize: T.size.md, maxWidth: 640, lineHeight: 1.55 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: S.xl },
  empty: {
    textAlign: "center",
    padding: S["3xl"],
    background: C.surface,
    borderRadius: 16,
    border: `1px dashed ${C.border}`
  },
  loader: { display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" },
  error: {
    background: "#fef2f2",
    border: `1px solid #fecaca`,
    color: "#991b1b",
    padding: S.lg,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: S.md
  },
  resultsCount: {
    fontSize: T.size.sm,
    color: C.textMuted,
    marginBottom: S.lg
  }
};

export default function HomePage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredChambers, setFilteredChambers] = useState<Chamber[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [centersData, bookingsData] = await Promise.all([
          api.getCenters(),
          api.getBookings({ status: 'all' })  // ✅ ИСПРАВЛЕНО: передаём объект
        ]);
        setCenters(centersData);
        setBookings(bookingsData);
      } catch (err) {
        setError('Не удалось загрузить данные. Проверьте, запущен ли бэкенд.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFiltersChange = async (filters: ChamberFilters) => {
    if (Object.keys(filters).length === 0) {
      setFilteredChambers(null);
      return;
    }

    try {
      const chambers = await api.filterChambers(filters);
      setFilteredChambers(chambers);
    } catch (err) {
      console.error('Ошибка фильтрации:', err);
    }
  };

  const getStatsForCenter = (center: Center) => {
    const totalChambers = center.chambers.length;
    const totalCassettes = center.chambers.reduce((sum, c) => sum + (c.cassette_count || 0), 0);
    const centerBookings = bookings.filter(b => b.center_id === center.id);
    return {
      totalChambers,
      totalCassettes,
      activeBookings: centerBookings.filter(b => b.status === 'active').length,
      totalBookings: centerBookings.length
    };
  };

  const getFilteredCenters = (): Center[] => {
    if (!filteredChambers) return centers;

    const centerMap = new Map<number, Center>();
    
    filteredChambers.forEach(chamber => {
      if (!centerMap.has(chamber.center_id)) {
        const originalCenter = centers.find(c => c.id === chamber.center_id);
        if (originalCenter) {
          centerMap.set(chamber.center_id, {
            ...originalCenter,
            chambers: []
          });
        }
      }
      centerMap.get(chamber.center_id)?.chambers.push(chamber);
    });

    return Array.from(centerMap.values());
  };

  if (loading) return <div style={styles.loader}><Loader2 size={32} className="text-blue-600 animate-spin" /></div>;
  if (error) return (
    <div style={{ ...styles.page, display: "grid", placeItems: "center" }}>
      <div style={styles.error}><AlertCircle size={20} /> {error}</div>
    </div>
  );

  const displayCenters = getFilteredCenters();

  const handleCenterClick = (centerId: number) => {
    navigate(`/lab/booking/centers/${centerId}`);  // ✅ ИСПРАВЛЕНО: правильный путь
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Научные центры</h1>
          <p style={styles.subtitle}>Выберите центр для просмотра доступных климатических камер и управления бронированиями.</p>
        </header>

        <FiltersComponent onFiltersChange={handleFiltersChange} />

        {filteredChambers && (
          <div style={styles.resultsCount}>
            Найдено камер: {filteredChambers.length}
          </div>
        )}

        {displayCenters.length === 0 ? (
          <div style={styles.empty}>
            {filteredChambers ? 'Камеры по заданным фильтрам не найдены.' : 'Центры пока не добавлены в систему.'}
          </div>
        ) : (
          <div style={styles.grid}>  {/* ✅ ИСПРАВЛЕНО: добавлен grid-контейнер */}
            {displayCenters.map(center => (
              <div 
                key={center.id} 
                onClick={() => handleCenterClick(center.id)}
                style={{ cursor: 'pointer' }}
              >
                <CenterCard center={center} stats={getStatsForCenter(center)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}