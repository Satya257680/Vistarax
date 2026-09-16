// VistaraX - PWA install-state hook. Thin React wrapper around the
// module-level singleton in ../pwaInstallStore.js, which is what actually
// listens for `beforeinstallprompt` (see that file for why it has to be
// captured outside of any component's lifecycle). There's no fake
// "uninstall" here either - browsers don't expose a JS API to uninstall a
// PWA, so instead of faking a button we just detect when the app is
// already running standalone (i.e. installed) and confirm that.
import { useEffect, useState, useCallback } from 'react';
import { getSnapshot, subscribe, triggerInstall } from '../pwaInstallStore.js';

export default function usePwaInstall() {
  const [state, setState] = useState(getSnapshot);

  useEffect(() => subscribe(() => setState(getSnapshot())), []);

  const promptInstall = useCallback(() => triggerInstall(), []);

  return {
    canInstall: state.canInstall,
    installed: state.installed,
    promptInstall,
  };
}
