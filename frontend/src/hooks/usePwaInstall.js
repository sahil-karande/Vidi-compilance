/**
 * Vidi — frontend/src/hooks/usePwaInstall.js
 * Progressive Web Application install prompt state, triggers & platform detection
 */

import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'vidi_pwa_prompt_dismissed_time';
const DISMISS_COOLOFF_MS = 24 * 60 * 60 * 1000; // 24 hours cool-off for auto-popup

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Detect platform & standalone display mode
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      setIsInstalled(isStandaloneMode);
    };

    checkStandalone();

    // Check if device is iOS (Safari doesn't support beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleMobile = 
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isAppleMobile);

    // If already running standalone, no need to show banner
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setShowBanner(false);
      return;
    }

    // Listen to beforeinstallprompt on Chromium / Android / Desktop Chrome / Edge
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Check cool-off period
      const lastDismissed = localStorage.getItem(DISMISS_KEY);
      if (!lastDismissed || Date.now() - parseInt(lastDismissed, 10) > DISMISS_COOLOFF_MS) {
        setShowBanner(true);
      }
    };

    // Listen to appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA] Application successfully installed.');
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If on iOS and not standalone, show prompt after a gentle initial delay if not dismissed
    if (isAppleMobile && !window.navigator.standalone) {
      const lastDismissed = localStorage.getItem(DISMISS_KEY);
      if (!lastDismissed || Date.now() - parseInt(lastDismissed, 10) > DISMISS_COOLOFF_MS) {
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger installation prompt
  const promptInstall = useCallback(async () => {
    // If native prompt is available (Chrome, Edge, Android)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
          setIsInstalled(true);
          setShowBanner(false);
        } else {
          console.log('[PWA] User dismissed the install prompt');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('[PWA] Error displaying install prompt:', err);
      }
      return;
    }

    // If on iOS or browser without beforeinstallprompt, open visual instructions modal
    if (isIOS || !deferredPrompt) {
      setShowIOSModal(true);
    }
  }, [deferredPrompt, isIOS]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  const closeIOSModal = useCallback(() => {
    setShowIOSModal(false);
  }, []);

  // Can be installed if not already installed, and either we have a native prompt or we can guide user on iOS/Desktop
  const isInstallable = !isInstalled && !isStandalone;

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isStandalone,
    showBanner,
    showIOSModal,
    hasNativePrompt: !!deferredPrompt,
    promptInstall,
    dismissBanner,
    setShowIOSModal,
    closeIOSModal
  };
}
