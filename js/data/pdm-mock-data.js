/*
 * Mock Project Database (PDM) for the prototype.
 * Record structure follows the CLIMINVEST Master Template sections (summary, context, bankability,
 * ESG & risk, governance) plus the Extraction Agent business-model fields.
 * Values for SOLVATE / FAEN / Ventimiglia draw on CLIMINVEST D4.1 §2.4–2.5 where available;
 * all other values are ILLUSTRATIVE demo data and must be replaced by the real PDM API.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const projects = [
        {
            id: 'PDM-SRC-001', roles: ['source'], version: 4, lastUpdated: '2026-08-30',
            name: 'SOLVATE — PV over irrigation canals with water–energy System Dynamics Model',
            shortName: 'SOLVATE (Lake Plastira, GR)',
            country: 'Greece', region: 'Thessaly — Lake Plastira irrigation network', status: 'Pilot (CLIMINVEST)', year: 2025,
            adaptationType: 'Water–energy nexus / Renewable energy',
            summary: 'CLIMINVEST pilot combining photovoltaic panels over open irrigation canals with a System Dynamics Model that couples reservoir storage, irrigation demand and pumping electricity use to support drought-resilient water management.',
            owner: 'TOEV Tavropou (local land-reclamation organisation); technical coordinator SolarKapital',
            climate: { koppen: 'Csa', avgTempC: 16.8, precipMm: 650, irradianceKwhM2: 1600, windMs: 2.6, hazards: ['drought', 'heatwaves', 'water scarcity'] },
            technical: {
                technologyFamily: 'canal-top PV', infrastructureType: 'canal', trl: 7, yearsOperational: 1, sitesDeployed: 1, failureRatePct: null,
                capacityKwp: 1000, infrastructure: 'Open irrigation canals fed by Lake Plastira; pumping stations for irrigation', supplyChain: 'Strong',
                omCapacity: 'Operator staff trained during pilot; PV O&M contracted'
            },
            financial: {
                capexEur: 1150000, capexPerKwpEur: 1150, opexEurYr: 18000, costIndex: 0.92, irrPct: 8.4, npvEur: 620000, paybackYrs: 9,
                tariffEurMwh: 95, revenueStreams: ['Self-consumption savings (pumping)', 'Net-metering credits', 'Avoided evaporation (water value)'],
                revenueTags: ['self-consumption', 'net-metering', 'water-value'], financingStructure: 'Blended: 40% grant, 60% loan', financingAccess: 'Blended', grantSharePct: 40
            },
            esg: {
                ghgReductionTco2Yr: 850, waterSavedM3Yr: 18000, beneficiaries: 4500, beneficiariesNote: 'Farming households served by the irrigation network',
                vulnerableSharePct: 38, stakeholderEngagement: 'High', dnshStatus: 'Screened – no significant harm', taxonomyAligned: true, expectedCoBenefitsPct: null
            },
            institutional: {
                organisation: 'TOEV Tavropou', maturityLevel: 3, skills: 'Key skills present, significant gaps', similarProjects: 1, largestBudgetEur: 1200000,
                lastProjectYear: 2025, auditOpinion: 'Unqualified', euFundingExperience: true, governanceNote: 'Water authority, investors, farmers, energy regulator and local government mapped'
            },
            businessModel: {
                valuePropositions: ['Lower pumping energy cost', 'Reduced canal evaporation', 'Drought-resilient irrigation planning'],
                customerSegments: ['Farmers', 'Irrigation authority', 'Local government'],
                keyPartners: ['TOEV Tavropou', 'SolarKapital', 'NOVO', 'Copernicus C3S'],
                revenueStreams: ['Self-consumption savings', 'Net-metering credits']
            },
            kpis: ['Pumping electricity (kWh/month)', 'PV yield (kWh/kWp)', 'Evaporation avoided (m³/yr)', 'Reservoir active volume (hm³)'],
            documents: [
                { id: 'DOC-SOL-01', title: 'SOLVATE System Dynamics Model calibration & datasets', type: 'Project document', provider: 'NOVO / CLIMINVEST', date: '2026-03-31', metrics: ['1.2', '2.3', '3.3'] },
                { id: 'DOC-SOL-02', title: 'PV feasibility inputs for canal installation (tilt, layout, kWp, inverter)', type: 'Project document', provider: 'SolarKapital', date: '2026-02-12', metrics: ['2.1', '2.2', '3.1'] },
                { id: 'DOC-SOL-03', title: 'TOEV hydrological & pumping datasets (Lake Plastira, irrigation demand)', type: 'Site survey / measurement', provider: 'TOEV Tavropou', date: '2026-01-20', metrics: ['1.2', '3.2'] },
                { id: 'DOC-SOL-04', title: 'ERA5 & CMIP6 (CNRM-CM6-1) climate forcing, SSP1-2.6/2-4.5/5-8.5', type: 'Climate / resource dataset', provider: 'Copernicus C3S CDS', date: '2025-11-05', metrics: ['1.1', '1.3'] },
                { id: 'DOC-SOL-05', title: 'SOLVATE stakeholder mapping & engagement plan', type: 'Stakeholder interview / workshop', provider: 'NOVO / OKYS', date: '2026-04-18', metrics: ['4.3'] }
            ]
        },
        {
            id: 'PDM-SRC-002', roles: ['source'], version: 2, lastUpdated: '2026-05-02',
            name: 'Over-Canal Solar PV Systems in California',
            shortName: 'Over-canal PV (California, US)',
            country: 'USA', region: 'California — Central Valley irrigation districts', status: 'Operational demonstrator', year: 2021,
            adaptationType: 'Water–energy nexus / Renewable energy',
            summary: 'Covering irrigation canals with PV to reduce evaporation and generate renewable energy, addressing drought and energy demand (CLIMINVEST project database, extracted record).',
            owner: 'Irrigation district with state water agency and research partners',
            climate: { koppen: 'Csa', avgTempC: 17.5, precipMm: 330, irradianceKwhM2: 2000, windMs: 3.0, hazards: ['drought', 'water scarcity', 'heatwaves'] },
            technical: {
                technologyFamily: 'canal-top PV', infrastructureType: 'canal', trl: 8, yearsOperational: 2, sitesDeployed: 3, failureRatePct: 3,
                capacityKwp: 1600, infrastructure: 'Wide concrete-lined irrigation canals (6–30 m)', supplyChain: 'Strong', omCapacity: 'District O&M team with contractor support'
            },
            financial: {
                capexEur: 3360000, capexPerKwpEur: 2100, opexEurYr: 30000, costIndex: 1.35, irrPct: 6.5, npvEur: 540000, paybackYrs: 12,
                tariffEurMwh: 110, revenueStreams: ['Energy sales', 'Government grants', 'Public-private partnership', 'Carbon credits'],
                revenueTags: ['energy-sales', 'grants', 'carbon-credits'], financingStructure: 'State grant 55% + PPP', financingAccess: 'Concessional', grantSharePct: 55
            },
            esg: {
                ghgReductionTco2Yr: 1100, waterSavedM3Yr: 60000, beneficiaries: 12000, beneficiariesNote: 'Agricultural and urban water users', vulnerableSharePct: 20,
                stakeholderEngagement: 'High', dnshStatus: 'Screened (non-EU framework, CEQA)', taxonomyAligned: false, expectedCoBenefitsPct: null
            },
            institutional: {
                organisation: 'Irrigation district / state water agency', maturityLevel: 5, skills: 'All critical skills in-house', similarProjects: 6, largestBudgetEur: 25000000,
                lastProjectYear: 2025, auditOpinion: 'Unqualified', euFundingExperience: false, governanceNote: 'Public–private partnership'
            },
            businessModel: {
                valuePropositions: ['Reduced water evaporation', 'Increased renewable energy production', 'Cost savings on water and energy'],
                customerSegments: ['Agricultural sector', 'Urban water supply agencies', 'Energy consumers'],
                keyPartners: ['State water agency', 'National laboratory', 'University', 'Private solar companies'],
                revenueStreams: ['Government grants', 'PPP', 'Energy sales', 'Carbon credits']
            },
            kpis: ['Water evaporation rates', 'Solar energy production', 'Aquatic weed growth', 'Panel efficiency'],
            documents: [
                { id: 'DOC-CA-01', title: 'Hydrologic and cost simulation of over-canal PV (peer-reviewed study)', type: 'Literature / study', provider: 'University research team', date: '2021-03-18', metrics: ['1.2', '2.3', '3.1', '4.1'] },
                { id: 'DOC-CA-02', title: 'Demonstrator performance report, year 2', type: 'Project document', provider: 'Irrigation district', date: '2026-04-10', metrics: ['2.1', '2.3'] }
            ]
        },
        {
            id: 'PDM-SRC-003', roles: ['source'], version: 1, lastUpdated: '2025-12-01',
            name: 'Installation of Solar Panels on Minab Irrigation Canal',
            shortName: 'Minab canal PV (IR)',
            country: 'Iran', region: 'Hormozgan — Minab', status: 'Simulated / planned', year: 2023,
            adaptationType: 'Water–energy nexus / Renewable energy',
            summary: 'Simulation of PV over an 8 km irrigation canal: 60% coverage ≈ 5 MW and >6,000 m³/yr evaporation avoided (CLIMINVEST project database, extracted record).',
            owner: 'Regional water and wastewater company',
            climate: { koppen: 'BWh', avgTempC: 27.0, precipMm: 200, irradianceKwhM2: 2150, windMs: 3.4, hazards: ['drought', 'water scarcity', 'heatwaves'] },
            technical: {
                technologyFamily: 'canal-top PV', infrastructureType: 'canal', trl: 6, yearsOperational: 0, sitesDeployed: 0, failureRatePct: null,
                capacityKwp: 5000, infrastructure: '8 km open irrigation canal', supplyChain: 'Limited', omCapacity: 'Not yet defined'
            },
            financial: {
                capexEur: 3750000, capexPerKwpEur: 750, opexEurYr: 45000, costIndex: 0.55, irrPct: 9.5, npvEur: 1400000, paybackYrs: 7,
                tariffEurMwh: 40, revenueStreams: ['Government grants', 'Energy sales', 'Carbon credits'],
                revenueTags: ['grants', 'energy-sales', 'carbon-credits'], financingStructure: 'Government grants + energy sales', financingAccess: 'Grant-dependent', grantSharePct: 60
            },
            esg: {
                ghgReductionTco2Yr: 4000, waterSavedM3Yr: 6000, beneficiaries: 8000, beneficiariesNote: 'Local farmers and residents', vulnerableSharePct: 55,
                stakeholderEngagement: 'Medium', dnshStatus: 'Not screened', taxonomyAligned: false, expectedCoBenefitsPct: null
            },
            institutional: {
                organisation: 'Minab Water and Wastewater Company', maturityLevel: 2, skills: 'Limited skills, external support', similarProjects: 0, largestBudgetEur: 800000,
                lastProjectYear: 2023, auditOpinion: 'Unknown', euFundingExperience: false, governanceNote: 'Public utility with national agencies'
            },
            businessModel: {
                valuePropositions: ['Reduced water evaporation', 'Renewable energy generation', 'Improved water security'],
                customerSegments: ['Local farmers', 'Residents', 'Government agencies'],
                keyPartners: ['National Standard Organization', 'Water and Wastewater Company', 'Directorate of Meteorology'],
                revenueStreams: ['Government grants', 'Energy sales', 'Carbon credits']
            },
            kpis: ['Water evaporation rate', 'Electricity generation', 'Water temperature'],
            documents: [
                { id: 'DOC-MIN-01', title: 'PVSol 2021 simulation of canal coverage scenarios', type: 'Literature / study', provider: 'Research team', date: '2023-06-01', metrics: ['1.2', '2.3'] }
            ]
        },
        {
            id: 'PDM-SRC-004', roles: ['source'], version: 3, lastUpdated: '2026-06-20',
            name: 'Floating PV on Irrigation Reservoir (Extremadura, ES)',
            shortName: 'Floating PV reservoir (Extremadura, ES)',
            country: 'Spain', region: 'Extremadura — irrigation reservoir', status: 'Operational', year: 2020,
            adaptationType: 'Water–energy nexus / Renewable energy',
            summary: 'Floating photovoltaic plant on an irrigation reservoir supplying energy while reducing evaporation, with a biodiversity monitoring programme. Illustrative demo record.',
            owner: 'Energy developer with irrigation community',
            climate: { koppen: 'Csa', avgTempC: 16.9, precipMm: 480, irradianceKwhM2: 1850, windMs: 2.8, hazards: ['drought', 'heatwaves', 'water scarcity'] },
            technical: {
                technologyFamily: 'floating PV', infrastructureType: 'reservoir', trl: 8, yearsOperational: 5, sitesDeployed: 4, failureRatePct: 2,
                capacityKwp: 1125, infrastructure: 'Irrigation reservoir with anchoring system', supplyChain: 'Strong', omCapacity: 'Developer O&M team'
            },
            financial: {
                capexEur: 1070000, capexPerKwpEur: 950, opexEurYr: 16000, costIndex: 0.97, irrPct: 7.2, npvEur: 480000, paybackYrs: 10,
                tariffEurMwh: 70, revenueStreams: ['Self-consumption savings (pumping)', 'PPA / energy sales'],
                revenueTags: ['self-consumption', 'ppa', 'energy-sales'], financingStructure: 'Corporate finance with 10% regional grant', financingAccess: 'Commercial + minor subsidy', grantSharePct: 10
            },
            esg: {
                ghgReductionTco2Yr: 900, waterSavedM3Yr: 25000, beneficiaries: 3000, beneficiariesNote: 'Irrigation community members', vulnerableSharePct: 15,
                stakeholderEngagement: 'Medium', dnshStatus: 'Screened – no significant harm', taxonomyAligned: true, expectedCoBenefitsPct: null
            },
            institutional: {
                organisation: 'Energy developer', maturityLevel: 5, skills: 'All critical skills in-house', similarProjects: 8, largestBudgetEur: 40000000,
                lastProjectYear: 2025, auditOpinion: 'Unqualified', euFundingExperience: true, governanceNote: 'Concession agreement with the irrigation community'
            },
            businessModel: {
                valuePropositions: ['Low-cost energy for pumping', 'Reduced reservoir evaporation', 'No land take'],
                customerSegments: ['Irrigation communities', 'Grid off-takers'],
                keyPartners: ['Irrigation community', 'River basin authority', 'Module and float suppliers'],
                revenueStreams: ['Self-consumption savings', 'PPA']
            },
            kpis: ['PV yield (kWh/kWp)', 'Evaporation avoided', 'Water-quality indicators', 'Bird and fish monitoring'],
            documents: [
                { id: 'DOC-FPV-01', title: 'Five-year operational performance report', type: 'Project document', provider: 'Developer', date: '2026-02-28', metrics: ['2.1', '2.3', '3.3'] },
                { id: 'DOC-FPV-02', title: 'Environmental monitoring programme — biodiversity & water quality', type: 'Project document', provider: 'River basin authority', date: '2025-10-15', metrics: ['4.1', '4.4'] },
                { id: 'DOC-FPV-03', title: 'Concession & self-consumption contract template', type: 'Regulation / policy', provider: 'Developer', date: '2024-05-06', metrics: ['3.2', '4.3'] }
            ]
        },
        {
            id: 'PDM-SRC-005', roles: ['source'], version: 2, lastUpdated: '2026-03-12',
            name: 'Floating PV on Water-Supply Reservoir for Treatment Pumping',
            shortName: 'Floating PV water-supply reservoir (UK)',
            country: 'United Kingdom', region: 'Thames basin — water-supply reservoir', status: 'Operational', year: 2016,
            adaptationType: 'Water–energy nexus / Renewable energy',
            summary: 'Large floating PV array supplying a water utility\'s treatment and pumping load behind the meter. Illustrative demo record.',
            owner: 'Regional water utility',
            climate: { koppen: 'Cfb', avgTempC: 11.3, precipMm: 600, irradianceKwhM2: 1050, windMs: 4.2, hazards: ['drought', 'heavy precipitation', 'heatwaves'] },
            technical: {
                technologyFamily: 'floating PV', infrastructureType: 'reservoir', trl: 9, yearsOperational: 9, sitesDeployed: 6, failureRatePct: 1.5,
                capacityKwp: 6300, infrastructure: 'Water-supply reservoir with pumping and treatment works', supplyChain: 'Strong', omCapacity: 'Utility asset team with specialist contractor'
            },
            financial: {
                capexEur: 7250000, capexPerKwpEur: 1150, opexEurYr: 70000, costIndex: 1.10, irrPct: 6.8, npvEur: 2100000, paybackYrs: 11,
                tariffEurMwh: 120, revenueStreams: ['Self-consumption savings (pumping)'],
                revenueTags: ['self-consumption'], financingStructure: 'Utility balance sheet with green bond', financingAccess: 'Commercial', grantSharePct: 0
            },
            esg: {
                ghgReductionTco2Yr: 1500, waterSavedM3Yr: 8000, beneficiaries: 50000, beneficiariesNote: 'Water customers (indirect tariff effect)', vulnerableSharePct: 18,
                stakeholderEngagement: 'High', dnshStatus: 'Screened – no significant harm', taxonomyAligned: false, expectedCoBenefitsPct: null
            },
            institutional: {
                organisation: 'Regional water utility', maturityLevel: 5, skills: 'All critical skills in-house', similarProjects: 5, largestBudgetEur: 120000000,
                lastProjectYear: 2024, auditOpinion: 'Unqualified', euFundingExperience: false, governanceNote: 'Utility-owned, regulator-approved'
            },
            businessModel: {
                valuePropositions: ['Lower operating cost of water supply', 'Decarbonised pumping', 'Reduced evaporation'],
                customerSegments: ['Water utility operations'],
                keyPartners: ['Water utility', 'Floating PV specialist', 'Grid operator'],
                revenueStreams: ['Self-consumption savings']
            },
            kpis: ['Share of pumping load met by PV', 'PV yield', 'Algae / water-quality indicators'],
            documents: [
                { id: 'DOC-UK-01', title: 'Nine-year operational data for behind-the-meter floating PV', type: 'Project document', provider: 'Water utility', date: '2025-12-02', metrics: ['2.1', '2.3', '3.2'] },
                { id: 'DOC-UK-02', title: 'Water-quality and ecology monitoring summary', type: 'Literature / study', provider: 'Environmental consultant', date: '2024-09-30', metrics: ['4.1', '4.4'] }
            ]
        },
        {
            id: 'PDM-SRC-006', roles: ['source'], version: 2, lastUpdated: '2026-04-22',
            name: 'Deep Energy Retrofit of Social Housing (industrialised, net-zero-ready)',
            shortName: 'Social-housing deep retrofit (NL)',
            country: 'Netherlands', region: 'South Holland — social housing portfolio', status: 'Operational programme', year: 2019,
            adaptationType: 'Building retrofit',
            summary: 'Industrialised façade and roof retrofit with heat pumps and rooftop PV for social housing, financed by energy-performance guarantees. Illustrative demo record.',
            owner: 'Housing association with retrofit consortium',
            climate: { koppen: 'Cfb', avgTempC: 10.8, precipMm: 850, irradianceKwhM2: 1000, windMs: 5.0, hazards: ['heatwaves', 'heavy precipitation'] },
            technical: {
                technologyFamily: 'building retrofit', infrastructureType: 'building', trl: 9, yearsOperational: 6, sitesDeployed: 12, failureRatePct: 2,
                capacityKwp: 350, infrastructure: 'Terraced social housing', supplyChain: 'Strong', omCapacity: 'Performance-guaranteed maintenance'
            },
            financial: {
                capexEur: 9000000, capexPerKwpEur: null, opexEurYr: 60000, costIndex: 1.15, irrPct: 5.5, npvEur: 900000, paybackYrs: 18,
                tariffEurMwh: 250, revenueStreams: ['Energy-performance payments', 'Energy bill savings', 'Grants'],
                revenueTags: ['epc', 'self-consumption', 'grants'], financingStructure: 'Housing-association loans + 25% grant', financingAccess: 'Blended', grantSharePct: 25
            },
            esg: {
                ghgReductionTco2Yr: 700, waterSavedM3Yr: 0, beneficiaries: 1800, beneficiariesNote: 'Social-housing tenants, many energy-poor', vulnerableSharePct: 70,
                stakeholderEngagement: 'High', dnshStatus: 'Screened – no significant harm', taxonomyAligned: true, expectedCoBenefitsPct: null
            },
            institutional: {
                organisation: 'Housing association', maturityLevel: 4, skills: 'Most skills present, some gaps', similarProjects: 4, largestBudgetEur: 15000000,
                lastProjectYear: 2025, auditOpinion: 'Unqualified', euFundingExperience: true, governanceNote: 'Tenant approval ≥70% required'
            },
            businessModel: {
                valuePropositions: ['Net-zero-ready homes', 'Lower energy bills', 'Improved comfort in heatwaves'],
                customerSegments: ['Social-housing tenants', 'Housing associations'],
                keyPartners: ['Housing association', 'Retrofit builders', 'Municipality'],
                revenueStreams: ['Energy-performance payments', 'Grants']
            },
            kpis: ['Energy use per dwelling', 'Indoor overheating hours', 'Tenant satisfaction'],
            documents: [
                { id: 'DOC-NL-01', title: 'Programme evaluation: energy, comfort and tenant outcomes', type: 'Literature / study', provider: 'Independent evaluator', date: '2025-06-01', metrics: ['2.1', '4.2'] }
            ]
        },
        {
            id: 'PDM-SITE-101', roles: ['site'], version: 3, lastUpdated: '2026-09-15',
            name: 'FAEN — Narcea Canal & reservoirs (SOLVATE replication)',
            shortName: 'FAEN Narcea Canal (Asturias, ES)',
            country: 'Spain', region: 'Asturias — Narcea river basin', status: 'Replicator (feasibility)', year: 2026,
            adaptationType: 'Water–energy nexus / Renewable energy',
            summary: 'FAEN replicates SOLVATE on the Narcea Canal system: Quinzanas intake and pumping station, 17.6 km open canal and three reservoirs supplying industrial (ArcelorMittal) and public (CADASA) demand.',
            owner: 'FAEN — Asturian Energy Foundation; water abstraction operated by a private concession holder',
            targetTechnologies: ['canal-top PV', 'floating PV', 'water-energy SDM'],
            climate: { koppen: 'Cfb', avgTempC: 13.6, precipMm: 1100, irradianceKwhM2: 1250, windMs: 3.5, hazards: ['heavy precipitation', 'drought', 'heatwaves'] },
            technical: {
                infrastructureTypes: ['canal', 'reservoir', 'pumping station'],
                infrastructure: 'Open canal 17.6 km, ~2.4 m water-surface width; Quinzanas intake & pumping station (5 × 1 m³/s + 1 × 0.5 m³/s, max 5.5 m³/s); reservoirs Trasona (4 hm³), La Granda (3 hm³), San Andrés de los Tacones (4 hm³)',
                constraints: ['Narrow canal (~2.4 m) limits canal-top PV layout and yield per km'], constrainedFamilies: ['canal-top PV'],
                pumpingEnergyMwhMonth: 586.3, plannedCapacityKwp: 2500, supplyChain: 'Strong',
                omCapacity: 'Concession operator maintains pumping station; no in-house PV O&M staff'
            },
            financial: {
                costIndex: 0.98, expectedCapexEur: 2900000, electricityPriceEurMwh: 118, projectedIrrPct: 6.1,
                revenueStreams: ['Self-consumption savings (pumping)', 'Surplus energy sales'], revenueTags: ['self-consumption', 'energy-sales'],
                financingStructure: 'To be defined — regional funds and green loan under discussion', financingAccess: 'Blended', grantSharePct: 30
            },
            esg: {
                beneficiaries: 6500, beneficiariesNote: 'Industrial supply (ArcelorMittal ≈1,492 k m³/month) and public supply via CADASA (≈175 k m³/yr)',
                vulnerableSharePct: 12, stakeholderEngagement: 'Medium', dnshStatus: 'Pending screening', taxonomyAligned: null, expectedCoBenefitsPct: 70
            },
            institutional: {
                organisation: 'FAEN — Asturian Energy Foundation', maturityLevel: 4, skills: 'Most skills present, some gaps', similarProjects: 3, largestBudgetEur: 3000000,
                lastProjectYear: 2024, auditOpinion: 'Unqualified', euFundingExperience: true,
                governanceNote: 'Water abstraction under private concession; CADASA public supply; AEMET data provider'
            },
            businessModel: {
                valuePropositions: ['Lower pumping electricity cost', 'Decarbonised industrial water supply'],
                customerSegments: ['Concession operator', 'Industrial water user', 'Public water consortium'],
                keyPartners: ['FAEN', 'Concession holder', 'CADASA', 'AEMET'],
                revenueStreams: ['Self-consumption savings', 'Surplus energy sales']
            },
            kpis: ['Pumping electricity (MWh/month)', 'Abstraction (k m³/month)', 'Reservoir levels'],
            documents: [
                { id: 'DOC-FAEN-01', title: 'FAEN replication datasets — Narcea Canal', type: 'PDM record', provider: 'FAEN', date: '2026-09-15', metrics: ['1.2', '2.2', '3.2'] },
                { id: 'DOC-FAEN-02', title: 'Quinzanas pumping station — abstraction & electricity records', type: 'Site survey / measurement', provider: 'Concession holder', date: '2026-09-10', metrics: ['3.1', '3.2'] },
                { id: 'DOC-FAEN-03', title: 'AEMET precipitation, solar radiation & temperature series', type: 'Climate / resource dataset', provider: 'AEMET', date: '2026-07-01', metrics: ['1.1', '1.2', '1.3'] },
                { id: 'DOC-FAEN-04', title: 'CADASA public-supply demand records', type: 'Official statistics', provider: 'CADASA', date: '2026-06-30', metrics: ['1.4', '4.2'] },
                { id: 'DOC-FAEN-05', title: 'Canal geometry & PV feasibility survey (17.6 km, ~2.4 m width)', type: 'Site survey / measurement', provider: 'FAEN', date: '2026-08-22', metrics: ['2.2', '2.3'] }
            ]
        },
        {
            id: 'PDM-SITE-102', roles: ['site'], version: 2, lastUpdated: '2026-06-05',
            name: 'Comune di Ventimiglia — municipal buildings & energy (replicator)',
            shortName: 'Comune di Ventimiglia (Liguria, IT)',
            country: 'Italy', region: 'Liguria — Ventimiglia', status: 'Replicator (pre-screening)', year: 2026,
            adaptationType: 'Building retrofit',
            summary: 'Municipal replicator exploring retrofit of public and social buildings with PV and heat-resilience measures. Level 1/Level 2 pre-screening completed at the May 2026 CLIMINVEST workshop.',
            owner: 'Comune di Ventimiglia (Energy Manager\'s office)',
            targetTechnologies: ['building retrofit', 'rooftop PV'],
            climate: { koppen: 'Csa', avgTempC: 16.3, precipMm: 800, irradianceKwhM2: 1550, windMs: 3.1, hazards: ['heatwaves', 'heavy precipitation', 'drought'] },
            technical: {
                infrastructureTypes: ['building'], infrastructure: 'Municipal offices, schools and public housing (1960s–1980s stock)',
                constraints: ['Historic-centre constraints on façades'], constrainedFamilies: [], plannedCapacityKwp: 400,
                supplyChain: 'Moderate', omCapacity: 'Municipal technical office; external maintenance contracts'
            },
            financial: {
                costIndex: 1.02, expectedCapexEur: 4500000, electricityPriceEurMwh: 210, projectedIrrPct: 4.8,
                revenueStreams: ['Energy bill savings', 'Grants (national incentives)'], revenueTags: ['self-consumption', 'grants', 'epc'],
                financingStructure: 'National incentives + regional ERDF call', financingAccess: 'Grant-dependent', grantSharePct: 60
            },
            esg: {
                beneficiaries: 4200, beneficiariesNote: 'Building users incl. public-housing tenants and pupils', vulnerableSharePct: 30,
                stakeholderEngagement: 'High', dnshStatus: 'Pending screening', taxonomyAligned: null, expectedCoBenefitsPct: 80
            },
            institutional: {
                organisation: 'Comune di Ventimiglia', maturityLevel: 3, skills: 'Key skills present, significant gaps', similarProjects: 2, largestBudgetEur: 1200000,
                lastProjectYear: 2023, auditOpinion: 'Unqualified with findings', euFundingExperience: true,
                governanceNote: 'Mayor and Energy Manager engaged (May 2026 workshop); regional regulations under analysis'
            },
            businessModel: {
                valuePropositions: ['Lower municipal energy bills', 'Heat-resilient public buildings'],
                customerSegments: ['Municipality', 'Tenants', 'Schools'],
                keyPartners: ['Comune di Ventimiglia', 'Regione Liguria', 'Maggioli'],
                revenueStreams: ['Energy bill savings', 'Grants']
            },
            kpis: ['Energy use (kWh/m²)', 'Overheating hours', 'Energy bill (€/yr)'],
            documents: [
                { id: 'DOC-VEN-01', title: 'CLIMINVEST Talks workshop outputs — Level 1/2 pre-screening (May 2026)', type: 'Stakeholder interview / workshop', provider: 'NOVO / Comune di Ventimiglia', date: '2026-05-21', metrics: ['4.3', '5.1', '5.2'] },
                { id: 'DOC-VEN-02', title: 'Local sustainability regulations analysed by the Extraction Agent', type: 'Regulation / policy', provider: 'Maggioli', date: '2026-05-20', metrics: ['4.3', '4.4'] }
            ]
        }
    ];

    RSA.MockPdmData = {
        datasetNote: 'Demo PDM dataset — SOLVATE, FAEN and Ventimiglia records draw on CLIMINVEST project documents; all other values are illustrative and not validated.',
        projects
    };
})(window.RSA);
