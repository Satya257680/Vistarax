// VistaraX - PWA install singleton store.
//
// Why this file exists: `beforeinstallprompt` fires exactly once per page
// load, very early (as soon as Chrome/Edge decides the page is
// installable), and if nothing is listening at that exact moment the
// event is gone for good - the browser does not re-dispatch it. Our old
// approach attached the listener inside a React hook's `useEffect` on the
// Login page, which only runs once the Login component actually *mounts*.
// Since the app now shows a ~2.4s boot splash before anything else
// renders (see components/SplashScreen.jsx + App.jsx), and a visitor may
// browse the Landing page for a while before ever reaching /login, the
// event was very often fired and lost long before Login's effect ever
// attached a listener - so the Install button could never trigger the
// browser's real, one-click native install prompt and always fell back
// to the "open your browser menu" instructions instead.
//
// The fix: capture the event here, at module scope, so it registers the
// instant this file is first imported - which happens while the JS
// module graph is being evaluated (main.jsx -> App.jsx -> Login.jsx ->
// this store), well before React mounts anything or the splash timer
// starts. Every component just reads from this single shared store
// instead of racing to attach its own listener.
const listeners = new Set();

const state = {
  deferredPrompt: null,
  installed: isStandalone(),
};

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true // iOS Safari
  );
}

function notify() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    state.installed = true;
    state.deferredPrompt = null;
    notify();
  });

  const mq = window.matchMedia?.('(display-mode: standalone)');
  mq?.addEventListener?.('change', (e) => {
    state.installed = e.matches;
    notify();
  });
}

export function getSnapshot() {
  return {
    canInstall: !!state.deferredPrompt && !state.installed,
    installed: state.installed,
  };
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Triggers the real, native, one-click browser install prompt captured
// earlier. This is the direct install path - no "open your browser menu"
// instructions involved - and is only possible when the browser actually
// supports and has fired beforeinstallprompt (Chrome/Edge/Android and
// similar Chromium browsers; Safari/Firefox don't expose this API at all,
// which is a platform limitation no website can work around).
export async function triggerInstall() {
  const prompt = state.deferredPrompt;
  if (!prompt) return 'unavailable';
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  state.deferredPrompt = null;
  if (outcome === 'accepted') state.installed = true;
  notify();
  return outcome; // 'accepted' | 'dismissed'
}
