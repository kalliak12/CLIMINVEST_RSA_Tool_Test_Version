/*
 * Connection to the real CLIMINVEST PDM (PDM Data Editor API, OpenAPI 1.0.0).
 *   GET  /data                      list available data types (used to test the connection)
 *   GET  /data/projects             list projects visible to the user
 *   GET  /data/projectTree/{id}     one project with all its references resolved
 * Authentication: personal token from the PDM "Developers menu" → sent as  Authorization: Bearer <token>.
 * Read-only: results are not written to the PDM until the record type for RSA results is agreed with the PDM team.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const DEFAULT_URL = 'https://dev-marketplace.climinvest.unparallel.pt/apps/pdm-data-editor/api/v1';

    /* Flatten a project tree into { key, value } leaves; array positions are dropped from the key. */
    const leaves = (obj, prefix = '', out = []) => {
        if (Array.isArray(obj)) { obj.forEach((x) => leaves(x, prefix, out)); return out; }
        if (obj && typeof obj === 'object') {
            Object.entries(obj).forEach(([k, v]) => { if (k === '$ref' || k === '_ownerIds') return; leaves(v, prefix ? `${prefix}.${k.toLowerCase()}` : k.toLowerCase(), out); });
            return out;
        }
        if (obj !== null && obj !== undefined && String(obj).trim() !== '') out.push({ key: prefix, value: obj });
        return out;
    };

    const toNumber = (v) => (typeof v === 'number' ? v : RSA.DataExtract ? RSA.DataExtract.parseNumber(v) : parseFloat(v));
    const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36).slice(0, 6); };

    function pick(list, patterns, type = 'text', agg = 'first') {
        for (const re of patterns) {
            const hits = list.filter((l) => re.test(l.key));
            if (!hits.length) continue;
            if (type === 'number') {
                const nums = hits.map((h) => toNumber(h.value)).filter((n) => Number.isFinite(n));
                if (!nums.length) continue;
                return agg === 'sum' ? nums.reduce((a, b) => a + b, 0) : nums[0];
            }
            if (type === 'list') { const vals = [...new Set(hits.map((h) => String(h.value).trim()).filter((v) => v && v.length < 120))]; if (vals.length) return vals.slice(0, 10); continue; }
            if (type === 'bool') { const v = String(hits[0].value).toLowerCase(); return /^(true|yes|1)$/.test(v); }
            const text = hits.map((h) => h.value).find((v) => typeof v === 'string' && v.trim());
            if (text) return text.trim();
        }
        return null;
    }

    /* PDM project tree → the record shape the RSA uses. Unmapped fields stay empty and appear under "missing information". */
    const shortOf = (name) => { const s = String(name || ''); if (s.length <= 48) return s; const cut = s.slice(0, 48); return `${cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : 48)}…`; };

    function mapProject(tree) {
        const map = RSA.PdmMapping;
        const all = leaves(tree);
        const top = all.filter((l) => !l.key.includes('.'));
        const ex = map.explicit(tree);
        const idn = ex.identity;
        const id = tree._id || tree.id;
        const rec = {
            id, roles: ['source', 'site'],
            name: idn.name || pick(top, map.identity.name) || String(id),
            shortName: idn.shortName || null,
            country: idn.country || '',
            region: idn.region || '',
            summary: String(idn.summary || pick(top, map.identity.summary) || '').slice(0, 800),
            adaptationType: idn.adaptationType || pick(top, map.identity.adaptationType) || '',
            owner: idn.owner || '',
            status: 'Project database record',
            climate: {}, technical: {}, financial: {}, esg: {}, institutional: {}, documents: []
        };
        rec.shortName = shortOf(rec.shortName || rec.name);
        const found = [];
        const put = (path, v) => { const [group, key] = path.split('.'); rec[group] = rec[group] || {}; rec[group][key] = v; found.push(path); };
        Object.entries(ex.fields).forEach(([path, v]) => put(path, v));
        map.fields.forEach((f) => {
            if (found.includes(f.path)) return;
            const v = pick(all, f.keys, f.type, f.agg);
            if (v === null || v === undefined || v === 0) return;
            put(f.path, v);
        });
        // A PDM project can be used as source or as replication site: mirror the figures into the site-side fields.
        const f = rec.financial;
        [['capexEur', 'expectedCapexEur'], ['opexEurYr', 'expectedOpexEurYr'], ['irrPct', 'projectedIrrPct'], ['paybackYrs', 'projectedPaybackYrs']].forEach(([from, to]) => { if (f[from] !== undefined && f[to] === undefined) f[to] = f[from]; });
        if (rec.owner && !rec.institutional.organisation) rec.institutional.organisation = rec.owner;
        const json = JSON.stringify(tree);
        rec.version = idn.updatedAt ? String(idn.updatedAt).slice(0, 19).replace('T', ' ') : hash(json);
        rec.lastUpdated = idn.updatedAt || U.today();
        rec.pdmMapping = { found, leaves: all.length };
        // keep the original record so its real field names can be inspected (Projects → Data versions)
        rec.pdmRaw = json.length > 150000 ? null : tree;
        if (!rec.pdmRaw) rec.pdmRawNote = 'This record is too large to show here. Use “Download PDM record” to save it as a file.';
        return rec;
    }

    /* Summary for the project lists (from GET /data/projects, references not resolved). */
    function summary(el) {
        const idn = RSA.PdmMapping.explicit(el).identity;
        const id = el._id || el.id;
        const name = idn.name || String(id);
        return {
            id, roles: ['source', 'site'], name, shortName: shortOf(idn.shortName || name),
            country: idn.country || '', region: '', adaptationType: idn.adaptationType || '',
            status: `${id}${el.year ? ` · ${el.year}` : ''}${el._visibility === 'private' ? ' · private' : ''}`, technical: {}
        };
    }

    const asList = (res) => (Array.isArray(res) ? res : Array.isArray(res && res.data) ? res.data : Array.isArray(res && res.items) ? res.items : res && typeof res === 'object' ? Object.values(res).find(Array.isArray) || [] : []);

    RSA.CliminvestPdmAdapter = (baseUrl, settingsToken) => {
        const base = (baseUrl || DEFAULT_URL).replace(/\/$/, '');
        // token typed in Settings first, otherwise the private config.local.js file
        const token = (settingsToken && settingsToken.trim()) || ((RSA.LocalConfig && RSA.LocalConfig.pdmToken) || '').trim();
        const req = async (path) => {
            if (!token) throw new Error('No PDM token yet. Paste it in Methodology → Settings, or in the private file config.local.js. (To try the tool without the PDM, choose "Demo projects" in Settings.)');
            let res;
            try {
                res = await fetch(`${base}${path}`, { headers: { accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
            } catch (err) {
                const local = location.protocol === 'file:';
                throw new Error(local
                    ? 'The browser blocked the request because the tool is opened as a local file. Open it from a web address (e.g. GitHub Pages or a local web server), or ask the PDM team to allow it.'
                    : `The browser could not reach the project database. Most likely the PDM does not yet allow calls from this website (${location.origin}) — ask the PDM team to enable CORS for it.`);
            }
            if (res.status === 401 || res.status === 403) throw new Error('The project database rejected the token. Generate a new token in the PDM Developers menu and paste it in Settings (a new token replaces the old one).');
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`Project database error ${res.status} ${res.statusText}`);
            return res.json();
        };
        let cache = null;
        const all = async () => { if (!cache) cache = asList(await req('/data/projects')).map(summary); return cache; };
        return {
            id: 'climinvest', label: `CLIMINVEST project database (${base.includes('dev-') ? 'development' : 'live'})`, baseUrl: base, tokenSource: settingsToken && settingsToken.trim() ? 'settings' : token ? 'config.local.js' : 'none',
            async test() {
                const types = await req('/data');
                const list = types && (types.availableDataTypes || asList(types));
                const projects = await req('/data/projects');
                return { types: (list || []).length, projects: asList(projects).length };
            },
            async list() { return U.clone(await all()); },
            async search(q = '') { const t = q.toLowerCase(); return (await all()).filter((p) => !t || `${p.id} ${p.name} ${p.shortName} ${p.country}`.toLowerCase().includes(t)); },
            async get(id) { const tree = await req(`/data/projectTree/${encodeURIComponent(id)}`); return tree ? mapProject(tree) : null; },
            /* The project tree exactly as the PDM returns it (for inspection / download). */
            async getRaw(id) { return req(`/data/projectTree/${encodeURIComponent(id)}`); },
            async pushResults() { throw new Error('Sending results to the project database is not switched on yet. The record type for RSA results still needs to be agreed with the PDM team.'); },
            async getResults() { return []; }
        };
    };
    RSA.CliminvestPdmAdapter.DEFAULT_URL = DEFAULT_URL;
    RSA.CliminvestPdmAdapter.mapProject = mapProject;
})(window.RSA);
