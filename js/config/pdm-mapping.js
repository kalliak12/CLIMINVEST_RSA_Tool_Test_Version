/*
 * How a CLIMINVEST PDM project (GET /data/projectTree/{id}) is turned into the fields the RSA uses.
 *
 * `explicit` reads the PDM project structure as seen in the dev database (project GEF4115, Oct 2026):
 *   title, summary, sector, impact_type, keywords, locations[], institutions[], climate_hazards[], mainHazards,
 *   eu_environmental_objectives[].dnhs_status, social_baseline, governance_baseline,
 *   capexBreakdownTable / capexBreakdownTotalAmount, opexBreakdownTable / opexBreakdownTotalAmount,
 *   fundingStructureTable, valueTable, value_logic, funding_type, updatedAt.
 * Linked records ({ "$ref", "$id" }) are resolved by projectTree; their exact field names are read
 * defensively (name / title / label / acronym, falling back to the id).
 *
 * `fields` are generic key-path patterns used only for RSA fields the explicit reader left empty.
 * Empty template values ("" or 0) are ignored, so an unfilled PDM form never overwrites anything.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const num = (v) => {
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        if (v === null || v === undefined || String(v).trim() === '') return null;
        const n = RSA.DataExtract ? RSA.DataExtract.parseNumber(v) : parseFloat(String(v).replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
    };
    const pos = (v) => { const n = num(v); return n !== null && n > 0 ? n : null; };
    const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    /* A plausible text value (filters empty strings and obvious test junk like "www", "sdf"). */
    const txt = (v) => { if (typeof v !== 'string') return null; const s = v.trim(); if (s.length < 3 || /^(.)\1+$/.test(s) || /^(none|n\/a|na|sdfv?|asdf|test)$/i.test(s)) return null; return s; };
    /* Display name of a resolved reference or plain value. */
    const nameOf = (o) => {
        if (o === null || o === undefined) return null;
        if (typeof o !== 'object') return txt(String(o)) || (typeof o === 'number' ? null : null);
        return txt(o.name) || txt(o.title) || txt(o.label) || txt(o.legal_name) || txt(o.full_name) || txt(o.institution_name) || txt(o.organisation_name) || txt(o.organization_name)
            || txt(o.acronym) || txt(o.short_name) || txt(o.shortName) || (typeof o.$id === 'string' ? txt(o.$id.replace(/[_-]/g, ' ')) : null);
    };
    const uniq = (list) => [...new Set(list.filter(Boolean).map((s) => String(s).trim()))];
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

    function explicit(t) {
        const out = { identity: {}, fields: {} };
        const id = out.identity;
        const set = (path, v) => { if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) out.fields[path] = v; };

        /* Identity */
        id.name = txt(t.title) || txt(t.name) || String(t._id || t.id);
        id.shortName = txt(t.acronym) || null;
        const pitch = arr(t.description).find((d) => d && /pitch/i.test(d.field || ''));
        id.summary = txt(t.summary) || (pitch && txt(pitch.text)) || '';
        const locs = arr(t.locations).map((l) => (l && l.location) || l);
        const countries = uniq(locs.map((l) => l && (nameOf(l.country) || txt(l.country_name) || (typeof l.country === 'string' ? txt(l.country) : null))));
        id.country = countries[0] || (txt(t.country) && t.country.length > 3 ? t.country : '') || '';
        id.region = uniq(locs.map((l) => l && (txt(l.city) || txt(l.region_name) || nameOf(l.region) || nameOf(l)))).filter((x) => !countries.includes(x))[0] || '';
        const areas = arr(t.impact_areas).map((a) => nameOf(a && a.impact_area));
        id.adaptationType = uniq([txt(t.sector), txt(t.impact_type), ...areas]).join(' · ');
        const insts = arr(t.institutions).filter((i) => i && i.institution);
        const ownerInst = insts.find((i) => arr(i.roles).some((r) => /owner|promoter/i.test(r)) && nameOf(i.institution))
            || insts.find((i) => arr(i.roles).some((r) => /coordinat|developer|executing/i.test(r)) && nameOf(i.institution));
        id.owner = (ownerInst && nameOf(ownerInst.institution)) || txt(t.promoter) || '';
        id.updatedAt = t.updatedAt || t._updatedAt || '';

        /* Investment performance */
        const capexRows = arr(t.capexBreakdownTable).map((r) => pos(r && r.amount)).filter((n) => n !== null);
        set('financial.capexEur', pos(t.capexBreakdownTotalAmount) || (capexRows.length ? capexRows.reduce((a, b) => a + b, 0) : null)
            || pos(arr(t.budget).map((b) => b && (b.total || b.amount || b.value || b.total_amount)).find((x) => pos(x))));
        const opexRows = arr(t.opexBreakdownTable).map((r) => pos(r && r.annualAmount)).filter((n) => n !== null);
        set('financial.opexEurYr', pos(t.opexBreakdownTotalAmount) || (opexRows.length ? opexRows.reduce((a, b) => a + b, 0) : null));
        const funds = arr(t.fundingStructureTable).filter((r) => r && (pos(r.amount) || pos(r.percentOfTotal)));
        if (funds.length) {
            const totalAmt = funds.reduce((s, r) => s + (pos(r.amount) || 0), 0);
            const grantAmt = funds.filter((r) => /grant/i.test(r.type || '')).reduce((s, r) => s + (pos(r.amount) || 0), 0);
            const grantPct = funds.filter((r) => /grant/i.test(r.type || '')).reduce((s, r) => s + (pos(r.percentOfTotal) || 0), 0);
            set('financial.grantSharePct', totalAmt ? Math.round((grantAmt / totalAmt) * 1000) / 10 : grantPct || null);
            set('financial.financingStructure', funds.map((r) => `${r.source}${r.type ? ` (${r.type})` : ''}${pos(r.percentOfTotal) ? ` ${r.percentOfTotal}%` : pos(r.amount) ? ` €${Math.round(pos(r.amount)).toLocaleString('en')}` : ''}`).join('; '));
            const types = funds.map((r) => r.type || '');
            const hasGrant = types.some((x) => /grant/i.test(x)); const hasLoan = types.some((x) => /loan/i.test(x));
            set('financial.financingAccess', hasGrant && hasLoan ? 'Blended' : hasGrant ? 'Grant-dependent' : hasLoan ? 'Commercial' : null);
        } else if (txt(t.funding_type)) {
            set('financial.financingStructure', `${cap(t.funding_type)} funding`);
        }
        const values = arr(t.valueTable).filter((r) => r && pos(r.annualAmount)).map((r) => `${r.category} (€${Math.round(pos(r.annualAmount)).toLocaleString('en')}/yr)`);
        const models = arr(t.business_models).map(nameOf);
        set('financial.revenueStreams', uniq([...values, ...models, txt(t.value_logic) ? cap(t.value_logic.replace(/-/g, ' ')) : null]));

        /* Climate */
        const hz = arr(t.climate_hazards).map((h) => nameOf(h && h.hazard));
        set('climate.hazards', uniq([...hz, ...arr(t.mainHazards).map((x) => txt(x))]));

        /* Technical */
        set('technical.technologyFamily', uniq(arr(t.keywords).map(txt)).join(', ') || null);
        set('technical.infrastructureTypes', uniq([...areas, ...arr(t.impact_areas).flatMap((a) => arr(a && a.sub_areas).map(nameOf))]));
        set('technical.infrastructure', txt(t.environmental_baseline && t.environmental_baseline.current_condition));

        /* ESG */
        const dnsh = arr(t.eu_environmental_objectives).map((o) => String((o && (o.dnhs_status || o.dnsh_status)) || '')).filter(Boolean);
        if (dnsh.length) {
            set('esg.dnshStatus', dnsh.some((s) => /significant harm/i.test(s) && !/no significant harm/i.test(s) && !/partial/i.test(s)) ? 'Concerns identified'
                : dnsh.some((s) => /partial|mitigation/i.test(s)) ? 'Screened – minor issues' : dnsh.every((s) => /no significant harm/i.test(s)) ? 'Screened – no significant harm' : null);
        }
        const sb = t.social_baseline || {};
        const people = /([\d][\d,.\s]*)\s+(people|persons|inhabitants|beneficiaries|residents)/i.exec(id.summary || '');
        set('esg.beneficiaries', people ? num(people[1].replace(/\s/g, '')) : null);
        set('esg.beneficiariesNote', uniq([txt(sb.equity_inclusion), ...arr(sb.beneficiaries).map((b) => b && txt(b.vulnerability))]).join(' ') || null);

        /* Institutional */
        set('institutional.organisation', id.owner || null);
        const gb = t.governance_baseline || {};
        set('institutional.governanceNote', uniq([txt(gb.capacity_management) ? `Capacity management: ${gb.capacity_management}` : null, arr(gb.safeguards).length ? `Safeguards: ${arr(gb.safeguards).join(', ')}` : null]).join('. ') || null);
        return out;
    }

    RSA.PdmMapping = {
        explicit,
        /* Generic fallback (key paths are lower case, array positions removed). */
        identity: {
            name: [/^(title|name|project_?name|project_?title)$/],
            shortName: [/^(acronym|short_?name)$/],
            country: [/(^|\.)country(_?name)?$/],
            region: [/(^|\.)(region|city|municipality|location)(_?name)?$/],
            summary: [/^(summary|abstract|objective)$/],
            adaptationType: [/^(sector|impact_?type)$/],
            owner: [/^promoter$/],
            updatedAt: [/^_?(updated_?at|last_?modified)$/]
        },
        fields: [
            { path: 'financial.irrPct', type: 'number', keys: [/(^|\.)(financial_?)?irr(_?pct|_?percent)?$/, /internal_?rate_?of_?return/] },
            { path: 'financial.npvEur', type: 'number', keys: [/(^|\.)(financial_?)?npv(_?eur)?$/, /net_?present_?value/] },
            { path: 'financial.paybackYrs', type: 'number', keys: [/(^|\.)payback(_?period)?(_?years|_?yrs)?$/] },
            { path: 'climate.koppen', type: 'text', keys: [/k(o|oe|ö)ppen/, /(^|\.)climate_?(zone|classification)$/] },
            { path: 'climate.avgTempC', type: 'number', keys: [/(mean|average|avg)_?(annual_?)?temp/] },
            { path: 'technical.trl', type: 'number', keys: [/(^|\.)trl$/, /technology_?readiness/] },
            { path: 'esg.ghgReductionTco2Yr', type: 'number', keys: [/(ghg|co2|emissions?)_?(reduction|savings|avoided)_?(per_?year|annual|yr)/] }
        ]
    };
})(window.RSA);
