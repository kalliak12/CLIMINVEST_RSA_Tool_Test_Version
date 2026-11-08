/*
 * CLIMINVEST RSA — methodology configuration.
 * Metrics, descriptions and scoring criteria are taken from the RSA Enhanced Scoring Toolkit v2.0
 * and CLIMINVEST D4.1 §3.2. Dimension weights are set per assessment (default: standard CLIMINVEST weighting, 25/20/25/15/15);
 * a set of proposed weightings is offered in `weightPresets`.
 * `pdmFields` declare which PDM attributes provide context for each metric; `dataSources` list the
 * evidence an assessor would typically consult (guidance only — not scores).
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const band = (score, text) => ({ score, text });

    const dimensions = [
        {
            id: 'D1', key: 'climate', name: 'Climate & Geography', short: 'Climate', weight: 0.25,
            purpose: 'Is the replication site\'s climate, geography and natural-resource context sufficiently similar to the original project\'s operating environment?',
            metrics: [
                {
                    id: '1.1', name: 'Climate Zone Compatibility',
                    description: 'Köppen-Geiger classification match; temperature ranges; precipitation.',
                    criteria: [band(90, 'Identical zones, resources ±10%'), band(75, 'Similar zones, resources ±20%'), band(50, 'Related zones, resources ±30–40%'), band(25, 'Different zones, resources >40%'), band(0, 'Fundamentally different')],
                    guidance: 'Compare the Köppen-Geiger class of both sites first, then check mean temperature and annual precipitation. Same main group (e.g. C) but different sub-type (Csa vs Cfb) normally points to the "related zones" band unless resources are within ±20%.',
                    dataSources: ['Köppen-Geiger climate maps', 'National meteorological service records (e.g. AEMET, HNMS)', 'Copernicus C3S ERA5 reanalysis'],
                    pdmFields: ['climate.koppen', 'climate.avgTempC', 'climate.precipMm']
                },
                {
                    id: '1.2', name: 'Resource Availability',
                    description: 'Solar irradiance, wind speed, water availability, or heating/cooling resources.',
                    criteria: [band(90, 'Resources match ±10%'), band(75, 'Resources match ±15–20%'), band(50, 'Resources match ±25–35%'), band(25, 'Resources differ ±35–50%'), band(0, 'Resources fundamentally different >50%')],
                    guidance: 'Identify the resource that drives performance (e.g. global horizontal irradiance for PV, streamflow for hydro, degree-days for retrofits) and compute the percentage difference between sites.',
                    dataSources: ['PVGIS / Copernicus solar radiation', 'Site measurement campaigns', 'Hydrological records'],
                    pdmFields: ['climate.irradianceKwhM2', 'climate.windMs', 'climate.precipMm']
                },
                {
                    id: '1.3', name: 'Climate Hazard Alignment',
                    description: 'Primary hazard match, frequency, intensity, and vulnerability context.',
                    criteria: [band(90, 'Same hazard, similar frequency/intensity'), band(75, 'Same hazard, somewhat different intensity'), band(50, 'Same hazard, significantly different'), band(25, 'Related hazard, different approach'), band(0, 'Fundamentally different climate risk')],
                    guidance: 'Check that the primary hazard the source project addresses is also the primary hazard at the replication site, then compare frequency and intensity (historical and CMIP6 projections).',
                    dataSources: ['CMIP6 projections (SSP1-2.6 / SSP2-4.5 / SSP5-8.5)', 'National climate risk assessments', 'Local hazard records'],
                    pdmFields: ['climate.hazards']
                },
                {
                    id: '1.4', name: 'Vulnerability Reduction Potential',
                    description: 'Vulnerable population size, affordability, and co-benefit potential.',
                    criteria: [band(90, 'Large population, benefits reach underserved'), band(75, 'Moderate-large population, fairly distributed'), band(50, 'Moderate population, some equity concerns'), band(25, 'Limited vulnerable population'), band(0, 'No clear vulnerable population')],
                    guidance: 'Estimate who benefits at the replication site and whether vulnerable groups are reached. Use the source project\'s beneficiary data as reference only.',
                    dataSources: ['Census / social vulnerability indices', 'Beneficiary mapping', 'Stakeholder interviews'],
                    pdmFields: ['esg.beneficiaries', 'esg.beneficiariesNote', 'esg.vulnerableSharePct']
                }
            ]
        },
        {
            id: 'D2', key: 'technical', name: 'Technical Feasibility', short: 'Technical', weight: 0.20,
            purpose: 'Is the technology proven and mature, and can it be implemented and sustained at the replication site?',
            metrics: [
                {
                    id: '2.1', name: 'Technology Maturity & Track Record',
                    description: 'TRL level, operational history, failure rates, and multi-site deployment.',
                    criteria: [band(90, 'TRL 8–9, >5 years, <2% failure, multi-site'), band(75, 'TRL 7–8, 3–5 years, 2–5% failure, 2–3 sites'), band(50, 'TRL 6–7, 1–3 years, 5–10% failure'), band(25, 'TRL 5–6, <1 year, failure unknown'), band(0, 'TRL <5, experimental, unproven')],
                    guidance: 'Score the maturity of the solution as deployed in the source project and comparable deployments. Pilot-only operation with less than 3 years of data rarely justifies more than the 50 band.',
                    dataSources: ['Source project monitoring data', 'Technology supplier references', 'Independent evaluations'],
                    pdmFields: ['technical.technologyFamily', 'technical.trl', 'technical.yearsOperational', 'technical.sitesDeployed', 'technical.failureRatePct']
                },
                {
                    id: '2.2', name: 'Design Adaptation Requirements',
                    description: 'Number and complexity of modifications needed.',
                    criteria: [band(90, '0–2 parametric changes only'), band(75, '2–4 parametric + minor specifications'), band(50, '4–6 specification changes + architectural'), band(25, 'Multiple architectural changes'), band(0, 'Fundamental redesign')],
                    guidance: 'List the design changes required (e.g. tilt, structure span, module layout, hub height) and classify each as parametric, specification or architectural.',
                    dataSources: ['Sector-specific RSA template', 'Localisation Pathway template', 'Engineering pre-feasibility'],
                    pdmFields: ['technical.infrastructure', 'technical.constraints', 'technical.infrastructureTypes']
                },
                {
                    id: '2.3', name: 'Performance Degradation Assessment',
                    description: 'Expected variance from original performance and climate sensitivity.',
                    criteria: [band(90, 'Performance within ±5%'), band(75, 'Within ±5–10%'), band(50, 'Within ±10–20%'), band(25, 'Within ±20–30%'), band(0, 'Performance <70% or uncertain')],
                    guidance: 'Recalculate expected performance for local conditions (yield simulation, SDM run) and compare to the source baseline.',
                    dataSources: ['Yield simulation (PVsyst / PVSol)', 'SOLVATE System Dynamics Model runs', 'Source KPIs'],
                    pdmFields: ['climate.irradianceKwhM2', 'climate.avgTempC', 'technical.capacityKwp', 'technical.plannedCapacityKwp']
                },
                {
                    id: '2.4', name: 'Local Supply Chain & O&M Capacity',
                    description: 'Spare-parts availability, local technicians, and training needs.',
                    criteria: [band(90, 'Complete supply chain, experienced technicians'), band(75, 'Most supplies available, some training'), band(50, 'Limited supply chain, training required'), band(25, 'Weak supply chain, significant training'), band(0, 'No supply chain, entirely external')],
                    guidance: 'Map local suppliers, installers and O&M providers; identify training needs for the operator.',
                    dataSources: ['Local supplier market scan', 'Operator staffing plan', 'Industry association data'],
                    pdmFields: ['technical.supplyChain', 'technical.omCapacity']
                }
            ]
        },
        {
            id: 'D3', key: 'financial', name: 'Financial Viability', short: 'Financial', weight: 0.25,
            purpose: 'Does the project remain financially viable and financeable at the replication site?',
            metrics: [
                {
                    id: '3.1', name: 'CAPEX/OPEX Scalability',
                    description: 'Cost scaling, local premiums, and variance from the original project.',
                    criteria: [band(90, 'Costs scale ±10%'), band(75, 'Costs scale ±15%'), band(50, 'Costs scale ±25–35%'), band(25, 'Costs differ >40%'), band(0, 'Fundamentally different cost structure')],
                    guidance: 'Update CAPEX/OPEX with local labour, materials and land costs; include design-adaptation premiums identified in 2.2. Level 3 later confirms through 3+ competitive quotes.',
                    dataSources: ['Source CAPEX/OPEX breakdown (Bankability Profile)', 'Local cost indices', 'Indicative supplier quotes'],
                    pdmFields: ['financial.capexEur', 'financial.capexPerKwpEur', 'financial.opexEurYr', 'financial.costIndex', 'financial.expectedCapexEur', 'financial.expectedOpexEurYr']
                },
                {
                    id: '3.2', name: 'Revenue Model Applicability',
                    description: 'Tariff/fee equivalency, willingness to pay, and policy support.',
                    criteria: [band(90, 'Equivalent revenue streams, long-term guarantee'), band(75, 'Similar tariff, competitive advantage'), band(50, 'Tariff lower ±20%, some uncertainty'), band(25, 'Tariff significantly lower, needs subsidy'), band(0, 'No revenue support or prohibitively low')],
                    guidance: 'Check whether each revenue or savings stream of the source (tariffs, self-consumption savings, avoided losses) exists at the replication site and at what value.',
                    dataSources: ['Energy regulator tariffs / self-consumption rules', 'Operator energy bills', 'Willingness-to-pay studies'],
                    pdmFields: ['financial.revenueStreams', 'financial.tariffEurMwh', 'financial.electricityPriceEurMwh']
                },
                {
                    id: '3.3', name: 'Financial Metrics Maintenance',
                    description: 'NPV and IRR recalculation and sensitivity analysis.',
                    criteria: [band(90, 'NPV maintained >80%, IRR ≥8%'), band(75, 'NPV 60–80%, IRR 6–8%'), band(50, 'NPV 40–60%, IRR 4–6%'), band(25, 'NPV 20–40%, IRR 2–4%'), band(0, 'NPV <20% or negative, IRR <2%')],
                    guidance: 'Recalculate NPV and IRR with localised costs and revenues, and run sensitivity on the three most uncertain variables. RSA uses model outputs; it does not build the model.',
                    dataSources: ['Localised financial model', 'CLIMINVEST Due Diligence & Financial Structuring Tool', 'Sensitivity analysis'],
                    pdmFields: ['financial.irrPct', 'financial.npvEur', 'financial.paybackYrs', 'financial.projectedIrrPct', 'financial.projectedNpvRetentionPct', 'financial.projectedPaybackYrs']
                },
                {
                    id: '3.4', name: 'Financing Mechanism Availability',
                    description: 'Commercial financing options, terms, and gap financing.',
                    criteria: [band(90, 'Commercial financing at competitive rates'), band(75, 'Commercial with minor subsidy'), band(50, 'Blended finance, moderate gap'), band(25, 'Mostly concessional, challenging terms'), band(0, 'Largely dependent on grants')],
                    guidance: 'Identify realistic financing sources (commercial lenders, EIB/InvestEU, regional funds, grants) and the size of any financing gap.',
                    dataSources: ['Lender term sheets / letters of interest', 'EU and regional funding calls', 'Bankability Blueprints'],
                    pdmFields: ['financial.financingStructure', 'financial.financingAccess', 'financial.grantSharePct']
                }
            ]
        },
        {
            id: 'D4', key: 'esg', name: 'ESG & Social Context', short: 'ESG', weight: 0.15,
            purpose: 'Can the replication deliver environmental and social benefits without significant harm, with stakeholder support?',
            metrics: [
                {
                    id: '4.1', name: 'Environmental Co-Benefits',
                    description: 'GHG reduction, biodiversity impact, and water/air quality.',
                    criteria: [band(90, 'Equal/greater benefits, no negatives'), band(75, '85–100% of benefits, minor negatives'), band(50, '60–85% of benefits, moderate negatives'), band(25, '40–60% of benefits, significant negatives'), band(0, '<40% benefits or unmitigated negatives')],
                    guidance: 'Estimate the share of the source project\'s environmental benefits (GHG, water saved, biodiversity) realisable at the site, net of any negatives.',
                    dataSources: ['CLIMINVEST ESG assessment tools', 'GHG accounting', 'Environmental baseline studies'],
                    pdmFields: ['esg.ghgReductionTco2Yr', 'esg.waterSavedM3Yr', 'esg.expectedCoBenefitsPct']
                },
                {
                    id: '4.2', name: 'Social Equity & Vulnerable Population',
                    description: 'Vulnerable population reach, affordability, and employment.',
                    criteria: [band(90, '>50% vulnerable benefit, strong affordability'), band(75, '35–50% vulnerable, mostly affordable'), band(50, '20–35% benefit, affordability concerns'), band(25, '<20% vulnerable, limited jobs'), band(0, 'Benefits elite only, affordability issues')],
                    guidance: 'Assess the share of benefits reaching vulnerable groups, affordability of any user charges and local employment effects.',
                    dataSources: ['PDET Scorecard – Resident Well-being Index', 'Social impact assessment', 'Employment estimates'],
                    pdmFields: ['esg.vulnerableSharePct', 'esg.beneficiariesNote']
                },
                {
                    id: '4.3', name: 'Governance & Stakeholder Alignment',
                    description: 'Stakeholder engagement, governance clarity, and policy fit.',
                    criteria: [band(90, 'All engaged, clear governance, policy aligned'), band(75, 'Most engaged, governance defined, good fit'), band(50, 'Key stakeholders engaged, governance emerging'), band(25, 'Limited engagement, governance unclear'), band(0, 'Minimal engagement, governance undefined')],
                    guidance: 'Use the stakeholder map: are owners of infrastructure, data and permits engaged? Is the governance model (who owns, who operates) defined and consistent with local policy?',
                    dataSources: ['Stakeholder mapping', 'Workshop minutes', 'Local regulation analysis (Extraction Agent normative module)'],
                    pdmFields: ['esg.stakeholderEngagement', 'institutional.governanceNote']
                },
                {
                    id: '4.4', name: 'ESG Safeguards & Risk Management',
                    description: 'Environmental safeguards, social safeguards, and DNSH.',
                    criteria: [band(90, 'All safeguards in place, no DNSH violations'), band(75, 'Most safeguards, minimal DNSH risk'), band(50, 'Key safeguards, moderate DNSH concerns'), band(25, 'Limited safeguards, significant concerns'), band(0, 'No safeguards, major DNSH violations')],
                    guidance: 'Check EU Taxonomy "Do No Significant Harm" screening, EIA requirements and environmental/social management plans.',
                    dataSources: ['DNSH screening', 'EIA / ESMP', 'Permitting correspondence'],
                    pdmFields: ['esg.dnshStatus', 'esg.taxonomyAligned']
                }
            ]
        },
        {
            id: 'D5', key: 'institutional', name: 'Institutional Capacity', short: 'Institutional', weight: 0.15,
            purpose: 'Can the replicating organisation implement, operate and sustain the solution?',
            metrics: [
                {
                    id: '5.1', name: 'Organizational Capability Maturity',
                    description: 'Maturity-model level, process formalization, and performance management.',
                    criteria: [band(90, 'Level 4–5, continuous improvement'), band(75, 'Level 4, standardized processes'), band(50, 'Level 3, defined processes'), band(25, 'Level 2, basic processes'), band(0, 'Level 1, ad-hoc management')],
                    guidance: 'Apply the 1–5 maturity model (ad-hoc → optimised) to the replicating organisation\'s project and asset-management processes.',
                    dataSources: ['Organisational self-assessment', 'Process documentation', 'Interviews with management'],
                    pdmFields: ['institutional.organisation', 'institutional.maturityLevel']
                },
                {
                    id: '5.2', name: 'Skills & Expertise Availability',
                    description: 'Technical skills, financial skills, and project management.',
                    criteria: [band(90, 'All critical skills in-house'), band(75, 'Most skills present, some gaps'), band(50, 'Key skills present, significant gaps'), band(25, 'Limited skills, external support'), band(0, 'Critical skills absent')],
                    guidance: 'Map technical, financial and project-management skills needed against in-house staff; identify what is trainable versus what must be contracted.',
                    dataSources: ['Skills matrix', 'Staff CVs / org chart', 'Training records'],
                    pdmFields: ['institutional.skills']
                },
                {
                    id: '5.3', name: 'Experience with Similar Projects',
                    description: 'Number of completed projects, budget scale, and recency.',
                    criteria: [band(90, '5+ projects, €5M+, <2 years'), band(75, '3–4 projects, €2–5M, <3 years'), band(50, '1–2 projects, €0.5–2M, <5 years'), band(25, '<1 project but transferred skills'), band(0, 'No relevant experience')],
                    guidance: 'Count comparable completed projects, the largest budget managed and how recent the experience is. Compare the budget scale with the replication CAPEX.',
                    dataSources: ['Project portfolio records', 'Final reports of past projects', 'CLIMINVEST project database'],
                    pdmFields: ['institutional.similarProjects', 'institutional.largestBudgetEur', 'institutional.lastProjectYear']
                },
                {
                    id: '5.4', name: 'Financial Management Capability',
                    description: 'Audit results, financial controls, and EU-financing experience.',
                    criteria: [band(90, 'Unqualified audit, strong controls, EU experience'), band(75, 'Unqualified, adequate controls, some EU'), band(50, 'Unqualified with findings, developing controls'), band(25, 'Qualified audit or significant findings'), band(0, 'Poor audit results, management concerns')],
                    guidance: 'Review the latest audit opinion, internal controls and track record in managing EU or IFI funds.',
                    dataSources: ['Audited financial statements', 'Internal control reports', 'EU project financial reports'],
                    pdmFields: ['institutional.auditOpinion', 'institutional.euFundingExperience']
                }
            ]
        }
    ];

    const M = {
        version: 'RSA Methodology v2.0 — second draft (configurable weights)',
        shortVersion: 'RSA v2.0-draft',
        basis: 'CLIMINVEST RSA methodology · RSA Scoring Toolkit',
        weightsNote: 'Dimension weights are set per assessment by the lead assessor before scoring. The default is the standard CLIMINVEST weighting (Climate 25%, Technical 20%, Financial 25%, ESG 15%, Institutional 15%). All dimensions keep four metrics and equal prominence.',

        /* Proposed weightings (percent). The lead assessor can pick one or set custom weights; they must add up to 100. */
        weightPresets: [
            { id: 'standard', name: 'Standard', weights: { D1: 25, D2: 20, D3: 25, D4: 15, D5: 15 }, use: 'Default. The standard weighting of the CLIMINVEST RSA methodology; a balanced view of all five dimensions.' },
            { id: 'finance', name: 'Finance-focused (bankability)', weights: { D1: 20, D2: 20, D3: 30, D4: 15, D5: 15 }, use: 'When investment performance matters most, e.g. projects seeking loans or private co-investment.' },
            { id: 'investor', name: 'Investor view', weights: { D1: 15, D2: 20, D3: 35, D4: 15, D5: 15 }, use: 'Reports for banks and investors; climate fit already established at screening.' },
            { id: 'climate', name: 'Climate-adaptation focus', weights: { D1: 30, D2: 20, D3: 20, D4: 15, D5: 15 }, use: 'Grant-funded public adaptation where the hazard and climate match are the main question.' },
            { id: 'technical', name: 'Technical-risk focus', weights: { D1: 20, D2: 30, D3: 25, D4: 10, D5: 15 }, use: 'Newer technologies or major design changes at the replication site.' },
            { id: 'social', name: 'Social & governance focus', weights: { D1: 20, D2: 15, D3: 20, D4: 25, D5: 20 }, use: 'Community-led or social projects where acceptance and institutions decide success.' },
            { id: 'equal', name: 'Equal weights', weights: { D1: 20, D2: 20, D3: 20, D4: 20, D5: 20 }, use: 'Neutral check: shows whether the result depends on the chosen weighting.' }
        ],
        dimensions,

        scoreBands: [
            { min: 90, max: 100, label: 'Excellent', cls: 'excellent' },
            { min: 75, max: 89.999, label: 'Good', cls: 'good' },
            { min: 50, max: 74.999, label: 'Acceptable', cls: 'acceptable' },
            { min: 25, max: 49.999, label: 'Poor', cls: 'poor' },
            { min: 0, max: 24.999, label: 'Unsuitable', cls: 'unsuitable' }
        ],

        /* RSS interpretation — decision GUIDANCE only. The final recommendation is made by an authorised human. */
        decisionBands: [
            { min: 85, label: 'GO', suitability: 'Highly suitable', detail: 'Proceed with standard project execution.', success: '~78%', contingency: '5–10%' },
            { min: 70, label: 'GO WITH CONDITIONS', suitability: 'Suitable', detail: 'Proceed with planned modifications, capacity building and risk mitigation.', success: '~58%', contingency: '10–15%' },
            { min: 50, label: 'CONDITIONAL', suitability: 'Marginally suitable', detail: 'Heavy modification and subsidy if strategic, pilot first then scale, or redesign.', success: '~38%', contingency: '20–30%' },
            { min: 30, label: 'NO-GO', suitability: 'Poor fit', detail: 'Do not replicate in the current form; consider alternative sites or solution types.', success: '—', contingency: '—' },
            { min: 0, label: 'REJECT', suitability: 'Unsuitable', detail: 'Fundamental mismatch; design a new solution for this context.', success: '—', contingency: '—' }
        ],

        confidenceLevels: [
            { value: '25', label: 'Low' },
            { value: '50', label: 'Moderate' },
            { value: '75', label: 'High' },
            { value: '100', label: 'Verified' }
        ],

        reliabilityLevels: [
            { value: '25', label: 'Low' },
            { value: '50', label: 'Moderate' },
            { value: '75', label: 'High' },
            { value: '100', label: 'Verified' }
        ],

        evidenceSourceTypes: [
            'PDM record', 'Project document', 'Climate / resource dataset', 'Official statistics', 'Site survey / measurement',
            'Financial model / quote', 'Stakeholder interview / workshop', 'Regulation / policy', 'Literature / study', 'Expert judgement'
        ],

        screeningQuestions: [
            { id: 'S1', text: 'Is the climate/adaptation need match apparent?', dimension: 'D1', pdmHint: ['climate.koppen', 'climate.hazards'] },
            { id: 'S2', text: 'Is the technology proven (not experimental)?', dimension: 'D2', pdmHint: ['technical.trl', 'technical.yearsOperational'] },
            { id: 'S3', text: 'Are basic financial metrics achievable?', dimension: 'D3', pdmHint: ['financial.irrPct', 'financial.projectedIrrPct'] },
            { id: 'S4', text: 'Is institutional commitment present?', dimension: 'D5', pdmHint: ['institutional.organisation', 'institutional.maturityLevel'] },
            { id: 'S5', text: 'Are critical ESG risks manageable?', dimension: 'D4', pdmHint: ['esg.dnshStatus', 'esg.stakeholderEngagement'] }
        ],

        metricStatuses: ['Not started', 'Draft', 'Submitted', 'Reviewed', 'Approved'],

        roles: {
            lead: { label: 'Lead Assessor', canEditAll: true, canReview: true, canApprove: true, canFinalise: true },
            assessor: { label: 'Assessor', canEditAll: false, canReview: false, canApprove: false, canFinalise: false },
            expert: { label: 'Domain Expert', canEditAll: false, canReview: false, canApprove: false, canFinalise: false },
            reviewer: { label: 'Reviewer / Validator', canEditAll: false, canReview: true, canApprove: true, canFinalise: true }
        },

        riskLevels: ['Low', 'Medium', 'High'],
        riskStatuses: ['Open', 'Mitigating', 'Accepted', 'Closed'],
        recommendationStatuses: ['Proposed', 'Accepted', 'In progress', 'Done', 'Dismissed'],
        humanDecisions: ['GO', 'GO WITH CONDITIONS', 'CONDITIONAL', 'NO-GO', 'REJECT'],

        pdmFieldLabels: {
            'climate.koppen': ['Köppen-Geiger class', ''],
            'climate.avgTempC': ['Mean annual temperature', '°C'],
            'climate.precipMm': ['Annual precipitation', 'mm'],
            'climate.irradianceKwhM2': ['Global horizontal irradiance', 'kWh/m²/yr'],
            'climate.windMs': ['Mean wind speed', 'm/s'],
            'climate.hazards': ['Climate hazards', ''],
            'technical.technologyFamily': ['Technology family', ''],
            'technical.trl': ['Technology readiness level', 'TRL'],
            'technical.yearsOperational': ['Years operational', 'yrs'],
            'technical.sitesDeployed': ['Sites deployed', ''],
            'technical.failureRatePct': ['Failure rate', '%'],
            'technical.capacityKwp': ['Installed capacity', 'kWp'],
            'technical.plannedCapacityKwp': ['Planned capacity', 'kWp'],
            'technical.infrastructure': ['Infrastructure', ''],
            'technical.infrastructureTypes': ['Infrastructure types', ''],
            'technical.constraints': ['Known constraints', ''],
            'technical.supplyChain': ['Local supply chain', ''],
            'technical.omCapacity': ['O&M capacity', ''],
            'technical.pumpingEnergyMwhMonth': ['Pumping electricity use', 'MWh/month'],
            'financial.capexEur': ['CAPEX', '€'],
            'financial.capexPerKwpEur': ['CAPEX per kWp', '€/kWp'],
            'financial.expectedCapexEur': ['Expected CAPEX', '€'],
            'financial.opexEurYr': ['OPEX', '€/yr'],
            'financial.expectedOpexEurYr': ['Expected OPEX', '€/yr'],
            'financial.projectedNpvRetentionPct': ['Projected NPV retained vs source', '%'],
            'financial.projectedPaybackYrs': ['Projected payback (localised)', 'yrs'],
            'financial.costIndex': ['Local cost index (EU avg = 1.00)', ''],
            'financial.irrPct': ['Project IRR', '%'],
            'financial.projectedIrrPct': ['Projected IRR (localised)', '%'],
            'financial.npvEur': ['NPV', '€'],
            'financial.paybackYrs': ['Payback', 'yrs'],
            'financial.tariffEurMwh': ['Tariff / energy value', '€/MWh'],
            'financial.electricityPriceEurMwh': ['Local electricity price', '€/MWh'],
            'financial.revenueStreams': ['Revenue / savings streams', ''],
            'financial.financingStructure': ['Financing structure', ''],
            'financial.financingAccess': ['Financing access', ''],
            'financial.grantSharePct': ['Grant share', '%'],
            'esg.ghgReductionTco2Yr': ['GHG reduction', 'tCO₂e/yr'],
            'esg.waterSavedM3Yr': ['Water saved', 'm³/yr'],
            'esg.expectedCoBenefitsPct': ['Expected share of source co-benefits', '%'],
            'esg.beneficiaries': ['Beneficiaries', 'people'],
            'esg.beneficiariesNote': ['Beneficiary profile', ''],
            'esg.vulnerableSharePct': ['Vulnerable share of benefits', '%'],
            'esg.stakeholderEngagement': ['Stakeholder engagement', ''],
            'esg.dnshStatus': ['DNSH status', ''],
            'esg.taxonomyAligned': ['EU Taxonomy aligned', ''],
            'institutional.organisation': ['Organisation', ''],
            'institutional.maturityLevel': ['Maturity level (1–5)', ''],
            'institutional.skills': ['Skills profile', ''],
            'institutional.similarProjects': ['Similar projects completed', ''],
            'institutional.largestBudgetEur': ['Largest budget managed', '€'],
            'institutional.lastProjectYear': ['Most recent similar project', ''],
            'institutional.auditOpinion': ['Latest audit opinion', ''],
            'institutional.euFundingExperience': ['EU funding experience', ''],
            'institutional.governanceNote': ['Governance', '']
        }
    };

    /* Data the RSA needs from the PDM. When the PDM record lacks a value, the team can fill it in (Projects page).
       Investment performance first: the financial dimension carries the largest weight in the RSS. */
    M.requiredData = {
        site: [
            ['Investment performance', ['financial.costIndex', 'financial.expectedCapexEur', 'financial.expectedOpexEurYr', 'financial.electricityPriceEurMwh', 'financial.revenueStreams', 'financial.projectedIrrPct', 'financial.projectedNpvRetentionPct', 'financial.projectedPaybackYrs', 'financial.financingAccess', 'financial.grantSharePct']],
            ['Climate & geography', ['climate.koppen', 'climate.avgTempC', 'climate.irradianceKwhM2', 'climate.hazards']],
            ['Technical', ['technical.infrastructureTypes', 'technical.supplyChain', 'technical.omCapacity']],
            ['ESG & social', ['esg.beneficiaries', 'esg.vulnerableSharePct', 'esg.expectedCoBenefitsPct', 'esg.stakeholderEngagement', 'esg.dnshStatus', 'esg.taxonomyAligned']],
            ['Institutional', ['institutional.maturityLevel', 'institutional.skills', 'institutional.similarProjects', 'institutional.largestBudgetEur', 'institutional.auditOpinion', 'institutional.euFundingExperience']]
        ],
        source: [
            ['Investment performance', ['financial.capexEur', 'financial.opexEurYr', 'financial.costIndex', 'financial.irrPct', 'financial.npvEur', 'financial.paybackYrs', 'financial.tariffEurMwh', 'financial.revenueStreams', 'financial.financingStructure']],
            ['Climate & geography', ['climate.koppen', 'climate.avgTempC', 'climate.irradianceKwhM2', 'climate.hazards']],
            ['Technical', ['technical.technologyFamily', 'technical.trl', 'technical.yearsOperational', 'technical.sitesDeployed']],
            ['ESG & social', ['esg.ghgReductionTco2Yr', 'esg.vulnerableSharePct']]
        ]
    };

    /* How a manually entered value is typed. Anything not listed with a unit is free text. */
    M.fieldSpecs = {
        'technical.supplyChain': { type: 'select', options: ['Strong', 'Moderate', 'Limited', 'Weak', 'None'] },
        'financial.financingAccess': { type: 'select', options: ['Commercial', 'Commercial + minor subsidy', 'Blended', 'Concessional', 'Grant-dependent'] },
        'esg.stakeholderEngagement': { type: 'select', options: ['Full', 'High', 'Medium', 'Low', 'Minimal'] },
        'esg.dnshStatus': { type: 'select', options: ['Screened – no significant harm', 'Screened – minor issues', 'Pending screening', 'Concerns identified', 'Not screened'] },
        'institutional.skills': { type: 'select', options: ['All critical skills in-house', 'Most skills present, some gaps', 'Key skills present, significant gaps', 'Limited skills, external support', 'Critical skills absent'] },
        'institutional.auditOpinion': { type: 'select', options: ['Unqualified', 'Unqualified with findings', 'Qualified', 'Adverse', 'Unknown'] },
        'institutional.maturityLevel': { type: 'select', options: ['1', '2', '3', '4', '5'], numeric: true },
        'esg.taxonomyAligned': { type: 'bool' },
        'institutional.euFundingExperience': { type: 'bool' },
        'climate.hazards': { type: 'list', hint: 'Comma-separated, primary hazard first' },
        'financial.revenueStreams': { type: 'list', hint: 'Comma-separated' },
        'technical.infrastructureTypes': { type: 'list', hint: 'e.g. canal, reservoir, building' }
    };
    M.fieldSpec = (path) => M.fieldSpecs[path] || (M.fieldUnit(path) || /Pct$|Eur|Yrs$|Ms$|Kwh|C$|trl|Level|Projects|sitesDeployed|beneficiaries|costIndex|yearsOperational/.test(path) ? { type: 'number' } : { type: 'text' });

    /* Weights (percent per dimension) of an assessment; falls back to the standard weighting. */
    M.defaultWeights = () => ({ ...M.weightPresets[0].weights });
    M.weightsOf = (a) => {
        const w = a && a.weights;
        const ok = w && dimensions.every((d) => Number.isFinite(Number(w[d.id]))) && Math.round(dimensions.reduce((s, d) => s + Number(w[d.id]), 0)) === 100;
        return ok ? Object.fromEntries(dimensions.map((d) => [d.id, Number(w[d.id])])) : M.defaultWeights();
    };
    M.presetFor = (w) => M.weightPresets.find((p) => dimensions.every((d) => Number(p.weights[d.id]) === Number(w[d.id]))) || null;
    M.weightsLabel = (w) => dimensions.map((d) => `${d.short} ${w[d.id]}%`).join(', ');
    /* Make the active assessment's weights the ones every calculation uses. */
    M.useWeights = (a) => { const w = M.weightsOf(a); dimensions.forEach((d) => { d.weight = w[d.id] / 100; }); return w; };

    M.allMetrics = () => dimensions.flatMap((d) => d.metrics.map((m) => ({ ...m, dimensionId: d.id, dimensionName: d.name, dimensionShort: d.short, weight: d.weight })));
    M.metric = (id) => M.allMetrics().find((m) => m.id === id);
    M.dimension = (id) => dimensions.find((d) => d.id === id);
    M.dimensionOfMetric = (metricId) => dimensions.find((d) => d.metrics.some((m) => m.id === metricId));

    M.bandFor = (score) => {
        if (score === null || score === undefined || isNaN(score)) return null;
        return M.scoreBands.find((b) => score >= b.min) || M.scoreBands[M.scoreBands.length - 1];
    };
    M.decisionFor = (rss) => {
        if (rss === null || rss === undefined || isNaN(rss)) return null;
        return M.decisionBands.find((b) => rss >= b.min);
    };
    M.confidenceLabel = (v) => (M.confidenceLevels.find((c) => c.value === String(v)) || {}).label || '—';
    M.reliabilityLabel = (v) => (M.reliabilityLevels.find((c) => c.value === String(v)) || {}).label || '—';
    M.fieldLabel = (path) => (M.pdmFieldLabels[path] || [path, ''])[0];
    M.fieldUnit = (path) => (M.pdmFieldLabels[path] || [path, ''])[1];

    RSA.Methodology = M;
})(window.RSA);
