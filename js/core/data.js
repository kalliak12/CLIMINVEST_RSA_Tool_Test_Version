/*
 * Project data as the RSA uses it = PDM snapshot + values the team filled in where the PDM had none.
 * Manually entered values are stored separately (a.pdm.manual) so the snapshot stays an exact copy of the PDM,
 * and they are included in the results synced back to the PDM.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;

    const empty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

    const setPath = (obj, path, value) => {
        const keys = path.split('.');
        const last = keys.pop();
        const target = keys.reduce((o, k) => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; return o[k]; }, obj);
        target[last] = value;
    };

    const REVENUE_TAGS = [
        ['self-consumption', /self.?consum|bill saving|savings/i], ['net-metering', /net.?meter/i], ['energy-sales', /energy sale|surplus/i],
        ['ppa', /\bppa\b|purchase agreement/i], ['grants', /grant|incentive/i], ['carbon-credits', /carbon/i], ['water-value', /water|evaporation/i],
        ['epc', /performance (payment|contract)/i]
    ];

    const D = {
        manual(a, side) { return ((a.pdm.manual || {})[side]) || {}; },

        /* The source projects to rank for "better match": the list, plus the assessment's own source when the
           list only has a copy of it under another ID (e.g. added from a JSON file); the copy is then left out. */
        matchSources(a, list) {
            const own = this.effective(a, 'source');
            if (!own || !a.pdm.sourceId || list.some((x) => x.id === a.pdm.sourceId)) return list;
            return [{ ...own, id: a.pdm.sourceId }, ...list.filter((x) => x.shortName !== own.shortName)];
        },

        effective(a, side) {
            const snap = a.pdm[side];
            if (!snap) return null;
            const data = U.clone(snap.data);
            Object.entries(D.manual(a, side)).forEach(([path, value]) => { if (!empty(value)) setPath(data, path, value); });
            if (data.financial && empty(data.financial.revenueTags) && Array.isArray(data.financial.revenueStreams)) {
                const text = data.financial.revenueStreams.join(' ');
                data.financial.revenueTags = REVENUE_TAGS.filter(([, re]) => re.test(text)).map(([t]) => t);
            }
            return data;
        },

        isManual(a, side, path) { return !empty(D.manual(a, side)[path]); },

        /* Required fields the PDM record does not hold, grouped; investment performance first. */
        missing(a) {
            const out = [];
            ['site', 'source'].forEach((side) => {
                const snap = a.pdm[side];
                if (!snap) return;
                (M.requiredData[side] || []).forEach(([group, paths]) => {
                    paths.forEach((path) => {
                        if (!empty(U.get(snap.data, path))) return;
                        out.push({
                            side, group, path, label: M.fieldLabel(path), unit: M.fieldUnit(path), spec: M.fieldSpec(path),
                            project: snap.data.shortName,
                            metrics: M.allMetrics().filter((m) => m.pdmFields.includes(path)).map((m) => m.id),
                            value: D.manual(a, side)[path], filled: D.isManual(a, side, path)
                        });
                    });
                });
            });
            return out;
        },

        parse(spec, raw) {
            if (raw === null || raw === undefined) return null;
            const s = String(raw).trim();
            if (s === '') return null;
            if (spec.type === 'number' || spec.numeric) { const n = Number(s.replace(',', '.')); return isNaN(n) ? null : n; }
            if (spec.type === 'bool') return s === 'true';
            if (spec.type === 'list') return s.split(',').map((x) => x.trim()).filter(Boolean);
            return s;
        },

        setManual(a, side, path, value) {
            a.pdm.manual = a.pdm.manual || { source: {}, site: {} };
            a.pdm.manual[side] = a.pdm.manual[side] || {};
            const before = a.pdm.manual[side][path];
            if (empty(value)) delete a.pdm.manual[side][path];
            else a.pdm.manual[side][path] = value;
            return before;
        },

        display(v) {
            if (empty(v)) return '';
            if (Array.isArray(v)) return v.join(', ');
            if (typeof v === 'boolean') return v ? 'true' : 'false';
            return String(v);
        }
    };

    RSA.Data = D;
})(window.RSA);
