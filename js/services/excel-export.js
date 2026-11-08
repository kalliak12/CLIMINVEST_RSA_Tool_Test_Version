/*
 * Export an assessment as an Excel workbook in the RSA Scoring Toolkit layout — the same layout the
 * import reads, so the file can be kept, shared, edited in Excel and imported again.
 * Formulas (dimension scores, RSS, band, sensitivity) are written with their current values.
 * Not included (they live only in the JSON backup): the history (audit trail), uploaded evidence files,
 * Assistant chats, catalogue changes and recommendation statuses.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology;

    const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : v);
    const cellOf = (v) => (Array.isArray(v) ? v.join('; ') : yesNo(v));
    const ROLE_LABEL = { lead: 'Lead assessor', assessor: 'Assessor', expert: 'Domain expert', reviewer: 'Reviewer' };
    const bandText = (rss) => (rss === null ? '' : rss >= 85 ? 'HIGHLY SUITABLE - GO' : rss >= 70 ? 'SUITABLE - GO WITH CONDITIONS' : rss >= 50 ? 'MARGINALLY SUITABLE - CONDITIONAL' : rss >= 30 ? 'POOR FIT - NO-GO' : 'UNSUITABLE - REJECT');
    const interp = (s) => (s === null ? '' : s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Acceptable' : s >= 30 ? 'Poor' : 'Unsuitable');
    const confLabel = (v) => (v ? M.confidenceLabel(v) : '');

    /* Styled writer (xlsx-js-style, Apache-2.0), loaded only when exporting. It also defines a global XLSX,
       so the reader's XLSX is restored afterwards. */
    let styleLib = null;
    const loadStyleLib = () => {
        if (styleLib) return styleLib;
        styleLib = new Promise((resolve, reject) => {
            const prev = window.XLSX;
            const s = document.createElement('script');
            s.src = 'js/vendor/xlsx-js-style.min.js';
            s.onload = () => { const lib = window.XLSX; window.XLSXStyle = lib; if (prev) window.XLSX = prev; resolve(lib); };
            s.onerror = () => { styleLib = null; reject(new Error('Could not load the Excel writer (js/vendor/xlsx-js-style.min.js).')); };
            document.head.appendChild(s);
        });
        return styleLib;
    };

    /* The colours and fonts of the RSA Scoring Toolkit workbook (UDT-AMA v3). */
    const F = 'Arial';
    const thin = { style: 'thin', color: { rgb: '000000' } };
    const BOX = { top: thin, bottom: thin, left: thin, right: thin };
    const fill = (rgb) => ({ patternType: 'solid', fgColor: { rgb } });
    const ST = {
        h1: { font: { name: F, sz: 13, bold: true, color: { rgb: 'FFFFFF' } }, fill: fill('1F4E78'), alignment: { vertical: 'center' } },
        h1fill: { fill: fill('1F4E78') },
        h2: { font: { name: F, sz: 11, bold: true }, fill: fill('D9E1F2') },
        small: { font: { name: F, sz: 9, color: { rgb: '666666' } }, alignment: { wrapText: false } },
        head: { font: { name: F, sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: fill('4472C4'), border: BOX, alignment: { vertical: 'center', wrapText: true } },
        head2: { font: { name: F, sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: fill('1F4E79'), border: BOX, alignment: { vertical: 'center', wrapText: true } },
        body: { font: { name: F, sz: 10 }, border: BOX, alignment: { vertical: 'top', wrapText: true } },
        label: { font: { name: F, sz: 10, bold: true }, border: BOX, alignment: { vertical: 'top', wrapText: true } },
        input: { font: { name: F, sz: 10 }, fill: fill('FFF2CC'), border: BOX, alignment: { vertical: 'top', wrapText: true } },
        score: { font: { name: F, sz: 10, bold: true, color: { rgb: '008000' } }, fill: fill('FFF2CC'), border: BOX, alignment: { vertical: 'top' } },
        calc: { font: { name: F, sz: 10 }, border: BOX, alignment: { vertical: 'top' } },
        total: { font: { name: F, sz: 12, bold: true }, fill: fill('D9E1F2'), border: BOX },
        section: { font: { name: F, sz: 11, bold: true }, fill: fill('D9E1F2') },
        key: { font: { name: F, sz: 8, color: { rgb: '999999' } }, border: BOX },
        text: { font: { name: F, sz: 10 }, alignment: { vertical: 'top', wrapText: true } }
    };
    const DARK_HEAD = /^(10|11|12|13|16|17)\. /;

    /* Apply the styles to one sheet. o: { head: header row index, from/to: data rows, edit: editable column indexes,
       label: label columns, key: key column, inputCells: ['B4', …], textRows: true for long text rows }. */
    function decorate(X, ws, o = {}) {
        const range = X.utils.decode_range(ws['!ref']);
        const get = (r, c) => { const ref = X.utils.encode_cell({ r, c }); if (!ws[ref]) ws[ref] = { t: 's', v: '' }; return ws[ref]; };
        const has = (r, c) => { const x = ws[X.utils.encode_cell({ r, c })]; return x && x.v !== '' && x.v !== undefined; };
        const lastC = o.cols !== undefined ? o.cols - 1 : range.e.c;
        for (let r = range.s.r; r <= range.e.r; r += 1) {
            const first = has(r, 0) ? String(get(r, 0).v) : '';
            const onlyFirst = first && ![...Array(lastC).keys()].some((k) => has(r, k + 1));
            if (r === 0) { get(r, 0).s = ST.h1; for (let c = 1; c <= Math.max(lastC, o.titleCols || 3); c += 1) get(r, c).s = ST.h1fill; continue; }
            if (o.head !== undefined && r === o.head) { for (let c = 0; c <= lastC; c += 1) get(r, c).s = o.dark ? ST.head2 : ST.head; continue; }
            const inData = o.head !== undefined && r > o.head && r <= (o.to !== undefined ? o.to : range.e.r);
            if (inData && !(o.sections && onlyFirst && first === first.toUpperCase() && /[A-Z]/.test(first))) {
                for (let c = 0; c <= lastC; c += 1) {
                    const cell = get(r, c);
                    cell.s = cell.f ? ST.calc : (o.edit || []).includes(c) ? ST.input : c === o.key ? ST.key : (o.label || [0]).includes(c) ? ST.label : ST.body;
                }
                continue;
            }
            if (onlyFirst && first === first.toUpperCase() && /[A-Z]/.test(first) && first.length < 80) {
                for (let c = 0; c <= Math.max(lastC, 3); c += 1) get(r, c).s = ST.h2;
                continue;
            }
            if (o.textRows && first) { get(r, 0).s = ST.input; continue; }
            if (first && r <= 2) get(r, 0).s = ST.small;
            for (let c = 0; c <= range.e.c; c += 1) { const x = ws[X.utils.encode_cell({ r, c })]; if (x && x.f) x.s = ST.calc; else if (x && !x.s) x.s = { font: { name: F, sz: 10 } }; }
        }
        (o.inputCells || []).forEach((ref) => { const c = X.utils.decode_cell(ref); get(c.r, c.c).s = ST.input; });
        Object.entries(o.cellStyles || {}).forEach(([ref, st]) => { const c = X.utils.decode_cell(ref); get(c.r, c.c).s = st; });
        if (ws['!rows'] === undefined) ws['!rows'] = []; ws['!rows'][0] = { hpt: 24 };
    }

    /* Sheet builder: rows of plain values or {f, v} formula cells. */
    function sheet(XLSX, rows, widths) {
        const ws = {};
        let maxC = 0;
        rows.forEach((row, r) => (row || []).forEach((val, c) => {
            if (val === null || val === undefined || val === '') return;
            maxC = Math.max(maxC, c);
            const ref = XLSX.utils.encode_cell({ r, c });
            if (typeof val === 'object' && val.f) { ws[ref] = { t: typeof val.v === 'number' ? 'n' : 's', f: val.f, v: val.v === null || val.v === undefined ? '' : val.v }; if (val.z) ws[ref].z = val.z; }
            else if (typeof val === 'number') ws[ref] = { t: 'n', v: val };
            else ws[ref] = { t: 's', v: String(val) };
        }));
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: maxC } });
        if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
        return ws;
    }

    async function build(app, a) {
        const XLSX = await loadStyleLib();
        const calc = RSA.Scoring.compute(a);
        const wb = XLSX.utils.book_new();
        const looks = {};
        const add = (name, rows, widths, look) => { XLSX.utils.book_append_sheet(wb, sheet(XLSX, rows, widths), name); looks[name] = look || {}; };
        const member = (id) => a.team.find((t) => t.id === id);
        const src = RSA.Data.effective(a, 'source'); const site = RSA.Data.effective(a, 'site');
        const lead = a.team.find((t) => t.role === 'lead');
        const weights = M.weightsOf(a);
        const dimSheet = (i) => `${i + 2}. ${M.dimensions[i].id} - ${M.dimensions[i].short}`;
        const effScore = (id) => { const x = calc.metrics.find((m) => m.id === id); return x ? x.eff : null; };

        // 0. START HERE: short, with the kind of evaluation the file holds
        const scored = M.allMetrics().filter((m) => a.metrics[m.id].score !== '' && a.metrics[m.id].score !== null && a.metrics[m.id].score !== undefined).length;
        const nMissing = RSA.Data.missing(a).filter((m) => !m.filled).length;
        const kind = scored === 20 ? ['FULL EVALUATION', 'C6EFCE', 'All 20 metrics scored'] : scored ? ['PARTIAL EVALUATION', 'FFEB9C', `${scored} of 20 metrics scored`]
            : nMissing && (a.pdm.source || a.pdm.site) ? ['MISSING INFORMATION', 'FFD966', 'No metrics scored yet'] : ['EMPTY', 'D9D9D9', 'No metrics scored yet'];
        const approved = M.allMetrics().filter((m) => a.metrics[m.id].status === 'Approved').length;
        add('0. START HERE', [
            ['CLIMINVEST REPLICATION SUITABILITY ASSESSMENT (RSA)'],
            ['RSA Scoring Toolkit - exported from the RSA tool'],
            [],
            ['FILE TYPE', kind[0]],
            [],
            ['Assessment', `${a.title} (exported ${U.fmtDateTime(U.nowIso())})`],
            ["What's inside", `${kind[2]}, ${approved} approved. ${a.risks.length} risk${a.risks.length === 1 ? '' : 's'}, ${a.evidence.filter((e) => !/^EV-REF-/.test(e.id)).length} evidence items. ${nMissing ? `${nMissing} project value${nMissing === 1 ? '' : 's'} still missing.` : 'No project values missing.'} Decision: ${a.decision.value ? `${a.decision.value} (${a.decision.finalised ? 'finalised' : 'draft'})` : 'not yet'}.`],
            ['How to use it', 'RSA tool: menu > "Import Excel or JSON" (green button) > choose this file. It becomes a new assessment.'],
            ['Rules', 'Yellow cells are inputs. Keep the sheet names, the column headers and the Key column (sheets 14 and 15).'],
            ['Not included', 'History, uploaded evidence files and Assistant chats - use Export JSON for an exact copy.']
        ], [32, 110], { titleCols: 1, cellStyles: {
            A2: { font: { name: F, sz: 12 } },
            B4: { font: { name: F, sz: 14, bold: true }, fill: fill(kind[1]), alignment: { vertical: 'center' } },
            ...Object.fromEntries([6, 7, 8, 9, 10].flatMap((r) => [[`A${r}`, { font: { name: F, sz: 11, bold: true, color: { rgb: '1F4E78' } }, alignment: { vertical: 'top' } }], [`B${r}`, { font: { name: F, sz: 11 }, alignment: { vertical: 'top', wrapText: true } }]]))
        } });

        // 1. Dashboard
        const dashRows = [
            ['REPLICATION SUITABILITY ASSESSMENT - DASHBOARD'], [],
            ['PROJECT IDENTIFICATION'],
            ['Original Project Name:', src ? src.name || src.shortName : ''],
            ['Replication Site:', site ? site.name || site.shortName : ''],
            ['Adaptation Type:', a.project.adaptationType || ''],
            ['Assessment Date:', a.project.assessmentDate || ''],
            ['Assessed By:', lead ? lead.name : ''],
            ['Organization:', a.project.organisation || ''],
            [],
            ['DIMENSIONAL SCORES'],
            ['Dimension', 'Score (0-100)', 'Weight', 'Interpretation']
        ];
        M.dimensions.forEach((d, i) => {
            const r = 13 + i; const dc = calc.dims[i].score;
            dashRows.push([`${d.id}: ${d.name}`, { f: `'${dimSheet(i)}'!C8`, v: dc === null ? '' : dc }, weights[d.id] / 100,
                { f: `IF(B${r}="","",IF(B${r}>=85,"Excellent",IF(B${r}>=70,"Good",IF(B${r}>=50,"Acceptable",IF(B${r}>=30,"Poor","Unsuitable")))))`, v: interp(dc) }]);
        });
        dashRows.push(['Weights total:', null, { f: 'SUM(C13:C17)', v: 1 }]);
        dashRows.push(['OVERALL REPLICATION SUITABILITY SCORE (RSS)']);
        dashRows.push(['Calculated RSS (0-100):', { f: 'IF(COUNT(B13:B17)<5,"",SUMPRODUCT(B13:B17,C13:C17))', v: calc.rss === null ? '' : calc.rss }]);
        dashRows.push(['Decision band:', { f: 'IF(B20="","",IF(B20>=85,"HIGHLY SUITABLE - GO",IF(B20>=70,"SUITABLE - GO WITH CONDITIONS",IF(B20>=50,"MARGINALLY SUITABLE - CONDITIONAL",IF(B20>=30,"POOR FIT - NO-GO","UNSUITABLE - REJECT")))))', v: bandText(calc.rss) }]);
        dashRows.push([], ['DECISION INTERPRETATION'], ['85-100', 'HIGHLY SUITABLE', 'GO'], ['70-84', 'SUITABLE', 'GO WITH CONDITIONS'], ['50-69', 'MARGINALLY SUITABLE', 'CONDITIONAL'], ['30-49', 'POOR FIT', 'NO-GO'], ['0-29', 'UNSUITABLE', 'REJECT']);
        const band = (c) => ({ font: { name: F, sz: 11, bold: true }, fill: fill(c), border: BOX });
        const dashStyles = { A19: { font: { name: F, sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: fill('366092') }, B19: { fill: fill('366092') }, C19: { fill: fill('366092') }, D19: { fill: fill('366092') },
            B20: { font: { name: F, sz: 11, bold: true }, fill: fill('FFEB9C'), border: BOX }, B21: { font: { name: F, sz: 11, bold: true, color: { rgb: 'C00000' } } } };
        ['C6EFCE', 'FFEB9C', 'FFD966', 'FFC7CE', 'FFC7CE'].forEach((c, i) => ['A', 'B', 'C', 'D'].forEach((L) => { dashStyles[`${L}${24 + i}`] = band(c); }));
        [13, 14, 15, 16, 17].forEach((r) => { dashStyles[`B${r}`] = { font: { name: F, sz: 10 }, fill: fill('FFF2CC'), border: BOX }; });
        ['A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A20', 'A21'].forEach((ref) => { dashStyles[ref] = { font: { name: F, sz: 11, bold: true } }; });
        add('1. Dashboard', dashRows, [42, 62, 12, 18], { head: 11, to: 17, edit: [2], inputCells: ['B4', 'B5', 'B6', 'B7', 'B8', 'B9'], cellStyles: dashStyles });

        // D1–D5
        M.dimensions.forEach((d, i) => {
            const rows = [[`${d.id}: ${d.name.toUpperCase()} (Weight: ${weights[d.id]}%)`], ['Scores, confidence, evidence basis, assessor, status and review. The dimension score uses the agreed (reviewer) score where there is one.'],
                ['Metric', 'Description', 'Score (0-100)', 'Scoring Criteria', 'Confidence', 'Evidence basis', 'Assessor', 'Status', 'Agreed score (reviewer)', 'Reviewer comment']];
            d.metrics.forEach((m) => {
                const st = a.metrics[m.id]; const as = member(st.assessorId);
                rows.push([`${m.id} ${m.name}`, m.description, st.score === '' ? null : Number(st.score), m.criteria.map((c) => `${c.score}: ${c.text}`).join(' | '),
                    confLabel(st.confidence), st.rationale || '', as ? as.name : '', st.status === 'Not started' ? '' : st.status,
                    st.finalScore === '' || st.finalScore === null || st.finalScore === undefined ? null : Number(st.finalScore), st.reviewerComment || '']);
            });
            const ds = calc.dims[i].score;
            rows.push(['DIMENSION SCORE (Average of 4 metrics)', null, { f: 'IF(COUNT(C4:C7)=0,"",AVERAGE(IF(I4="",C4,I4),IF(I5="",C5,I5),IF(I6="",C6,I6),IF(I7="",C7,I7)))', v: ds === null ? '' : ds }]);
            add(dimSheet(i), rows, [34, 36, 12, 52, 13, 70, 22, 12, 14, 40], { head: 2, to: 6, edit: [2, 4, 5, 6, 7, 8, 9],
                cellStyles: { C4: ST.score, C5: ST.score, C6: ST.score, C7: ST.score, E3: ST.head2, F3: ST.head2, A8: ST.section, B8: ST.section, C8: ST.total } });
        });

        // 7. Evidence Log: per metric the linked evidence, then evidence not linked to a metric
        const evRows = [['EVIDENCE LOG - DATA SOURCES & ASSUMPTIONS'], [], ['Metric ID', 'Metric Name', 'Data Source(s)', 'Key Assumption(s)', 'Data Quality / Confidence']];
        M.allMetrics().forEach((m) => {
            const st = a.metrics[m.id];
            const items = a.evidence.filter((e) => (e.metricIds || []).includes(m.id) && !/^EV-REF-/.test(e.id));
            const sources = items.map((e) => (/evidence basis \(workbook\)$/.test(e.title) ? e.notes : [e.title, e.provider, e.date].filter(Boolean).join(', '))).filter(Boolean).join(' | ');
            const best = items.map((e) => Number(e.reliability) || 0).reduce((x, y) => Math.max(x, y), 0);
            evRows.push([m.id, m.name, sources, st.assumptions || '', best ? M.reliabilityLabel(String(best)) : '']);
        });
        a.evidence.filter((e) => !(e.metricIds || []).length && !/^EV-REF-/.test(e.id)).forEach((e) => evRows.push([`${e.title}${e.notes ? `: ${e.notes}` : ''}`.replace(/\s+/g, ' ').slice(0, 2000)]));
        add('7. Evidence Log', evRows, [10, 32, 60, 48, 16], { head: 2, to: 22, edit: [2, 3, 4], label: [0, 1] });

        // 8. Risk Register
        const hml = (v) => (v || '').charAt(0).toUpperCase();
        add('8. Risk Register', [['RISK REGISTER - CRITICAL UNCERTAINTIES & MITIGATION'], [],
            ['Risk ID', 'Risk Description', 'Dimension', 'Likelihood (H/M/L)', 'Impact (H/M/L)', 'Mitigation Strategy', 'Status', 'Critical', 'Owner'],
            ...a.risks.map((r, i) => [r.id || `R-${String(i + 1).padStart(2, '0')}`, r.description, r.dimension, hml(r.likelihood), hml(r.impact), r.mitigation || '', r.status || 'Open', r.critical ? 'Yes' : 'No', (member(r.owner) || {}).name || ''])],
        [8, 60, 11, 12, 12, 56, 12, 9, 22], { head: 2, edit: [1, 2, 3, 4, 5, 6, 7, 8] });

        // 9. Final Report
        const rep = a.report; const dec = a.decision;
        const sections = [['EXECUTIVE SUMMARY', rep.executiveSummary], ['DIMENSIONAL ASSESSMENT', rep.dimensionalAssessment], ['OVERALL RECOMMENDATION', dec.value ? `${dec.value} - recommendation of the assessment team (${dec.finalised ? 'finalised' : 'draft'})` : '(no recommendation yet)'], ['CONDITIONS', dec.conditions], ['RATIONALE', dec.rationale],
            ['CRITICAL SUCCESS FACTORS', rep.criticalSuccessFactors], ['ADAPTATION ROADMAP', rep.adaptationRoadmap], ['CAPACITY BUILDING NEEDS', rep.capacityBuilding], ['FINANCIAL SUMMARY', rep.financialSummary], ['NEXT STEPS', rep.nextSteps]];
        const frRows = [['REPLICATION SUITABILITY ASSESSMENT - FINAL REPORT'], [`Decision status: ${dec.finalised ? `finalised by ${(member(dec.finalisedBy) || {}).name || ''} on ${U.fmtDate(dec.finalisedAt)} (imports as a draft)` : 'draft'}`]];
        sections.forEach(([h, t]) => { frRows.push([h]); frRows.push([t || '']); frRows.push([]); });
        add('9. Final Report', frRows, [130], { textRows: true });

        // 10. Sensitivity Analysis (scenarios from the imported workbook, if any, and the stress tests)
        const sens = RSA.Sensitivity.compute(a, calc);
        const scen = (a.sensitivity && a.sensitivity.scenarios) || [];
        if (scen.length) {
            const head = ['Metric', 'Name', 'Base', ...scen.map((s) => `${s.id} override`), ...scen.map((s) => `${s.id} score`)];
            const L = (n) => XLSX.utils.encode_col(n);
            const rows = [['SENSITIVITY AND PATHWAY ANALYSIS (live formulas; edit the override columns; blank = base value)'], [a.sensitivity.intro || ''], [], head];
            M.allMetrics().forEach((m, k) => {
                const r = 5 + k; const di = M.dimensions.findIndex((d) => d.metrics.some((x) => x.id === m.id)); const row = 4 + M.dimensions[di].metrics.findIndex((x) => x.id === m.id);
                const base = effScore(m.id);
                rows.push([m.id, m.name, { f: `IF('${dimSheet(di)}'!I${row}="",'${dimSheet(di)}'!C${row},'${dimSheet(di)}'!I${row})`, v: base === null ? '' : base },
                    ...scen.map((s) => (s.scores[m.id] !== undefined && s.scores[m.id] !== base ? s.scores[m.id] : null)),
                    ...scen.map((s, j) => { const oc = L(3 + j); const v = s.scores[m.id] !== undefined ? s.scores[m.id] : base; return { f: `IF(${oc}${r}="",$C${r},${oc}${r})`, v: v === null ? '' : v }; })]);
            });
            rows.push([], [], ['Dimension', 'Weight', 'Base', ...scen.map((s) => s.id)]);
            M.dimensions.forEach((d, i) => {
                const a0 = 5 + 4 * i; const a1 = a0 + 3;
                const avg = (col) => ({ f: `IF(COUNT(${col}${a0}:${col}${a1})=0,"",AVERAGE(${col}${a0}:${col}${a1}))` });
                const scVals = scen.map((s) => { const vals = d.metrics.map((x) => (s.scores[x.id] !== undefined ? s.scores[x.id] : effScore(x.id))).filter((v) => v !== null); return vals.length ? U.avg(vals) : ''; });
                rows.push([`${d.id} ${d.name}`, { f: `'1. Dashboard'!C${13 + i}`, v: weights[d.id] / 100 }, { ...avg('C'), v: calc.dims[i].score === null ? '' : calc.dims[i].score },
                    ...scen.map((s, j) => ({ ...avg(L(3 + scen.length + j)), v: scVals[j] }))]);
            });
            const rssRow = rows.length + 1;
            rows.push(['RSS', { f: `SUM(B${rssRow - 5}:B${rssRow - 1})`, v: 1 }, { f: `IF(COUNT(C${rssRow - 5}:C${rssRow - 1})<5,"",SUMPRODUCT($B${rssRow - 5}:$B${rssRow - 1},C${rssRow - 5}:C${rssRow - 1}))`, v: calc.rss === null ? '' : calc.rss },
                ...sens.scenarios.map((s, j) => { const col = L(3 + j); return { f: `IF(COUNT(${col}${rssRow - 5}:${col}${rssRow - 1})<5,"",SUMPRODUCT($B${rssRow - 5}:$B${rssRow - 1},${col}${rssRow - 5}:${col}${rssRow - 1}))`, v: s.rss === null ? '' : s.rss }; })]);
            rows.push([], [], ['GUIDE TESTS AND TORNADO'], ['Test', 'Description', 'RSS', 'Change vs base']);
            sens.tests.forEach((t) => rows.push([t.id, t.description, t.rss === null ? '' : t.rss, t.change === null ? '' : t.change]));
            add('10. Sensitivity Analysis', rows, [30, 40, 9, ...scen.map(() => 11), ...scen.map(() => 9)], { head: 3, to: 23, edit: scen.map((x, j) => 3 + j), label: [0] });
        }

        // Workbook reference sheets kept from an earlier import (e.g. Response Matrix, Financial Check)
        a.evidence.filter((e) => /^EV-REF-/.test(e.id) && e.attachment && e.attachment.text && /^Workbook sheet: /.test(e.title)).forEach((e) => {
            const name = e.title.replace(/^Workbook sheet: /, '').slice(0, 31);
            if (/sensitivity/i.test(name) && scen.length) return;
            if (wb.SheetNames.includes(name)) return;
            const tmp = XLSX.read(e.attachment.text, { type: 'string', raw: true });
            XLSX.utils.book_append_sheet(wb, tmp.Sheets[tmp.SheetNames[0]], name);
            looks[name] = { ref: true };
        });

        // 13. Action Plan
        add('13. Action Plan', [['ACTION PLAN - recommendations derived from the RSA'], [], ['#', 'Recommendation', 'RSA trigger', 'Horizon', 'Suggested lead', 'Output / KPI', 'Metrics expected to move', 'Status'],
            ...(a.actionPlan || []).map((x, i) => [i + 1, x.title, x.trigger || '', x.horizon || '', x.lead || '', x.output || '', (x.metrics || []).join(', '), x.status || ''])],
        [5, 56, 18, 22, 22, 32, 14, 12], { head: 2, edit: [1, 2, 3, 4, 5, 6, 7] });

        // 14/15. Project data
        const projectSheet = (role, data) => {
            const rows = [[`${role === 'source' ? 'SOURCE PROJECT' : 'REPLICATION SITE'} — PROJECT DATA`], ['Values the assessment used (project data plus values added by the team). Keep the Key column as it is.'], [], ['Field', 'Value', 'Unit', 'Notes', 'Key']];
            RSA.ExcelProjects.fields().forEach((f) => {
                let v = data ? U.get(data, f.key) : null;
                if (f.key === 'version') v = data && data.version; if (f.key === 'lastUpdated') v = data && data.lastUpdated;
                if (role === 'source' && f.key === 'targetTechnologies') return;
                rows.push([f.label, v === null || v === undefined || (Array.isArray(v) && !v.length) ? null : cellOf(v), f.unit || '', '', f.key]);
            });
            return rows;
        };
        if (src) add('14. Source Project', projectSheet('source', { ...src, version: a.pdm.source.version, lastUpdated: a.pdm.source.lastUpdated }), [34, 46, 11, 20, 30], { head: 3, edit: [1], key: 4 });
        if (site) add('15. Replication Site', projectSheet('site', { ...site, version: a.pdm.site.version, lastUpdated: a.pdm.site.lastUpdated }), [34, 46, 11, 20, 30], { head: 3, edit: [1], key: 4 });

        // 16. Team
        add('16. Team', [['ASSESSMENT TEAM'], ['Role: Lead assessor, Assessor, Domain expert or Reviewer. Dimensions: the dimensions the person scores.'], [], ['Name', 'Role', 'Organisation', 'Expertise', 'Dimensions', 'Email'],
            ...a.team.map((t) => [t.name, ROLE_LABEL[t.role] || t.role, t.organisation || '', t.expertise || '', (t.dimensions || []).join(', '), t.email || ''])],
        [30, 16, 30, 30, 20, 30], { head: 3, edit: [0, 1, 2, 3, 4, 5] });

        // 17. Screening
        const sd = RSA.Scoring.screeningDecision(a.screening.answers);
        add('17. Screening', [['LEVEL 1 SCREENING'], ['Answer: Yes / Uncertain / No.'], [], ['#', 'Question', 'Answer', 'Note'],
            ...M.screeningQuestions.map((q, i) => { const x = a.screening.answers[i] || {}; return [q.id, q.text, x.value ? x.value.charAt(0).toUpperCase() + x.value.slice(1) : '', x.note || '']; }),
            [], ['Outcome', sd.label], ['Confirmed by', a.screening.confirmedBy ? (member(a.screening.confirmedBy) || {}).name || '' : '']],
        [6, 60, 12, 50], { head: 3, to: 3 + M.screeningQuestions.length, edit: [2, 3] });

        wb.SheetNames.forEach((n) => { const look = { ...(looks[n] || {}), dark: DARK_HEAD.test(n) }; if (look.ref) { decorate(XLSX, wb.Sheets[n], { dark: look.dark }); return; } decorate(XLSX, wb.Sheets[n], look); });
        return { wb, XLSX };
    }

    async function download(app, a) {
        const { wb, XLSX } = await build(app, a);
        XLSX.writeFile(wb, `${U.slug(a.title)}.rsa.xlsx`, { compression: true });
    }

    RSA.ExcelExport = { build, download };
})(window.RSA);
