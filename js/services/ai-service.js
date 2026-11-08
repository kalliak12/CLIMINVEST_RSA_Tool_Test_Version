/*
 * AI Assessment Assistant service.
 * Provider "local": deterministic analysis engine over the RSA data (PDM snapshots, metrics, evidence, risks,
 *   attached document text, methodology). Always returns the sources it used. Runs offline.
 * Provider "remote": POSTs { question, context } to a configurable endpoint (e.g. an LLM gateway) and expects
 *   { answer: string, sources?: [{kind,label}] }. Falls back to the local engine on error.
 * The assistant never changes scores or statuses; any text it drafts must be inserted and edited by a human.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;
    const S = RSA.Scoring;
    const W = RSA.Workflow;

    const src = (kind, label) => ({ kind, label });
    const fmtVal = (v, path) => {
        if (v === null || v === undefined || v === '') return '<span class="muted">n/a</span>';
        if (Array.isArray(v)) return U.esc(v.join(', ')) || '<span class="muted">n/a</span>';
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        const unit = path ? M.fieldUnit(path) : '';
        return `${typeof v === 'number' ? U.fmtNum(v, v % 1 ? 2 : 0) : U.esc(v)}${unit && unit !== '€' ? ` ${U.esc(unit)}` : ''}${unit === '€' ? ' €' : ''}`;
    };

    function context(a, focusMetricId) {
        const calc = S.compute(a);
        return {
            a, calc,
            source: RSA.Data.effective(a, 'source'),
            site: RSA.Data.effective(a, 'site'),
            sv: a.pdm.source ? `v${a.pdm.source.version}` : '',
            tv: a.pdm.site ? `v${a.pdm.site.version}` : '',
            focus: focusMetricId || null
        };
    }

    function pdmSourcesFor(ctx, fields) {
        const out = [];
        fields.forEach((fl) => {
            const rec = fl.side === 'source' ? ctx.source : ctx.site;
            if (!rec) return;
            out.push(src('PDM', `${rec.shortName || rec.name} (${fl.side === 'source' ? ctx.sv : ctx.tv}) · ${M.fieldLabel(fl.path)}`));
        });
        return out;
    }

    function metricState(ctx, id) { return ctx.calc.metrics.find((x) => x.id === id); }

    const Engine = {
        help() {
            return {
                html: `<p>I can help the assessment team with:</p><ul>
                  <li><strong>Explain a metric</strong> — e.g. "Explain 3.2"</li>
                  <li><strong>Which band may apply</strong> — e.g. "Why would 1.2 be in the 50 band?"</li>
                  <li><strong>Draft a rationale</strong> — e.g. "Draft rationale for 2.2"</li>
                  <li><strong>Missing evidence / data</strong>, <strong>contradictions</strong>, <strong>low-confidence scores</strong></li>
                  <li><strong>Compare source vs replication site</strong> and <strong>summarise differences</strong></li>
                  <li><strong>Summarise risks</strong>, <strong>suggest evidence</strong>, <strong>next actions</strong>, <strong>better-match projects</strong></li>
                  <li><strong>Search documents</strong> — e.g. "search documents for concession"</li></ul>
                  <p class="muted">Suggestions only — the assessment team scores, the reviewer/lead assessor approves.</p>`,
                sources: [src('Methodology', M.version)]
            };
        },

        explainMetric(ctx, id) {
            const m = M.metric(id); const x = metricState(ctx, id);
            if (!m) return Engine.help();
            const ind = RSA.Indicators.compute(id, ctx.source, ctx.site);
            const sources = [src('Methodology', `Scoring Toolkit v2.0 — metric ${id} criteria`)];
            let html = `<p><strong>${id} ${U.esc(m.name)}</strong> · ${U.esc(m.dimensionName)} (dimension weight ${Math.round(m.weight * 100)}%)</p>
              <p>${U.esc(m.description)}</p><p><em>How to score:</em> ${U.esc(m.guidance)}</p>
              <table class="mini-table"><tbody>${m.criteria.map((c) => `<tr><td><strong>${c.score}</strong></td><td>${U.esc(c.text)}</td></tr>`).join('')}</tbody></table>
              <p><em>Current state:</em> ${U.esc(x.st.status)} · assessor score ${x.st.score === '' ? '—' : U.esc(x.st.score)} · agreed ${x.st.finalScore === '' ? '—' : U.esc(x.st.finalScore)} · confidence ${M.confidenceLabel(x.st.confidence)} · ${x.evCount} evidence item(s).</p>`;
            if (ctx.source && ctx.site) {
                html += `<p><em>PDM context:</em></p><table class="mini-table"><thead><tr><th>Field</th><th>Source</th><th>Site</th></tr></thead><tbody>${m.pdmFields.map((p) => `<tr><td>${U.esc(M.fieldLabel(p))}</td><td>${fmtVal(U.get(ctx.source, p), p)}</td><td>${fmtVal(U.get(ctx.site, p), p)}</td></tr>`).join('')}</tbody></table>`;
                sources.push(...m.pdmFields.slice(0, 3).map((p) => src('PDM', `${M.fieldLabel(p)} — ${ctx.source.shortName} ${ctx.sv} / ${ctx.site.shortName} ${ctx.tv}`)));
            }
            if (ind) {
                const band = m.criteria.find((c) => c.score === ind.score) || {};
                html += `<p class="ai-suggest"><strong>Indicative band from PDM data: ${ind.score}</strong> (${U.esc(band.text || '')}). ${U.esc(ind.detail)}</p>`;
            }
            x.evidence.forEach((e) => sources.push(src('Evidence', `${e.id} ${e.title}`)));
            return { html, sources };
        },

        band(ctx, id) {
            const m = M.metric(id); const x = metricState(ctx, id);
            const ind = RSA.Indicators.compute(id, ctx.source, ctx.site);
            if (!ind) {
                return {
                    html: `<p>The PDM data for this pairing is not sufficient to indicate a band for <strong>${id} ${U.esc(m.name)}</strong>. Use the criteria and the suggested data sources: ${U.esc(m.dataSources.join('; '))}.</p>`,
                    sources: [src('Methodology', `Metric ${id} criteria`)]
                };
            }
            const band = m.criteria.find((c) => c.score === ind.score) || {};
            const next = m.criteria.find((c) => c.score > ind.score && c.score - ind.score <= 25);
            let html = `<p>For <strong>${id} ${U.esc(m.name)}</strong> the PDM data points to the <strong>${ind.score}</strong> band — "${U.esc(band.text)}".</p><p>${U.esc(ind.detail)}</p>`;
            if (next) html += `<p>To justify the ${next.score} band ("${U.esc(next.text)}"), the team would need evidence that the site condition is closer to the source than PDM currently shows.</p>`;
            if (x.eff !== null) {
                const diff = x.eff - ind.score;
                html += Math.abs(diff) >= 20
                    ? `<p class="ai-warn">The current score (${Math.round(x.eff)}) differs from the indicative band by ${diff > 0 ? '+' : ''}${Math.round(diff)} points — make sure the rationale explains why.</p>`
                    : `<p>The current score (${Math.round(x.eff)}) is consistent with the indicative band.</p>`;
            }
            html += '<p class="muted">Indicative only. The assessor sets the score; the reviewer agrees the final score.</p>';
            return { html, sources: [src('Methodology', `Metric ${id} criteria`), ...pdmSourcesFor(ctx, ind.fields.filter((f) => f.value !== undefined))] };
        },

        draftRationale(ctx, id) {
            const m = M.metric(id); const x = metricState(ctx, id);
            const ind = RSA.Indicators.compute(id, ctx.source, ctx.site);
            const parts = [];
            if (ind) {
                const band = m.criteria.find((c) => c.score === ind.score) || {};
                parts.push(`PDM data indicates the "${band.text}" band (${ind.score}): ${ind.detail}`);
            }
            if (x.evidence.length) parts.push(`Evidence considered: ${x.evidence.map((e) => `${e.title} (${e.provider || 'n/a'}, reliability ${M.reliabilityLabel(e.reliability)})`).join('; ')}.`);
            else parts.push('No evidence is linked yet; the score should be treated as provisional.');
            if (x.st.assumptions) parts.push(`Key assumptions: ${x.st.assumptions}`);
            const risks = ctx.calc.risks.unresolved.filter((r) => r.dimension === m.dimensionId);
            if (risks.length) parts.push(`Open risks affecting this dimension: ${risks.map((r) => r.description).join(' / ')}`);
            parts.push('[AI draft — to be verified and edited by the assessor]');
            const text = parts.join('\n');
            const sources = [src('Methodology', `Metric ${id} criteria`), ...(ind ? pdmSourcesFor(ctx, ind.fields) : []), ...x.evidence.map((e) => src('Evidence', `${e.id} ${e.title}`)), ...risks.map((r) => src('Risk', `${r.id} ${r.description}`))];
            return {
                html: `<p>Draft rationale for <strong>${id} ${U.esc(m.name)}</strong>:</p><blockquote>${U.nl2br(text)}</blockquote>`,
                sources,
                actions: [{ type: 'insertRationale', metricId: id, text, label: `Insert into ${id} rationale (as editable draft)` }]
            };
        },

        missing(ctx) {
            const rows = [];
            const sources = [];
            ctx.calc.metrics.forEach((x) => {
                const issues = [];
                if (x.evCount === 0) issues.push('no linked evidence');
                if (x.eff !== null && !x.st.assumptions) issues.push('no assumptions recorded');
                if (x.eff !== null && !x.st.rationale) issues.push('no rationale');
                if (ctx.site) {
                    const missingFields = x.pdmFields.filter((p) => { const v = U.get(ctx.site, p); return v === null || v === undefined || v === ''; });
                    const siteOnly = missingFields.filter((p) => !['technical.trl', 'technical.yearsOperational', 'technical.sitesDeployed', 'technical.failureRatePct', 'technical.technologyFamily', 'technical.capacityKwp', 'financial.capexEur', 'financial.capexPerKwpEur', 'financial.opexEurYr', 'financial.irrPct', 'financial.npvEur', 'financial.paybackYrs', 'financial.tariffEurMwh', 'esg.ghgReductionTco2Yr', 'esg.waterSavedM3Yr'].includes(p));
                    if (siteOnly.length) issues.push(`PDM site data missing: ${siteOnly.map(M.fieldLabel).join(', ')}`);
                }
                if (issues.length) rows.push(`<li><strong>${x.id} ${U.esc(x.name)}</strong> — ${U.esc(issues.join('; '))}</li>`);
            });
            const pdmDocs = [...((ctx.site && ctx.site.documents) || []), ...((ctx.source && ctx.source.documents) || [])];
            const logged = new Set(ctx.a.evidence.map((e) => e.pdmDocId).filter(Boolean));
            const notLogged = pdmDocs.filter((d) => !logged.has(d.id));
            let html = rows.length ? `<p>Evidence and data gaps (${rows.length} metrics):</p><ul>${rows.join('')}</ul>` : '<p>No evidence or data gaps detected.</p>';
            const actions = [];
            if (notLogged.length) {
                html += `<p>PDM documents available but not yet in the Evidence Log:</p><ul>${notLogged.map((d) => `<li>${U.esc(d.title)} (${U.esc(d.provider)}, ${U.fmtDate(d.date)}) → relevant to ${U.esc((d.metrics || []).join(', '))}</li>`).join('')}</ul>`;
                notLogged.forEach((d) => { sources.push(src('PDM', `Document ${d.id}: ${d.title}`)); actions.push({ type: 'importPdmDoc', docId: d.id, label: `Add "${d.title.slice(0, 48)}${d.title.length > 48 ? '…' : ''}" to Evidence Log` }); });
            }
            sources.unshift(src('Metric', 'Metric states & evidence links (20 metrics)'));
            if (ctx.site) sources.push(src('PDM', `${ctx.site.shortName} ${ctx.tv} — site record`));
            return { html, sources, actions };
        },

        compare(ctx) {
            if (!ctx.source || !ctx.site) return { html: '<p>Select a source project and a replication site in Projects / PDM first.</p>', sources: [] };
            const groups = M.dimensions.map((d) => {
                const fields = [...new Set(d.metrics.flatMap((m) => m.pdmFields))];
                const rows = fields.map((p) => {
                    const a = U.get(ctx.source, p); const b = U.get(ctx.site, p);
                    if ((a === null || a === undefined) && (b === null || b === undefined)) return '';
                    let delta = '';
                    if (typeof a === 'number' && typeof b === 'number' && a !== 0) { const d2 = ((b - a) / a) * 100; delta = `${d2 > 0 ? '+' : ''}${d2.toFixed(0)}%`; }
                    return `<tr><td>${U.esc(M.fieldLabel(p))}</td><td>${fmtVal(a, p)}</td><td>${fmtVal(b, p)}</td><td>${delta}</td></tr>`;
                }).join('');
                return `<tr class="group-row"><td colspan="4">${U.esc(d.name)}</td></tr>${rows}`;
            }).join('');
            return {
                html: `<p><strong>${U.esc(ctx.source.shortName)}</strong> vs <strong>${U.esc(ctx.site.shortName)}</strong></p><table class="mini-table"><thead><tr><th>Field</th><th>Source</th><th>Site</th><th>Δ</th></tr></thead><tbody>${groups}</tbody></table>`,
                sources: [src('PDM', `${ctx.source.shortName} ${ctx.sv}`), src('PDM', `${ctx.site.shortName} ${ctx.tv}`)]
            };
        },

        differences(ctx) {
            if (!ctx.source || !ctx.site) return Engine.compare(ctx);
            const inds = RSA.Indicators.all(ctx.source, ctx.site);
            const list = Object.entries(inds).filter(([, v]) => v).sort((x, y) => x[1].score - y[1].score);
            const weak = list.filter(([, v]) => v.score < 60);
            const strong = list.filter(([, v]) => v.score >= 75);
            const li = ([id, v]) => `<li><strong>${id} ${U.esc(M.metric(id).name)}</strong> (indicative ${v.score}) — ${U.esc(v.detail)}</li>`;
            const sources = [];
            weak.concat(strong).forEach(([, v]) => sources.push(...pdmSourcesFor(ctx, v.fields.slice(0, 2))));
            return {
                html: `<p><strong>Key differences</strong> between ${U.esc(ctx.source.shortName)} and ${U.esc(ctx.site.shortName)}:</p><ul>${weak.map(li).join('') || '<li>No major differences detected in PDM data.</li>'}</ul>
                       <p><strong>Main similarities:</strong></p><ul>${strong.map(li).join('') || '<li>—</li>'}</ul><p class="muted">Derived from PDM data only; team judgement and evidence take precedence.</p>`,
                sources: dedupe(sources)
            };
        },

        contradictions(ctx) {
            const out = [];
            const sources = [];
            const byDim = Object.fromEntries(ctx.calc.dims.map((d) => [d.id, d]));
            ctx.calc.metrics.forEach((x) => {
                const ind = RSA.Indicators.compute(x.id, ctx.source, ctx.site);
                if (x.eff !== null && ind && Math.abs(x.eff - ind.score) >= 25) {
                    out.push(`<li><strong>${x.id}</strong>: score ${Math.round(x.eff)} vs PDM-indicative band ${ind.score} (${U.esc(ind.detail)})</li>`);
                    sources.push(src('Metric', `${x.id} score`), ...pdmSourcesFor(ctx, ind.fields.slice(0, 2)));
                }
                if (x.confidence === 100 && x.bestRel < 75) out.push(`<li><strong>${x.id}</strong>: confidence "Verified" but ${x.evCount ? 'best linked evidence is only ' + M.reliabilityLabel(String(x.bestRel)) : 'no evidence linked'}.</li>`);
                if (x.eff !== null && x.eff >= 75 && x.evCount && x.bestRel <= 50) out.push(`<li><strong>${x.id}</strong>: high score (${Math.round(x.eff)}) relies on low/moderate-reliability evidence.</li>`);
                if (x.st.status === 'Approved' && x.evCount === 0) out.push(`<li><strong>${x.id}</strong>: approved without linked evidence.</li>`);
                if (x.st.finalScore !== '' && x.st.score !== '' && Math.abs(Number(x.st.finalScore) - Number(x.st.score)) >= 15 && !x.st.reviewerComment) out.push(`<li><strong>${x.id}</strong>: agreed score differs from assessor score by ≥15 without a reviewer comment.</li>`);
            });
            M.screeningQuestions.forEach((q, i) => {
                const ans = ctx.a.screening.answers[i];
                const d = byDim[q.dimension];
                if (ans && ans.value === 'yes' && d && d.score !== null && d.score < 50) {
                    out.push(`<li>Level 1 "${U.esc(q.text)}" answered <em>Yes</em>, but ${U.esc(d.name)} scores ${U.fmtScore(d.score)} in Level 2.</li>`);
                    sources.push(src('Metric', `Level 1 ${q.id} vs ${d.id} score`));
                }
            });
            ctx.calc.risks.criticalUnresolved.forEach((r) => {
                const d = byDim[r.dimension];
                if (d && d.score !== null && d.score >= 75) { out.push(`<li>Critical unresolved risk in ${U.esc(d.name)} while the dimension scores ${U.fmtScore(d.score)}: ${U.esc(r.description)}</li>`); sources.push(src('Risk', `${r.id}`)); }
            });
            const changed = [...(ctx.a.pdm.pendingChanges.site || []), ...(ctx.a.pdm.pendingChanges.source || [])];
            if (changed.length) {
                ctx.calc.metrics.forEach((x) => {
                    const hit = changed.filter((c) => x.pdmFields.includes(c.path));
                    if (hit.length && x.eff !== null) { out.push(`<li><strong>${x.id}</strong> was scored on PDM data that has since changed (${hit.map((c) => `${M.fieldLabel(c.path)}: ${c.from} → ${c.to}`).join('; ')}).</li>`); sources.push(src('PDM', `Pending PDM changes — ${hit.map((c) => c.path).join(', ')}`)); }
                });
            }
            return {
                html: out.length ? `<p>Possible contradictions or inconsistencies (${out.length}):</p><ul>${out.join('')}</ul><p class="muted">These are flags for discussion, not errors.</p>` : '<p>No contradictions detected between scores, evidence, risks, screening and PDM data.</p>',
                sources: dedupe([src('Metric', 'All metric scores, confidence and evidence'), ...sources])
            };
        },

        lowConfidence(ctx) {
            const low = ctx.calc.metrics.filter((x) => x.eff !== null && (x.confidence === null || x.confidence <= 25));
            const moderate = ctx.calc.metrics.filter((x) => x.eff !== null && x.confidence === 50);
            const li = (x) => `<li><strong>${x.id} ${U.esc(x.name)}</strong> — score ${Math.round(x.eff)}, confidence ${M.confidenceLabel(x.st.confidence)}, ${x.evCount} evidence item(s), assessor ${U.esc(W.memberName(ctx.a, x.st.assessorId))}</li>`;
            return {
                html: `<p><strong>Low or missing confidence (${low.length}):</strong></p><ul>${low.map(li).join('') || '<li>None</li>'}</ul><p><strong>Moderate confidence (${moderate.length}):</strong></p><ul>${moderate.map(li).join('') || '<li>None</li>'}</ul>
                       <p>Average confidence: ${U.fmtPct(ctx.calc.confidence)} · evidence quality index: ${U.fmtPct(ctx.calc.evidenceQuality)}.</p>`,
                sources: [src('Metric', 'Assessor confidence ratings'), src('Evidence', 'Evidence reliability ratings')]
            };
        },

        risks(ctx) {
            const r = ctx.calc.risks;
            const li = (x) => `<li>${x.critical ? '<span class="badge danger">Critical</span> ' : ''}<strong>${x.id}</strong> (${x.dimension}, ${S.riskRating(x)}, ${x.status}) — ${U.esc(x.description)}${x.mitigation ? ` <em>Mitigation:</em> ${U.esc(x.mitigation)}` : ' <em>No mitigation recorded.</em>'} Owner: ${U.esc(W.memberName(ctx.a, x.owner))}</li>`;
            const noOwner = r.unresolved.filter((x) => !x.owner);
            const noMit = r.unresolved.filter((x) => !x.mitigation);
            return {
                html: `<p>${r.all.length} risk(s) logged; ${r.unresolved.length} unresolved, ${r.highUnresolved.length} high-rated unresolved, <strong>${r.criticalUnresolved.length} critical unresolved</strong>.</p>
                       <p><strong>Critical unresolved</strong></p><ul>${r.criticalUnresolved.map(li).join('') || '<li>None</li>'}</ul>
                       <p><strong>Other unresolved</strong></p><ul>${r.unresolved.filter((x) => !x.critical).map(li).join('') || '<li>None</li>'}</ul>
                       ${noOwner.length || noMit.length ? `<p class="ai-warn">${noOwner.length} unresolved risk(s) without owner, ${noMit.length} without mitigation.</p>` : ''}
                       <p class="muted">Critical risks are reported separately from the RSS and must be addressed in the final human decision.</p>`,
                sources: r.all.map((x) => src('Risk', `${x.id} ${x.description.slice(0, 60)}`))
            };
        },

        suggestEvidence(ctx, id) {
            const targets = id ? [metricState(ctx, id)] : ctx.calc.metrics.filter((x) => x.evCount === 0);
            const docs = [...((ctx.site && ctx.site.documents) || []).map((d) => ({ ...d, owner: ctx.site.shortName })), ...((ctx.source && ctx.source.documents) || []).map((d) => ({ ...d, owner: ctx.source.shortName }))];
            const logged = new Set(ctx.a.evidence.map((e) => e.pdmDocId).filter(Boolean));
            const actions = [];
            const sources = [];
            const items = targets.map((x) => {
                const rel = docs.filter((d) => (d.metrics || []).includes(x.id));
                rel.forEach((d) => { sources.push(src('PDM', `Document ${d.id}: ${d.title}`)); if (!logged.has(d.id) && !actions.some((a) => a.docId === d.id)) actions.push({ type: 'importPdmDoc', docId: d.id, label: `Add "${d.title.slice(0, 48)}${d.title.length > 48 ? '…' : ''}" to Evidence Log` }); });
                return `<li><strong>${x.id} ${U.esc(x.name)}</strong><br>Typical sources: ${U.esc(x.dataSources.join('; '))}.${rel.length ? `<br>Available in PDM: ${rel.map((d) => `${U.esc(d.title)} (${U.esc(d.owner)})${logged.has(d.id) ? ' — already logged' : ''}`).join('; ')}` : ''}</li>`;
            }).join('');
            return {
                html: targets.length ? `<p>Suggested evidence${id ? '' : ` for the ${targets.length} metric(s) without evidence`}:</p><ul>${items}</ul>` : '<p>All metrics have at least one evidence item linked.</p>',
                sources: dedupe([src('Methodology', 'Metric data-source guidance'), ...sources]), actions
            };
        },

        nextActions(ctx) {
            const a = ctx.a; const c = ctx.calc; const steps = [];
            const changes = (a.pdm.pendingChanges.source || []).length + (a.pdm.pendingChanges.site || []).length;
            if (!a.pdm.source || !a.pdm.site) steps.push('Select source project and replication site in Projects / PDM and import the PDM data.');
            if (changes) steps.push(`Review ${changes} changed PDM field(s) and update the snapshot (Projects / PDM).`);
            if (c.screening.label === 'Incomplete') steps.push('Complete the Level 1 screening.');
            const by = (status) => c.metrics.filter((x) => x.st.status === status);
            const group = (list, key) => Object.entries(list.reduce((acc, x) => { const n = W.memberName(a, x.st[key]); (acc[n] = acc[n] || []).push(x.id); return acc; }, {})).map(([n, ids]) => `${n}: ${ids.join(', ')}`).join('; ');
            if (by('Not started').length) steps.push(`Start scoring ${by('Not started').length} metric(s) — ${group(by('Not started'), 'assessorId')}.`);
            if (by('Draft').length) steps.push(`Complete and submit ${by('Draft').length} draft metric(s) — ${group(by('Draft'), 'assessorId')}.`);
            if (by('Submitted').length) steps.push(`Review ${by('Submitted').length} submitted metric(s) — reviewer ${group(by('Submitted'), 'reviewerId')}.`);
            if (by('Reviewed').length) steps.push(`Approve ${by('Reviewed').length} reviewed metric(s) (lead assessor / validator).`);
            c.risks.criticalUnresolved.forEach((r) => steps.push(`Resolve critical risk ${r.id}: ${r.description}`));
            const recs = RSA.Recommend.Improvement.generate(a, ctx.catalogue || RSA.DefaultCatalogue, c).filter((r) => r.priority === 'High' && r.status === 'Proposed').slice(0, 3);
            recs.forEach((r) => steps.push(`Consider high-priority action: ${r.entry.title}.`));
            if (c.approved === c.total && !a.decision.finalised) steps.push('All metrics approved — the lead assessor/reviewer can record the final recommendation.');
            if (a.decision.finalised && a.pdm.sync.status !== 'synced') steps.push('Sync the approved results to the PDM.');
            return {
                html: `<p>Suggested next actions:</p><ol>${steps.map((s) => `<li>${U.esc(s)}</li>`).join('') || '<li>No open actions.</li>'}</ol>`,
                sources: [src('Metric', 'Workflow status of 20 metrics'), src('Risk', 'Risk register'), src('Recommendation', 'Recommendation catalogue matches')]
            };
        },

        betterMatch(ctx, sources) {
            if (!ctx.site) return { html: '<p>Select a replication site first.</p>', sources: [] };
            const ranked = RSA.Recommend.Match.rank(ctx.site, sources || [], ctx.a.pdm.sourceId).slice(0, 4);
            return {
                html: `<p>Source projects ranked by similarity to <strong>${U.esc(ctx.site.shortName)}</strong> (Financial weighted ${Math.round(M.dimension('D3').weight * 100)}%):</p><ol>${ranked.map((r) => `<li><strong>${U.esc(r.source.shortName)}</strong> — match ${U.fmtScore(r.overall)}${r.isCurrent ? ' (current)' : ''}. ${U.esc(r.explanation)}</li>`).join('')}</ol><p class="muted">See Recommendations → Better-match projects for the dimension breakdown.</p>`,
                sources: ranked.map((r) => src('PDM', `${r.source.shortName} v${r.source.version}`))
            };
        },

        searchDocs(ctx, query) {
            const terms = query.toLowerCase().replace(/search|documents?|for|find|in|the|uploaded|attachments?/g, ' ').split(/\s+/).filter((t) => t.length > 2);
            if (!terms.length) return { html: '<p>Tell me what to look for, e.g. "search documents for concession".</p>', sources: [] };
            const hits = [];
            const snippet = (text, term) => { const i = text.toLowerCase().indexOf(term); return i < 0 ? '' : `…${text.slice(Math.max(0, i - 60), i + 90)}…`; };
            ctx.a.evidence.forEach((e) => {
                const hay = [e.title, e.notes, e.assumptions, e.provider, e.attachment && e.attachment.text].filter(Boolean).join(' \n ');
                const t = terms.find((term) => hay.toLowerCase().includes(term));
                if (t) hits.push({ kind: e.attachment && e.attachment.text && e.attachment.text.toLowerCase().includes(t) ? 'Document' : 'Evidence', label: `${e.id} ${e.title}`, text: snippet(hay, t) });
            });
            [ctx.source, ctx.site].filter(Boolean).forEach((p) => {
                const hay = [p.summary, p.technical && p.technical.infrastructure, p.institutional && p.institutional.governanceNote, (p.documents || []).map((d) => d.title).join('; ')].join(' \n ');
                const t = terms.find((term) => hay.toLowerCase().includes(term));
                if (t) hits.push({ kind: 'PDM', label: p.shortName, text: snippet(hay, t) });
            });
            return {
                html: hits.length ? `<p>Found ${hits.length} match(es) for "${U.esc(terms.join(' '))}":</p><ul>${hits.map((h) => `<li><strong>${U.esc(h.label)}</strong><br><span class="muted">${U.esc(h.text)}</span></li>`).join('')}</ul>` : `<p>No matches for "${U.esc(terms.join(' '))}" in evidence, attached documents or PDM records.</p>`,
                sources: hits.map((h) => src(h.kind, h.label))
            };
        }
    };

    function dedupe(list) {
        const seen = new Set();
        return list.filter((s) => { const k = `${s.kind}|${s.label}`; if (seen.has(k)) return false; seen.add(k); return true; });
    }

    function route(q, ctx, extras) {
        const t = q.toLowerCase();
        const mm = t.match(/\b([1-5])\.([1-4])\b/);
        const metricId = mm ? `${mm[1]}.${mm[2]}` : ctx.focus;
        if (/draft|write.*rationale|rationale/.test(t) && metricId) return Engine.draftRationale(ctx, metricId);
        if (/band|why.*(score|scor)|which score|indicative/.test(t) && metricId) return Engine.band(ctx, metricId);
        if (/contradict|inconsisten|conflict/.test(t)) return Engine.contradictions(ctx);
        if (/low.?confidence|uncertain score|confidence/.test(t)) return Engine.lowConfidence(ctx);
        if (/suggest.*evidence|evidence for|which evidence|relevant evidence|sources? for/.test(t)) return Engine.suggestEvidence(ctx, mm ? metricId : null);
        if (/missing|gap|lacking|without evidence|missing data/.test(t)) return Engine.missing(ctx);
        if (/risk/.test(t)) return Engine.risks(ctx);
        if (/better.?match|alternative|other (source )?project/.test(t)) return Engine.betterMatch(ctx, extras.sources);
        if (/search|document|upload|attachment|find /.test(t)) return Engine.searchDocs(ctx, q);
        if (/differ|summari[sz]e/.test(t)) return Engine.differences(ctx);
        if (/compare|versus|\bvs\b/.test(t)) return Engine.compare(ctx);
        if (/next|todo|to do|what should|action/.test(t)) return Engine.nextActions(ctx);
        if ((/explain|what is|meaning|how.*score|describe/.test(t) || mm) && metricId) return Engine.explainMetric(ctx, metricId);
        if (/help|what can you/.test(t)) return Engine.help();
        const search = Engine.searchDocs(ctx, q);
        if (search.sources.length) return search;
        return Engine.help();
    }

    function compactContext(ctx) {
        return {
            methodology: M.version,
            weights: Object.fromEntries(M.dimensions.map((d) => [d.id, d.weight])),
            source: ctx.source, site: ctx.site,
            metrics: ctx.calc.metrics.map((x) => ({ id: x.id, name: x.name, status: x.st.status, score: x.st.score, finalScore: x.st.finalScore, confidence: x.st.confidence, rationale: x.st.rationale, assumptions: x.st.assumptions, evidenceIds: x.st.evidenceIds })),
            evidence: ctx.a.evidence.map((e) => ({ ...e, attachment: e.attachment ? { name: e.attachment.name, text: (e.attachment.text || '').slice(0, 4000) } : null })),
            risks: ctx.a.risks, rss: ctx.calc.rss, dimensions: ctx.calc.dims.map((d) => ({ id: d.id, score: d.score }))
        };
    }

    RSA.AI = {
        async ask(question, a, opts = {}) {
            const ctx = context(a, opts.metricId);
            ctx.catalogue = opts.catalogue;
            const settings = opts.settings || { provider: 'local' };
            if (settings.provider === 'remote' && settings.endpoint) {
                try {
                    const res = await fetch(settings.endpoint, {
                        method: 'POST', headers: { 'Content-Type': 'application/json', ...(settings.token ? { Authorization: `Bearer ${settings.token}` } : {}) },
                        body: JSON.stringify({ question, context: compactContext(ctx), instructions: 'You assist a human RSA assessment team. Cite sources. Never approve or set final scores.' })
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    return { html: `<p>${U.nl2br(data.answer || '')}</p>`, sources: (data.sources || []).map((s) => src(s.kind || 'Source', s.label || String(s))), provider: 'remote' };
                } catch (err) {
                    const local = route(question, ctx, opts);
                    return { ...local, html: `<p class="ai-warn">Remote AI endpoint unavailable (${U.esc(err.message)}); answered with the local analysis engine.</p>${local.html}`, provider: 'local' };
                }
            }
            await new Promise((r) => setTimeout(r, 250));
            return { ...route(question, ctx, opts), provider: 'local' };
        },
        quickPrompts: [
            'What is missing?',
            'Compare the two projects',
            'Any contradictions?',
            'What should we do next?'
        ]
    };
})(window.RSA);
