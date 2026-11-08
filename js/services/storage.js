/* Local persistence for the prototype. Replace with a server-side repository when auth/API are available. */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const KEY = RSA.Edition && RSA.Edition.test ? 'climinvest-rsa-test-v1' : 'climinvest-rsa-v2'; // the test version keeps its own data
    const LEGACY_KEY = 'climinvest-rsa-state';

    const safe = (fn, fallback = null) => {
        try { return fn(); } catch (err) { console.warn('[RSA storage]', err); return fallback; }
    };

    RSA.Storage = {
        load() { return safe(() => { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }); },
        save(data) { return safe(() => { localStorage.setItem(KEY, JSON.stringify(data)); return true; }, false); },
        clear() { safe(() => localStorage.removeItem(KEY)); },
        loadLegacy() { return safe(() => { const raw = localStorage.getItem(LEGACY_KEY); return raw ? JSON.parse(raw) : null; }); },
        clearLegacy() { safe(() => localStorage.removeItem(LEGACY_KEY)); },
        getItem(key) { return safe(() => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }); },
        setItem(key, value) { return safe(() => { localStorage.setItem(key, JSON.stringify(value)); return true; }, false); }
    };
})(window.RSA);
