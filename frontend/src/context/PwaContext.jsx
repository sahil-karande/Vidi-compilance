import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PwaContext = createContext(null);
const SESSION_DISMISS_KEY = 'vidi_pwa_dismissed_session';

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(() => {
    if (typeof window !== 'undefined' && window.__vidi_deferred_prompt) {
      return window.__vidi_deferred_prompt;
    }
    return null;
  });

  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

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

    // If already running standalone as an installed app, never pop up banner
    if (standalone) {
      setShowBanner(false);
      return;
    }

    // Check if early capture script caught beforeinstallprompt
    if (window.__vidi_deferred_prompt) {
      setDeferredPrompt(window.__vidi_deferred_prompt);
    }

    const handlePromptCaptured = () => {
      if (window.__vidi_deferred_prompt) {
        setDeferredPrompt(window.__vidi_deferred_prompt);
      }
    };
    window.addEventListener('vidi_prompt_captured', handlePromptCaptured);

    // Listen to beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.__vidi_deferred_prompt = e;
      setDeferredPrompt(e);
      // If not dismissed this session, trigger banner
      if (!sessionStorage.getItem(SESSION_DISMISS_KEY)) {
        setShowBanner(true);
      }
    };

    // Listen to appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA] Application successfully installed.');
      setIsInstalled(true);
      setShowBanner(false);
      setShowGuideModal(false);
      setDeferredPrompt(null);
      window.__vidi_deferred_prompt = null;
      try {
        sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
      } catch (_) {}
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Auto-popup banner on entrance if not dismissed
    const isDismissedInSession = sessionStorage.getItem(SESSION_DISMISS_KEY);
    let enterTimer = null;
    if (!isDismissedInSession) {
      enterTimer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
    }

    return () => {
      if (enterTimer) clearTimeout(enterTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('vidi_prompt_captured', handlePromptCaptured);
    };
  }, []);

  // Universal Install Trigger
  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__vidi_deferred_prompt : null);

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted install prompt');
          setIsInstalled(true);
          setShowBanner(false);
          setShowGuideModal(false);
        }
        setDeferredPrompt(null);
        window.__vidi_deferred_prompt = null;
      } catch (err) {
        console.warn('[PWA] Native prompt display error:', err);
        setShowGuideModal(true);
      }
    } else {
      // Browser didn't supply beforeinstallprompt (cooldown or unsupported browser like Firefox/desktop Safari)
      // Open the visual step-by-step install guide modal
      setShowGuideModal(true);
    }
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

  const isInstallable = !isInstalled && !isStandalone;

  const value = {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isDesktop,
    isStandalone,
    showBanner,
    showGuideModal,
    hasNativePrompt: !!(deferredPrompt || (typeof window !== 'undefined' && window.__vidi_deferred_prompt)),
    promptInstall,
    dismissBanner,
    setShowGuideModal,
    closeGuideModal
  };

  return (
    <PwaContext.Provider value={value}>
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}
