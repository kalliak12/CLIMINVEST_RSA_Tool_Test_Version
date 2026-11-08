/*
 * PDM (Project Database) service abstraction.
 * The UI talks only to RSA.PDM. Two adapters are provided:
 *   - MockAdapter: local demo dataset (RSA.MockPdmData) with simulated latency; pushed results are kept in localStorage.
 *   - RestAdapter: thin fetch() client for a real PDM API (GET /projects, GET /projects/:id, POST /assessments).
 *   - CliminvestPdmAdapter (pdm-climinvest.js): the real CLIMINVEST PDM Data Editor API (read-only).
 * Swap adapters from Methodology → Settings.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const RESULTS_KEY = 'climinvest-rsa-mock-pdm-results';

    const matches = (p, q) => {
        if (!q) return true;
        const hay = [p.id, p.name, p.shortName, p.country, p.region, p.adaptationType, p.technical && p.technical.technologyFamily, (p.targetTechnologies || []).join(' ')]
            .filter(Boolean).join(' ').toLowerCase();
        return q.toLowerCase().split(/\s+/).every((term) => hay.includes(term));
    };

    const MockAdapter = {
        id: 'mock',
        label: 'Mock PDM (local demo dataset)',
        async search(query = '', role = null) {
            await delay(220);
            return RSA.MockPdmData.projects
                .filter((p) => !role || p.roles.includes(role))
                .filter((p) => matches(p, query))
                .map((p) => U.clone(p));
        },
        async get(id) {
            await delay(180);
            const p = RSA.MockPdmData.projects.find((x) => x.id === id);
            return p ? U.clone(p) : null;
        },
        async list(role = null) { return this.search('', role); },
        async pushResults(payload) {
            await delay(450);
            const store = RSA.Storage.getItem(RESULTS_KEY) || [];
            const receipt = { receiptId: `PDM-RSA-${Date.now().toString().slice(-6)}`, receivedAt: U.nowIso(), payload };
            store.push(receipt);
            RSA.Storage.setItem(RESULTS_KEY, store);
            return { success: true, receiptId: receipt.receiptId, receivedAt: receipt.receivedAt };
        },
        async getResults(projectId) {
            const store = RSA.Storage.getItem(RESULTS_KEY) || [];
            return store.filter((r) => r.payload && (r.payload.replicationSiteId === projectId || r.payload.sourceProjectId === projectId));
        },
        /* Synchronous accessor used only for seeding demo data. */
        getSync(id) {
            const p = RSA.MockPdmData.projects.find((x) => x.id === id);
            return p ? U.clone(p) : null;
        }
    };

    const RestAdapter = (baseUrl, token) => {
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        const req = async (path, options = {}) => {
            const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { headers, ...options });
            if (!res.ok) throw new Error(`PDM API ${res.status} ${res.statusText}`);
            return res.json();
        };
        return {
            id: 'rest',
            label: `PDM REST API (${baseUrl})`,
            search: (query = '', role = null) => req(`/projects?q=${encodeURIComponent(query)}${role ? `&role=${role}` : ''}`),
            get: (id) => req(`/projects/${encodeURIComponent(id)}`),
            list: (role = null) => req(`/projects${role ? `?role=${role}` : ''}`),
            pushResults: (payload) => req('/assessments', { method: 'POST', body: JSON.stringify(payload) }),
            getResults: (projectId) => req(`/assessments?projectId=${encodeURIComponent(projectId)}`)
        };
    };

    /* Test version: no project database — projects come only from imported Excel files. */
    const NoDatabase = {
        id: 'none', label: 'Excel imports only',
        async search() { return []; }, async get() { return null; }, async list() { return []; },
        async pushResults() { throw new Error('Sending results to a project database is not available in the test version. Use Export JSON or print the report.'); },
        async getResults() { return []; }, async test() { return { projects: 0 }; }
    };

    let adapter = MockAdapter;

    RSA.PDM = {
        configure(settings = {}) {
            if (RSA.Edition && RSA.Edition.test) { adapter = NoDatabase; return adapter; }
            if (settings.adapter === 'climinvest' && RSA.CliminvestPdmAdapter) adapter = RSA.CliminvestPdmAdapter(settings.baseUrl, settings.token);
            else adapter = settings.adapter === 'rest' && settings.baseUrl ? RestAdapter(settings.baseUrl, settings.token) : MockAdapter;
            return adapter;
        },
        get adapterLabel() { return adapter.label; },
        get adapterId() { return adapter.id; },
        search: (q, role) => adapter.search(q, role),
        get: (id) => (String(id).startsWith('XLS-') && RSA.ExcelProjects ? RSA.ExcelProjects.adapter.get(id) : adapter.get(id)),
        list: (role) => adapter.list(role),
        pushResults: (payload) => adapter.pushResults(payload),
        getResults: (id) => adapter.getResults(id),
        getSync: (id) => MockAdapter.getSync(id),
        getRaw: (id) => (String(id).startsWith('XLS-') && RSA.ExcelProjects ? RSA.ExcelProjects.adapter.get(id) : adapter.getRaw ? adapter.getRaw(id) : adapter.get(id)),
        test: () => (adapter.test ? adapter.test() : adapter.list().then((l) => ({ projects: l.length }))),

        /* Immutable snapshot of the PDM record used for an assessment. */
        snapshot(record) {
            const snap = { id: record.id, version: record.version, lastUpdated: record.lastUpdated, fetchedAt: U.nowIso(), data: U.clone(record) };
            if (record.origin === 'excel') { snap.local = true; snap.excel = true; snap.data.local = true; } // Excel projects are not PDM records
            return snap;
        },

        /* Field-level differences between two record versions (ignores documents list ordering noise). */
        diff(oldData, newData) {
            const strip = (d) => { const x = { ...(d || {}) }; delete x.pdmRaw; delete x.pdmMapping; delete x.local; delete x.fileName; return x; };
            const a = U.flatten(strip(oldData));
            const b = U.flatten(strip(newData));
            const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
            const out = [];
            keys.forEach((k) => {
                if (k === 'version' || k === 'lastUpdated') return;
                if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ path: k, from: a[k], to: b[k] });
            });
            return out;
        }
    };
})(window.RSA);
