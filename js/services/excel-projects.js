/*
 * Excel files as a project database.
 * A workbook can hold one or more project-data sheets ("Source project", "Replication site", or any sheet
 * with a "Role" row). Each sheet is a simple list: Field | Value | Unit | Notes | Key.
 * The projects found are kept in this browser and offered in the Projects lists when
 * Settings → Project database is "Excel files". RSA Scoring Toolkit workbooks with these sheets
 * also fill the project data of the assessment they create.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const STORE_KEY = RSA.Edition && RSA.Edition.test ? 'climinvest-rsa-test-excel-projects' : 'climinvest-rsa-excel-projects';

    /* Fields an Excel project sheet can hold. kind: text | number | pct | list | bool | select | date */
    const GENERAL = [
        ['name', 'Project name', '', 'text'],
        ['shortName', 'Short name', '', 'text'],
        ['country', 'Country', '', 'text'],
        ['region', 'Region / location', '', 'text'],
        ['adaptationType', 'Adaptation type', '', 'text'],
        ['status', 'Project status', '', 'text'],
        ['year', 'Start year', '', 'number'],
        ['owner', 'Owner / promoter', '', 'text'],
        ['summary', 'Summary', '', 'text'],
        ['targetTechnologies', 'Target technologies (site)', '', 'list'],
        ['version', 'Data version', '', 'number'],
        ['lastUpdated', 'Last updated', '', 'date']
    ];
    const EXTRA = [
        ['technical.infrastructureType', 'Host infrastructure type (source)', '', 'text'],
        ['technical.constrainedFamilies', 'Technologies limited by site constraints', '', 'list']
    ];

    const kindOf = (path) => {
        if (/Note$/.test(path)) return 'text';
        const spec = RSA.Methodology.fieldSpec(path);
        if (spec.type === 'select') return spec.numeric ? 'number' : 'select';
        if (spec.type === 'bool' || spec.type === 'list') return spec.type;
        if (/Pct$/.test(path)) return 'pct';
        if (spec.type === 'number') return 'number';
        if (path === 'technical.constraints') return 'list';
        return 'text';
    };

    let fieldCache = null;
    function fields() {
        if (fieldCache) return fieldCache;
        const M = RSA.Methodology;
        const list = GENERAL.map(([key, label, unit, kind]) => ({ key, label, unit, kind }));
        Object.entries(M.pdmFieldLabels).forEach(([key, [label, unit]]) => list.push({ key, label, unit, kind: kindOf(key) }));
        EXTRA.forEach(([key, label, unit, kind]) => list.push({ key, label, unit, kind }));
        fieldCache = list;
        return list;
    }

    const setPath = (obj, path, value) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[ks[ks.length - 1]] = value; };
    const str = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim()));
    const norm = (s) => str(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[–—]/g, '-').replace(/[:*]+$/, '').replace(/\s+/g, ' ').trim();

    function fieldFor(label, key) {
        const k = str(key);
        if (k) { const f = fields().find((x) => x.key === k); if (f) return f; }
        const n = norm(label);
        if (!n) return null;
        return fields().find((x) => norm(x.label) === n || norm(x.key) === n) || null;
    }

    /* Convert a cell into the field's value. Returns { value } or { error }. */
    function convert(f, cell) {
        const raw = cell ? cell.v : null;
        const text = cell && cell.w !== undefined ? String(cell.w).trim() : str(raw);
        if (raw === null || raw === undefined || str(raw) === '') return { value: null };
        switch (f.kind) {
            case 'number': {
                const n = typeof raw === 'number' ? raw : RSA.DataExtract.parseNumber(raw);
                return n === null ? { error: `"${text}" is not a number` } : { value: Math.round(n * 1000) / 1000 };
            }
            case 'pct': {
                let n = typeof raw === 'number' ? raw : RSA.DataExtract.parseNumber(raw);
                if (n === null) return { error: `"${text}" is not a percentage` };
                if (/%/.test((cell && cell.z) || '') || /%/.test(text)) { if (typeof raw === 'number' && Math.abs(raw) <= 1.5) n = raw * 100; }
                return { value: Math.round(n * 10) / 10 };
            }
            case 'bool': {
                const t = text.toLowerCase();
                if (/^(yes|y|true|1|si|sí|ναι)$/.test(t)) return { value: true };
                if (/^(no|n|false|0|όχι)$/.test(t)) return { value: false };
                return { error: `"${text}" should be Yes or No` };
            }
            case 'list': return { value: text.split(/\s*;\s*|\n|,(?!\d{3}\b)\s*/).map((x) => x.trim()).filter(Boolean) }; // "13,000" is not split
            case 'select': {
                const opts = RSA.Methodology.fieldSpec(f.key).options || [];
                const hit = opts.find((o) => norm(o) === norm(text)) || opts.find((o) => norm(o).replace(/[^a-z0-9]/g, '') === norm(text).replace(/[^a-z0-9]/g, ''));
                return hit ? { value: hit } : { error: `"${text}" is not one of: ${opts.join(' / ')}` };
            }
            case 'date': {
                if (raw instanceof Date) return { value: raw.toISOString().slice(0, 10) };
                const m = /(\d{4})-(\d{2})-(\d{2})/.exec(text) || /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(text);
                if (!m) return { error: `"${text}" is not a date` };
                return { value: m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` };
            }
            default: return { value: text.slice(0, 2000) };
        }
    }

    const roleOfSheet = (name) => (/source/i.test(name) ? 'source' : /(replication|target|replicator)\s*(site|project)?|\bsite\b/i.test(name) ? 'site' : null);
    const isProjectSheet = (name) => /(source project|replication site|target site|project data|project sheet)/i.test(name);

    /* Read one project sheet. Returns { record, role, report } or null when the sheet has no Field/Value table. */
    function readSheet(XLSX, ws, sheetName, fileName) {
        if (!ws || !ws['!ref']) return null;
        const range = XLSX.utils.decode_range(ws['!ref']);
        const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
        let headRow = -1; const cols = {};
        for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 15) && headRow < 0; r += 1) {
            for (let c = range.s.c; c <= range.e.c; c += 1) {
                const t = norm(cell(r, c) && cell(r, c).v);
                if (t === 'field') { headRow = r; cols.field = c; }
            }
        }
        if (headRow < 0) return null;
        for (let c = range.s.c; c <= range.e.c; c += 1) {
            const t = norm(cell(headRow, c) && cell(headRow, c).v);
            if (t === 'value') cols.value = c;
            else if (/^key|tool key/.test(t)) cols.key = c;
        }
        if (cols.value === undefined) return null;

        const record = { id: '', roles: [], origin: 'excel', fileName, version: 1, lastUpdated: '', climate: {}, technical: {}, financial: {}, esg: {}, institutional: {}, documents: [] };
        const report = { sheet: sheetName, read: 0, empty: 0, notRead: [], invalid: [] };
        let role = roleOfSheet(sheetName);
        for (let r = headRow + 1; r <= range.e.r; r += 1) {
            const labelCell = cell(r, cols.field);
            const label = str(labelCell && labelCell.v);
            const valueCell = cell(r, cols.value);
            const keyCell = cols.key !== undefined ? cell(r, cols.key) : null;
            if (!label) continue;
            if (/^role$/i.test(norm(label))) { const v = norm(valueCell && valueCell.v); if (/source/.test(v)) role = 'source'; else if (/site|replic|target/.test(v)) role = 'site'; continue; }
            const hasValue = valueCell && str(valueCell.v) !== '';
            const f = fieldFor(label, keyCell && keyCell.v);
            if (!f) {
                // Section headings (a label alone in capitals) are not data.
                if (hasValue) report.notRead.push(`${label}: ${str(valueCell.w !== undefined ? valueCell.w : valueCell.v).slice(0, 60)}`);
                continue;
            }
            if (!hasValue) { report.empty += 1; continue; }
            const res = convert(f, valueCell);
            if (res.error) { report.invalid.push(`${f.label}: ${res.error}`); continue; }
            if (res.value === null || (Array.isArray(res.value) && !res.value.length)) { report.empty += 1; continue; }
            setPath(record, f.key, res.value);
            report.read += 1;
        }
        if (!record.name && !record.shortName) return null;
        if (!role) role = 'source';
        record.name = record.name || record.shortName;
        record.shortName = record.shortName || `${record.name.split(/\s+[—–-]\s+/)[0]}${record.country ? ` (${record.country})` : ''}`;
        record.roles = [role];
        record.id = `XLS-${role === 'source' ? 'SRC' : 'SITE'}-${U.slug(record.shortName).toUpperCase().slice(0, 40)}`;
        record.version = Number(record.version) || 1;
        record.lastUpdated = record.lastUpdated || U.today();
        record.status = record.status || (role === 'source' ? 'Source project (Excel)' : 'Replication site (Excel)');
        record.adaptationType = record.adaptationType || '';
        record.summary = record.summary || '';
        report.project = record.shortName; report.role = role;
        return { record, role, report };
    }

    /* All project sheets in a workbook. */
    function readWorkbook(book) {
        const { XLSX, wb, fileName } = book;
        const out = [];
        wb.SheetNames.forEach((n) => {
            if (!isProjectSheet(n)) return;
            const res = readSheet(XLSX, wb.Sheets[n], n, fileName);
            if (res) out.push(res);
        });
        return out;
    }

    /* ---------- Store (this browser) ---------- */
    const load = () => RSA.Storage.getItem(STORE_KEY) || { files: [], projects: {} };
    const save = (db) => RSA.Storage.setItem(STORE_KEY, db);
    const comparable = (r) => { const x = U.clone(r); delete x.version; delete x.lastUpdated; delete x.fileName; return JSON.stringify(x); };

    /* Add or update the projects of one file. A project whose data changed gets a new version number. */
    function addRecords(fileName, records) {
        const db = load();
        const now = U.nowIso();
        const result = { added: [], updated: [], unchanged: [] };
        records.forEach((rec) => {
            const old = db.projects[rec.id];
            if (!old) { db.projects[rec.id] = rec; result.added.push(rec.shortName); return; }
            if (comparable(old) === comparable(rec)) { result.unchanged.push(rec.shortName); return; }
            rec.version = Math.max(rec.version || 1, (old.version || 1) + 1);
            if (rec.lastUpdated <= old.lastUpdated) rec.lastUpdated = U.today();
            db.projects[rec.id] = rec; result.updated.push(rec.shortName);
        });
        db.files = db.files.filter((f) => f.name !== fileName);
        db.files.push({ name: fileName, loadedAt: now, projectIds: records.map((r) => r.id) });
        save(db);
        return result;
    }

    function removeFile(fileName) {
        const db = load();
        const file = db.files.find((f) => f.name === fileName);
        db.files = db.files.filter((f) => f.name !== fileName);
        const stillUsed = new Set(db.files.flatMap((f) => f.projectIds));
        (file ? file.projectIds : []).forEach((id) => { if (!stillUsed.has(id)) delete db.projects[id]; });
        save(db);
    }

    const all = () => Object.values(load().projects);
    const clearAll = () => save({ files: [], projects: {} });

    const matches = (p, q) => {
        if (!q) return true;
        const hay = [p.id, p.name, p.shortName, p.country, p.region, p.adaptationType, p.technical && p.technical.technologyFamily].filter(Boolean).join(' ').toLowerCase();
        return q.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
    };

    const adapter = {
        id: 'excel',
        label: 'Excel project files',
        async search(query = '', role = null) { return all().filter((p) => (!role || p.roles.includes(role)) && matches(p, query)).map((p) => U.clone(p)); },
        async get(id) { const p = load().projects[id]; return p ? U.clone(p) : null; },
        async list(role = null) { return this.search('', role); },
        async pushResults() { throw new Error('Results can only be sent to the CLIMINVEST project database. With Excel projects, use Export JSON or print the report.'); },
        async getResults() { return []; },
        async test() { return { projects: all().length }; }
    };

    RSA.ExcelProjects = { fields, readWorkbook, readSheet, isProjectSheet, addRecords, removeFile, all, clearAll, files: () => load().files, adapter };
})(window.RSA);
