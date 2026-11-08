/*
 * Indicative PDM-based bands per metric.
 * These translate PDM data into the Scoring Toolkit bands so the AI assistant can explain which band MAY apply
 * and the better-match engine can compare projects transparently. They are never written into a metric score
 * automatically — assessors decide.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const f = (side, path, value) => ({ side, path, value });
    const res = (score, detail, fields) => ({ score, detail, fields });
    const num = (v) => (v === null || v === undefined || v === '' || isNaN(v) ? null : Number(v));
    const pctDiff = (a, b) => (num(a) === null || num(b) === null || Number(a) === 0 ? null : ((Number(b) - Number(a)) / Number(a)) * 100);
    const PV_FAMILIES = ['canal-top PV', 'floating PV', 'rooftop PV'];

    const levelMap = (value, map) => (value in map ? map[value] : null);

    const I = {
        '1.1'(s, t) {
            const a = U.get(s, 'climate.koppen'); const b = U.get(t, 'climate.koppen');
            if (!a || !b) return null;
            let score; let why;
            if (a === b) { score = 90; why = 'identical Köppen class'; }
            else if (a.slice(0, 2) === b.slice(0, 2)) { score = 75; why = 'same main group and precipitation regime'; }
            else if (a[0] === b[0]) { score = 50; why = 'same main climate group, different sub-type'; }
            else if ('BCD'.includes(a[0]) && 'BCD'.includes(b[0])) { score = 25; why = 'different but adjacent climate groups'; }
            else { score = 0; why = 'fundamentally different climate groups'; }
            const dT = num(U.get(t, 'climate.avgTempC')) !== null && num(U.get(s, 'climate.avgTempC')) !== null
                ? (U.get(t, 'climate.avgTempC') - U.get(s, 'climate.avgTempC')).toFixed(1) : null;
            return res(score, `${a} → ${b}: ${why}${dT !== null ? `; mean temperature difference ${dT} °C` : ''}.`,
                [f('source', 'climate.koppen', a), f('site', 'climate.koppen', b), f('source', 'climate.avgTempC', U.get(s, 'climate.avgTempC')), f('site', 'climate.avgTempC', U.get(t, 'climate.avgTempC'))]);
        },
        '1.2'(s, t) {
            const a = U.get(s, 'climate.irradianceKwhM2'); const b = U.get(t, 'climate.irradianceKwhM2');
            const d = pctDiff(a, b); if (d === null) return null;
            const ad = Math.abs(d);
            const score = ad <= 10 ? 90 : ad <= 20 ? 75 : ad <= 35 ? 50 : ad <= 50 ? 25 : 0;
            return res(score, `Irradiance ${U.fmtNum(a)} → ${U.fmtNum(b)} kWh/m²/yr (${d > 0 ? '+' : ''}${d.toFixed(0)}%).`,
                [f('source', 'climate.irradianceKwhM2', a), f('site', 'climate.irradianceKwhM2', b)]);
        },
        '1.3'(s, t) {
            const a = U.get(s, 'climate.hazards') || []; const b = U.get(t, 'climate.hazards') || [];
            if (!a.length || !b.length) return null;
            const j = U.jaccard(a, b); const primarySame = a[0] === b[0]; const primaryShared = b.includes(a[0]);
            const score = primarySame && j >= 0.6 ? 90 : primarySame ? 75 : primaryShared ? 50 : j > 0 ? 25 : 0;
            return res(score, `Source primary hazard "${a[0]}" is ${primarySame ? 'also the primary' : primaryShared ? 'a secondary' : 'not a'} hazard at the site; hazard overlap ${Math.round(j * 100)}%.`,
                [f('source', 'climate.hazards', a), f('site', 'climate.hazards', b)]);
        },
        '1.4'(s, t) {
            const n = num(U.get(t, 'esg.beneficiaries')); const v = num(U.get(t, 'esg.vulnerableSharePct'));
            if (n === null) return null;
            let score = n >= 10000 ? 90 : n >= 5000 ? 75 : n >= 1000 ? 50 : n > 0 ? 25 : 0;
            if (v !== null && v < 20) score = Math.min(score, 50);
            return res(score, `≈${U.fmtNum(n)} beneficiaries at the site${v !== null ? `, ${v}% vulnerable` : ''}.`,
                [f('site', 'esg.beneficiaries', n), f('site', 'esg.vulnerableSharePct', v), f('site', 'esg.beneficiariesNote', U.get(t, 'esg.beneficiariesNote'))]);
        },
        '2.1'(s) {
            const trl = num(U.get(s, 'technical.trl')); if (trl === null) return null;
            const yrs = num(U.get(s, 'technical.yearsOperational')) || 0; const sites = num(U.get(s, 'technical.sitesDeployed')) || 0;
            const score = trl >= 8 && yrs > 5 && sites > 1 ? 90 : trl >= 7 && yrs >= 3 && sites >= 2 ? 75 : trl >= 6 && yrs >= 1 ? 50 : trl >= 5 ? 25 : 0;
            return res(score, `TRL ${trl}, ${yrs} year(s) operational, ${sites} site(s) deployed.`,
                [f('source', 'technical.trl', trl), f('source', 'technical.yearsOperational', yrs), f('source', 'technical.sitesDeployed', sites)]);
        },
        '2.2'(s, t) {
            const fam = U.get(s, 'technical.technologyFamily'); const targets = t.targetTechnologies || [];
            if (!fam) return null;
            const fit = targets.includes(fam);
            const infraFit = (U.get(t, 'technical.infrastructureTypes') || []).includes(U.get(s, 'technical.infrastructureType'));
            const constrained = (U.get(t, 'technical.constrainedFamilies') || []).includes(fam);
            let score = fit && infraFit ? 75 : fit || infraFit ? 50 : 25;
            if (constrained) score = Math.max(0, score - 25);
            const notes = [fit ? `"${fam}" is a target technology of the site` : `"${fam}" is not among the site's target technologies`,
                infraFit ? `host infrastructure (${U.get(s, 'technical.infrastructureType')}) exists at the site` : 'host infrastructure type differs'];
            if (constrained) notes.push(`site constraint: ${(U.get(t, 'technical.constraints') || []).join('; ')}`);
            return res(score, `${notes.join('; ')}.`,
                [f('source', 'technical.technologyFamily', fam), f('site', 'technical.infrastructureTypes', U.get(t, 'technical.infrastructureTypes')), f('site', 'technical.constraints', U.get(t, 'technical.constraints'))]);
        },
        '2.3'(s, t) {
            const fam = U.get(s, 'technical.technologyFamily');
            if (!PV_FAMILIES.includes(fam)) return null;
            const d = pctDiff(U.get(s, 'climate.irradianceKwhM2'), U.get(t, 'climate.irradianceKwhM2')); if (d === null) return null;
            const score = d >= -5 ? 90 : d >= -10 ? 75 : d >= -20 ? 50 : d >= -30 ? 25 : 0;
            return res(score, `Specific PV yield expected to change by ≈${d > 0 ? '+' : ''}${d.toFixed(0)}% (irradiance-driven, before temperature gains).`,
                [f('source', 'climate.irradianceKwhM2', U.get(s, 'climate.irradianceKwhM2')), f('site', 'climate.irradianceKwhM2', U.get(t, 'climate.irradianceKwhM2'))]);
        },
        '2.4'(s, t) {
            const v = U.get(t, 'technical.supplyChain');
            const score = levelMap(v, { Strong: 90, Moderate: 75, Limited: 50, Weak: 25, None: 0 });
            if (score === null) return null;
            return res(score, `Local supply chain rated "${v}"; ${U.get(t, 'technical.omCapacity') || 'O&M capacity not recorded'}.`,
                [f('site', 'technical.supplyChain', v), f('site', 'technical.omCapacity', U.get(t, 'technical.omCapacity'))]);
        },
        '3.1'(s, t) {
            const a = num(U.get(s, 'financial.costIndex')); const b = num(U.get(t, 'financial.costIndex'));
            if (a === null || b === null) return null;
            const d = (b / a - 1) * 100; const ad = Math.abs(d);
            const score = ad <= 10 ? 90 : ad <= 15 ? 75 : ad <= 35 ? 50 : 25;
            return res(score, `Local cost index ${a.toFixed(2)} → ${b.toFixed(2)} (${d > 0 ? '+' : ''}${d.toFixed(0)}% cost scaling, before design-adaptation premiums).`,
                [f('source', 'financial.costIndex', a), f('site', 'financial.costIndex', b), f('source', 'financial.capexPerKwpEur', U.get(s, 'financial.capexPerKwpEur'))]);
        },
        '3.2'(s, t) {
            const tariff = num(U.get(s, 'financial.tariffEurMwh')); const price = num(U.get(t, 'financial.electricityPriceEurMwh'));
            const overlap = U.jaccard(U.get(s, 'financial.revenueTags') || [], U.get(t, 'financial.revenueTags') || []);
            if (tariff === null || price === null) return null;
            const ratio = price / tariff;
            let score = ratio >= 1 ? 90 : ratio >= 0.8 ? 75 : ratio >= 0.6 ? 50 : 25;
            if (overlap !== null && overlap < 0.34) score = Math.max(0, score - 25);
            else if (overlap !== null && overlap < 0.6) score = Math.max(0, score - 15);
            return res(score, `Energy value at site ${U.fmtNum(price)} vs ${U.fmtNum(tariff)} €/MWh in source (ratio ${ratio.toFixed(2)}); revenue-stream overlap ${overlap === null ? 'n/a' : `${Math.round(overlap * 100)}%`}.`,
                [f('source', 'financial.tariffEurMwh', tariff), f('site', 'financial.electricityPriceEurMwh', price), f('source', 'financial.revenueStreams', U.get(s, 'financial.revenueStreams')), f('site', 'financial.revenueStreams', U.get(t, 'financial.revenueStreams'))]);
        },
        '3.3'(s, t) {
            const irr = num(U.get(t, 'financial.projectedIrrPct'));
            const npv = num(U.get(t, 'financial.projectedNpvRetentionPct'));
            if (irr === null && npv === null) return null;
            const irrBand = irr === null ? null : irr >= 8 ? 90 : irr >= 6 ? 75 : irr >= 4 ? 50 : irr >= 2 ? 25 : 0;
            const npvBand = npv === null ? null : npv > 80 ? 90 : npv >= 60 ? 75 : npv >= 40 ? 50 : npv >= 20 ? 25 : 0;
            const score = Math.min(...[irrBand, npvBand].filter((x) => x !== null));
            const parts = [irr !== null ? `projected IRR ${irr}%` : 'projected IRR not available', npv !== null ? `NPV retained ${npv}%` : 'NPV retention not available'];
            return res(score, `${parts.join('; ')} (source IRR ${U.get(s, 'financial.irrPct') ?? '—'}%). The lower of the two bands applies.`,
                [f('site', 'financial.projectedIrrPct', irr), f('site', 'financial.projectedNpvRetentionPct', npv), f('source', 'financial.irrPct', U.get(s, 'financial.irrPct'))]);
        },
        '3.4'(s, t) {
            const v = U.get(t, 'financial.financingAccess');
            const score = levelMap(v, { Commercial: 90, 'Commercial + minor subsidy': 75, Blended: 50, Concessional: 25, 'Grant-dependent': 0 });
            if (score === null) return null;
            return res(score, `Financing access at site: "${v}" (${U.get(t, 'financial.financingStructure') || 'structure not defined'}).`,
                [f('site', 'financial.financingAccess', v), f('site', 'financial.financingStructure', U.get(t, 'financial.financingStructure')), f('source', 'financial.financingStructure', U.get(s, 'financial.financingStructure'))]);
        },
        '4.1'(s, t) {
            const p = num(U.get(t, 'esg.expectedCoBenefitsPct')); if (p === null) return null;
            const score = p >= 100 ? 90 : p >= 85 ? 75 : p >= 60 ? 50 : p >= 40 ? 25 : 0;
            return res(score, `Site expected to realise ≈${p}% of the source co-benefits.`,
                [f('site', 'esg.expectedCoBenefitsPct', p), f('source', 'esg.ghgReductionTco2Yr', U.get(s, 'esg.ghgReductionTco2Yr')), f('source', 'esg.waterSavedM3Yr', U.get(s, 'esg.waterSavedM3Yr'))]);
        },
        '4.2'(s, t) {
            const v = num(U.get(t, 'esg.vulnerableSharePct')); if (v === null) return null;
            const score = v > 50 ? 90 : v >= 35 ? 75 : v >= 20 ? 50 : 25;
            return res(score, `${v}% of benefits reach vulnerable groups at the site (source: ${U.get(s, 'esg.vulnerableSharePct') ?? '—'}%).`,
                [f('site', 'esg.vulnerableSharePct', v), f('source', 'esg.vulnerableSharePct', U.get(s, 'esg.vulnerableSharePct'))]);
        },
        '4.3'(s, t) {
            const v = U.get(t, 'esg.stakeholderEngagement');
            const score = levelMap(v, { Full: 90, High: 75, Medium: 50, Low: 25, Minimal: 0 });
            if (score === null) return null;
            return res(score, `Stakeholder engagement recorded as "${v}". ${U.get(t, 'institutional.governanceNote') || ''}`,
                [f('site', 'esg.stakeholderEngagement', v), f('site', 'institutional.governanceNote', U.get(t, 'institutional.governanceNote'))]);
        },
        '4.4'(s, t) {
            const v = U.get(t, 'esg.dnshStatus');
            const score = levelMap(v, { 'Screened – no significant harm': 90, 'Screened – minor issues': 75, 'Pending screening': 50, 'Concerns identified': 25, 'Not screened': 25 });
            if (score === null) return null;
            return res(score, `DNSH status at site: "${v}".`, [f('site', 'esg.dnshStatus', v), f('source', 'esg.dnshStatus', U.get(s, 'esg.dnshStatus'))]);
        },
        '5.1'(s, t) {
            const v = num(U.get(t, 'institutional.maturityLevel')); if (v === null) return null;
            const score = v >= 5 ? 90 : v >= 4 ? 75 : v >= 3 ? 50 : v >= 2 ? 25 : 0;
            return res(score, `${U.get(t, 'institutional.organisation') || 'Organisation'} at maturity level ${v}/5.`, [f('site', 'institutional.maturityLevel', v)]);
        },
        '5.2'(s, t) {
            const v = U.get(t, 'institutional.skills');
            const score = levelMap(v, { 'All critical skills in-house': 90, 'Most skills present, some gaps': 75, 'Key skills present, significant gaps': 50, 'Limited skills, external support': 25, 'Critical skills absent': 0 });
            if (score === null) return null;
            return res(score, `Skills profile: "${v}".`, [f('site', 'institutional.skills', v)]);
        },
        '5.3'(s, t) {
            const n = num(U.get(t, 'institutional.similarProjects')); const b = num(U.get(t, 'institutional.largestBudgetEur'));
            if (n === null) return null;
            let score = n >= 5 && b >= 5e6 ? 90 : n >= 3 && b >= 2e6 ? 75 : n >= 1 && b >= 5e5 ? 50 : n >= 1 ? 25 : 0;
            const capex = num(U.get(t, 'financial.expectedCapexEur')) || num(U.get(s, 'financial.capexEur'));
            const scaleNote = capex && b ? `; largest budget managed is ${Math.round((b / capex) * 100)}% of the expected CAPEX` : '';
            if (capex && b && b < capex * 0.5) score = Math.max(0, score - 25);
            return res(score, `${n} similar project(s), largest budget €${U.fmtNum(b)}${scaleNote}.`,
                [f('site', 'institutional.similarProjects', n), f('site', 'institutional.largestBudgetEur', b), f('site', 'institutional.lastProjectYear', U.get(t, 'institutional.lastProjectYear'))]);
        },
        '5.4'(s, t) {
            const a = U.get(t, 'institutional.auditOpinion'); const eu = U.get(t, 'institutional.euFundingExperience');
            if (!a) return null;
            const score = a === 'Unqualified' && eu ? 90 : a === 'Unqualified' ? 75 : a === 'Unqualified with findings' ? 50 : a === 'Qualified' ? 25 : 0;
            return res(score, `Audit opinion "${a}"; EU funding experience: ${eu ? 'yes' : 'no'}.`,
                [f('site', 'institutional.auditOpinion', a), f('site', 'institutional.euFundingExperience', eu)]);
        }
    };

    RSA.Indicators = {
        compute(metricId, source, site) {
            if (!source || !site || !I[metricId]) return null;
            try { return I[metricId](source, site); } catch (err) { console.warn('[indicator]', metricId, err); return null; }
        },
        all(source, site) {
            const out = {};
            RSA.Methodology.allMetrics().forEach((m) => { out[m.id] = this.compute(m.id, source, site); });
            return out;
        }
    };
})(window.RSA);
