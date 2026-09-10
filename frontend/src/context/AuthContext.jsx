// VistaraX - Auth context: holds the signed-in user & token, exposes
// login/logout, and is the single source of truth ProtectedRoute checks.
import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('vistarax_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('vistarax_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const { data } = await client.get('/auth/me');
          setUser(data.user);
          localStorage.setItem('vistarax_user', JSON.stringify(data.user));
        } catch {
          setUser(null);
          setToken(null);
          localStorage.removeItem('vistarax_token');
          localStorage.removeItem('vistarax_user');
        }
      }
      setLoading(false);
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(username, password) {
    const { data } = await client.post('/auth/login', { username, password });
    localStorage.setItem('vistarax_token', data.token);
    localStorage.setItem('vistarax_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await client.post('/auth/logout');
    } catch { /* ignore */ }
    localStorage.removeItem('vistarax_token');
    localStorage.removeItem('vistarax_user');
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
