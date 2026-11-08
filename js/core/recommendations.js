/*
 * Recommendation engines.
 *  - Improvement: matches the configurable catalogue against low scores, low confidence, evidence gaps and risks.
 *  - Better match: transparent similarity between the replication site and every PDM source project using the
 *    same five RSA dimensions and the assessment's weights. Each dimension averages several metric-level indicators,
 *    so no single metric can drive the ranking.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;
    const S = RSA.Scoring;

    const Improvement = {
        generate(a, catalogue, calc) {
            const byId = Object.fromEntries(calc.metrics.map((x) => [x.id, x]));
            const out = [];
            (catalogue.entries || []).filter((e) => e.enabled !== false).forEach((entry) => {
                const reasons = [];
                let weight = 0;
                const affected = new Set();
                const t = entry.triggers || {};
                (entry.metrics || []).forEach((id) => {
                    const x = byId[id];
                    if (!x) return;
                    const dimW = 1 + x.weight;
                    if (t.belowScore !== undefined && x.eff !== null && x.eff < t.belowScore) {
                        const sev = x.eff < 40 ? 3 : x.eff < 55 ? 2.2 : 1.5;
                        reasons.push({ kind: 'score', text: `${id} ${x.name} scored ${Math.round(x.eff)} (below ${t.belowScore})`, metricId: id });
                        weight = Math.max(weight, sev * dimW); affected.add(id);
                    }
                    if (t.lowConfidence && x.eff !== null && x.confidence !== null && x.confidence <= 25) {
                        reasons.push({ kind: 'confidence', text: `${id} has low assessor confidence`, metricId: id });
                        weight = Math.max(weight, 1.6 * dimW); affected.add(id);
                    }
                    if (t.evidenceGap && x.evCount === 0) {
                        reasons.push({ kind: 'evidence', text: `${id} has no linked evidence`, metricId: id });
                        weight = Math.max(weight, 1.2 * dimW); affected.add(id);
                    }
                });
                (t.riskDimensions || []).forEach((dimId) => {
                    calc.risks.unresolved.filter((r) => r.dimension === dimId && (r.critical || S.riskRating(r) === 'High')).forEach((r) => {
                        reasons.push({ kind: 'risk', text: `${r.critical ? 'Critical' : 'High'} unresolved risk (${dimId}): ${r.description}`, riskId: r.id });
                        weight = Math.max(weight, (r.critical ? 3.2 : 2.2) * (1 + M.dimension(dimId).weight));
                    });
                });
                if (!reasons.length) return;
                const priority = weight >= 3.3 ? 'High' : weight >= 2.1 ? 'Medium' : 'Low';
                /* Potential RSS gain if each affected metric moved up to the next scoring band. */
                const gainIds = affected.size ? [...affected] : (entry.metrics || []);
                const gain = gainIds.reduce((sum, id) => {
                    const x = byId[id];
                    if (!x || x.eff === null) return sum;
                    const next = x.criteria.map((c) => c.score).sort((p, q) => p - q).find((v) => v > x.eff);
                    return next === undefined ? sum : sum + ((next - x.eff) * x.weight) / 4;
                }, 0);
                const saved = (a.recommendations.statuses || {})[entry.id] || {};
                const affectedIds = affected.size ? [...affected] : (entry.metrics || []);
                out.push({
                    key: entry.id, entry, reasons, weight, priority, gain,
                    metrics: affectedIds,
                    dimensions: [...new Set(affectedIds.map((id) => (M.dimensionOfMetric(id) || {}).id).filter(Boolean))],
                    status: saved.status || 'Proposed', note: saved.note || '', updatedBy: saved.updatedBy || null, updatedAt: saved.updatedAt || null
                });
            });
            const rank = { High: 0, Medium: 1, Low: 2 };
            return out.sort((x, y) => rank[x.priority] - rank[y.priority] || y.gain - x.gain || y.weight - x.weight);
        }
    };

    const Match = {
        compare(source, site) {
            const dims = M.dimensions.map((d) => {
                const factors = d.metrics.map((m) => {
                    const ind = RSA.Indicators.compute(m.id, source, site);
                    return { metricId: m.id, name: m.name, score: ind ? ind.score : null, detail: ind ? ind.detail : 'Insufficient PDM data for this indicator.' };
                });
                const vals = factors.map((x) => x.score).filter((v) => v !== null);
                return { id: d.id, name: d.name, short: d.short, weight: d.weight, score: vals.length ? U.avg(vals) : null, coverage: vals.length, factors };
            });
            const withScore = dims.filter((d) => d.score !== null);
            const wSum = withScore.reduce((s, d) => s + d.weight, 0);
            const overall = wSum ? withScore.reduce((s, d) => s + d.score * d.weight, 0) / wSum : null;
            const gaps = dims.flatMap((d) => d.factors.filter((f) => f.score !== null && f.score < 50).map((f) => ({ ...f, dimension: d.short })));
            const dataCoverage = dims.reduce((s, d) => s + d.coverage, 0);
            return { sourceId: source.id, source, overall, dims, gaps, dataCoverage };
        },

        rank(site, sources, currentSourceId) {
            if (!site) return [];
            const results = sources.map((s) => Match.compare(s, site));
            const current = results.find((r) => r.sourceId === currentSourceId) || null;
            results.forEach((r) => {
                r.isCurrent = r.sourceId === currentSourceId;
                r.deltaVsCurrent = current && !r.isCurrent && r.overall !== null && current.overall !== null ? r.overall - current.overall : null;
                r.dimDeltas = current ? r.dims.map((d, i) => ({ id: d.id, short: d.short, delta: d.score !== null && current.dims[i].score !== null ? d.score - current.dims[i].score : null })) : [];
                r.explanation = Match.explain(r, current);
            });
            return results.sort((x, y) => (y.overall ?? -1) - (x.overall ?? -1));
        },

        explain(r, current) {
            if (r.isCurrent) return 'Current source project of this assessment (reference for comparison).';
            if (!current) return `Overall match ${U.fmtScore(r.overall)} based on ${r.dataCoverage} PDM indicators.`;
            const better = r.dimDeltas.filter((d) => d.delta !== null && d.delta >= 5).sort((x, y) => y.delta - x.delta);
            const worse = r.dimDeltas.filter((d) => d.delta !== null && d.delta <= -5).sort((x, y) => x.delta - y.delta);
            const parts = [];
            if (r.deltaVsCurrent !== null) parts.push(`${r.deltaVsCurrent >= 0 ? 'Better' : 'Weaker'} overall match than the current source (${r.deltaVsCurrent >= 0 ? '+' : ''}${r.deltaVsCurrent.toFixed(1)} points).`);
            if (better.length) parts.push(`Stronger on ${better.map((d) => `${d.short} (+${d.delta.toFixed(0)})`).join(', ')}.`);
            if (worse.length) parts.push(`Weaker on ${worse.map((d) => `${d.short} (${d.delta.toFixed(0)})`).join(', ')}.`);
            if (!better.length && !worse.length) parts.push('Similar profile across all five dimensions.');
            return parts.join(' ');
        }
    };

    RSA.Recommend = { Improvement, Match };
})(window.RSA);
