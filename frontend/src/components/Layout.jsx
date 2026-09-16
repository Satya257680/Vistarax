import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { ToastStack } from './UI.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export default function Layout({ children, onSearch }) {
  const { toasts } = useSocket();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    // The sidebar and the content pane each own their own scroll area (both
    // axes) instead of relying on the whole document to scroll - so a tall
    // page or a wide table always gets a visible scrollbar right where it
    // overflows, on every module, without every page having to remember to
    // add its own overflow classes.
    <div className="h-screen flex bg-base-950 bg-grid-glow bg-fixed overflow-hidden">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-auto">
        <Topbar onSearch={onSearch} onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
      <ToastStack toasts={toasts} />
    </div>
  );
}
