// VistaraX - PWA install-state hook. Wraps the real `beforeinstallprompt`
// browser API - there's no fake "uninstall" here: browsers don't expose a
// JS API to uninstall an installed PWA, so instead of faking a button we
// detect when the app is already running standalone (i.e. installed) and
// show honest instructions for removing it from the OS/browser instead.
import { useEffect, useState, useCallback } from 'react';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true // iOS Safari
  );
}

export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setSupported(true);
    }
    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    const mq = window.matchMedia?.('(display-mode: standalone)');
    function onDisplayModeChange(e) {
      setInstalled(e.matches);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    mq?.addEventListener?.('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      mq?.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') setInstalled(true);
    return outcome; // 'accepted' | 'dismissed'
  }, [deferredPrompt]);

  return {
    canInstall: supported && !!deferredPrompt && !installed,
    installed,
    promptInstall,
  };
}
