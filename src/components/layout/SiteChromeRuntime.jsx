'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { FaTelegramPlane } from 'react-icons/fa';

import AnalyticsBootstrap from '../analytics/AnalyticsBootstrap';
import { getUserInfo } from '../../lib/client/auth';
import {
  OPEN_WATCH_REQUEST_POPUP,
  PUSH_RECEIVED_EVENT,
  SW_RELOAD_ON_CONTROLLERCHANGE_FLAG,
  SW_UPDATE_AVAILABLE_EVENT,
} from '../../lib/events';

const AdsterraScripts = dynamic(() => import('../ads/AdsterraScripts'), {
  ssr: false,
});

const FloatingShareIcons = dynamic(
  () => import('../social/FloatingShareIcons'),
  { ssr: false }
);

const MovieRequestPopup = dynamic(() => import('../modals/MovieRequestPopup'), {
  ssr: false,
});

const ChannelPopup = dynamic(() => import('../modals/ChannelPopup'), {
  ssr: false,
});

const InstallPwaPopup = dynamic(() => import('../modals/InstallPwaPopup'), {
  ssr: false,
});

const UpdateAvailablePopup = dynamic(
  () => import('../modals/UpdateAvailablePopup'),
  { ssr: false }
);

const POPUP_COOLDOWN_MS = 20000;
const POPUP_RETRY_MS = 2000;

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL || '';

// Default false: Telegram popup disabled unless explicitly enabled.
const TELEGRAM_POPUP_ENABLED =
  String(process.env.NEXT_PUBLIC_TELEGRAM_POPUP_ENABLED || 'false')
    .trim()
    .toLowerCase() === 'true';

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    window.navigator?.standalone === true
  );
};

const isIOSDevice = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isIpadOS = /Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
  return isIOS || isIpadOS;
};

export default function SiteChromeRuntime() {
  const pathname = usePathname();

  const [userInfo, setUserInfoState] = useState(null);
  const isAdmin = !!userInfo?.isAdmin;

  const [requestOpen, setRequestOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  const [updateOpen, setUpdateOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const swRegRef = useRef(null);

  const [enhancementsReady, setEnhancementsReady] = useState(false);

  const isAnyPopupOpenRef = useRef(false);
  const lastPopupClosedAtRef = useRef(0);

  useEffect(() => {
    setIsIOS(isIOSDevice());
  }, []);

  useEffect(() => {
    setUserInfoState(getUserInfo());
    const onStorage = () => setUserInfoState(getUserInfo());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    isAnyPopupOpenRef.current =
      requestOpen || telegramOpen || installOpen || updateOpen;
  }, [requestOpen, telegramOpen, installOpen, updateOpen]);

  const markPopupClosed = useCallback(() => {
    lastPopupClosedAtRef.current = Date.now();
  }, []);

  const canOpenPopupNow = useCallback(() => {
    const now = Date.now();
    const gapOk = now - lastPopupClosedAtRef.current >= POPUP_COOLDOWN_MS;
    return !isAnyPopupOpenRef.current && gapOk;
  }, []);

  const schedulePopup = useCallback(
    ({ storageKey, delayMs, open, shouldSkip }) => {
      let initialTimerId;
      let retryTimerId;
      let cancelled = false;

      const isShown = () => {
        try {
          return sessionStorage.getItem(storageKey) === '1';
        } catch {
          return false;
        }
      };

      const markShown = () => {
        try {
          sessionStorage.setItem(storageKey, '1');
        } catch {
          // ignore
        }
      };

      const tryOpen = () => {
        if (cancelled) return;
        if (typeof shouldSkip === 'function' && shouldSkip()) return;
        if (isShown()) return;

        if (canOpenPopupNow()) {
          isAnyPopupOpenRef.current = true;
          open();
          markShown();
        } else {
          retryTimerId = window.setTimeout(tryOpen, POPUP_RETRY_MS);
        }
      };

      initialTimerId = window.setTimeout(tryOpen, delayMs);

      return () => {
        cancelled = true;
        if (initialTimerId) window.clearTimeout(initialTimerId);
        if (retryTimerId) window.clearTimeout(retryTimerId);
      };
    },
    [canOpenPopupNow]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timerId = null;
    let idleId = null;

    const ready = () => setEnhancementsReady(true);

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(ready, { timeout: 1500 });
    } else {
      timerId = window.setTimeout(ready, 800);
    }

    return () => {
      if (timerId) window.clearTimeout(timerId);
      if (
        idleId !== null &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      setInstallOpen(false);
      setTelegramOpen(false);
      setRequestOpen(true);
    };

    window.addEventListener(OPEN_WATCH_REQUEST_POPUP, handler);
    return () => window.removeEventListener(OPEN_WATCH_REQUEST_POPUP, handler);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event) => {
      if (event?.data?.type === 'PUSH_RECEIVED') {
        window.dispatchEvent(new Event(PUSH_RECEIVED_EVENT));
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const onUpdate = (evt) => {
      swRegRef.current = evt?.detail?.registration || null;
      setUpdateOpen(true);
    };

    window.addEventListener(SW_UPDATE_AVAILABLE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_AVAILABLE_EVENT, onUpdate);
  }, []);

  const clearCaches = useCallback(async () => {
    try {
      if (!('caches' in window)) return;
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateNow = useCallback(async () => {
    if (updating) return;

    setUpdating(true);

    try {
      await clearCaches();

      if ('serviceWorker' in navigator) {
        const reg =
          swRegRef.current ||
          (await navigator.serviceWorker.getRegistration('/'));

        if (reg?.waiting) {
          window[SW_RELOAD_ON_CONTROLLERCHANGE_FLAG] = true;
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });

          window.setTimeout(() => {
            window.location.reload();
          }, 5000);

          return;
        }
      }

      window.location.reload();
    } catch {
      window.location.reload();
    }
  }, [clearCaches, updating]);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const onAppInstalled = () => {
      setInstallOpen(false);
      markPopupClosed();
      setDeferredPrompt(null);
      try {
        localStorage.setItem('pwaInstalled', '1');
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [markPopupClosed]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setInstallOpen(false);
      markPopupClosed();
    }
  };

  useEffect(() => {
    if (!isIOS && !deferredPrompt) return;

    const shouldSkip = () => {
      if (pathname === '/login' || pathname === '/register') return true;
      if (pathname.startsWith('/watch')) return true;
      if (isStandaloneMode()) return true;

      try {
        if (localStorage.getItem('pwaInstalled') === '1') return true;
      } catch {
        // ignore
      }

      if (!isIOS && !deferredPrompt) return true;
      return false;
    };

    return schedulePopup({
      storageKey: 'pwaInstallPopupShown',
      delayMs: 10000,
      open: () => setInstallOpen(true),
      shouldSkip,
    });
  }, [pathname, isIOS, deferredPrompt, schedulePopup]);

  useEffect(() => {
    if (!TELEGRAM_POPUP_ENABLED || !TELEGRAM_URL) return;

    const shouldSkip = () => {
      if (isAdmin) return true;
      if (pathname === '/login' || pathname === '/register') return true;
      if (pathname.startsWith('/watch')) return true;
      return false;
    };

    return schedulePopup({
      storageKey: 'telegramPopupShown',
      delayMs: 40000,
      open: () => setTelegramOpen(true),
      shouldSkip,
    });
  }, [pathname, isAdmin, schedulePopup]);

  return (
    <>
      <AnalyticsBootstrap />

      {enhancementsReady && ADS_ENABLED ? <AdsterraScripts /> : null}
      {enhancementsReady ? <FloatingShareIcons /> : null}

      {updateOpen ? (
        <UpdateAvailablePopup
          open={updateOpen}
          updating={updating}
          onDismiss={() => {
            setUpdateOpen(false);
            setUpdating(false);
            markPopupClosed();
          }}
          onUpdate={handleUpdateNow}
        />
      ) : null}

      {requestOpen ? (
        <MovieRequestPopup
          open={requestOpen}
          onClose={() => {
            setRequestOpen(false);
            markPopupClosed();
          }}
        />
      ) : null}

      {installOpen ? (
        <InstallPwaPopup
          open={installOpen}
          onClose={() => {
            setInstallOpen(false);
            markPopupClosed();
          }}
          onInstall={handleInstallClick}
          canInstall={!!deferredPrompt}
          isIOS={isIOS}
        />
      ) : null}

      {TELEGRAM_POPUP_ENABLED && TELEGRAM_URL && !isAdmin && telegramOpen ? (
        <ChannelPopup
          open={telegramOpen}
          onClose={() => {
            setTelegramOpen(false);
            markPopupClosed();
          }}
          title="Join our Telegram Channel"
          description="Get instant updates, new uploads, and announcements."
          buttonText="Open Telegram"
          url={TELEGRAM_URL}
          Icon={FaTelegramPlane}
          showMaybeLater={true}
          maybeLaterText="Close"
        />
      ) : null}
    </>
  );
}
