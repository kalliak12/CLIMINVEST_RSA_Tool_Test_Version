/* Assessment data model, factories and migrations (schema v2). */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;
    const SCHEMA = 2;

    const newMetricState = () => ({
        assessorId: '', reviewerId: '',
        score: '', confidence: '', assumptions: '', rationale: '', rationaleAiAssisted: false, scoreAiAssisted: false,
        evidenceIds: [],
        reviewerComment: '', finalScore: '',
        status: 'Not started',
        updatedAt: null, updatedBy: null, submittedAt: null, reviewedAt: null, reviewedBy: null, approvedAt: null, approvedBy: null
    });

    const newReport = () => ({
        executiveSummary: '', dimensionalAssessment: '', criticalSuccessFactors: '', adaptationRoadmap: '',
        capacityBuilding: '', financialSummary: '', nextSteps: ''
    });

    const newAssessment = (opts = {}) => {
        const now = U.nowIso();
        const team = opts.team || [];
        return {
            id: U.uid('RSA'),
            schemaVersion: SCHEMA,
            methodologyVersion: M.version,
            weights: opts.weights ? { ...opts.weights } : M.defaultWeights(),
            createdAt: now, updatedAt: now,
            title: opts.title || 'New replication assessment',
            project: { adaptationType: '', assessmentDate: U.today(), organisation: '', scope: '', notes: '' },
            provenance: {},
            pdm: {
                sourceId: '', siteId: '', source: null, site: null, manual: { source: {}, site: {} }, snapshotHistory: [], lastCheckedAt: null, pendingChanges: { source: [], site: [] },
                sync: { status: 'not-synced', lastPushAt: null, receiptId: null, pushedFingerprint: null, history: [] }
            },
            team,
            currentUserId: team[0] ? team[0].id : '',
            screening: { answers: M.screeningQuestions.map(() => ({ value: '', note: '' })), confirmedBy: null, confirmedAt: null },
            metrics: Object.fromEntries(M.allMetrics().map((m) => [m.id, newMetricState()])),
            evidence: [],
            risks: [],
            recommendations: { statuses: {} },
            actionPlan: [],
            decision: { value: '', conditions: '', rationale: '', finalised: false, finalisedBy: null, finalisedAt: null, acknowledgedOpenIssues: false },
            report: newReport(),
            audit: [],
            aiLog: []
        };
    };

    /* Fill any missing fields (older exports, partial imports). */
    const normalise = (a) => {
        const base = newAssessment({ team: a.team || [] });
        const out = { ...base, ...a };
        out.project = { ...base.project, ...(a.project || {}) };
        out.provenance = { ...(a.provenance || {}) };
        out.pdm = { ...base.pdm, ...(a.pdm || {}) };
        out.pdm.pendingChanges = { source: [], site: [], ...(out.pdm.pendingChanges || {}) };
        out.pdm.sync = { ...base.pdm.sync, ...((a.pdm && a.pdm.sync) || {}) };
        out.pdm.snapshotHistory = out.pdm.snapshotHistory || [];
        out.pdm.manual = { source: {}, site: {}, ...(out.pdm.manual || {}) };
        out.screening = { ...base.screening, ...(a.screening || {}) };
        out.screening.answers = base.screening.answers.map((x, i) => ({ ...x, ...((a.screening && a.screening.answers && a.screening.answers[i]) || {}) }));
        out.metrics = Object.fromEntries(M.allMetrics().map((m) => [m.id, { ...newMetricState(), ...((a.metrics && a.metrics[m.id]) || {}) }]));
        Object.values(out.metrics).forEach((m) => { m.evidenceIds = Array.isArray(m.evidenceIds) ? m.evidenceIds : []; });
        out.evidence = (a.evidence || []).map((e) => ({ metricIds: [], ...e }));
        out.risks = a.risks || [];
        out.actionPlan = Array.isArray(a.actionPlan) ? a.actionPlan : [];
        out.weights = M.weightsOf(a);
        out.recommendations = { statuses: {}, ...(a.recommendations || {}) };
        out.decision = { ...base.decision, ...(a.decision || {}) };
        out.report = { ...newReport(), ...(a.report || {}) };
        out.audit = a.audit || [];
        out.aiLog = a.aiLog || [];
        out.team = a.team || [];
        if (!out.team.some((t) => t.id === out.currentUserId)) out.currentUserId = out.team[0] ? out.team[0].id : '';
        out.schemaVersion = SCHEMA;
        return out;
    };

    /* Migrate the v1 single-assessment state of the first prototype. */
    const fromLegacy = (v1) => {
        const lead = { id: U.uid('usr'), name: (v1.project && v1.project.assessedBy) || 'Lead Assessor', organisation: (v1.project && v1.project.organization) || '', role: 'lead', expertise: 'Imported from v1', dimensions: ['D1', 'D2', 'D3', 'D4', 'D5'], email: '' };
        const a = newAssessment({ title: `${(v1.project && v1.project.originalProject) || 'Source'} → ${(v1.project && v1.project.replicationSite) || 'Site'} (imported v1)`, team: [lead] });
        a.project.adaptationType = (v1.project && v1.project.adaptationType) || '';
        a.project.assessmentDate = (v1.project && v1.project.assessmentDate) || U.today();
        a.project.organisation = (v1.project && v1.project.organization) || '';
        a.project.notes = `Imported from prototype v1. Original project: ${(v1.project && v1.project.originalProject) || '—'}; replication site: ${(v1.project && v1.project.replicationSite) || '—'}.`;
        (v1.screening || []).forEach((v, i) => { if (a.screening.answers[i]) a.screening.answers[i].value = v || ''; });
        Object.entries(v1.metrics || {}).forEach(([id, m]) => {
            if (!a.metrics[id]) return;
            const st = a.metrics[id];
            st.score = m.score === undefined ? '' : String(m.score);
            st.assumptions = m.assumptions || '';
            st.confidence = m.confidence || '';
            st.assessorId = lead.id;
            if (m.source && m.source.trim()) {
                const ev = { id: U.uid('EV'), title: m.source.trim(), sourceType: 'Project document', provider: '', date: '', url: '', assumptions: '', reliability: m.confidence || '', notes: 'Migrated from v1 evidence field', provenance: 'human', metricIds: [id], createdBy: lead.id, createdAt: U.nowIso() };
                a.evidence.push(ev);
                st.evidenceIds.push(ev.id);
            }
            if (st.score !== '' || st.assumptions || st.confidence) st.status = 'Draft';
        });
        a.risks = (v1.risks || []).map((r) => ({
            id: U.uid('RK'), description: r.description || '', dimension: (r.dimension || 'D1').slice(0, 2), likelihood: r.likelihood || 'Medium', impact: r.impact || 'Medium',
            mitigation: r.mitigation || '', owner: '', status: 'Open', critical: false, createdBy: lead.id, createdAt: U.nowIso()
        }));
        const rep = v1.report || {};
        Object.keys(a.report).forEach((k) => { if (rep[k]) a.report[k] = rep[k]; });
        if (rep.risksAndMitigation) a.report.nextSteps = `${a.report.nextSteps}\n${rep.risksAndMitigation}`.trim();
        a.audit.push({ id: U.uid('AU'), at: U.nowIso(), userId: lead.id, userName: lead.name, action: 'Imported', entity: 'assessment', entityId: a.id, detail: 'Migrated from prototype v1 state' });
        return a;
    };

    RSA.Model = { SCHEMA, newMetricState, newAssessment, normalise, fromLegacy, newReport };
})(window.RSA);
