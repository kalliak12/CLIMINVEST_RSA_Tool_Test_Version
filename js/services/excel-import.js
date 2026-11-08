/*
 * Import a filled "RSA Scoring Toolkit" Excel workbook as a new assessment.
 * Reads: Dashboard (project identification), D1–D5 (scores, confidence, evidence basis),
 * Evidence Log, Risk Register, Final Report texts, the Action Plan and the "Source project" /
 * "Replication site" project-data sheets (see excel-projects.js). Builds a report of what was not read.
 * Other sheets (Response Matrix, Financial Check, Sensitivity Analysis…) are kept as
 * searchable reference documents in the Evidence log.
 * Uses SheetJS (js/vendor/xlsx.full.min.js), loaded only when an Excel file is imported.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;

    let libPromise = null;
    const loadLib = () => {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        if (!libPromise) {
            libPromise = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'js/vendor/xlsx.full.min.js';
                s.onload = () => resolve(window.XLSX);
                s.onerror = () => { libPromise = null; reject(new Error('Could not load the Excel reader (js/vendor/xlsx.full.min.js).')); };
                document.head.appendChild(s);
            });
        }
        return libPromise;
    };

    const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
    const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(str(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
    const level = (v) => { const s = str(v).toLowerCase(); if (!s) return ''; if (/^v/.test(s)) return '100'; if (/^h/.test(s)) return '75'; if (/^(m|mod)/.test(s)) return '50'; if (/^l/.test(s)) return '25'; return ''; };
    const hml = (v) => ({ h: 'High', m: 'Medium', l: 'Low' })[str(v).toLowerCase().charAt(0)] || 'Medium';

    const rowsOf = (XLSX, ws) => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const findSheet = (wb, re) => wb.SheetNames.find((n) => re.test(n));
    const headerRow = (rows, re) => rows.findIndex((r) => r.some((c) => re.test(str(c))));
    const colOf = (row, re) => row.findIndex((c) => re.test(str(c)));

    function parseDashboard(rows) {
        const val = (re) => { const r = rows.find((x) => re.test(str(x[0]))); return r ? str(r[1]) : ''; };
        return {
            source: val(/^original project/i), site: val(/^replication site/i), adaptationType: val(/^adaptation type/i),
            date: val(/^assessment date/i), assessedBy: val(/^assessed by/i), organisation: val(/^organi[sz]ation/i),
            rss: num(val(/^calculated rss/i)), band: val(/^decision band/i),
            weights: (() => {
                const w = {};
                rows.forEach((r) => { const m = /^(D[1-5])\s*:/.exec(str(r[0])); const n = num(r[2]); if (m && n !== null) w[m[1]] = n <= 1 ? Math.round(n * 1000) / 10 : n; });
                return Object.keys(w).length === 5 && Math.round(Object.values(w).reduce((x, y) => x + y, 0)) === 100 ? w : null;
            })()
        };
    }

    function parseDimension(rows) {
        const h = headerRow(rows, /^metric$/i);
        if (h < 0) return [];
        const head = rows[h];
        const cScore = colOf(head, /^score/i); const cConf = colOf(head, /^confidence/i); const cEv = colOf(head, /^evidence/i);
        const cDesc = colOf(head, /^description/i); const cCrit = colOf(head, /criteria/i);
        const cAss = colOf(head, /^assessor/i); const cStat = colOf(head, /^status/i); const cAgreed = colOf(head, /agreed|final score|reviewer score/i); const cRev = colOf(head, /review(er)? comment|^review$/i);
        return rows.slice(h + 1).map((r) => {
            const m = /^(\d\.\d)\s*(.*)$/.exec(str(r[0]));
            if (!m) return null;
            const g = sameGuide(m[1], cDesc >= 0 ? r[cDesc] : '', cCrit >= 0 ? r[cCrit] : '');
            const criteriaNote = [!g.desc && `Workbook description: ${str(r[cDesc])}`, !g.crit && `Workbook scoring criteria: ${str(r[cCrit])}`].filter(Boolean).join('\n');
            return { id: m[1], score: cScore >= 0 ? num(r[cScore]) : null, confidence: cConf >= 0 ? level(r[cConf]) : '', evidence: cEv >= 0 ? str(r[cEv]) : '', criteriaNote,
                assessor: cAss >= 0 ? str(r[cAss]) : '', status: cStat >= 0 ? str(r[cStat]) : '', agreed: cAgreed >= 0 ? num(r[cAgreed]) : null, review: cRev >= 0 ? str(r[cRev]) : '' };
        }).filter(Boolean);
    }

    /* "Team" sheet: Name | Role | Organisation | Expertise | Dimensions. */
    const ROLE = (v) => { const t = str(v).toLowerCase(); return /lead/.test(t) ? 'lead' : /review|validat/.test(t) ? 'reviewer' : /expert/.test(t) ? 'expert' : 'assessor'; };
    function parseTeam(rows) {
        const h = rows.findIndex((r) => r.some((c) => /^name$/i.test(str(c))) && r.some((c) => /^role$/i.test(str(c))));
        if (h < 0) return [];
        const head = rows[h];
        const c = { n: colOf(head, /^name$/i), r: colOf(head, /^role$/i), o: colOf(head, /organi/i), e: colOf(head, /expertise|area/i), d: colOf(head, /dimension/i), m: colOf(head, /e-?mail/i) };
        return rows.slice(h + 1).filter((r) => str(r[c.n])).map((r) => ({
            name: str(r[c.n]), role: ROLE(r[c.r]), organisation: c.o >= 0 ? str(r[c.o]) : '', expertise: c.e >= 0 ? str(r[c.e]) : '', email: c.m >= 0 ? str(r[c.m]) : '',
            dimensions: c.d >= 0 ? (str(r[c.d]).match(/D[1-5]/gi) || []).map((x) => x.toUpperCase()) : []
        }));
    }

    /* "Screening" sheet: # | Question | Answer (Yes / Uncertain / No) | Note, then "Confirmed by". */
    function parseScreening(rows) {
        const h = rows.findIndex((r) => r.some((c) => /^question$/i.test(str(c))) && r.some((c) => /^answer$/i.test(str(c))));
        if (h < 0) return null;
        const head = rows[h]; const cq = colOf(head, /^#$/); const ca = colOf(head, /^answer$/i); const cn = colOf(head, /^note/i);
        const answers = M.screeningQuestions.map(() => ({ value: '', note: '' }));
        let found = 0;
        rows.slice(h + 1).forEach((r) => {
            const i = M.screeningQuestions.findIndex((q) => q.id === str(r[cq]).toUpperCase());
            if (i < 0) return;
            const v = str(r[ca]).toLowerCase();
            answers[i] = { value: /^y/.test(v) ? 'yes' : /^n/.test(v) ? 'no' : /^u/.test(v) ? 'uncertain' : '', note: cn >= 0 ? str(r[cn]) : '' };
            found += 1;
        });
        const conf = rows.find((r) => /^confirmed by/i.test(str(r[0])));
        return { answers, found, confirmedBy: conf ? str(conf[1]) : '' };
    }

    function parseTable(rows, headRe) {
        const h = headerRow(rows, headRe);
        if (h < 0) return { head: [], body: [] };
        return { head: rows[h].map(str), body: rows.slice(h + 1).filter((r) => r.some((c) => str(c))) };
    }

    function parseFinalReport(rows) {
        const out = {}; let current = null;
        rows.forEach((r) => {
            const t = str(r[0]);
            if (!t) return;
            if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 60 && !/FINAL REPORT/.test(t)) { current = t; out[current] = ''; return; }
            if (current) out[current] = `${out[current]}\n${t}`.trim();
        });
        return out;
    }

    /* "Financial Check" sheet: the stakeholder-median case (the one the workbook uses for metric 3.3). */
    function parseFinancialCheck(rows) {
        const h = rows.findIndex((r) => /^case$/i.test(str(r[0])));
        const row = (re) => rows.find((r) => re.test(str(r[0])));
        const out = {};
        const savings = row(/annual savings/i); if (savings) out.savingsEurYr = num(savings[1]);
        const area = row(/conditioned area/i); if (area) out.areaM2 = num(area[1]);
        if (h >= 0) {
            const head = rows[h];
            const cCost = colOf(head, /^cost \(eur\)$/i); const cPay = colOf(head, /payback/i);
            const median = rows.slice(h + 1).find((r) => /median/i.test(str(r[0])));
            const pea = rows.slice(h + 1).find((r) => /pea/i.test(str(r[0])));
            if (median) { out.capexEur = num(median[cCost]); out.paybackYrs = num(median[cPay]); }
            if (pea) { out.peaCapexEur = num(pea[cCost]); out.peaPaybackYrs = num(pea[cPay]); }
        }
        return out;
    }

    /*
     * Project facts the workbook states clearly. Entered as team-added values (editable, sent with the results).
     * Judgement calls (e.g. supply-chain or skills ratings) are left for the team.
     */
    function workbookFacts(p) {
        const ev = Object.fromEntries(p.evidence.body.map((r) => [str(r[0]), str(r[2])]));
        const site = {}; const source = {}; const notes = [];
        const f = p.finance || {};
        if (f.capexEur) { site['financial.expectedCapexEur'] = Math.round(f.capexEur); notes.push(`Expected CAPEX €${Math.round(f.capexEur).toLocaleString('en')} = stakeholder median cost (Financial Check)${f.peaCapexEur ? `; PEA-reported cost is €${Math.round(f.peaCapexEur).toLocaleString('en')}` : ''}`); }
        if (f.paybackYrs) { site['financial.projectedPaybackYrs'] = Math.round(f.paybackYrs * 10) / 10; notes.push(`Projected payback ${site['financial.projectedPaybackYrs']} yrs at median cost, unsubsidised${f.peaPaybackYrs ? ` (${Math.round(f.peaPaybackYrs * 10) / 10} yrs at PEA cost)` : ''}`); }
        if (f.savingsEurYr) site['financial.revenueStreams'] = [`Energy bill savings (~€${Math.round(f.savingsEurYr).toLocaleString('en')}/yr for the PEA cohort)`];
        const hz = /Q1b[^:]*:\s*([^.]+)/i.exec(ev['1.3'] || '');
        if (hz) site['climate.hazards'] = hz[1].split(',').map((x) => x.replace(/\s*\d+\s*$/, '').trim()).filter(Boolean);
        const src = /focus:\s*([a-z /]+)/i.exec(ev['1.3'] || '');
        if (src) source['climate.hazards'] = src[1].split('/').map((x) => x.trim()).filter(Boolean);
        const vs = /median\s+(\d+)\s*-\s*(\d+)%/i.exec(ev['1.4'] || '');
        if (vs) { site['esg.vulnerableSharePct'] = (Number(vs[1]) + Number(vs[2])) / 2; notes.push(`Vulnerable share ${site['esg.vulnerableSharePct']}% = midpoint of the median ${vs[1]}–${vs[2]}% band (questionnaire)`); }
        if (/programme experience\s+"?some"?/i.test(ev['5.4'] || '')) site['institutional.euFundingExperience'] = true;
        if (/retrofit|renovation/i.test(p.info.adaptationType)) {
            site['technical.infrastructureTypes'] = ['residential buildings'];
            source['technical.technologyFamily'] = 'Building energy retrofit';
        }
        return { site, source, notes };
    }

    const sheetText = (XLSX, ws) => XLSX.utils.sheet_to_csv(ws, { blankrows: false }).split('\n').filter((l) => l.replace(/,/g, '').trim()).join('\n');

    const localSnapshot = (side, title, date) => {
        const name = title || (side === 'source' ? 'Source project' : 'Replication site');
        const shortName = name.split(/\s+-\s+replicator|\s+–\s+/i)[0].replace(/^CLIMINVEST\s+/i, '').trim();
        const id = `LOCAL-${side === 'source' ? 'SRC' : 'SITE'}-${U.slug(shortName).slice(0, 24).toUpperCase()}`;
        const data = {
            id, roles: [side], version: 1, lastUpdated: date, local: true,
            name, shortName, country: (/\(([^)]+)\)/.exec(name) || [])[1] || '', region: '', status: 'Imported from Excel — not in the project database',
            adaptationType: '', summary: 'Imported from an RSA Scoring Toolkit workbook. Only the project facts stated in the workbook were filled in; complete the rest under Projects or link the project database record.',
            owner: '', climate: {}, technical: {}, financial: {}, esg: {}, institutional: {}, documents: []
        };
        return { id, version: 1, lastUpdated: date, fetchedAt: U.nowIso(), local: true, data };
    };

    /* Read any spreadsheet (xlsx, xls, xlsm, ods, csv) into a SheetJS workbook. */
    async function read(file) {
        const XLSX = await loadLib();
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        return { XLSX, wb, fileName: file.name };
    }

    /* An RSA Scoring Toolkit workbook has a Dashboard sheet and D1–D5 sheets. */
    const dimSheetRe = (d) => new RegExp(`(^|\\W)${d}(\\W|$)`, 'i');
    const isToolkit = (wb) => !!findSheet(wb, /dashboard/i) && ['D1', 'D2', 'D3', 'D4', 'D5'].filter((d) => findSheet(wb, dimSheetRe(d))).length >= 3;

    /* Loose comparison of texts (ignores punctuation, dashes, case and joining words). */
    const loose = (t) => str(t).toLowerCase().replace(/[–—-]/g, ' ').replace(/\b(and|or|the|of)\b/g, ' ').replace(/specifications?/g, 'spec').replace(/specs?\b/g, 'spec').replace(/[^a-z0-9%<>±€]+/g, '');
    const criteriaOf = (cell) => str(cell).split(/\s*\|\s*|\n/).map((x) => /^(\d+)\s*:\s*(.*)$/.exec(x.trim())).filter(Boolean).map((m) => ({ score: Number(m[1]), text: m[2] }));
    function sameGuide(metricId, desc, crit) {
        const m = M.allMetrics().find((x) => x.id === metricId);
        if (!m) return { desc: true, crit: true };
        const words = (t) => str(t).toLowerCase().split(/[^a-z0-9%]+/).filter((w) => w.length > 2 && !['and', 'the'].includes(w));
        const dw = words(desc); const tw = new Set(words(m.description));
        const okDesc = !dw.length || dw.filter((w) => tw.has(w) || [...tw].some((t) => t.startsWith(w) || w.startsWith(t))).length / dw.length >= 0.8;
        const xs = criteriaOf(crit);
        const okCrit = !xs.length || (xs.length === m.criteria.length && xs.every((c, i) => c.score === m.criteria[i].score && (loose(c.text) === loose(m.criteria[i].text) || loose(c.text).includes(loose(m.criteria[i].text).replace(/^within/, '')) || loose(m.criteria[i].text).includes(loose(c.text)))));
        return { desc: okDesc, crit: okCrit, criteria: xs };
    }

    /* Dashboard extras: evidence-confidence summary and respondents. */
    function parseDashboardExtras(rows) {
        const val = (re) => { const r = rows.find((x) => re.test(str(x[0]))); return r ? num(r[1]) : null; };
        return {
            high: val(/high confidence/i), medium: val(/medium confidence/i), low: val(/low confidence \(of/i), shareLow: val(/share at low/i),
            above: val(/points above/i), below: val(/points below/i), respondents: val(/respondents/i),
            dimScores: Object.fromEntries(rows.map((r) => [/^(D[1-5])\s*:/.exec(str(r[0])), num(r[1])]).filter(([m, v]) => m && v !== null).map(([m, v]) => [m[1], v]))
        };
    }

    /* "Sensitivity Analysis" sheet: metric-level scenarios (Sx score columns) and the guide tests table. */
    function parseSensitivity(rows) {
        const h = rows.findIndex((r) => /^metric$/i.test(str(r[0])) && r.some((c) => /^base$/i.test(str(c))));
        if (h < 0) return null;
        const head = rows[h].map(str);
        const cols = head.map((t, i) => ({ i, m: /^(.+?)\s+score$/i.exec(t) })).filter((x) => x.m);
        const intro = rows.slice(0, h).map((r) => str(r[0])).filter(Boolean).filter((t, i) => !(i === 0 && /^[A-Z][A-Z &/-]{8,}/.test(t))).join(' ');
        const labelOf = (id) => { const m = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s+([^;.]+)`, 'i').exec(intro); return m ? m[1].trim() : ''; };
        const scenarios = cols.map(({ i, m }) => ({ id: m[1], label: labelOf(m[1]), column: i, scores: {}, workbookRss: null }));
        rows.slice(h + 1).forEach((r) => {
            const id = str(r[0]);
            if (!/^\d\.\d$/.test(id)) return;
            scenarios.forEach((sc) => { const v = num(r[sc.column]); if (v !== null) sc.scores[id] = v; });
        });
        const rssRow = rows.find((r) => /^rss$/i.test(str(r[0])));
        const dimHead = rows.find((r) => /^dimension$/i.test(str(r[0])) && r.some((c) => /^base$/i.test(str(c))));
        if (rssRow && dimHead) scenarios.forEach((sc) => { const c = dimHead.map(str).findIndex((t) => t === sc.id); if (c >= 0) sc.workbookRss = num(rssRow[c]); });
        const th = rows.findIndex((r) => /^test$/i.test(str(r[0])));
        const tests = th < 0 ? [] : rows.slice(th + 1).filter((r) => /^T\d+/i.test(str(r[0]))).map((r) => ({ id: str(r[0]), description: str(r[1]), workbookRss: num(r[2]), workbookChange: num(r[3]) }));
        scenarios.forEach((sc) => delete sc.column);
        return { intro, scenarios, tests };
    }

    /* What was read from each sheet, and what was not (shown to the user after the import). */
    const RISK_LEVEL = /^(h|m|l|high|medium|med|moderate|low)$/i;
    const DECISION_LABELS = /^(original project|replication site|adaptation type|assessment date|assessed by|organi[sz]ation|calculated rss|decision band)/i;
    const REPORT_FIELDS = [/executive/i, /dimensional/i, /success/i, /roadmap/i, /capacity/i, /financial/i, /next steps/i, /risks/i, /recommendation/i, /^conditions/i, /^rationale/i];
    function buildReport(wb, sh, p) {
        const sections = []; const warnings = [];
        const short = (v, n = 70) => { const t = str(v).replace(/\s+/g, ' '); return t.length > n ? `${t.slice(0, n)}…` : t; };
        const add = (sheet, status, summary, notRead = []) => sections.push({ sheet, status, summary, notRead });

        if (sh.scrSheet) add(sh.scrSheet.name, p.screening && p.screening.found ? 'read' : 'skipped', p.screening && p.screening.found ? `${p.screening.answers.filter((x) => x.value).length} of ${M.screeningQuestions.length} screening answers${p.screening.confirmedBy ? `, confirmed by ${p.screening.confirmedBy}` : ''}.` : 'No Question / Answer table found.');
        if (sh.teamSheet) add(sh.teamSheet.name, (p.team || []).length ? 'read' : 'none', (p.team || []).length ? `${p.team.length} team members with roles (${[...new Set(p.team.map((t) => t.role))].join(', ')}) — Team page.` : 'Empty: no team members yet. The tool adds a placeholder Lead assessor you can rename on the Team page.');
        else if (sh.dims.length) warnings.push('No "Team" sheet: one lead assessor is created and all metrics are assigned to them. Add the team on the Team page.');
        if (sh.startSheet) add(sh.startSheet, 'none', 'Instructions for filling in the workbook — no data to import.');

        // Dashboard
        const dashNot = [];
        sh.dash.rows.forEach((r) => {
            const label = str(r[0]).replace(/:\s*$/, ''); const rest = r.slice(1).map(str).filter(Boolean);
            if (!label || !rest.length) return;
            if (/^weights? total/i.test(label)) return;
            if (/confidence|share at low|points (above|below)|respondents/i.test(label)) return; // read: evidence-confidence summary
            if (DECISION_LABELS.test(label) || /^D[1-5]\s*:/.test(label) || /^\d+\s*-\s*\d+$/.test(label) || /^dimension$/i.test(label)) return;
            dashNot.push(`${short(label, 50)}: ${short(rest.join(' · '), 50)}`);
        });
        const ex = p.dashExtras || {};
        const wbDims = ex.dimScores || {};
        const mismatch = M.dimensions.filter((d) => {
            const vals = p.metrics.filter((m) => m.id.startsWith(d.id.slice(1) + '.') && m.score !== null).map((m) => (m.agreed !== null && m.agreed !== undefined ? m.agreed : m.score));
            return wbDims[d.id] !== undefined && vals.length && Math.abs(U.avg(vals) - wbDims[d.id]) > 0.05;
        });
        mismatch.forEach((d) => dashNot.push(`${d.id}: the Dashboard score (${wbDims[d.id]}) is not the average of its metric scores (agreed scores where given) — the tool uses the metric scores`));
        const conf = ex.high !== null && ex.high !== undefined ? ` Evidence-confidence summary (${ex.high} High / ${ex.medium} Medium / ${ex.low} Low${ex.respondents ? `, ${ex.respondents} respondents` : ''}) copied to the assessment notes and checked against the tool's own count.` : '';
        if (!p.info.weights) warnings.push('Dimension weights were not found in the Dashboard (or do not add up to 100%): the standard weights are used.');
        if (!p.info.source || !p.info.site) warnings.push('The Dashboard does not name the original project and/or the replication site.');
        add(sh.dash.name, dashNot.length ? 'partly' : 'read', `Project names, adaptation type, date, assessed by, organisation${p.info.weights ? ', dimension weights' : ''}. Dimension scores${mismatch.length ? '' : ' match the metric scores'}; the workbook RSS${p.info.rss !== null ? ` (${p.info.rss.toFixed(2)})` : ''}, decision band and band table are compared with the tool's own calculation (same bands).${conf}`, dashNot);

        // D1–D5 (metrics without a score are still to do, not a reading problem)
        const scoredIds = new Set();
        sh.dims.forEach((d, i) => {
            const dim = M.dimensions[i];
            const rows = parseDimension(d.rows);
            const found = new Set(rows.map((x) => x.id));
            const not = []; const todo = [];
            const h0 = headerRow(d.rows, /^metric$/i); const cDesc = colOf(d.rows[h0] || [], /^description/i); const cCrit = colOf(d.rows[h0] || [], /criteria/i);
            d.rows.slice(h0 + 1).forEach((r) => {
                const mm = /^(\d\.\d)/.exec(str(r[0])); if (!mm) return;
                const g = sameGuide(mm[1], cDesc >= 0 ? r[cDesc] : '', cCrit >= 0 ? r[cCrit] : '');
                if (!g.crit) not.push(`${mm[1]}: the scoring criteria differ from the tool's scoring guide — the workbook's criteria are kept with the metric's notes`);
                if (!g.desc) not.push(`${mm[1]}: the description differs from the tool's — kept with the metric's notes`);
            });
            if (dim) dim.metrics.filter((m) => !found.has(m.id)).forEach((m) => not.push(`Metric ${m.id} not found in this sheet`));
            rows.forEach((x) => {
                if (x.score === null) todo.push(x.id); else scoredIds.add(x.id);
                const raw = (() => { const h = headerRow(d.rows, /^metric$/i); const c = colOf(d.rows[h], /^confidence/i); const row = d.rows.find((r) => str(r[0]).startsWith(x.id)); return c >= 0 && row ? str(row[c]) : ''; })();
                if (raw && !x.confidence) not.push(`${x.id}: confidence "${short(raw, 20)}" not recognised (use High / Medium / Low)`);
            });
            const withStatus = rows.filter((x) => x.status).length; const withReview = rows.filter((x) => x.agreed !== null || x.review).length;
            const nScored = rows.filter((x) => x.score !== null).length;
            const todoText = todo.length ? ` ${todo.length === rows.length ? 'Not scored yet' : `Not scored yet: ${todo.join(', ')}`} - to do in the tool.` : '';
            if (!nScored && !not.length) { add(d.name, 'none', `Empty: the ${rows.length} metrics are still to be scored (in the tool or in this sheet).`, []); return; }
            add(d.name, not.length ? 'partly' : 'read', `${nScored} metric scores with confidence and evidence basis${withStatus ? `, assessor and status (${rows.map((x) => x.status).filter(Boolean).join(', ')})` : ' (imported as Draft)'}${withReview ? `, ${withReview} review${withReview > 1 ? 's' : ''} (agreed score / comment)` : ''}. Descriptions and scoring criteria checked against the tool's scoring guide${not.some((x) => /differ/.test(x)) ? '' : ' (same)'}; the dimension score is recalculated.${todoText}`, not);
        });

        // Evidence log
        if (sh.evSheet) {
            const eh = p.evidence.head; const cId = colOf(eh, /^metric id/i); const cSrc = colOf(eh, /source/i);
            const not = []; let n = 0; let notes = 0;
            p.evidence.body.forEach((r) => {
                const id = str(r[cId]);
                if (M.allMetrics().some((m) => m.id === id)) { if (str(r[cSrc])) n += 1; else if (scoredIds.has(id)) not.push(`${id}: no data source given`); }
                else { notes += 1; }
            });
            const known = [/^metric id/i, /^metric name/i, /source/i, /assumption/i, /quality|confidence/i];
            eh.forEach((h) => { if (h && !known.some((re) => re.test(h))) not.push(`Column "${h}"`); });
            if (!eh.length) not.push('No "Metric ID" header row found — the whole sheet was skipped');
            if (eh.length && !n && !notes && !not.length) add(sh.evSheet.name, 'none', 'Empty: no evidence recorded yet.', []);
            else add(sh.evSheet.name, eh.length ? (not.length ? 'partly' : 'read') : 'skipped', `${n} evidence items (data source, assumptions, quality), linked to their metrics.${notes ? ` ${notes} note row${notes > 1 ? 's' : ''} (e.g. respondent codes) kept as an evidence note.` : ''}`, not);
        }

        // Risk register
        if (sh.riskSheet) {
            const rh = p.risks.head; const not = []; let n = 0; const multi = [];
            const c = { id: colOf(rh, /^risk id/i), d: colOf(rh, /description/i), dim: colOf(rh, /^dimension/i), l: colOf(rh, /^likelihood/i), i: colOf(rh, /^impact/i), st: colOf(rh, /^status/i) };
            p.risks.body.forEach((r) => {
                const id = str(r[c.id]) || '(no id)';
                if (!r.some((x, k) => k !== c.id && str(x))) return; // empty template row (only the risk ID)
                if (!str(r[c.d])) { not.push(`Row without a description: "${short(r.filter((x) => str(x)).join(' '), 60)}"`); return; }
                n += 1;
                if (!RISK_LEVEL.test(str(r[c.l]))) not.push(`${id}: likelihood "${str(r[c.l]) || 'empty'}" not H/M/L — set to Medium`);
                if (!RISK_LEVEL.test(str(r[c.i]))) not.push(`${id}: impact "${str(r[c.i]) || 'empty'}" not H/M/L — set to Medium`);
                const dims = str(r[c.dim]).match(/D[1-5]/g) || [];
                if (!dims.length) not.push(`${id}: no dimension (D1–D5) — filed under D1`);
                else if (dims.length > 1) multi.push(`${id} (${dims.join('/')})`);
            });
            const known = [/^risk id/i, /description/i, /^dimension/i, /^likelihood/i, /^impact/i, /mitigation/i, /^status/i, /^critical/i, /^owner/i];
            rh.forEach((h) => { if (h && !known.some((re) => re.test(h))) not.push(`Column "${h}" (e.g. owners must be team members — set them on the Risks page)`); });
            add(sh.riskSheet.name, rh.length ? (not.length ? 'partly' : 'read') : 'skipped', `${n} risks with likelihood, impact and mitigation${c.st >= 0 ? ' and status' : ' (no status column: set to Open)'}. High × High risks are marked critical for the team to confirm.${multi.length ? ` Risks with several dimensions — ${multi.join(', ')} — are filed under the first one and the others are named in the risk text.` : ''}`, not);
        }

        // Final report
        if (sh.repSheet) {
            const heads = Object.keys(p.report); const not = [];
            heads.forEach((h) => { if (!REPORT_FIELDS.some((re) => re.test(h))) not.push(`Section "${h}"`); });
            const rec = heads.find((h) => /recommendation/i.test(h));
            if (rec && p.report[rec] && !/^\(no recommendation/i.test(p.report[rec]) && !M.humanDecisions.some((d) => p.report[rec].toUpperCase().startsWith(d))) not.push('The recommendation does not start with GO / GO WITH CONDITIONS / CONDITIONAL / NO-GO / REJECT — text kept, decision left empty');
            add(sh.repSheet.name, not.length ? 'partly' : 'read', `${heads.length - not.filter((x) => x.startsWith('Section')).length} report sections copied into the report (the recommendation is a draft, not finalised).`, not);
        }

        // Action plan
        if (sh.planSheet) {
            const ph = p.plan.head; const not = [];
            const known = [/^#$/, /^recommendation/i, /trigger/i, /horizon/i, /lead/i, /output|kpi/i, /metrics/i, /^status/i];
            ph.forEach((h) => { if (h && !known.some((re) => re.test(h))) not.push(`Column "${h}"`); });
            add(sh.planSheet.name, not.length ? 'partly' : 'read', `${p.plan.body.filter((r) => r.some((x) => str(x))).length} team actions (Recommendations → Team action plan).`, not);
        }

        // Project sheets
        p.projects.forEach((x) => {
            const r = x.report;
            add(r.sheet, r.notRead.length || r.invalid.length ? 'partly' : 'read', `${r.read} project fields for ${r.project} (${r.role === 'source' ? 'source project' : 'replication site'})${r.empty ? `; ${r.empty} left empty` : ''}.`, [...r.invalid, ...r.notRead.map((t) => `Unknown field — ${t}`)]);
        });
        const sides = new Set(p.projects.map((x) => x.role));
        if (!sides.has('source') || !sides.has('site')) warnings.push(`No filled-in ${[!sides.has('source') && '"Source project"', !sides.has('site') && '"Replication site"'].filter(Boolean).join(' or ')} sheet: only the project name${sides.size ? '' : 's'} and a few facts found in the text were imported for that side. Fill in the rest on the Projects page, or use a workbook with project sheets.`);

        // Financial check and other sheets
        if (sh.finSheet) {
            const f = p.finance || {};
            const usedAny = f.capexEur || f.paybackYrs || f.savingsEurYr;
            const links = (p.links || {})[sh.finSheet.name] || [];
            add(sh.finSheet.name, 'read', `${usedAny && !sides.has('site') ? 'Stakeholder-median cost, payback and annual savings → replication-site project fields. ' : ''}All cost cases, grant shares and the metric 3.3 mapping are kept as an evidence document${links.length ? ` linked to metric${links.length > 1 ? 's' : ''} ${links.join(', ')}` : ''}.`);
        }
        p.extra.filter((x) => !sh.finSheet || x.name !== sh.finSheet.name).forEach((x) => {
            const links = (p.links || {})[x.name] || [];
            const sens = p.sensitivity && /sensitivity/i.test(x.name);
            add(x.name, 'read', `${sens ? `${p.sensitivity.scenarios.length} scenarios (${p.sensitivity.scenarios.map((s) => s.id).join(', ')}) and ${p.sensitivity.tests.length} stress tests imported — the tool recalculates them live (Report → section 5). ` : ''}Kept as an evidence document the Assistant can search${links.length ? `, linked to metric${links.length > 1 ? 's' : ''} ${links.join(', ')}` : ''}.`);
        });
        wb.SheetNames.forEach((n) => { if (!sections.some((s) => s.sheet === n) && !/^lists?$/i.test(n.trim())) add(n, 'skipped', 'Empty sheet.'); });
        sections.sort((a, b) => wb.SheetNames.indexOf(a.sheet) - wb.SheetNames.indexOf(b.sheet));
        return { fileName: p.fileName, at: U.nowIso(), sections, warnings };
    }

    async function parse(fileOrBook) {
        const { XLSX, wb, fileName } = fileOrBook.wb ? fileOrBook : await read(fileOrBook);
        const file = { name: fileName };
        const get = (re) => { const n = findSheet(wb, re); return n ? { name: n, rows: rowsOf(XLSX, wb.Sheets[n]) } : null; };

        const dash = get(/dashboard/i);
        const dims = ['D1', 'D2', 'D3', 'D4', 'D5'].map((d) => get(dimSheetRe(d))).filter(Boolean);
        if (!dash || !dims.length) throw new Error('This does not look like an RSA Scoring Toolkit workbook (no Dashboard or D1–D5 sheets found).');

        const used = new Set([dash.name, ...dims.map((d) => d.name)]);
        const info = parseDashboard(dash.rows);
        const metrics = dims.flatMap((d) => parseDimension(d.rows));

        const evSheet = get(/evidence/i); if (evSheet) used.add(evSheet.name);
        const evidence = evSheet ? parseTable(evSheet.rows, /^metric id$/i) : { head: [], body: [] };
        const riskSheet = get(/risk/i); if (riskSheet) used.add(riskSheet.name);
        const risks = riskSheet ? parseTable(riskSheet.rows, /^risk id$/i) : { head: [], body: [] };
        const repSheet = get(/final report/i); if (repSheet) used.add(repSheet.name);
        const report = repSheet ? parseFinalReport(repSheet.rows) : {};
        const planSheet = get(/action plan/i); if (planSheet) used.add(planSheet.name);
        const teamSheet = get(/^\s*(\d+\.\s*)?team\b/i); if (teamSheet) used.add(teamSheet.name);
        const scrSheet = get(/screening/i); if (scrSheet) used.add(scrSheet.name);
        const screening = scrSheet ? parseScreening(scrSheet.rows) : null;
        const team = teamSheet ? parseTeam(teamSheet.rows) : [];
        const plan = planSheet ? parseTable(planSheet.rows, /^recommendation$/i) : { head: [], body: [] };
        const startSheet = findSheet(wb, /start here/i); if (startSheet) used.add(startSheet);
        const finSheet = get(/financial check/i);
        const finance = finSheet ? parseFinancialCheck(finSheet.rows) : null;

        wb.SheetNames.filter((n) => /^lists?$/i.test(n.trim())).forEach((n) => used.add(n)); // drop-down value lists of the template
        const projects = RSA.ExcelProjects ? RSA.ExcelProjects.readWorkbook({ XLSX, wb, fileName: file.name }) : [];
        projects.forEach((x) => used.add(x.report.sheet));

        const extra = wb.SheetNames.filter((n) => !used.has(n)).map((n) => ({ name: n, text: sheetText(XLSX, wb.Sheets[n]) })).filter((x) => x.text);
        const dashExtras = parseDashboardExtras(dash.rows);
        const sensSheet = get(/sensitivity/i);
        const sensitivity = sensSheet ? parseSensitivity(sensSheet.rows) : null;
        // Which metrics each reference sheet supports: "sheet 12" mentions, Q-codes for the response matrix, overrides for scenarios.
        const evText = Object.fromEntries(metrics.map((m) => [m.id, `${m.evidence} ${(evidence.body.find((r) => str(r[0]) === m.id) || []).map(str).join(' ')}`]));
        const links = {};
        extra.forEach((x) => {
            const nr = (/^(\d+)\./.exec(x.name) || [])[1];
            const ids = Object.keys(evText).filter((id) => (nr && new RegExp(`sheet\\s*${nr}\\b`, 'i').test(evText[id]))
                || (/response matrix|questionnaire/i.test(x.name) && /\bQ\d/.test(evText[id]))
                || (/financial check/i.test(x.name) && /^3\./.test(id) && /payback|cost|sheet 12/i.test(evText[id]))
                || (sensitivity && /sensitivity/i.test(x.name) && sensitivity.scenarios.some((sc) => sc.scores[id] !== undefined && sc.scores[id] !== (metrics.find((m) => m.id === id) || {}).score)));
            links[x.name] = ids.sort();
        });
        const parsed = { fileName: file.name, info, metrics, evidence, risks, report, plan, extra, finance, projects, dashExtras, sensitivity, links, team, screening };
        parsed.importReport = buildReport(wb, { dash, dims, evSheet, riskSheet, repSheet, planSheet, startSheet, finSheet, teamSheet, scrSheet }, parsed);
        return parsed;
    }

    /* Build a normal assessment from the parsed workbook. Nothing is approved or finalised. */
    function toAssessment(p) {
        const date = (/\d{4}-\d{2}-\d{2}/.exec(p.info.date) || [U.today()])[0];
        const allDims = M.dimensions.map((d) => d.id);
        const members = (p.team || []).map((t) => ({ id: U.uid('usr'), ...t, dimensions: t.dimensions.length ? t.dimensions : (['lead', 'reviewer'].includes(t.role) ? allDims : []) }));
        if (!members.some((t) => t.role === 'lead')) members.unshift({ id: U.uid('usr'), name: 'Lead assessor (rename)', organisation: p.info.organisation, role: 'lead', expertise: p.info.assessedBy, email: '', dimensions: allDims });
        const lead = members.find((t) => t.role === 'lead');
        const a = RSA.Model.newAssessment({ team: members, weights: p.info.weights || undefined });
        a.currentUserId = lead.id;
        const byName = (n) => { const t = str(n).toLowerCase(); return t ? members.find((x) => x.name.toLowerCase() === t) || members.find((x) => x.name.toLowerCase().startsWith(t) || t.startsWith(x.name.toLowerCase())) : null; };
        const reviewers = members.filter((t) => t.role === 'reviewer');

        const fromSheet = (role) => (p.projects || []).find((x) => x.role === role);
        const snapFrom = (role, title) => {
            const x = fromSheet(role);
            if (!x) return localSnapshot(role, title, date);
            const data = U.clone(x.record); data.local = true;
            return { id: data.id, version: data.version, lastUpdated: data.lastUpdated, fetchedAt: U.nowIso(), local: true, excel: true, data };
        };
        a.pdm.source = snapFrom('source', p.info.source);
        a.pdm.site = snapFrom('site', p.info.site);
        a.pdm.sourceId = a.pdm.source.id; a.pdm.siteId = a.pdm.site.id;
        a.title = `${a.pdm.source.data.shortName.split(' (')[0].replace(/^Pilot \d+\s*-\s*/i, '')} → ${a.pdm.site.data.shortName.split(' (')[0]}`;

        a.project.assessmentDate = date;
        a.project.organisation = p.info.organisation;
        a.project.adaptationType = /retrofit|renovation|building/i.test(p.info.adaptationType) ? 'Building retrofit' : '';
        a.project.scope = `Replication of ${p.info.source || 'the source project'} at ${p.info.site || 'the replication site'}.`;
        a.project.notes = [
            `Imported from Excel: ${p.fileName}.`,
            p.info.adaptationType && `Adaptation type: ${p.info.adaptationType}`,
            p.info.date && `Assessment date: ${p.info.date}`,
            p.info.assessedBy && `Assessed by: ${p.info.assessedBy}`,
            p.info.rss !== null && `RSS in the workbook: ${p.info.rss.toFixed(2)} (${p.info.band}).`,
            p.info.weights && `Dimension weights taken from the workbook: ${M.weightsLabel(p.info.weights)}.`
        ].filter(Boolean).join('\n');
        ['organisation', 'scope', 'adaptationType'].forEach((k) => { if (a.project[k]) a.provenance[k] = 'human'; });

        const now = U.nowIso();
        if (p.screening) {
            a.screening.answers = p.screening.answers;
            const who = p.screening.confirmedBy && byName(p.screening.confirmedBy);
            if (who && p.screening.answers.every((x) => x.value)) { a.screening.confirmedBy = who.id; a.screening.confirmedAt = now; }
        }
        // Project facts stated in the workbook (team-added values).
        const facts = workbookFacts(p);
        ['site', 'source'].forEach((side) => { if (fromSheet(side)) { facts[side] = {}; return; } Object.entries(facts[side]).forEach(([path, v]) => { a.pdm.manual[side][path] = v; }); });
        if (!fromSheet('site') && !fromSheet('source')) facts.notes = facts.notes || [];
        const replicator = /replicator:\s*(.+)$/i.exec(p.info.site || '');
        if (replicator && !fromSheet('site')) a.pdm.site.data.institutional.organisation = replicator[1].trim();
        ['source', 'site'].forEach((side) => { if (!a.pdm[side].data.adaptationType) a.pdm[side].data.adaptationType = a.project.adaptationType; });
        if (!a.project.adaptationType && fromSheet('source') && fromSheet('source').record.adaptationType) { a.project.adaptationType = fromSheet('source').record.adaptationType; a.provenance.adaptationType = 'human'; }
        const factsFromText = Object.keys(facts.site).length + Object.keys(facts.source).length;
        if (factsFromText) p.importReport.warnings.push(`${factsFromText} project value${factsFromText === 1 ? ' was' : 's were'} picked out of the evidence text (no project sheet for that side). Check them on the Projects page.`);
        if (facts.notes.length) a.project.notes = `${a.project.notes}\nProject fields filled from the workbook: ${facts.notes.join('; ')}.`;
        const factCount = factsFromText + (p.projects || []).reduce((n, x) => n + x.report.read, 0);

        // One evidence item per Evidence Log row.
        const eh = p.evidence.head;
        const ec = { id: colOf(eh, /^metric id/i), src: colOf(eh, /source/i), ass: colOf(eh, /assumption/i), q: colOf(eh, /quality|confidence/i) };
        p.evidence.body.forEach((r) => {
            const mid = str(r[ec.id]);
            if (!a.metrics[mid] || !str(r[ec.src])) return;
            const ev = {
                id: `EV-M${mid.replace('.', '-')}`, title: `${mid} evidence basis (workbook)`, sourceType: 'Project document', provider: p.info.organisation, date,
                url: p.fileName, reliability: ec.q >= 0 ? level(r[ec.q]) : '', assumptions: ec.ass >= 0 ? str(r[ec.ass]) : '',
                notes: str(r[ec.src]), metricIds: [mid], provenance: 'human', createdBy: lead.id, createdAt: now,
                attachment: { name: `${mid}-evidence.txt`, size: str(r[ec.src]).length, type: 'text/plain', text: `${str(r[ec.src])}\n${ec.ass >= 0 ? str(r[ec.ass]) : ''}` }
            };
            a.evidence.push(ev);
            a.metrics[mid].evidenceIds.push(ev.id);
            if (ec.ass >= 0) a.metrics[mid].assumptions = str(r[ec.ass]);
        });

        // Evidence Log rows that are not about one metric (e.g. respondent codes) → one evidence note.
        const noteRows = p.evidence.body.filter((r) => !a.metrics[str(r[ec.id])] && r.some((c) => str(c))).map((r) => r.filter((c) => str(c)).map(str).join(' '));
        if (noteRows.length) a.evidence.push({ id: 'EV-LOG-NOTES', title: 'Evidence Log notes (workbook)', sourceType: 'Project document', provider: p.info.organisation, date, url: p.fileName, reliability: '', assumptions: '', notes: noteRows.join('\n'), metricIds: [], provenance: 'human', createdBy: lead.id, createdAt: now, attachment: { name: 'evidence-log-notes.txt', size: noteRows.join('\n').length, type: 'text/plain', text: noteRows.join('\n') } });

        // Metric scores, with assessor, status and review from the workbook when given (otherwise Draft, assigned to the lead).
        let scored = 0; const statusIssues = [];
        p.metrics.forEach((m) => {
            const st = a.metrics[m.id];
            if (!st) return;
            if (m.score !== null) { st.score = String(Math.round(m.score * 100) / 100); scored += 1; }
            st.confidence = m.confidence;
            st.rationale = m.evidence;
            if (m.criteriaNote) st.assumptions = [st.assumptions, m.criteriaNote].filter(Boolean).join('\n');
            const dimId = `D${m.id.charAt(0)}`;
            const assessor = byName(m.assessor) || members.find((t) => ['assessor', 'expert'].includes(t.role) && t.dimensions.includes(dimId)) || lead;
            st.assessorId = assessor.id;
            const reviewer = reviewers.find((t) => t.id !== assessor.id) || (lead.id !== assessor.id ? lead : null);
            st.reviewerId = reviewer ? reviewer.id : '';
            if (m.agreed !== null) st.finalScore = String(m.agreed);
            if (m.review) st.reviewerComment = m.review;
            const wanted = (M.metricStatuses.find((x) => x.toLowerCase() === m.status.toLowerCase()) || '');
            let status = m.score !== null ? 'Draft' : 'Not started';
            if (m.score !== null && wanted && wanted !== 'Not started') {
                // Four-eyes rule: Reviewed/Approved only with a reviewer who is not the assessor.
                status = ['Reviewed', 'Approved'].includes(wanted) && !reviewer ? 'Submitted' : wanted;
                if (status !== wanted) statusIssues.push(`${m.id}: "${wanted}" needs a reviewer other than the assessor — imported as Submitted`);
            } else if (wanted && m.score === null && wanted !== 'Not started') statusIssues.push(`${m.id}: status "${wanted}" ignored because there is no score`);
            st.status = status;
            if (['Submitted', 'Reviewed', 'Approved'].includes(status)) st.submittedAt = now;
            if (['Reviewed', 'Approved'].includes(status)) { st.reviewedAt = now; st.reviewedBy = reviewer.id; if (st.finalScore === '') st.finalScore = st.score; }
            if (status === 'Approved') { st.approvedAt = now; st.approvedBy = reviewer.id; }
            st.updatedAt = now; st.updatedBy = assessor.id;
        });
        if (statusIssues.length) p.importReport.warnings.push(...statusIssues);

        // Risks. H×H is flagged critical for the team to confirm.
        const rh = p.risks.head;
        const rc = { id: colOf(rh, /^risk id/i), d: colOf(rh, /description/i), dim: colOf(rh, /^dimension/i), l: colOf(rh, /^likelihood/i), i: colOf(rh, /^impact/i), mit: colOf(rh, /mitigation/i), st: colOf(rh, /^status/i), cr: colOf(rh, /^critical/i), ow: colOf(rh, /^owner/i) };
        const statusOf = (v) => { const t = str(v).toLowerCase(); return /mitig/.test(t) ? 'Mitigating' : /accept/.test(t) ? 'Accepted' : /clos|resolv|done/.test(t) ? 'Closed' : 'Open'; };
        p.risks.body.forEach((r) => {
            if (!str(r[rc.d])) return;
            const likelihood = hml(r[rc.l]); const impact = hml(r[rc.i]);
            const dims = (str(r[rc.dim]).match(/D[1-5]/g) || ['D1']);
            a.risks.push({
                id: str(r[rc.id]) || U.uid('RK'), description: str(r[rc.d]) + (dims.length > 1 ? ` (also ${dims.slice(1).join(', ')})` : ''), dimension: dims[0],
                likelihood, impact, mitigation: str(r[rc.mit]), owner: rc.ow >= 0 ? ((byName(r[rc.ow]) || {}).id || '') : '', status: rc.st >= 0 ? statusOf(r[rc.st]) : 'Open',
                critical: rc.cr >= 0 && str(r[rc.cr]) ? /^(y|yes|true|1|x)$/i.test(str(r[rc.cr])) : likelihood === 'High' && impact === 'High', createdBy: lead.id, createdAt: now
            });
        });

        // Team action plan from the workbook.
        const ph = p.plan.head;
        const pc = { n: colOf(ph, /^#$/), t: colOf(ph, /^recommendation/i), trig: colOf(ph, /trigger/i), h: colOf(ph, /horizon/i), lead: colOf(ph, /lead/i), out: colOf(ph, /output|kpi/i), mv: colOf(ph, /metrics/i), st: colOf(ph, /^status/i) };
        a.actionPlan = p.plan.body.filter((r) => str(r[pc.t])).map((r, i) => ({
            id: `AP-${str(r[pc.n]) || i + 1}`, title: str(r[pc.t]), trigger: str(r[pc.trig]), horizon: str(r[pc.h]), lead: str(r[pc.lead]),
            output: str(r[pc.out]), metrics: (str(r[pc.mv]).match(/\d\.\d/g) || []), status: (pc.st >= 0 && M.recommendationStatuses.find((x) => x.toLowerCase() === str(r[pc.st]).toLowerCase())) || 'Proposed'
        }));

        // Final Report texts.
        const rep = p.report; const pick = (re) => { const k = Object.keys(rep).find((x) => re.test(x)); return k ? rep[k] : ''; };
        a.report.executiveSummary = pick(/executive/i);
        a.report.dimensionalAssessment = pick(/dimensional/i);
        a.report.criticalSuccessFactors = pick(/success/i);
        a.report.adaptationRoadmap = pick(/roadmap/i);
        a.report.capacityBuilding = pick(/capacity/i);
        a.report.financialSummary = pick(/financial/i);
        a.report.nextSteps = [pick(/next steps/i), pick(/^risks/i) && `Risks and mitigation: ${pick(/^risks/i)}`].filter(Boolean).join('\n\n');
        const rec = /^\(no recommendation/i.test(pick(/recommendation/i)) ? '' : pick(/recommendation/i);
        if (rec) {
            const value = M.humanDecisions.slice().sort((x, y) => y.length - x.length).find((d) => rec.toUpperCase().startsWith(d)) || '';
            a.decision.value = value; a.decision.rationale = pick(/^rationale/i) || rec; a.decision.finalised = false;
        }
        if (pick(/^conditions/i)) a.decision.conditions = pick(/^conditions/i);
        if (pick(/^rationale/i)) a.decision.rationale = pick(/^rationale/i);

        // Remaining sheets as searchable reference documents.
        p.extra.forEach((x, i) => {
            a.evidence.push({
                id: `EV-REF-${i + 1}`, title: `Workbook sheet: ${x.name}`, sourceType: 'Project document', provider: p.info.organisation, date,
                url: p.fileName, reliability: '', assumptions: '', notes: `Sheet from the imported workbook, searchable by the Assistant${(p.links[x.name] || []).length ? `; supports metrics ${p.links[x.name].join(', ')}` : ''}.`,
                metricIds: (p.links[x.name] || []).slice(), provenance: 'human', createdBy: lead.id, createdAt: now,
                attachment: { name: `${U.slug(x.name)}.csv`, size: x.text.length, type: 'text/csv', text: x.text.slice(0, 200000) }
            });
        });

        (p.extra || []).forEach((x, i) => (p.links[x.name] || []).forEach((id) => { if (a.metrics[id]) a.metrics[id].evidenceIds.push(`EV-REF-${i + 1}`); }));
        if (p.sensitivity && p.sensitivity.scenarios.length) a.sensitivity = { source: p.fileName, ...p.sensitivity };
        const ex = p.dashExtras || {};
        if (ex.high !== null && ex.high !== undefined) a.project.notes = `${a.project.notes}\nWorkbook evidence confidence: ${ex.high} High, ${ex.medium} Medium, ${ex.low} Low of 20${ex.shareLow !== null ? ` (${Math.round(ex.shareLow * 100)}% Low)` : ''}${ex.above !== null ? `; ${Math.round(ex.above * 100) / 100} points above the lower band edge and ${Math.round(ex.below * 100) / 100} below the upper edge` : ''}${ex.respondents ? `; ${ex.respondents} questionnaire respondents` : ''}.`;
        a.importReport = p.importReport;
        a.audit.push({ id: U.uid('AU'), at: now, userId: lead.id, userName: lead.name, action: 'Imported Excel', entity: 'assessment', entityId: a.id, detail: `${p.fileName}: ${scored} metric scores, ${a.risks.length} risks, ${a.actionPlan.length} actions, ${p.extra.length} reference sheets` });
        a.backupAuditLen = a.audit.length; // the workbook is the saved copy until something changes
        return { assessment: RSA.Model.normalise(a), summary: { scored, facts: factCount, risks: a.risks.length, actions: a.actionPlan.length, refs: p.extra.length, workbookRss: p.info.rss } };
    }

    RSA.ExcelImport = { read, loadLib, isToolkit, parse, toAssessment, localSnapshot, sheetText, isSpreadsheet: (file) => /\.(xlsx|xlsm|xls|ods|csv)$/i.test(file.name) };
})(window.RSA);
