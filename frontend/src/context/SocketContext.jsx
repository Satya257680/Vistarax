// VistaraX - Socket.IO context for real-time visitor & notification events
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!token || !user) return undefined;

    const socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    function pushToast(kind, title, message) {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, title, message }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }

    socket.on('visitor:checkin', (v) => pushToast('checkin', 'New visitor checked in', `${v.name} is here to see ${v.whom_to_visit}.`));
    socket.on('visitor:checkout', (v) => pushToast('checkout', 'Visitor checked out', `${v.name} has checked out.`));

    return () => socket.disconnect();
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, toasts, setToasts }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
