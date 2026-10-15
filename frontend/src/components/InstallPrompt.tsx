import { useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";

const DISMISS_KEY = "pn_install_dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Dismissible "install / add to home screen" reminder. Works on both platforms:
 *  • Android/Chromium — uses the captured `beforeinstallprompt` event to fire the
 *    native install dialog.
 *  • iOS Safari — that event never fires, so we show the manual "Share → Add to
 *    Home Screen" steps instead (the only way to install a PWA on iOS).
 * Hidden once installed (standalone) or after the user dismisses it (remembered
 * in localStorage). Phone-focused: it stays out of the way on desktop.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // iOS can't use beforeinstallprompt — offer the manual steps right away.
    if (isIos()) {
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => dismiss();
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setShowIosSteps(false);
  };

  const handleInstall = async () => {
    if (isIos()) {
      setShowIosSteps((s) => !s);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {}
    setDeferredPrompt(null);
    dismiss();
  };

  if (!visible) return null;

  return (
    // Sits above the phone tab bar in AppLayout.
    <div className="fixed bottom-16 inset-x-0 z-50 p-3 lg:hidden pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
            <Download size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Add PitchNest to your phone
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Install the app for a faster, full-screen experience.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {showIosSteps ? (
          <div className="mt-3 text-xs text-slate-600 dark:text-zinc-300 space-y-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
            <p className="flex items-center gap-2">
              <span className="font-bold">1.</span> Tap the Share icon
              <Share size={14} className="inline text-sky-500" /> in your browser
              bar.
            </p>
            <p className="flex items-center gap-2">
              <span className="font-bold">2.</span> Choose “Add to Home Screen”
              <Plus size={14} className="inline text-sky-500" />.
            </p>
            <p className="flex items-center gap-2">
              <span className="font-bold">3.</span> Tap “Add”. Done!
            </p>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {isIos() ? "How to install" : "Install app"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="px-4 py-2.5 text-slate-500 dark:text-zinc-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
