import React from "react";

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface CountryFilterProps {
  countries: Country[];
  selectedCountry: string;
  onChange: (country: string) => void;
}

export const CountryFilter: React.FC<CountryFilterProps> = ({
  countries,
  selectedCountry,
  onChange,
}) => {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <h6 style={{ margin: "0 0 12px 0", color: "#555", fontSize: "0.95rem" }}>
        🌍 Страна
      </h6>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onChange("all")}
          style={{
            padding: "8px 16px",
            background: selectedCountry === "all" ? "#008B92" : "#f5f5f5",
            color: selectedCountry === "all" ? "#fff" : "#555",
            border: `2px solid ${selectedCountry === "all" ? "#008B92" : "#ddd"}`,
            borderRadius: 20,
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: selectedCountry === "all" ? 600 : 400,
            transition: "all 0.2s",
          }}
        >
          🌐 Все страны
        </button>
        
        {countries.map((country) => {
          const isSelected = selectedCountry === country.code;
          return (
            <button
              key={country.code}
              onClick={() => onChange(country.code)}
              style={{
                padding: "8px 16px",
                background: isSelected ? "#008B92" : "#f5f5f5",
                color: isSelected ? "#fff" : "#555",
                border: `2px solid ${isSelected ? "#008B92" : "#ddd"}`,
                borderRadius: 20,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: isSelected ? 600 : 400,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "#008B92";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "#ddd";
                }
              }}
            >
              {country.flag} {country.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};