import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Visitors from './pages/Visitors.jsx';
import CurrentlyInside from './pages/CurrentlyInside.jsx';
import Reports from './pages/Reports.jsx';
import Notifications from './pages/Notifications.jsx';
import Users from './pages/Users.jsx';
import RolesPermissions from './pages/RolesPermissions.jsx';
import Settings from './pages/Settings.jsx';
import Print from './pages/Print.jsx';

export default function App() {
  // Every fresh load (a hard refresh, or the very first visit) shows the
  // boot splash before anything else renders - only then does the router
  // resolve to Landing / Login / Dashboard, etc. per the URL.
  const [booting, setBooting] = useState(true);

  if (booting) {
    return <SplashScreen onComplete={() => setBooting(false)} />;
  }

  return (
    <SocketProvider>
      <Routes>
        {/* Public: a link into the app always lands on the landing page
            first, then Sign In, then the dashboard - never straight into
            a protected screen. */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/print" element={<ProtectedRoute><Print /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/visitors" element={<ProtectedRoute><Visitors /></ProtectedRoute>} />
        <Route path="/currently-inside" element={<ProtectedRoute><CurrentlyInside /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute adminOnly><RolesPermissions /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SocketProvider>
  );
}
