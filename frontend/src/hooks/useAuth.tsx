import { useState, useEffect, useCallback } from "react";

type User = {
  username: string;
  display_name: string;
  role: string;
};

type AuthState = {
  loggedIn: boolean;
  user: User | null;
};

const STORAGE_KEY = "polylab_auth";

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { loggedIn: false, user: null };
    } catch {
      return { loggedIn: false, user: null };
    }
  });

  const login = useCallback((user: User) => {
    const state = { loggedIn: true, user, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setAuth(state);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth({ loggedIn: false, user: null });
  }, []);

  // Проверка "свежести" сессии (опционально: раз в 24 часа)
  useEffect(() => {
    if (auth.loggedIn) {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        const age = Date.now() - (stored.timestamp || 0);
        if (age > 24 * 60 * 60 * 1000) {
          logout(); // сессия устарела
        }
      } catch {
        logout();
      }
    }
  }, [auth.loggedIn, logout]);

  return { ...auth, login, logout };
}