/* Calculations: dimension scores, RSS, evidence quality, confidence, completion and risk summaries. */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;
    const LEVEL = { Low: 1, Medium: 2, High: 3 };

    const isSet = (v) => v !== '' && v !== null && v !== undefined && !isNaN(v);

    const S = {
        /* Reviewer-agreed final score takes precedence over the assessor score. */
        effectiveScore(st) {
            if (!st) return null;
            if (isSet(st.finalScore)) return Number(st.finalScore);
            if (isSet(st.score)) return Number(st.score);
            return null;
        },

        riskRating(r) {
            const v = (LEVEL[r.likelihood] || 2) * (LEVEL[r.impact] || 2);
            return v >= 6 ? 'High' : v >= 3 ? 'Medium' : 'Low';
        },
        riskUnresolved(r) { return r.status === 'Open' || r.status === 'Mitigating'; },

        screeningDecision(answers) {
            const values = answers.map((a) => a.value);
            const answered = values.filter(Boolean).length;
            if (answered < values.length) return { label: 'Incomplete', note: `Answer all ${values.length} questions.`, cls: 'neutral', answered };
            if (values.includes('no')) return { label: 'NO-GO', note: 'At least one foundational condition is not met. Resolve it before a detailed assessment.', cls: 'danger', answered };
            if (values.includes('uncertain')) return { label: 'MAYBE', note: 'Clarify uncertain items before committing resources to the detailed assessment.', cls: 'warning', answered };
            return { label: 'GO', note: 'All five initial conditions appear to be met. Proceed to Level 2.', cls: 'success', answered };
        },

        compute(a) {
            M.useWeights(a);
            const evidenceById = Object.fromEntries((a.evidence || []).map((e) => [e.id, e]));
            const metrics = M.allMetrics().map((m) => {
                const st = a.metrics[m.id];
                const eff = S.effectiveScore(st);
                const ev = (st.evidenceIds || []).map((id) => evidenceById[id]).filter(Boolean);
                const bestRel = ev.reduce((best, e) => Math.max(best, Number(e.reliability) || 0), 0);
                return { ...m, st, eff, evidence: ev, evCount: ev.length, bestRel, confidence: isSet(st.confidence) ? Number(st.confidence) : null };
            });

            const dims = M.dimensions.map((d) => {
                const ms = metrics.filter((x) => x.dimensionId === d.id);
                const vals = ms.map((x) => x.eff).filter((v) => v !== null);
                return {
                    ...d,
                    metricsState: ms,
                    score: vals.length ? U.avg(vals) : null,
                    scored: vals.length,
                    approved: ms.filter((x) => x.st.status === 'Approved').length,
                    reviewed: ms.filter((x) => ['Reviewed', 'Approved'].includes(x.st.status)).length,
                    evidenced: ms.filter((x) => x.evCount > 0).length
                };
            });

            const count = (fn) => metrics.filter(fn).length;
            const scored = count((x) => x.eff !== null);
            const approved = count((x) => x.st.status === 'Approved');
            const reviewed = count((x) => ['Reviewed', 'Approved'].includes(x.st.status));
            const submitted = count((x) => ['Submitted', 'Reviewed', 'Approved'].includes(x.st.status));
            const evidenced = count((x) => x.evCount > 0);
            const total = metrics.length;

            const rss = dims.every((d) => d.score !== null) ? dims.reduce((sum, d) => sum + d.score * d.weight, 0) : null;
            const rssStatus = rss === null ? 'insufficient' : approved === total ? 'final' : scored === total ? 'provisional-complete' : 'provisional';

            const confVals = metrics.map((x) => x.confidence).filter((v) => v !== null);
            const confidence = confVals.length ? U.avg(confVals) : null;
            const evidenceQuality = U.avg(metrics.map((x) => x.bestRel));
            const lowConfidence = metrics.filter((x) => x.eff !== null && (x.confidence === null || x.confidence <= 25));

            const risks = a.risks || [];
            const unresolved = risks.filter(S.riskUnresolved);
            const highUnresolved = unresolved.filter((r) => S.riskRating(r) === 'High');
            const criticalUnresolved = unresolved.filter((r) => r.critical);

            const screening = S.screeningDecision(a.screening.answers);
            const parts = {
                screening: screening.answered / M.screeningQuestions.length,
                scored: scored / total,
                evidenced: evidenced / total,
                approved: approved / total
            };
            const completion = U.avg(Object.values(parts)) * 100;

            return {
                metrics, dims, total, scored, approved, reviewed, submitted, evidenced,
                rss, rssStatus, guidance: M.decisionFor(rss),
                confidence, evidenceQuality, lowConfidence,
                risks: { all: risks, unresolved, highUnresolved, criticalUnresolved },
                screening, completion, completionParts: parts,
                statusCounts: M.metricStatuses.reduce((acc, s) => ({ ...acc, [s]: count((x) => x.st.status === s) }), {})
            };
        },

        /* Open issues that the human decision-maker must see before finalising. */
        openIssues(a, calc) {
            const issues = [];
            if (calc.screening.label === 'Incomplete') issues.push({ severity: 'warning', text: 'Level 1 screening is incomplete.', view: 'screening' });
            if (calc.screening.label === 'NO-GO') issues.push({ severity: 'danger', text: 'Level 1 screening returned NO-GO.', view: 'screening' });
            const notApproved = calc.metrics.filter((x) => x.st.status !== 'Approved');
            if (notApproved.length) issues.push({ severity: 'warning', text: `${notApproved.length} metric(s) not yet approved: ${notApproved.map((x) => x.id).join(', ')}.`, view: 'assessment' });
            const noEvidence = calc.metrics.filter((x) => x.evCount === 0);
            if (noEvidence.length) issues.push({ severity: 'warning', text: `${noEvidence.length} metric(s) without linked evidence: ${noEvidence.map((x) => x.id).join(', ')}.`, view: 'evidence' });
            if (calc.lowConfidence.length) issues.push({ severity: 'info', text: `${calc.lowConfidence.length} scored metric(s) with low or missing confidence: ${calc.lowConfidence.map((x) => x.id).join(', ')}.`, view: 'assessment' });
            calc.risks.criticalUnresolved.forEach((r) => issues.push({ severity: 'danger', text: `Critical risk unresolved: ${r.description}`, view: 'risks' }));
            const nonCriticalHigh = calc.risks.highUnresolved.filter((r) => !r.critical);
            if (nonCriticalHigh.length) issues.push({ severity: 'warning', text: `${nonCriticalHigh.length} other high-rated risk(s) unresolved.`, view: 'risks' });
            const changes = (a.pdm.pendingChanges.source || []).length + (a.pdm.pendingChanges.site || []).length;
            if (changes) issues.push({ severity: 'warning', text: `PDM source data changed since the snapshot (${changes} field(s)). Review before finalising.`, view: 'projects' });
            return issues;
        }
    };

    RSA.Scoring = S;
})(window.RSA);
