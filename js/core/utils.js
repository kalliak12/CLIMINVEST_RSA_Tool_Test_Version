/* CLIMINVEST RSA — shared utilities (no dependencies). */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = {};

    U.$ = (selector, root = document) => root.querySelector(selector);
    U.$$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    U.esc = (value) => (value === null || value === undefined ? '' : String(value)).replace(/[&<>'"]/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
    U.nl2br = (value) => U.esc(value).replace(/\n/g, '<br>');
    U.textOrDash = (value) => (value && String(value).trim() ? U.nl2br(value) : '<span class="muted">—</span>');

    U.uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    U.nowIso = () => new Date().toISOString();
    U.today = () => new Date().toISOString().slice(0, 10);

    U.fmtDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d) ? String(iso) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    U.fmtDateTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d) ? String(iso) : `${U.fmtDate(iso)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    };
    U.fmtNum = (n, digits = 0) => (n === null || n === undefined || n === '' || isNaN(n)) ? '—'
        : Number(n).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
    U.fmtScore = (n) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(1);
    U.fmtPct = (n) => (n === null || n === undefined || isNaN(n)) ? '—' : `${Math.round(n)}%`;

    U.clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    U.avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    U.isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    U.clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

    U.get = (obj, path) => String(path).split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);

    /* Path helpers for data-field bindings. Segments are separated by "|" because metric ids contain dots. */
    U.getField = (obj, path) => path.split('|').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
    U.setField = (obj, path, value) => {
        const keys = path.split('|');
        const last = keys.pop();
        const target = keys.reduce((o, k) => {
            if (o[k] === undefined || o[k] === null) o[k] = {};
            return o[k];
        }, obj);
        target[last] = value;
    };

    /* Flatten an object into { "a.b.c": primitive|jsonString } for diffing PDM snapshots. */
    U.flatten = (obj, prefix = '', out = {}) => {
        if (obj === null || obj === undefined) return out;
        Object.keys(obj).forEach((key) => {
            const value = obj[key];
            const path = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) U.flatten(value, path, out);
            else out[path] = Array.isArray(value) ? JSON.stringify(value) : value;
        });
        return out;
    };

    U.debounce = (fn, ms = 300) => {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    U.download = (filename, text, mime = 'application/json') => {
        const blob = new Blob([text], { type: mime });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    U.slug = (s) => String(s || 'rsa-assessment').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

    U.jaccard = (a = [], b = []) => {
        const A = new Set(a.map((x) => String(x).toLowerCase()));
        const B = new Set(b.map((x) => String(x).toLowerCase()));
        if (!A.size && !B.size) return null;
        let inter = 0;
        A.forEach((x) => { if (B.has(x)) inter += 1; });
        return inter / (A.size + B.size - inter);
    };

    U.toast = (message, type = 'info', ms = 3200) => {
        const host = document.getElementById('toastHost');
        if (!host) return;
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.setAttribute('role', 'status');
        el.textContent = message;
        host.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
    };

    RSA.U = U;
})(window.RSA);
