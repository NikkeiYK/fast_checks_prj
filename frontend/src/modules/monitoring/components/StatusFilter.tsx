import React from "react";

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "Вынесен на публичное обсуждение",
    label: "Публичное обсуждение",
    color: "#008B92",
  },
  {
    value: "Публичное обсуждение завершено",
    label: "Завершено",
    color: "#95a5a6",
  },
  {
    value: "Направлено уведомление о завершении публичного обсуждения",
    label: "Уведомление",
    color: "#01313D",
  },
];

interface StatusFilterProps {
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  selectedStatuses,
  onChange,
}) => {
  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onChange([...selectedStatuses, status]);
    }
  };

  const selectAll = () => {
    onChange(STATUS_OPTIONS.map((opt) => opt.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h6 style={{ margin: 0, color: "#555", fontSize: "0.95rem" }}>
          📋 Фильтр по статусам
        </h6>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={selectAll}
            style={{
              padding: "6px 12px",
              background: "#f0f0f0",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "#555",
            }}
          >
            Выбрать все
          </button>
          <button
            onClick={clearAll}
            style={{
              padding: "6px 12px",
              background: "#f0f0f0",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "#555",
            }}
          >
            Очистить
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {STATUS_OPTIONS.map((option) => {
          const isSelected = selectedStatuses.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggleStatus(option.value)}
              style={{
                padding: "8px 16px",
                background: isSelected ? option.color : "#f5f5f5",
                color: isSelected ? "#fff" : "#555",
                border: `2px solid ${isSelected ? option.color : "#ddd"}`,
                borderRadius: 20,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: isSelected ? 600 : 400,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = option.color;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "#ddd";
                }
              }}
            >
              {option.label}
              {isSelected && " ✓"}
            </button>
          );
        })}
      </div>
      {selectedStatuses.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "#f0f9fa",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#006b70",
          }}
        >
          Выбрано: <strong>{selectedStatuses.length}</strong> из{" "}
          {STATUS_OPTIONS.length}
        </div>
      )}
    </div>
  );
};