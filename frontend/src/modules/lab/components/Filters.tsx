import React, { useState, useEffect } from 'react';
import { api, type FilterOptions, type ChamberFilters } from '../../../api/climate/api';
import { Filter, X, Calendar, Thermometer, Zap, BookOpen } from 'lucide-react';
import { C, S, T } from '../../../theme';

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: C.surface,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    padding: S.xl,
    marginBottom: S.xl,
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.lg,
    paddingBottom: S.md,
    borderBottom: `1px solid ${C.border}`
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: S.sm,
    fontSize: T.size.lg,
    fontWeight: T.weight.bold,
    color: C.text,
    margin: 0
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: S.xs,
    padding: `${S.sm} ${S.md}`,
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.textMuted,
    fontSize: T.size.sm,
    fontWeight: T.weight.medium,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: S.lg
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: S.sm
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: S.xs,
    fontSize: T.size.sm,
    fontWeight: T.weight.medium,
    color: C.textMuted,
    marginBottom: S.xs
  },
  input: {
    width: '100%',
    padding: `${S.sm} ${S.md}`,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: T.size.base,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    fontFamily: T.font
  },
  rangeInputs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: S.sm
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: S.xs,
    maxHeight: 150,
    overflowY: 'auto',
    padding: S.sm,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    backgroundColor: '#fafafa'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: S.sm,
    cursor: 'pointer',
    fontSize: T.size.sm,
    color: C.text,
    padding: `${S.xs} 0`
  },
  checkboxInput: {
    cursor: 'pointer',
    width: 16,
    height: 16
  }
};

interface ChamberFiltersProps {
  onFiltersChange: (filters: ChamberFilters) => void;
}

export function ChamberFilters({ onFiltersChange }: ChamberFiltersProps) {
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [filters, setFilters] = useState<ChamberFilters>({});

  useEffect(() => {
    api.getFilterOptions().then(setFilterOptions).catch(console.error);
  }, []);

  const handleReset = () => {
    setFilters({});
    onFiltersChange({});
  };

  const updateFilter = (key: keyof ChamberFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleCheckboxChange = (key: 'methodologies' | 'lamp_types', value: string, checked: boolean) => {
    const current = filters[key] || [];
    const newValue = checked ? [...current, value] : current.filter(v => v !== value);
    updateFilter(key, newValue.length > 0 ? newValue : undefined);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <Filter size={20} />
          Фильтры поиска камер
        </h3>
        <button style={styles.resetBtn} onClick={handleReset}>
          <X size={16} />
          Сбросить
        </button>
      </div>

      <div style={styles.grid}>
        {/* Фильтр по датам */}
        <div style={styles.filterGroup}>
          <div style={styles.label}>
            <Calendar size={16} />
            Интервал дат
          </div>
          <div style={styles.rangeInputs}>
            <input
              type="date"
              style={styles.input}
              value={filters.available_from || ''}
              onChange={e => updateFilter('available_from', e.target.value || undefined)}
            />
            <input
              type="date"
              style={styles.input}
              value={filters.available_to || ''}
              onChange={e => updateFilter('available_to', e.target.value || undefined)}
            />
          </div>
        </div>

        {/* Фильтр по температуре конденсации */}
        <div style={styles.filterGroup}>
          <div style={styles.label}>
            <Thermometer size={16} />
            Темп. конденсации (°C)
          </div>
          <div style={styles.rangeInputs}>
            <input
              type="number"
              placeholder="Мин"
              style={styles.input}
              value={filters.condensation_temp_min || ''}
              onChange={e => updateFilter('condensation_temp_min', e.target.value ? Number(e.target.value) : undefined)}
            />
            <input
              type="number"
              placeholder="Макс"
              style={styles.input}
              value={filters.condensation_temp_max || ''}
              onChange={e => updateFilter('condensation_temp_max', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Фильтр по температуре облучения */}
        <div style={styles.filterGroup}>
          <div style={styles.label}>
            <Thermometer size={16} />
            Темп. облучения (°C)
          </div>
          <div style={styles.rangeInputs}>
            <input
              type="number"
              placeholder="Мин"
              style={styles.input}
              value={filters.irradiation_temp_min || ''}
              onChange={e => updateFilter('irradiation_temp_min', e.target.value ? Number(e.target.value) : undefined)}
            />
            <input
              type="number"
              placeholder="Макс"
              style={styles.input}
              value={filters.irradiation_temp_max || ''}
              onChange={e => updateFilter('irradiation_temp_max', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Фильтр по интенсивности */}
        <div style={styles.filterGroup}>
          <div style={styles.label}>
            <Zap size={16} />
            Интенсивность (W/m²)
          </div>
          <div style={styles.rangeInputs}>
            <input
              type="number"
              step="0.01"
              placeholder="Мин"
              style={styles.input}
              value={filters.intensity_min || ''}
              onChange={e => updateFilter('intensity_min', e.target.value ? Number(e.target.value) : undefined)}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Макс"
              style={styles.input}
              value={filters.intensity_max || ''}
              onChange={e => updateFilter('intensity_max', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Фильтр по методикам */}
        {filterOptions && filterOptions.methodologies.length > 0 && (
          <div style={styles.filterGroup}>
            <div style={styles.label}>
              <BookOpen size={16} />
              Методики
            </div>
            <div style={styles.checkboxGroup}>
              {filterOptions.methodologies.map(method => (
                <label key={method} style={styles.checkbox}>
                  <input
                    type="checkbox"
                    style={styles.checkboxInput}
                    checked={(filters.methodologies || []).includes(method)}
                    onChange={e => handleCheckboxChange('methodologies', method, e.target.checked)}
                  />
                  <span>{method}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Фильтр по типам ламп */}
        {filterOptions && filterOptions.lamp_types.length > 0 && (
          <div style={styles.filterGroup}>
            <div style={styles.label}>
              <Zap size={16} />
              Типы ламп
            </div>
            <div style={styles.checkboxGroup}>
              {filterOptions.lamp_types.map(lamp => (
                <label key={lamp} style={styles.checkbox}>
                  <input
                    type="checkbox"
                    style={styles.checkboxInput}
                    checked={(filters.lamp_types || []).includes(lamp)}
                    onChange={e => handleCheckboxChange('lamp_types', lamp, e.target.checked)}
                  />
                  <span>{lamp}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}