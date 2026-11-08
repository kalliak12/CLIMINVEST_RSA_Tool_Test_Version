/*
 * Find project facts in any spreadsheet (council files, budgets, fact sheets…).
 * Rule-based: looks for a label cell that matches a known field and takes the value next to it
 * (to the right, or below). Every suggestion is shown to the user for confirmation before it is saved.
 * Replaceable later by an AI extractor that returns the same candidate format.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const M = RSA.Methodology;

    /*
     * key: internal id · paths: field per side (null = not used on that side) · re: label pattern · not: exclusions
     * kind: number | pct | text | list | bool | select · bonus: label words that make a candidate stronger
     */
    const FIELDS = [
        { key: 'name', paths: { site: '_name', source: '_name' }, re: /^(project (title|name)|title of (the )?project|name of (the )?project)\b/, kind: 'text' },
        { key: 'reference', paths: { site: null, source: '_name' }, re: /^(reference|source|original|replicated|benchmark) project\b/, kind: 'text', forceSide: 'source' },
        { key: 'location', paths: { site: '_location', source: '_location' }, re: /^(location|city|country|municipality|region)\b/, kind: 'text' },
        { key: 'capex', paths: { site: 'financial.expectedCapexEur', source: 'financial.capexEur' }, re: /(capex|capital (cost|expenditure)|investment cost|total (project )?(cost|budget|investment)|estimated budget|project budget|pilot budget|total budget)/, not: /(per |\/ ?m|opex|annual|per year|maintenance|vat$|^vat|subtotal|share)/, kind: 'number', bonus: /(total|incl)/ },
        { key: 'opex', paths: { site: 'financial.expectedOpexEurYr', source: 'financial.opexEurYr' }, re: /(opex|operating cost|operational cost|o&m cost|running cost|maintenance cost|annual operating)/, not: /(per (school|unit|site|m)|share)/, kind: 'number', bonus: /total/ },
        { key: 'irr', paths: { site: 'financial.projectedIrrPct', source: 'financial.irrPct' }, re: /(\birr\b|internal rate of return)/, not: /(economic|social|eirr)/, kind: 'pct', bonus: /financial/ },
        { key: 'npvRetention', paths: { site: 'financial.projectedNpvRetentionPct', source: null }, re: /(npv|net present value).*(retain|retention|vs\.? source|compared)|(retain|retention).*(npv|net present value)/, kind: 'pct', forceSide: 'site' },
        { key: 'npv', paths: { site: null, source: 'financial.npvEur' }, re: /(\bnpv\b|net present value)/, not: /(economic|social|enpv|retain|retention|vs\.? source)/, kind: 'number', bonus: /financial/ },
        { key: 'payback', paths: { site: 'financial.projectedPaybackYrs', source: 'financial.paybackYrs' }, re: /pay ?-?back/, not: /acceptable/, kind: 'number', bonus: /simple|financial/ },
        { key: 'grantShare', paths: { site: 'financial.grantSharePct', source: 'financial.grantSharePct' }, re: /(grant share|share of grant|subsidy (share|rate)|non.?repayable|co.?financing rate|grant rate)/, kind: 'pct' },
        { key: 'elecPrice', paths: { site: 'financial.electricityPriceEurMwh', source: 'financial.tariffEurMwh' }, re: /(electricity (price|tariff)|energy (price|tariff)|power price|feed.?in tariff)/, kind: 'number' },
        { key: 'costIndex', paths: { site: 'financial.costIndex', source: 'financial.costIndex' }, re: /(cost index|price level index)/, kind: 'number' },
        { key: 'financing', paths: { site: null, source: 'financial.financingStructure' }, re: /^(financing structure|funding( structure| mix| sources?)?|financing)$/, kind: 'text' },
        { key: 'revenue', paths: { site: 'financial.revenueStreams', source: 'financial.revenueStreams' }, re: /(revenue (model|streams?)|business model|income streams?)/, kind: 'list' },
        { key: 'koppen', paths: { site: 'climate.koppen', source: 'climate.koppen' }, re: /(k[oö]ppen|climate (classification|zone|type)|^climate$)/, kind: 'koppen' },
        { key: 'temp', paths: { site: 'climate.avgTempC', source: 'climate.avgTempC' }, re: /(mean|average) annual (air )?temp|annual mean temp/, kind: 'number' },
        { key: 'precip', paths: { site: 'climate.precipMm', source: 'climate.precipMm' }, re: /(annual )?(precipitation|rainfall)/, not: /(intens|days|event)/, kind: 'number' },
        { key: 'irradiance', paths: { site: 'climate.irradianceKwhM2', source: 'climate.irradianceKwhM2' }, re: /(irradiance|irradiation|solar (resource|radiation)|\bghi\b)/, kind: 'number' },
        { key: 'wind', paths: { site: 'climate.windMs', source: 'climate.windMs' }, re: /wind speed/, kind: 'number' },
        { key: 'hazards', paths: { site: 'climate.hazards', source: 'climate.hazards' }, re: /((main )?(climate )?hazards?( addressed)?|climate risks?)$/, kind: 'list' },
        { key: 'techFamily', paths: { site: null, source: 'technical.technologyFamily' }, re: /^(technology( family| type)?|type of (technology|action|measure|intervention)|solution type|intervention type)$/, kind: 'text' },
        { key: 'trl', paths: { site: null, source: 'technical.trl' }, re: /(\btrl\b|technology readiness)/, kind: 'number' },
        { key: 'years', paths: { site: null, source: 'technical.yearsOperational' }, re: /(years (in )?operation|years operational)/, kind: 'number' },
        { key: 'sites', paths: { site: null, source: 'technical.sitesDeployed' }, re: /(number of (sites|schools|installations|units|locations)|sites deployed)/, kind: 'number' },
        { key: 'capacity', paths: { site: 'technical.plannedCapacityKwp', source: 'technical.capacityKwp' }, re: /(installed|planned)? ?capacity.*kwp|kwp/, kind: 'number' },
        { key: 'measures', paths: { site: 'technical.infrastructure', source: 'technical.infrastructure' }, re: /^(measures|scope( \(.*\))?|interventions|existing infrastructure|infrastructure)$/, kind: 'text' },
        { key: 'constraints', paths: { site: 'technical.constraints', source: 'technical.constraints' }, re: /^(known )?(constraints|limitations|barriers)$/, kind: 'text' },
        { key: 'om', paths: { site: 'technical.omCapacity', source: 'technical.omCapacity' }, re: /^(operation|o&m|operation (and|&) maintenance|maintenance arrangements?)$/, kind: 'text' },
        { key: 'ghg', paths: { site: 'esg.ghgReductionTco2Yr', source: 'esg.ghgReductionTco2Yr' }, re: /(ghg|co2|co₂|emissions?) (reduction|savings?|avoided)|carbon (reduction|savings)/, kind: 'number' },
        { key: 'water', paths: { site: 'esg.waterSavedM3Yr', source: 'esg.waterSavedM3Yr' }, re: /water (saved|savings)/, kind: 'number' },
        { key: 'beneficiaries', paths: { site: 'esg.beneficiaries', source: 'esg.beneficiaries' }, re: /(beneficiar|people (served|reached)|direct users)/, kind: 'number' },
        { key: 'population', paths: { site: 'esg.beneficiaries', source: 'esg.beneficiaries' }, re: /^population\b/, kind: 'number', weak: true },
        { key: 'vulnerable', paths: { site: 'esg.vulnerableSharePct', source: 'esg.vulnerableSharePct' }, re: /(vulnerable|low.?income|energy.?poor).*(share|%|percent)|(share|%|percent).*(vulnerable|low.?income)/, kind: 'pct' },
        { key: 'dnsh', paths: { site: 'esg.dnshStatus', source: 'esg.dnshStatus' }, re: /(dnsh|do no significant harm)/, kind: 'select' },
        { key: 'taxonomy', paths: { site: 'esg.taxonomyAligned', source: 'esg.taxonomyAligned' }, re: /taxonomy/, kind: 'bool' },
        { key: 'organisation', paths: { site: 'institutional.organisation', source: 'institutional.organisation' }, re: /^(lead (department|organi[sz]ation|partner)|owner( \/ promoter)?|promoter|implementing (body|organi[sz]ation)|organi[sz]ation)$/, kind: 'text' },
        { key: 'maturity', paths: { site: 'institutional.maturityLevel', source: 'institutional.maturityLevel' }, re: /maturity (level)?/, kind: 'select' },
        { key: 'similar', paths: { site: 'institutional.similarProjects', source: 'institutional.similarProjects' }, re: /(similar|comparable) projects/, kind: 'number' },
        { key: 'euFunds', paths: { site: 'institutional.euFundingExperience', source: 'institutional.euFundingExperience' }, re: /(experience with (eu|european)|eu.?fund(ed|ing)? (projects|experience)|structural funds experience)/, kind: 'bool' },
        { key: 'audit', paths: { site: 'institutional.auditOpinion', source: 'institutional.auditOpinion' }, re: /(last |latest )?(external )?audit/, kind: 'select' },
        { key: 'governance', paths: { site: 'institutional.governanceNote', source: 'institutional.governanceNote' }, re: /^governance/, kind: 'text' }
    ];

    // Words that mark a sheet or file as describing the proven (source) project. "vs source" inside a label does not count.
    const SOURCE_HINT = /\b(reference|source|original|benchmark) (project|case|site)\b|case study|good practice|replicated from|fact ?sheet/i;
    const SITE_HINT = /\b(replication|target|new|candidate|replicat(or|ing)) (site|project|location)\b|\breplicator\b/i;
    const has = (text, name) => !!name && name.length >= 3 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

    const norm = (s) => String(s || '').toLowerCase().replace(/[–—]/g, '-').replace(/[:*]+$/, '').replace(/\s+/g, ' ').trim();

    const parseNumber = (raw) => {
        if (typeof raw === 'number') return raw;
        let s = String(raw || '').trim();
        const range = /(-?[\d.,]+)\s*[-–]\s*(-?[\d.,]+)/.exec(s);
        if (range) { const a = parseNumber(range[1]); const b = parseNumber(range[2]); return a !== null && b !== null ? (a + b) / 2 : null; }
        const mult = /\b(m|mn|million)\b/i.test(s) ? 1e6 : /\b(k|thousand)\b/i.test(s) ? 1e3 : 1;
        const m = /-?[\d][\d.,\s]*/.exec(s);
        if (!m) return null;
        s = m[0].replace(/\s/g, '');
        if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
        else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
        else s = s.replace(',', '.');
        const n = parseFloat(s);
        return Number.isFinite(n) ? n * mult : null;
    };

    const selectMatch = (path, text) => {
        const spec = M.fieldSpec(path); const t = norm(text);
        if (!spec.options) return null;
        if (path === 'institutional.auditOpinion') {
            if (/adverse/.test(t)) return 'Adverse';
            if (/\bqualified\b/.test(t) && !/unqualified/.test(t)) return 'Qualified';
            if (/(no material|unqualified|clean)/.test(t)) return /(recommendation|finding|minor)/.test(t) ? 'Unqualified with findings' : 'Unqualified';
            return null;
        }
        if (path === 'institutional.maturityLevel') { const n = parseNumber(t); return n >= 1 && n <= 5 ? String(Math.round(n)) : null; }
        return spec.options.find((o) => t.includes(norm(o)) || norm(o).startsWith(t)) || null;
    };

    /* Convert a raw cell into the field's value. Returns null when the cell does not fit. */
    function convert(f, path, cell, label) {
        const raw = cell.v; const text = cell.w !== undefined ? String(cell.w) : String(raw);
        if (raw === null || raw === undefined || String(raw).trim() === '') return null;
        if (f.kind === 'number' || f.kind === 'pct') {
            let n = parseNumber(raw);
            if (n === null) return null;
            if (f.kind === 'pct') {
                const isPctFormat = /%/.test(cell.z || '') || /%/.test(text);
                if (isPctFormat && typeof raw === 'number' && Math.abs(raw) <= 1.5) n = raw * 100;
                else if (!isPctFormat && Math.abs(n) <= 1 && /(share|rate|%|percent|irr|retain|retention)/.test(label)) n *= 100;
                n = Math.round(n * 10) / 10;
            }
            if (path === 'financial.electricityPriceEurMwh' || path === 'financial.tariffEurMwh') { if (n < 2 || /kwh/.test(label + text.toLowerCase())) n *= 1000; }
            return Math.round(n * 100) / 100;
        }
        if (typeof raw === 'number' && f.kind !== 'select' && f.kind !== 'bool') return null; // text field but number found
        if (f.kind === 'bool') { const t = norm(text); if (/^(yes|true|y|several|some)\b/.test(t)) return true; if (/^(no|false|none|n)\b/.test(t)) return false; return null; }
        if (f.kind === 'select') return selectMatch(path, text);
        if (f.kind === 'list') return text.split(/[;,\n]|\s\/\s/).map((x) => x.trim()).filter((x) => x && x.length < 80).slice(0, 8);
        if (f.kind === 'koppen') { const m = /\b([ABCDE][a-z]{1,2})\b/.exec(text); return m ? m[1] : null; }
        return text.trim().slice(0, 400);
    }

    /* Every project field can also be found by its exact label as the tool shows it (e.g. "Largest budget managed"),
       so a simple two-column table "Field | Value" always works. Added once, after the hand-written rules. */
    let labelsAdded = false;
    function addExactLabels() {
        if (labelsAdded || !RSA.ExcelProjects || !RSA.ExcelProjects.fields) return;
        labelsAdded = true;
        const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        RSA.ExcelProjects.fields().forEach((fd) => {
            if (!/\./.test(fd.key)) return; // general fields (name, country…) are not project values to fill
            const label = norm(fd.label);
            if (FIELDS.some((f) => (f.paths.site === fd.key || f.paths.source === fd.key) && f.re.test(label))) return;
            const kind = fd.kind === 'pct' || fd.kind === 'number' || fd.kind === 'bool' || fd.kind === 'select' || fd.kind === 'list' ? fd.kind : 'text';
            FIELDS.push({ key: `label:${fd.key}`, paths: { site: fd.key, source: fd.key }, re: new RegExp(`^${esc(label)}( \\(.*\\))?$`), kind, bonus: /./ });
        });
    }

    /* All candidate values in a workbook, per side and field. */
    function extract(book, opts = {}) {
        addExactLabels();
        const { XLSX, wb } = book;
        const sheets = [];
        const found = [];
        wb.SheetNames.forEach((name, si) => {
            const ws = wb.Sheets[name];
            if (!ws || !ws['!ref']) return;
            const range = XLSX.utils.decode_range(ws['!ref']);
            const cellAt = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
            const head = [name];
            for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 3); r += 1) for (let c = range.s.c; c <= Math.min(range.e.c, 3); c += 1) { const x = cellAt(r, c); if (x && typeof x.v === 'string') head.push(x.v); }
            // Which project does this sheet describe? Project names in the sheet or file name win, then heading words; default: replication site.
            const text = `${opts.fileName || ''} ${head.join(' ')}`;
            const guess = has(text, opts.siteName) && !has(text, opts.sourceName) ? 'site'
                : has(text, opts.sourceName) && !has(text, opts.siteName) ? 'source'
                : SITE_HINT.test(text) ? 'site' : SOURCE_HINT.test(text) ? 'source' : 'site';
            sheets.push({ name, side: guess });
            for (let r = range.s.r; r <= range.e.r; r += 1) {
                for (let c = range.s.c; c <= range.e.c; c += 1) {
                    const lc = cellAt(r, c);
                    if (!lc || typeof lc.v !== 'string') continue;
                    const label = norm(lc.v);
                    if (label.length < 2 || label.length > 90) continue;
                    FIELDS.forEach((f, fi) => {
                        if (!f.re.test(label) || (f.not && f.not.test(label))) return;
                        const path = f.paths[f.forceSide || guess] || f.paths.site || f.paths.source;
                        // value: first non-empty cell to the right (skip short unit cells), else the cell below
                        let vc = null; let addr = null;
                        for (let k = c + 1; k <= Math.min(range.e.c, c + 8); k += 1) {
                            const x = cellAt(r, k);
                            if (!x || x.v === null || x.v === undefined || String(x.v).trim() === '') continue;
                            if (typeof x.v === 'string' && x.v.trim().length <= 12 && (f.kind === 'number' || f.kind === 'pct') && parseNumber(x.v) === null) continue;
                            vc = x; addr = XLSX.utils.encode_cell({ r, c: k }); break;
                        }
                        if (!vc) { const x = cellAt(r + 1, c); if (x && x.v !== undefined && typeof x.v !== 'string') { vc = x; addr = XLSX.utils.encode_cell({ r: r + 1, c }); } }
                        if (!vc) return;
                        const value = convert(f, path, vc, label);
                        if (value === null || (Array.isArray(value) && !value.length)) return;
                        let score = 10 - fi * 0.01 - (f.weak ? 5 : 0) - label.length / 100;
                        if (f.bonus && f.bonus.test(label)) score += 3;
                        if (f.penalty && f.penalty.test(label)) score -= 4;
                        if (f.kind === 'number' && typeof vc.v !== 'number') score -= 1;
                        found.push({ fi, key: f.key, weak: !!f.weak, value, sheet: name, sheetIndex: si, cell: addr, label: lc.v.trim(), score });
                    });
                }
            }
        });
        return { sheets, found };
    }

    /* Best candidate per side + field, given which project each sheet describes ({sheet: 'site'|'source'|'ignore'}). */
    function group(found, sheetSides) {
        const groups = {};
        found.forEach((x) => {
            const f = FIELDS[x.fi];
            const side = f.forceSide || sheetSides[x.sheet];
            if (!side || side === 'ignore' || sheetSides[x.sheet] === 'ignore') return;
            const path = f.paths[side];
            if (!path) return;
            const k = `${side}|${path}`;
            (groups[k] = groups[k] || []).push({ ...x, side, path });
        });
        return Object.values(groups).map((list) => {
            list.sort((a, b) => b.score - a.score);
            const seen = new Set();
            const alts = list.filter((x) => { const k = JSON.stringify(x.value); if (seen.has(k)) return false; seen.add(k); return true; });
            return { ...alts[0], alternatives: alts.slice(1, 6) };
        });
    }

    RSA.DataExtract = { extract, group, FIELDS, parseNumber };
})(window.RSA);
