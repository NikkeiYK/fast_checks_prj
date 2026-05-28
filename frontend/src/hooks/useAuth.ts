import { useMemo, useState, useEffect } from "react";
import type { AuthState } from "../layouts/Auth";

//  Ключ для синхронизации между вкладками/компонентами
const AUTH_STORAGE_KEY = "polylab_auth";

export function useAuth() {
  //  Состояние-триггер для принудительного обновления при изменении localStorage
  const [sync, setSync] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY));

  //  Слушаем изменения localStorage (в том числе из других вкладок)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        setSync(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Читаем актуальное значение (с учётом sync-триггера)
  const authRaw = localStorage.getItem(AUTH_STORAGE_KEY);
  
  const auth: AuthState | null = useMemo(() => {
    try {
      return authRaw ? JSON.parse(authRaw) : null;
    } catch {
      return null;
    }
  }, [authRaw, sync]); //  Добавили sync в зависимости!

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    // 🔹 Принудительно обновляем все компоненты, использующие useAuth
    window.dispatchEvent(new StorageEvent("storage", { key: AUTH_STORAGE_KEY, newValue: null }));
    window.location.href = "/login";
  };

  return {
    isAuthenticated: !!auth?.loggedIn,
    user: auth?.user || null,
    permissions: auth?.permissions || [],
    
    isAdmin: auth?.user?.role === "admin",
    isAuditor: auth?.user?.role === "auditor",
    
    hasPermission: (perm: string) => (auth?.permissions || []).includes(perm),
    
    logout,
    
    // 🔹 Метод для принудительного обновления (можно вызвать после логина)
    refresh: () => setSync(localStorage.getItem(AUTH_STORAGE_KEY)),
  };
}