// VistaraX - Auth context: holds the signed-in user & token, exposes
// login/logout, and is the single source of truth ProtectedRoute checks.
//
// Session storage is "remember me" aware: a checked "Remember me" on the
// Login page persists the session in localStorage (survives closing the
// browser); unchecked, it lives in sessionStorage only (cleared when the
// tab closes). Whichever one has a token wins on load, and logging out
// clears both so a stale copy never lingers in the other.
import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'vistarax_token';
const USER_KEY = 'vistarax_user';

function readStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}
function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [token, setToken] = useState(() => readStoredToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const { data } = await client.get('/auth/me');
          setUser(data.user);
          // Refresh whichever storage already holds the session, without
          // upgrading a "remember me: off" session into a persisted one.
          const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
          store.setItem(USER_KEY, JSON.stringify(data.user));
        } catch {
          setUser(null);
          setToken(null);
          clearStorage();
        }
      }
      setLoading(false);
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(username, password, remember = true) {
    const { data } = await client.post('/auth/login', { username, password });
    clearStorage();
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, data.token);
    store.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await client.post('/auth/logout');
    } catch { /* ignore */ }
    clearStorage();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
