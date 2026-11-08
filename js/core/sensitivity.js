/*
 * Sensitivity analysis, recalculated live from the current scores and weights.
 *  - Scenarios: metric-level score changes (imported from the workbook's Sensitivity Analysis sheet).
 *  - Stress tests: dimension changes ("D3 x 0.8", "D2 +10 points") and alternative weights
 *    ("Alternative weights D1 15/D2 25/D3 25/D4 15/D5 20"). The workbook's tests are used when present,
 *    otherwise a standard set.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology;
    const DEFAULT_TESTS = ['D3 x 0.8 (financial stress)', 'D5 x 1.15 (capacity building, capped at 100)',
        ...['D1', 'D2', 'D3', 'D4', 'D5'].flatMap((d) => [`${d} +10 points`, `${d} -10 points`])].map((description, i) => ({ id: `T${i + 1}`, description }));

    const rssOf = (dimScores, weights) => (Object.values(dimScores).some((v) => v === null) ? null : M.dimensions.reduce((s, d) => s + dimScores[d.id] * weights[d.id] / 100, 0));
    const clamp = (v) => U.clamp(v, 0, 100);

    function scenarioRss(a, calc, scores) {
        const dims = {};
        M.dimensions.forEach((d) => {
            const vals = calc.metrics.filter((x) => x.dimensionId === d.id).map((x) => (scores[x.id] !== undefined ? scores[x.id] : x.eff)).filter((v) => v !== null && v !== undefined);
            dims[d.id] = vals.length ? U.avg(vals) : null;
        });
        return rssOf(dims, M.weightsOf(a));
    }

    function testRss(a, calc, description) {
        const base = Object.fromEntries(calc.dims.map((d) => [d.id, d.score]));
        let weights = M.weightsOf(a);
        const t = description;
        let m = /\b(D[1-5])\s*[x×*]\s*([\d.]+)/i.exec(t);
        if (m) base[m[1].toUpperCase()] = base[m[1].toUpperCase()] === null ? null : clamp(base[m[1].toUpperCase()] * Number(m[2]));
        else if ((m = /\b(D[1-5])\s*([+-−])\s*(\d+(?:\.\d+)?)\s*points?/i.exec(t))) {
            const k = m[1].toUpperCase(); const sign = m[2] === '+' ? 1 : -1;
            base[k] = base[k] === null ? null : clamp(base[k] + sign * Number(m[3]));
        } else if (/weights?/i.test(t) && /D1\s*\d/.test(t)) {
            const w = {}; (t.match(/D[1-5]\s*\d+(?:\.\d+)?/g) || []).forEach((x) => { const mm = /(D[1-5])\s*(\d+(?:\.\d+)?)/.exec(x); w[mm[1]] = Number(mm[2]); });
            if (Object.keys(w).length !== 5) return null;
            weights = w;
        } else return null;
        return rssOf(base, weights);
    }

    function compute(a, calc) {
        const current = calc.rss;
        const sens = a.sensitivity || null;
        const scenarios = (sens ? sens.scenarios : []).map((sc) => {
            const rss = scenarioRss(a, calc, sc.scores);
            const changed = Object.entries(sc.scores).filter(([id, v]) => { const x = calc.metrics.find((y) => y.id === id); return x && x.eff !== v; }).map(([id, v]) => `${id} → ${v}`);
            return { ...sc, rss, band: M.decisionFor(rss), change: rss !== null && current !== null ? rss - current : null, changed };
        });
        const tests = ((sens && sens.tests.length) ? sens.tests : DEFAULT_TESTS).map((x) => {
            const rss = testRss(a, calc, x.description);
            return { ...x, rss, change: rss !== null && current !== null ? rss - current : null };
        });
        return { current, scenarios, tests, source: sens ? sens.source : null, intro: sens ? sens.intro : '' };
    }

    RSA.Sensitivity = { compute };
})(window.RSA);
