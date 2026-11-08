/*
 * Configurable recommendation catalogue (default set).
 * Each entry is matched against the assessment by `metrics` + `triggers`:
 *   belowScore     — metric effective score below this threshold
 *   lowConfidence  — assessor confidence Low on one of the metrics
 *   evidenceGap    — none of the metrics has linked evidence
 *   riskDimensions — unresolved High-rated or critical risks in these dimensions
 * The catalogue can be exported, edited and re-imported from the Recommendations view.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const entry = (o) => ({ enabled: true, effort: 'Medium', phase: 'Before Level 3', triggers: {}, ...o });

    RSA.DefaultCatalogue = {
        version: '2026.09-draft',
        entries: [
            /* Climate & Geography */
            entry({
                id: 'CAT-STUDY-RESOURCE', type: 'Assessment / study', title: 'Site resource & climate-match study',
                description: 'Quantify irradiance/resource and climate-zone differences with ERA5 reanalysis and CMIP6 projections for both sites.',
                resource: { name: 'Copernicus C3S Climate Data Store (ERA5, CMIP6)', provider: 'Copernicus / CLIMINVEST method' },
                expectedImprovement: 'Higher confidence and defensible scores for climate fit; input to yield recalculation.',
                metrics: ['1.1', '1.2'], triggers: { belowScore: 60, lowConfidence: true, evidenceGap: true, riskDimensions: ['D1'] }, effort: 'Low', phase: 'Immediate'
            }),
            entry({
                id: 'CAT-STUDY-HAZARD', type: 'Assessment / study', title: 'Climate risk & vulnerability assessment of the replication site',
                description: 'Assess primary hazards, frequency and intensity under SSP scenarios and map vulnerable groups.',
                resource: { name: 'Climate risk & vulnerability assessment template', provider: 'CLIMINVEST' },
                expectedImprovement: 'Clarifies hazard alignment and vulnerability reduction potential.',
                metrics: ['1.3', '1.4'], triggers: { belowScore: 60, lowConfidence: true, evidenceGap: true, riskDimensions: ['D1'] }
            }),
            /* Technical */
            entry({
                id: 'CAT-TECH-ADAPT', type: 'Technical adaptation', title: 'Design-adaptation study for local infrastructure',
                description: 'Define required design changes (structure span, layout, tilt, alternative host infrastructure such as reservoirs) and classify them as parametric, specification or architectural.',
                resource: { name: 'RSA Localisation Pathway + Renewable Energy sector template', provider: 'CLIMINVEST RSA templates' },
                expectedImprovement: 'Reduces design uncertainty and can move 2.2 up by one band.',
                metrics: ['2.2'], triggers: { belowScore: 65, lowConfidence: true, evidenceGap: true, riskDimensions: ['D2'] }, effort: 'High'
            }),
            entry({
                id: 'CAT-TOOL-SDM', type: 'CLIMINVEST tool', title: 'Run the SOLVATE System Dynamics Model for the replication site',
                description: 'Simulate water balance, pumping demand and PV generation with local data to recalculate expected performance.',
                resource: { name: 'SOLVATE System Dynamics Model (SDM) & UI', provider: 'CLIMINVEST (NOVO)' },
                expectedImprovement: 'Evidence-based performance variance for 2.3 and inputs for 3.3.',
                metrics: ['2.3', '1.2'], triggers: { belowScore: 65, lowConfidence: true, evidenceGap: true }, effort: 'Medium', phase: 'Immediate'
            }),
            entry({
                id: 'CAT-TECH-PILOT', type: 'Technical adaptation', title: 'Pilot segment before full roll-out',
                description: 'Install a limited pilot section to validate performance and O&M under local conditions before scaling.',
                resource: { name: 'Pilot-first pathway (RSA CONDITIONAL option 2)', provider: 'CLIMINVEST RSA decision framework' },
                expectedImprovement: 'Reduces technology and performance risk; builds track record.',
                metrics: ['2.1', '2.3'], triggers: { belowScore: 55, riskDimensions: ['D2'] }, effort: 'High', phase: 'Implementation'
            }),
            entry({
                id: 'CAT-TECH-OM', type: 'Governance / capacity building', title: 'Local supplier scan & O&M training plan',
                description: 'Map installers, spare-part suppliers and O&M providers; plan operator training.',
                resource: { name: 'O&M planning section — Renewable Energy sector template', provider: 'CLIMINVEST RSA templates' },
                expectedImprovement: 'Stronger supply chain and O&M readiness (2.4).',
                metrics: ['2.4'], triggers: { belowScore: 65, evidenceGap: true, riskDimensions: ['D2'] }, effort: 'Low'
            }),
            entry({
                id: 'CAT-TOOL-MONITOR', type: 'CLIMINVEST tool', title: 'Set up continuous performance monitoring',
                description: 'Define KPIs and data flows so performance and degradation are tracked from commissioning.',
                resource: { name: 'CLIMINVEST Continuous Monitoring Tool', provider: 'CLIMINVEST platform' },
                expectedImprovement: 'Early detection of under-performance; evidence for future replication.',
                metrics: ['2.3', '2.4'], triggers: { belowScore: 60 }, effort: 'Low', phase: 'Implementation'
            }),
            /* Financial */
            entry({
                id: 'CAT-FIN-CAPEX', type: 'Financial action', title: 'Localised CAPEX/OPEX estimate with indicative quotes',
                description: 'Rebuild the cost breakdown with local labour, materials and design-adaptation premiums; obtain indicative quotes (3+ quotes at Level 3).',
                resource: { name: 'Bankability Profile (CAPEX/OPEX) — RSA Master Template', provider: 'CLIMINVEST' },
                expectedImprovement: 'Defensible cost scaling for 3.1; lowers contingency needs.',
                metrics: ['3.1'], triggers: { belowScore: 70, lowConfidence: true, evidenceGap: true, riskDimensions: ['D3'] }, phase: 'Immediate'
            }),
            entry({
                id: 'CAT-FIN-REVENUE', type: 'Financial action', title: 'Revenue & tariff analysis (self-consumption, surplus sales, water value)',
                description: 'Confirm which revenue/savings streams apply locally, their value and regulatory stability (self-consumption rules, net-metering, PPA).',
                resource: { name: 'Bankability Blueprints — revenue models', provider: 'CLIMINVEST' },
                expectedImprovement: 'Clarifies revenue model applicability (3.2).',
                metrics: ['3.2'], triggers: { belowScore: 70, lowConfidence: true, evidenceGap: true, riskDimensions: ['D3'] }
            }),
            entry({
                id: 'CAT-FIN-MODEL', type: 'CLIMINVEST tool', title: 'Recalculate NPV/IRR with sensitivity analysis',
                description: 'Run the localised financial model and test the three most uncertain variables (CAPEX, energy price, yield).',
                resource: { name: 'CLIMINVEST Due Diligence & Financial Structuring Tool', provider: 'CLIMINVEST platform' },
                expectedImprovement: 'Robust financial-metrics score (3.3) and bankability evidence.',
                metrics: ['3.3'], triggers: { belowScore: 75, lowConfidence: true, evidenceGap: true, riskDimensions: ['D3'] }, phase: 'Immediate'
            }),
            entry({
                id: 'CAT-FUND-BLENDED', type: 'Funding preparation', title: 'Blended-finance and EU funding preparation',
                description: 'Screen EU/regional instruments (e.g. ERDF, LIFE, InvestEU, EIB) and structure a blended package closing the financing gap.',
                resource: { name: 'Funding readiness checklist & BbD financing guidance', provider: 'CLIMINVEST' },
                expectedImprovement: 'Better financing mechanism availability (3.4).',
                metrics: ['3.4'], triggers: { belowScore: 70, riskDimensions: ['D3'] }, effort: 'High'
            }),
            entry({
                id: 'CAT-COURSE-BBD', type: 'Course', title: 'Bankability-by-Design training for the project team',
                description: 'Train the replication team on BbD principles: cash-flow logic, revenue models, risk allocation and investor expectations.',
                resource: { name: 'Bankability-by-Design fundamentals (course)', provider: 'CLIMINVEST Learning Center' },
                expectedImprovement: 'Stronger financial structuring and investor readiness.',
                metrics: ['3.2', '3.4', '5.4'], triggers: { belowScore: 60 }, effort: 'Low'
            }),
            /* ESG */
            entry({
                id: 'CAT-ESG-DNSH', type: 'Assessment / study', title: 'DNSH & EU Taxonomy screening',
                description: 'Screen the replication against Do-No-Significant-Harm criteria and adaptation substantial-contribution criteria.',
                resource: { name: 'CLIMINVEST ESG assessment tools (DNSH / Taxonomy)', provider: 'CLIMINVEST' },
                expectedImprovement: 'Resolves safeguard uncertainty (4.4) and supports green financing.',
                metrics: ['4.4', '4.1'], triggers: { belowScore: 70, lowConfidence: true, evidenceGap: true, riskDimensions: ['D4'] }, phase: 'Immediate', effort: 'Low'
            }),
            entry({
                id: 'CAT-ESG-PDET', type: 'CLIMINVEST tool', title: 'Score co-benefits with the PDET Scorecard',
                description: 'Use the Resident Well-being, Local Resilience and Governance Adoption indices to quantify social and environmental co-benefits.',
                resource: { name: 'PDET Scorecard (RWI / LRI / CGAI)', provider: 'CLIMINVEST (BSpoke)' },
                expectedImprovement: 'Quantified evidence for 1.4, 4.1 and 4.2.',
                metrics: ['4.1', '4.2', '1.4'], triggers: { belowScore: 60, lowConfidence: true, evidenceGap: true }
            }),
            entry({
                id: 'CAT-STAKE-WORKSHOP', type: 'Stakeholder engagement', title: 'Stakeholder mapping & co-creation workshop',
                description: 'Engage infrastructure owners, data owners, regulators, users and investors; agree governance roles.',
                resource: { name: 'Stakeholder Engagement & Co-Creation Methodology', provider: 'CLIMINVEST (OKYS)' },
                expectedImprovement: 'Improves governance & stakeholder alignment (4.3) and social acceptance.',
                metrics: ['4.3', '4.2'], triggers: { belowScore: 70, riskDimensions: ['D4', 'D5'] }, phase: 'Immediate'
            }),
            entry({
                id: 'CAT-ESG-ESMP', type: 'Assessment / study', title: 'Environmental & social management plan (incl. biodiversity monitoring)',
                description: 'Define safeguards, monitoring and grievance mechanisms proportionate to identified impacts.',
                resource: { name: 'ESMP template (CLIMINVEST ESG toolkit)', provider: 'CLIMINVEST' },
                expectedImprovement: 'Safeguards in place (4.4); mitigates ESG risks.',
                metrics: ['4.4'], triggers: { belowScore: 60, riskDimensions: ['D4'] }, phase: 'Implementation'
            }),
            entry({
                id: 'CAT-REG-NORM', type: 'CLIMINVEST tool', title: 'Regulatory & normative analysis of local rules',
                description: 'Analyse permits, concession rules and local regulations affecting installation, ownership and energy sales.',
                resource: { name: 'CLIMINVEST Extraction Agent — normative analysis module (beta)', provider: 'CLIMINVEST (Maggioli)' },
                expectedImprovement: 'Reduces regulatory uncertainty for revenue (3.2) and governance (4.3).',
                metrics: ['4.3', '3.2'], triggers: { belowScore: 70, riskDimensions: ['D3', 'D4', 'D5'] }, effort: 'Low'
            }),
            /* Institutional */
            entry({
                id: 'CAT-INST-MATURITY', type: 'Governance / capacity building', title: 'Institutional maturity self-assessment & capacity plan',
                description: 'Apply the 1–5 maturity model, identify process gaps and agree a capacity-building plan.',
                resource: { name: 'Institutional capacity assessment — Governance & Implementation sheet', provider: 'CLIMINVEST RSA templates' },
                expectedImprovement: 'Structured improvement path for 5.1.',
                metrics: ['5.1'], triggers: { belowScore: 65, lowConfidence: true, riskDimensions: ['D5'] }, effort: 'Low'
            }),
            entry({
                id: 'CAT-COURSE-PM', type: 'Course', title: 'Project management & technical skills training',
                description: 'Targeted training on climate-investment project management and the specific technology.',
                resource: { name: 'Climate-adaptation project delivery (course series)', provider: 'CLIMINVEST Learning Center' },
                expectedImprovement: 'Closes skills gaps (5.2).',
                metrics: ['5.2'], triggers: { belowScore: 70 }, effort: 'Low'
            }),
            entry({
                id: 'CAT-INST-TWINNING', type: 'Governance / capacity building', title: 'Peer twinning with the source project team',
                description: 'Structured exchange (site visit, mentoring, shared documents) with the source project owner.',
                resource: { name: 'CLIMINVEST replication peer-learning programme', provider: 'CLIMINVEST marketplace' },
                expectedImprovement: 'Transfers experience (5.3) and skills (5.2); lowers execution risk.',
                metrics: ['5.3', '5.2'], triggers: { belowScore: 65, riskDimensions: ['D5'] }
            }),
            entry({
                id: 'CAT-COURSE-FINMGMT', type: 'Course', title: 'Financial controls & EU funds management training',
                description: 'Strengthen financial controls, procurement compliance and EU-fund reporting.',
                resource: { name: 'EU funds financial management (course)', provider: 'CLIMINVEST Learning Center' },
                expectedImprovement: 'Improves financial management capability (5.4).',
                metrics: ['5.4'], triggers: { belowScore: 70 }, effort: 'Low'
            }),
            /* Data collection / evidence */
            entry({
                id: 'CAT-DATA-REQUEST', type: 'Data collection', title: 'Targeted data request to site data owners',
                description: 'Request missing site data (operational records, cost data, audits) from data owners and log it in the Evidence Log.',
                resource: { name: 'RSA Master Template — data checklist', provider: 'CLIMINVEST' },
                expectedImprovement: 'Closes evidence gaps and raises confidence across metrics.',
                metrics: ['1.4', '2.4', '3.1', '3.2', '4.2', '5.1', '5.3', '5.4'], triggers: { evidenceGap: true, lowConfidence: true }, effort: 'Low', phase: 'Immediate'
            }),
            entry({
                id: 'CAT-TOOL-EXTRACT', type: 'CLIMINVEST tool', title: 'Extract comparable-project evidence with the Extraction Agent',
                description: 'Structure documents of comparable projects into business-model data to benchmark costs, revenues and results.',
                resource: { name: 'CLIMINVEST Extraction Agent (API)', provider: 'CLIMINVEST (Maggioli)' },
                expectedImprovement: 'Benchmarks for 2.1, 3.1 and 5.3; more evidence per metric.',
                metrics: ['2.1', '3.1', '5.3'], triggers: { evidenceGap: true, lowConfidence: true }, effort: 'Low'
            }),
            entry({
                id: 'CAT-COURSE-RSA', type: 'Course', title: 'RSA assessor calibration session',
                description: 'Short calibration session so assessors apply scoring bands consistently and document evidence.',
                resource: { name: 'RSA assessor guidance & QA checklist', provider: 'CLIMINVEST Learning Center' },
                expectedImprovement: 'More consistent, higher-confidence scoring.',
                metrics: ['1.1', '2.2', '3.3', '4.3', '5.1'], triggers: { lowConfidence: true }, effort: 'Low', phase: 'Immediate'
            })
        ]
    };
})(window.RSA);
