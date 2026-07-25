import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

// Non-standard Chromium API — not in TS's built-in DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const canShow = !installed && !dismissed && (deferredPrompt !== null || isIOSSafari());
  if (!canShow) return null;

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    setShowIOSHint(true);
  }

  return (
    <>
      <div className="install-banner">
        <span className="icon-inline">
          <Download size={16} aria-hidden="true" />
          Install this app for quick, offline access
        </span>
        <div className="install-banner-actions">
          <button type="button" className="btn btn-primary install-btn" onClick={handleInstallClick}>
            Install
          </button>
          <button
            type="button"
            className="icon-btn install-dismiss"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {showIOSHint && (
        <>
          <div className="detail-backdrop" onClick={() => setShowIOSHint(false)} />
          <div className="detail-panel">
            <div className="detail-header">
              <h3 className="icon-inline">
                <Share size={18} aria-hidden="true" /> Install on iPhone/iPad
              </h3>
              <button type="button" className="icon-btn" onClick={() => setShowIOSHint(false)} aria-label="Close">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <ol className="ios-install-steps">
              <li>
                Tap the <strong>Share</strong> button in Safari's toolbar
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>
              </li>
              <li>
                Tap <strong>Add</strong> in the top right
              </li>
            </ol>
          </div>
        </>
      )}
    </>
  );
}
