import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { ToastStack } from './UI.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export default function Layout({ children, onSearch }) {
  const { toasts } = useSocket();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-base-950 bg-grid-glow bg-fixed">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onSearch={onSearch} onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
      <ToastStack toasts={toasts} />
    </div>
  );
}
