/*
 * Demo assessment: SOLVATE (Lake Plastira, GR) → FAEN Narcea Canal (Asturias, ES).
 * Team members are fictional demo users. Scores, evidence and risks are illustrative.
 * The site snapshot deliberately uses PDM version 2 so the "changed source data" warning can be demonstrated.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;

    const TEAM = [
        { id: 'usr-lead', name: 'Lucía Álvarez', organisation: 'FAEN', role: 'lead', expertise: 'Energy planning, project lead', email: 'lead@example.org', dimensions: ['D1', 'D2', 'D3', 'D4', 'D5'] },
        { id: 'usr-tech', name: 'Nikos Papadakis', organisation: 'NOVO', role: 'assessor', expertise: 'PV engineering, water–energy modelling', email: 'tech@example.org', dimensions: ['D1', 'D2'] },
        { id: 'usr-fin', name: 'Elena Rossi', organisation: 'INNOV', role: 'assessor', expertise: 'Project finance, bankability', email: 'finance@example.org', dimensions: ['D3'] },
        { id: 'usr-esg', name: 'Marta Suárez', organisation: 'FAEN', role: 'expert', expertise: 'ESG, stakeholder engagement', email: 'esg@example.org', dimensions: ['D4'] },
        { id: 'usr-inst', name: 'Javier Menéndez', organisation: 'FAEN', role: 'expert', expertise: 'Governance & institutional capacity', email: 'inst@example.org', dimensions: ['D5'] },
        { id: 'usr-rev', name: 'Anna Weber', organisation: 'Independent validator', role: 'reviewer', expertise: 'Climate-investment due diligence', email: 'review@example.org', dimensions: ['D1', 'D2', 'D3', 'D4', 'D5'] }
    ];

    const DIM_ASSESSOR = { D1: 'usr-tech', D2: 'usr-tech', D3: 'usr-fin', D4: 'usr-esg', D5: 'usr-inst' };

    /* [status, score, confidence, finalScore, rationale, assumptions, evidenceKeys, reviewerComment] */
    const SEED = {
        '1.1': ['Approved', 50, 75, 50, 'Csa (Thessaly) vs Cfb (Asturias): same main group C, different precipitation regime. Mean temperature 3 °C lower and precipitation ~70% higher at the site.', 'Köppen class from AEMET/ERA5; long-term means 1991–2020.', ['E2'], 'Agree with "related zones" band.'],
        '1.2': ['Approved', 50, 100, 50, 'GHI at the site is ≈1,250 vs ≈1,600 kWh/m²/yr at the source (−22%), which falls in the ±25–35% band after including seasonal profile.', 'AEMET radiation series; PVGIS cross-check.', ['E1', 'E2'], ''],
        '1.3': ['Reviewed', 55, 50, 50, 'Source addresses drought/water scarcity; at the site drought is seasonal and secondary to heavy precipitation.', 'CMIP6 SSP2-4.5 used for projections.', ['E2'], 'Primary hazard differs — lowered to 50.'],
        '1.4': ['Submitted', 55, 50, '', 'Benefits flow mainly to industrial and public water supply; direct vulnerable-population reach is limited.', 'Public-supply share from CADASA records.', ['E11'], ''],
        '2.1': ['Approved', 55, 75, 55, 'Canal-top PV is TRL 7 in SOLVATE with one year of operation; comparable deployments exist elsewhere (TRL 8).', 'International references considered as track record.', ['E3'], ''],
        '2.2': ['Draft', 45, 50, '', 'The ~2.4 m canal width requires a new structural layout; reaching 2.5 MWp may require a hybrid with floating PV on reservoirs.', 'Structural concept not yet engineered.', ['E1', 'E6'], ''],
        '2.3': ['Submitted', 50, 50, '', 'Specific yield expected ≈15–20% lower due to irradiance, partly offset by cooler operation.', 'Preliminary PVSol estimate; SDM run pending.', ['E3', 'E4', 'E6'], ''],
        '2.4': ['Approved', 80, 75, 80, 'Mature Spanish PV supply chain; O&M can be contracted locally, operator training needed for water-side works.', '', [], ''],
        '3.1': ['Draft', 60, 25, '', 'Local cost index similar to the source, but narrow-canal structures add a premium not yet quantified.', 'Premium assumed 10–20% on structures; single indicative quote.', ['E10'], ''],
        '3.2': ['Reviewed', 75, 75, 72, 'Pumping load (≈586 MWh/month) allows high self-consumption; surplus sales uncertain.', 'Self-consumption share ≥80% of production.', ['E1', 'E5'], 'Agreed at 72 pending grid-connection terms.'],
        '3.3': ['Not started', '', '', '', '', '', [], ''],
        '3.4': ['Draft', 50, 50, '', 'Blended structure expected (regional funds + green loan); no lender engagement yet.', '', [], ''],
        '4.1': ['Submitted', 70, 50, '', 'GHG benefit comparable; evaporation benefit smaller in a humid climate.', 'Grid emission factor Spain 2025.', [], ''],
        '4.2': ['Draft', 40, 50, '', 'Limited direct benefit to vulnerable groups; indirect benefit via public-supply costs.', '', ['E7'], ''],
        '4.3': ['Reviewed', 60, 75, 60, 'FAEN, CADASA and AEMET engaged; concession holder engagement ongoing; governance of ownership not yet defined.', '', ['E7'], 'Governance of PV ownership still open.'],
        '4.4': ['Not started', '', '', '', '', '', [], ''],
        '5.1': ['Approved', 75, 75, 75, 'FAEN operates standardised project processes (maturity level 4).', '', ['E9'], ''],
        '5.2': ['Submitted', 70, 50, '', 'Strong energy-planning skills; PV-over-water design skills need external support.', '', [], ''],
        '5.3': ['Draft', 55, 25, '', 'Three comparable energy projects; largest ~€3M, similar to the expected CAPEX.', 'Portfolio list not yet verified.', ['E9'], ''],
        '5.4': ['Approved', 85, 100, 85, 'Unqualified audits and extensive EU-funded project experience.', '', ['E8'], '']
    };

    const EVIDENCE = [
        { key: 'E1', title: 'FAEN replication datasets — Narcea Canal', sourceType: 'PDM record', provider: 'FAEN', date: '2026-09-15', reliability: '75', provenance: 'pdm', pdmDocId: 'DOC-FAEN-01', assumptions: 'Monthly averages representative of a typical year.', notes: 'Canal geometry, pumping capacity, reservoir volumes, demand.' },
        { key: 'E2', title: 'AEMET precipitation, solar radiation & temperature series', sourceType: 'Climate / resource dataset', provider: 'AEMET', date: '2026-07-01', reliability: '100', provenance: 'pdm', pdmDocId: 'DOC-FAEN-03', assumptions: '1991–2020 climate normals.', notes: '' },
        { key: 'E3', title: 'PV feasibility inputs for canal installation (tilt, layout, kWp, inverter)', sourceType: 'Project document', provider: 'SolarKapital', date: '2026-02-12', reliability: '75', provenance: 'pdm', pdmDocId: 'DOC-SOL-02', assumptions: '', notes: 'Source project (SOLVATE).' },
        { key: 'E4', title: 'SOLVATE System Dynamics Model calibration & datasets', sourceType: 'Project document', provider: 'NOVO / CLIMINVEST', date: '2026-03-31', reliability: '75', provenance: 'pdm', pdmDocId: 'DOC-SOL-01', assumptions: '', notes: 'Source project (SOLVATE).' },
        { key: 'E5', title: 'Quinzanas pumping station — abstraction & electricity records', sourceType: 'Site survey / measurement', provider: 'Concession holder', date: '2026-09-10', reliability: '100', provenance: 'pdm', pdmDocId: 'DOC-FAEN-02', assumptions: '', notes: 'Average 586.3 MWh/month pumping consumption.' },
        { key: 'E6', title: 'Canal geometry & PV feasibility survey (17.6 km, ~2.4 m width)', sourceType: 'Site survey / measurement', provider: 'FAEN', date: '2026-08-22', reliability: '75', provenance: 'pdm', pdmDocId: 'DOC-FAEN-05', assumptions: '', notes: '' },
        { key: 'E7', title: 'FAEN stakeholder workshop notes (concession holder, CADASA, AEMET)', sourceType: 'Stakeholder interview / workshop', provider: 'FAEN', date: '2026-09-04', reliability: '50', provenance: 'human', assumptions: 'Positions expressed informally; no signed commitments.', notes: '' },
        { key: 'E8', title: 'FAEN audited financial statements 2025', sourceType: 'Official statistics', provider: 'FAEN / external auditor', date: '2026-04-30', reliability: '100', provenance: 'human', assumptions: '', notes: 'Unqualified opinion.' },
        { key: 'E9', title: 'FAEN project portfolio 2019–2025', sourceType: 'Project document', provider: 'FAEN', date: '2026-09-01', reliability: '50', provenance: 'human', assumptions: 'Self-reported budgets.', notes: '' },
        { key: 'E10', title: 'Indicative quote — PV support structures for narrow canals', sourceType: 'Financial model / quote', provider: 'Local installer (anonymised)', date: '2026-09-12', reliability: '50', provenance: 'human', assumptions: 'Single quote; ±20% accuracy.', notes: 'Level 3 requires 3+ competitive quotes.' },
        { key: 'E11', title: 'CADASA public-supply demand records', sourceType: 'Official statistics', provider: 'CADASA', date: '2026-06-30', reliability: '75', provenance: 'pdm', pdmDocId: 'DOC-FAEN-04', assumptions: '', notes: '' }
    ];

    const RISKS = [
        { description: 'Narrow canal (~2.4 m) limits canal-top PV capacity; the 2.5 MWp target may not fit on the canal alone.', dimension: 'D2', likelihood: 'High', impact: 'High', mitigation: 'Assess hybrid layout: canal-top sections plus floating PV on Trasona/La Granda reservoirs.', owner: 'usr-tech', status: 'Open', critical: true },
        { description: 'Legal right to install PV on concession-operated infrastructure not confirmed.', dimension: 'D4', likelihood: 'Medium', impact: 'High', mitigation: 'Legal review of concession terms; MoU with the concession holder.', owner: 'usr-lead', status: 'Mitigating', critical: true },
        { description: 'Surplus-energy sales depend on grid-connection capacity and the compensation scheme.', dimension: 'D3', likelihood: 'Medium', impact: 'High', mitigation: 'Request grid-access study; size the plant for self-consumption first.', owner: 'usr-fin', status: 'Open', critical: false },
        { description: 'Lower irradiance (≈−22%) reduces specific yield compared with the source.', dimension: 'D1', likelihood: 'High', impact: 'Medium', mitigation: 'Yield recalculated with local data and reflected in the financial model.', owner: 'usr-tech', status: 'Accepted', critical: false },
        { description: 'Possible biodiversity / water-quality effects of floating PV on reservoirs.', dimension: 'D4', likelihood: 'Low', impact: 'Medium', mitigation: 'Include monitoring programme in the ESMP.', owner: 'usr-esg', status: 'Open', critical: false }
    ];

    function olderSiteSnapshot(site) {
        const old = U.clone(site);
        old.version = 2;
        old.lastUpdated = '2026-07-02';
        old.technical.pumpingEnergyMwhMonth = 540;
        old.financial.projectedIrrPct = 5.6;
        old.financial.electricityPriceEurMwh = 104;
        old.documents = old.documents.filter((d) => d.id !== 'DOC-FAEN-05');
        return old;
    }

    RSA.Demo = {
        team: () => U.clone(TEAM),
        createAssessment() {
            const a = RSA.Model.newAssessment({ title: 'SOLVATE → FAEN Narcea Canal', team: U.clone(TEAM) });
            a.id = 'RSA-DEMO-SOLVATE-FAEN';
            a.createdAt = '2026-09-01T08:30:00.000Z';
            a.currentUserId = 'usr-lead';

            const source = RSA.PDM.getSync('PDM-SRC-001');
            const site = RSA.PDM.getSync('PDM-SITE-101');
            a.pdm.sourceId = source.id;
            a.pdm.siteId = site.id;
            a.pdm.source = { id: source.id, version: source.version, lastUpdated: source.lastUpdated, fetchedAt: '2026-09-02T09:00:00.000Z', data: source };
            const old = olderSiteSnapshot(site);
            a.pdm.site = { id: site.id, version: old.version, lastUpdated: old.lastUpdated, fetchedAt: '2026-09-02T09:00:00.000Z', data: old };

            a.project.adaptationType = source.adaptationType;
            a.project.assessmentDate = '2026-09-02';
            a.project.organisation = 'FAEN — Asturian Energy Foundation';
            a.project.scope = 'Replication of SOLVATE (PV over canals + water–energy SDM) on the Narcea Canal pumping and reservoir system.';
            a.provenance = { adaptationType: 'pdm', organisation: 'pdm', assessmentDate: 'human', scope: 'human' };

            a.screening.answers = [
                { value: 'yes', note: 'Pumping energy and seasonal drought create a clear water–energy need.' },
                { value: 'yes', note: 'Canal-top PV operating in SOLVATE and internationally.' },
                { value: 'yes', note: 'Indicative localised IRR ≈6% (PDM).' },
                { value: 'yes', note: 'FAEN committed as CLIMINVEST replicator.' },
                { value: 'uncertain', note: 'DNSH screening pending; concession rights to be confirmed.' }
            ];
            a.screening.confirmedBy = 'usr-lead';
            a.screening.confirmedAt = '2026-09-03T10:00:00.000Z';

            const evIds = {};
            EVIDENCE.forEach((e, i) => {
                const id = `EV-${String(i + 1).padStart(3, '0')}`;
                evIds[e.key] = id;
                const { key, ...rest } = e;
                a.evidence.push({ id, url: '', metricIds: [], createdBy: e.provenance === 'pdm' ? 'usr-lead' : DIM_ASSESSOR.D5, createdAt: '2026-09-05T09:00:00.000Z', ...rest });
            });

            Object.entries(SEED).forEach(([id, [status, score, conf, finalScore, rationale, assumptions, evKeys, reviewerComment]]) => {
                const st = a.metrics[id];
                const dim = `D${id[0]}`;
                st.assessorId = DIM_ASSESSOR[dim];
                st.reviewerId = 'usr-rev';
                st.status = status;
                st.score = score === '' ? '' : String(score);
                st.confidence = conf === '' ? '' : String(conf);
                st.finalScore = finalScore === '' ? '' : String(finalScore);
                st.rationale = rationale;
                st.assumptions = assumptions;
                st.reviewerComment = reviewerComment;
                st.evidenceIds = evKeys.map((k) => evIds[k]);
                st.evidenceIds.forEach((eid) => { const ev = a.evidence.find((x) => x.id === eid); if (ev && !ev.metricIds.includes(id)) ev.metricIds.push(id); });
                if (status !== 'Not started') { st.updatedAt = '2026-09-18T11:00:00.000Z'; st.updatedBy = st.assessorId; }
                if (['Submitted', 'Reviewed', 'Approved'].includes(status)) st.submittedAt = '2026-09-19T15:00:00.000Z';
                if (['Reviewed', 'Approved'].includes(status)) { st.reviewedAt = '2026-09-22T10:00:00.000Z'; st.reviewedBy = 'usr-rev'; }
                if (status === 'Approved') { st.approvedAt = '2026-09-24T16:30:00.000Z'; st.approvedBy = id === '1.1' || id === '1.2' ? 'usr-rev' : 'usr-lead'; }
            });

            a.risks = RISKS.map((r, i) => ({ id: `RK-${String(i + 1).padStart(3, '0')}`, createdBy: 'usr-lead', createdAt: '2026-09-10T09:00:00.000Z', ...r }));

            a.recommendations.statuses = {
                'CAT-TECH-ADAPT': { status: 'Accepted', note: 'Include reservoir floating-PV option.', updatedBy: 'usr-lead', updatedAt: '2026-09-25T09:00:00.000Z' },
                'CAT-FIN-MODEL': { status: 'In progress', note: 'Model update by INNOV.', updatedBy: 'usr-fin', updatedAt: '2026-09-25T09:10:00.000Z' },
                'CAT-ESG-DNSH': { status: 'Accepted', note: '', updatedBy: 'usr-esg', updatedAt: '2026-09-25T09:20:00.000Z' }
            };

            const log = (at, userId, action, entity, entityId, extra = {}) => a.audit.push({
                id: U.uid('AU'), at, userId, userName: (TEAM.find((t) => t.id === userId) || {}).name || 'System', action, entity, entityId,
                field: extra.field || '', from: extra.from || '', to: extra.to || '', detail: extra.detail || ''
            });
            log('2026-09-24T16:30:00.000Z', 'usr-lead', 'Status approve', 'metric', '5.4', { field: 'status', from: 'Reviewed', to: 'Approved' });
            log('2026-09-24T16:10:00.000Z', 'usr-rev', 'Status approve', 'metric', '1.2', { field: 'status', from: 'Reviewed', to: 'Approved' });
            log('2026-09-22T10:05:00.000Z', 'usr-rev', 'Status review', 'metric', '1.3', { field: 'finalScore', from: '55', to: '50', detail: 'Primary hazard differs.' });
            log('2026-09-19T15:00:00.000Z', 'usr-fin', 'Status submit', 'metric', '3.2', { field: 'status', from: 'Draft', to: 'Submitted' });
            log('2026-09-10T09:00:00.000Z', 'usr-lead', 'Risk added', 'risk', 'RK-001', { detail: 'Narrow canal constraint flagged as critical.' });
            log('2026-09-03T10:00:00.000Z', 'usr-lead', 'Screening confirmed', 'screening', 'L1', { to: 'MAYBE', detail: 'Proceed to Level 2 to resolve DNSH and concession uncertainty.' });
            log('2026-09-02T09:00:00.000Z', 'usr-lead', 'PDM data imported', 'pdm', 'PDM-SITE-101', { detail: 'Snapshot v1: SOLVATE v4, FAEN v2' });
            a.updatedAt = '2026-09-25T09:20:00.000Z';
            return a;
        }
    };
})(window.RSA);
