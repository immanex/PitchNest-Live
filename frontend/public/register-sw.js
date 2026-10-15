if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isLocalDevelopment =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '0.0.0.0';

    if (isLocalDevelopment) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      Promise.all([
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister()))),
        'caches' in window
          ? caches.keys().then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.startsWith('pitchnest-cache-'))
                  .map((key) => caches.delete(key)),
              ),
            )
          : Promise.resolve(),
      ])
        .then(() => {
          const reloadKey = 'pitchnest-sw-dev-cleanup';
          if (hadController && sessionStorage.getItem(reloadKey) !== 'done') {
            sessionStorage.setItem(reloadKey, 'done');
            location.reload();
          } else if (!hadController) {
            sessionStorage.removeItem(reloadKey);
          }
        })
        .catch((err) => console.warn('Local service worker cleanup failed:', err));
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('Service worker registered:', reg.scope))
      .catch((err) => console.error('Service worker registration failed:', err));
  });
}
