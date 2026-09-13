/**
 * Vidi — frontend/src/hooks/usePwaInstall.js
 * Progressive Web Application install prompt state, triggers & platform detection
 */

import { useState, useEffect, useCallback } from 'react';

const SESSION_DISMISS_KEY = 'vidi_pwa_dismissed_session';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clean up any legacy 24h lockout from localStorage
    try {
      localStorage.removeItem('vidi_pwa_prompt_dismissed_time');
    } catch (_) {}

    // Check standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      setIsInstalled(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    // Detect Platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleMobile = 
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(userAgent);
    const isDesktopDevice = !isAppleMobile && !isAndroidDevice;

    setIsIOS(isAppleMobile);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(isDesktopDevice);

    // If already running standalone as an installed app, never pop up
    if (standalone) {
      setShowBanner(false);
      return;
    }

    // Always pop up while entering the site (on both desktop and mobile)
    // Small delay (2.2s) ensures smooth entrance right after intro splash / page load
    const isDismissedInSession = sessionStorage.getItem(SESSION_DISMISS_KEY);
    if (!isDismissedInSession) {
      const enterTimer = setTimeout(() => {
        setShowBanner(true);
      }, 2200);

      // Listen to beforeinstallprompt on Chromium / Android / Desktop Chrome / Edge
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowBanner(true);
      };

      // Listen to appinstalled event
      const handleAppInstalled = () => {
        console.log('[PWA] Application successfully installed.');
        setIsInstalled(true);
        setShowBanner(false);
        setDeferredPrompt(null);
        try {
          sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
        } catch (_) {}
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        clearTimeout(enterTimer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    } else {
      // Even if dismissed in this session, keep listener ready in case user clicks manual Install App button
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
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
        setShowGuideModal(true);
      }
      return;
    }

    // If browser doesn't have native beforeinstallprompt ready, show visual instructions modal
    setShowGuideModal(true);
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch (_) {}
  }, []);

  const closeGuideModal = useCallback(() => {
    setShowGuideModal(false);
  }, []);

  // Can be installed if not already installed/standalone
  const isInstallable = !isInstalled && !isStandalone;

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isDesktop,
    isStandalone,
    showBanner,
    showGuideModal,
    hasNativePrompt: !!deferredPrompt,
    promptInstall,
    dismissBanner,
    setShowGuideModal,
    closeGuideModal
  };
}
