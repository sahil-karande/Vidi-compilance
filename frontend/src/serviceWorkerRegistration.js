/**
 * Vidi — frontend/src/serviceWorkerRegistration.js
 * Progressive Web Application service worker registration and lifecycle helper
 */

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = '/sw.js';

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available and will be used when all tabs for this page are closed.
                  console.log('[PWA] New content is available; please refresh.');
                } else {
                  // Content is cached for offline use.
                  console.log('[PWA] Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('[PWA] Error during service worker registration:', error);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
