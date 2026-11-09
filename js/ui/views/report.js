/* Final decision (human) and print-ready final report. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const W = RSA.Workflow; const S = RSA.Scoring; const R = RSA.Recommend;

    const narrative = (a, key, label, placeholder, tag = 'h4') => `<div class="report-section ${tag === 'h4' ? 'sub' : ''}">
        <${tag}>${U.esc(label)}${key === 'executiveSummary' && a.report.executiveSummaryAi ? ` <span class="no-print">${C.prov('ai-assisted')}</span>` : ''}</${tag}>
        ${key === 'executiveSummary' ? '<div class="no-print button-row"><button class="button ghost small" data-action="draft-summary">Draft from assessment data</button></div>' : ''}
        <textarea class="no-print" data-field="report|${key}" data-audit="report ${label}" data-report-text="${key}" placeholder="${U.esc(placeholder)}">${U.esc(a.report[key])}</textarea>
        <div class="print-text" data-print-mirror="${key}">${a.report[key] ? U.nl2br(a.report[key]) : '<span class="muted">—</span>'}</div>
      </div>`;

    function summaryDraft(a, calc) {
        const src = RSA.Data.effective(a, 'source'); const site = RSA.Data.effective(a, 'site');
        const dims = calc.dims.filter((d) => d.score !== null).sort((x, y) => y.score - x.score);
        const strongest = dims[0]; const weakest = dims[dims.length - 1];
        return [
            `This report presents the Replication Suitability Assessment of ${src ? src.name : 'the source project'} for replication at ${site ? site.name : 'the replication site'}, carried out by a ${a.team.length}-member team using ${M.version}.`,
            `The ${calc.rssStatus === 'final' ? 'final' : 'provisional'} Replication Suitability Score is ${U.fmtScore(calc.rss)} (${calc.approved}/${calc.total} metrics approved). ${strongest ? `The strongest dimension is ${strongest.name} (${U.fmtScore(strongest.score)}); the weakest is ${weakest.name} (${U.fmtScore(weakest.score)}).` : ''}`,
            `Evidence covers ${calc.evidenced}/${calc.total} metrics (quality index ${U.fmtPct(calc.evidenceQuality)}); average assessor confidence is ${U.fmtPct(calc.confidence)}. ${calc.risks.criticalUnresolved.length} critical risk(s) remain unresolved.`,
            a.decision.finalised ? `The authorised recommendation is ${a.decision.value}.` : 'The final recommendation is pending the decision of the authorised reviewer / lead assessor.'
        ].join(' ');
    }

    function decisionPanel(app, calc) {
        const a = app.a; const user = app.user; const d = a.decision;
        const issues = S.openIssues(a, calc);
        const g = calc.guidance;
        const canFinalise = W.canFinalise(user);
        const blocking = [];
        if (calc.approved < calc.total) blocking.push(`All 20 metrics must be approved (${calc.approved}/20).`);
        if (calc.screening.label === 'Incomplete') blocking.push('Level 1 screening must be completed.');
        const needsAck = issues.some((i) => i.severity !== 'info');
        const dis = canFinalise && !d.finalised ? '' : 'disabled';

        const facts = [
            ['Suitability score (RSS)', `${U.fmtScore(calc.rss)} <span class="muted small">${calc.rssStatus === 'final' ? 'final' : 'provisional'}${g ? ` · guidance: ${U.esc(g.label.toLowerCase())}` : ''}</span>`],
            ['Approved metrics', `${calc.approved} of ${calc.total}`],
            ['Evidence quality', `${U.fmtPct(calc.evidenceQuality)} <span class="muted small">${calc.evidenced}/20 metrics with evidence</span>`],
            ['Assessor confidence', `${U.fmtPct(calc.confidence)}${calc.lowConfidence.length ? ` <span class="muted small">${calc.lowConfidence.length} low</span>` : ''}`],
            ['Critical risks open', `<span class="${calc.risks.criticalUnresolved.length ? 'neg' : ''}">${calc.risks.criticalUnresolved.length}</span>`],
            ['Screening', U.esc(calc.screening.label)]
        ];
        const shownIssues = app.ui.expanded.allIssues ? issues : issues.slice(0, 4);

        return `<div class="no-print cols decision-layout">
            <section class="panel">
              <h2>Where the assessment stands</h2>
              <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
              ${issues.length ? `<h3 class="sub">Open points</h3><ul class="issue-list">${shownIssues.map((i) => `<li class="${i.severity}"><button class="link-plain" data-action="nav" data-view="${i.view}">${U.esc(i.text)}</button></li>`).join('')}</ul>
                ${issues.length > 4 ? `<button class="link-button small" data-action="toggle-expand" data-key="allIssues">${app.ui.expanded.allIssues ? 'Show fewer' : `Show all ${issues.length}`}</button>` : ''}` : '<p class="empty-inline">No open points.</p>'}
              <p class="note">The score band is guidance from the methodology, not a decision.</p>
            </section>

            <section class="panel decision-card ${d.finalised ? 'finalised' : ''}">
              <h2>Final recommendation</h2>
              ${d.finalised ? `<p class="stamp">Recorded by ${C.memberName(a, d.finalisedBy)} on ${U.fmtDateTime(d.finalisedAt)}</p>` : `<p class="muted small">${canFinalise ? 'Recorded in your name once finalised.' : 'Only the lead assessor or reviewer can record this.'}</p>`}
              <label>Recommendation<select data-field="decision|value" data-audit="decision" ${dis}>${C.options(M.humanDecisions, d.value, 'Select…')}</select></label>
              <label>Conditions<textarea class="short" data-field="decision|conditions" data-audit="decision conditions" placeholder="e.g. resolve critical risks, pilot first, confirm financing" ${dis}>${U.esc(d.conditions)}</textarea></label>
              <label>Rationale<textarea data-field="decision|rationale" data-audit="decision rationale" placeholder="Why this recommendation?" ${dis}>${U.esc(d.rationale)}</textarea></label>
              ${!d.finalised && needsAck ? `<label class="check-inline ack"><input type="checkbox" data-field="decision|acknowledgedOpenIssues" data-rerender="1" data-audit="acknowledged open issues" ${d.acknowledgedOpenIssues ? 'checked' : ''} ${dis}/> I have considered the open points and critical risks.</label>` : ''}
              ${blocking.length && !d.finalised ? `<p class="muted small">${blocking.map((b) => U.esc(b)).join(' ')}</p>` : ''}
              <div class="button-row">
                ${d.finalised ? (user && user.role === 'lead' ? '<button class="button secondary" data-action="reopen-decision">Reopen</button>' : '') : `<button class="button primary" data-action="finalise" ${canFinalise && !blocking.length ? '' : 'disabled'}>Finalise</button>`}
                ${d.finalised && !(RSA.Edition && RSA.Edition.test) ? '<button class="button secondary" data-action="nav" data-view="projects">Send to PDM</button>' : ''}
                <button class="button secondary" data-action="print">Print / PDF</button>
              </div>
            </section>
          </div>
          <h2 class="no-print section-title">Report preview</h2>`;
    }

    function reportDoc(app, calc) {
        const a = app.a;
        const src = RSA.Data.effective(a, 'source'); const site = RSA.Data.effective(a, 'site');
        const d = a.decision; const g = calc.guidance;
        const recs = R.Improvement.generate(a, app.catalogue, calc).filter((r) => r.status !== 'Dismissed');
        const alternatives = site && app.pdmCache.loaded ? R.Match.rank(site, RSA.Data.matchSources(a, app.pdmCache.sources), a.pdm.sourceId).filter((r) => !r.isCurrent).slice(0, 3) : [];
        const keyEvidence = a.evidence.filter((e) => Number(e.reliability) >= 75 && e.metricIds.length).slice(0, 10);
        const assumptions = calc.metrics.filter((x) => x.st.assumptions && x.st.assumptions.trim());
        const phase = (p) => recs.filter((r) => r.entry.phase === p && (r.status !== 'Proposed' || r.priority === 'High'));
        const issues = S.openIssues(a, calc);

        return `<article class="card report-card" id="reportDoc">
            <header class="report-header">
              <div><p class="eyebrow">CLIMINVEST · Replication Suitability Assessment</p><h2>Final Report — ${U.esc(a.title)}</h2>
              <p class="muted small">Generated ${U.fmtDateTime(U.nowIso())} · Assessment ${U.esc(a.id)} · ${U.esc(M.shortVersion)}</p></div>
              <div class="report-score"><span>RSS</span><strong>${U.fmtScore(calc.rss)}</strong><small>${calc.rssStatus === 'final' ? 'final' : 'provisional'}</small></div>
            </header>
            <div class="report-stamp ${d.finalised ? 'final' : 'draft'}">${d.finalised ? `FINAL — Recommendation: ${U.esc(d.value)} · approved by ${C.memberName(a, d.finalisedBy)} on ${U.fmtDate(d.finalisedAt)}` : 'DRAFT — final human recommendation pending'}</div>

            <div class="report-section"><h3>1. Project pair</h3>
              <table class="compact"><thead><tr><th></th><th>Source project</th><th>Replication site</th></tr></thead><tbody>
                <tr><td>Name</td><td>${src ? U.esc(src.name) : '—'}</td><td>${site ? U.esc(site.name) : '—'}</td></tr>
                <tr><td>Location</td><td>${src ? `${U.esc(src.region)}, ${U.esc(src.country)}` : '—'}</td><td>${site ? `${U.esc(site.region)}, ${U.esc(site.country)}` : '—'}</td></tr>
                <tr><td>Owner / organisation</td><td>${src ? U.esc(src.owner) : '—'}</td><td>${site ? U.esc(site.owner) : '—'}</td></tr>
                <tr><td>PDM record (snapshot)</td><td>${src ? `${U.esc(src.id)} v${a.pdm.source.version} (${U.fmtDate(a.pdm.source.lastUpdated)})` : '—'}</td><td>${site ? `${U.esc(site.id)} v${a.pdm.site.version} (${U.fmtDate(a.pdm.site.lastUpdated)})` : '—'}</td></tr>
              </tbody></table>
              <p class="small">Adaptation type: <strong>${U.esc(a.project.adaptationType || '—')}</strong> · Assessment date: <strong>${U.fmtDate(a.project.assessmentDate)}</strong> · Organisation: <strong>${U.esc(a.project.organisation || '—')}</strong>${a.project.scope ? `<br>Scope: ${U.esc(a.project.scope)}` : ''}</p>
              ${(() => { const added = RSA.Data.missing(a).filter((m) => m.filled); const open = RSA.Data.missing(a).filter((m) => !m.filled); return added.length || open.length ? `<p class="small">Data not in the project database: ${added.length ? `added by the team for ${added.map((m) => `${U.esc(m.label.toLowerCase())} (${U.esc(RSA.Data.display(m.value))}${m.unit ? ` ${U.esc(m.unit)}` : ''})`).join('; ')}` : ''}${added.length && open.length ? '; ' : ''}${open.length ? `still missing: ${open.map((m) => U.esc(m.label.toLowerCase())).join(', ')}` : ''}.</p>` : ''; })()}
            </div>

            <div class="report-section"><h3>2. Assessment team</h3>
              <table class="compact"><thead><tr><th>Name</th><th>Organisation</th><th>Role</th><th>Dimensions</th><th>Metrics assessed</th></tr></thead><tbody>
              ${a.team.map((t) => `<tr><td>${U.esc(t.name)}</td><td>${U.esc(t.organisation)}</td><td>${U.esc(M.roles[t.role].label)}</td><td>${U.esc(t.dimensions.join(', '))}</td><td>${U.esc(calc.metrics.filter((x) => x.st.assessorId === t.id).map((x) => x.id).join(', ') || '—')}</td></tr>`).join('')}
              </tbody></table>
            </div>

            <div class="report-section"><h3>3. Methodology & version</h3>
              <p class="small">${U.esc(M.version)} — basis: ${U.esc(M.basis)}. Five dimensions × four metrics scored 0–100; dimension = mean of metric scores (reviewer-agreed where available); RSS = weighted sum. Weights used: ${U.esc(M.weightsLabel(M.weightsOf(a)))} (${U.esc((M.presetFor(M.weightsOf(a)) || { name: 'Custom' }).name)} weighting${(M.presetFor(M.weightsOf(a)) || {}).id === 'standard' ? '' : '; the standard weighting is Climate 25%, Technical 20%, Financial 25%, ESG 15%, Institutional 15%'}), set by the lead assessor. Workflow: Draft → Submitted → Reviewed → Approved with four-eyes review.</p>
            </div>

            ${narrative(a, 'executiveSummary', '4. Executive summary', 'Brief overview of the project pair and key findings', 'h3')}

            <div class="report-section"><h3>5. RSS and dimension results</h3>
              <table class="compact"><thead><tr><th>Dimension</th><th>Weight</th><th>Score</th><th>Band</th><th>Scored</th><th>Approved</th><th>Evidenced</th></tr></thead><tbody>
              ${calc.dims.map((x) => `<tr><td>${x.id} ${U.esc(x.name)}</td><td>${Math.round(x.weight * 100)}%</td><td><strong>${U.fmtScore(x.score)}</strong></td><td>${C.bandChip(x.score)}</td><td>${x.scored}/4</td><td>${x.approved}/4</td><td>${x.evidenced}/4</td></tr>`).join('')}
              <tr class="total-row"><td>Replication Suitability Score</td><td>100%</td><td><strong>${U.fmtScore(calc.rss)}</strong></td><td colspan="4">${g ? `Methodology guidance band: ${U.esc(g.label)} (${U.esc(g.suitability)}; indicative success ${U.esc(g.success)}, contingency ${U.esc(g.contingency)}) — not a decision.` : 'Insufficient scores.'}</td></tr>
              </tbody></table>
              <table class="compact metric-results"><thead><tr><th>Metric</th><th>Assessor</th><th>Agreed</th><th>Confidence</th><th>Evidence</th><th>Status</th></tr></thead><tbody>
              ${calc.metrics.map((x) => `<tr><td>${x.id} ${U.esc(x.name)}</td><td>${x.st.score === '' ? '—' : U.esc(x.st.score)}</td><td>${x.st.finalScore === '' ? '—' : U.esc(x.st.finalScore)}</td><td>${U.esc(M.confidenceLabel(x.st.confidence))}</td><td>${x.evCount}</td><td>${U.esc(x.st.status)}</td></tr>`).join('')}
              </tbody></table>
              ${narrative(a, 'dimensionalAssessment', 'Dimensional commentary', 'Strongest and weakest dimensions and why')}
              ${sensitivityHtml(a, calc)}
            </div>

            <div class="report-section"><h3>6. Evidence quality</h3>
              <p>Evidence covers <strong>${calc.evidenced}/${calc.total}</strong> metrics; evidence quality index <strong>${U.fmtPct(calc.evidenceQuality)}</strong>; average assessor confidence <strong>${U.fmtPct(calc.confidence)}</strong>; ${a.evidence.length} evidence item(s) logged (${a.evidence.filter((e) => e.provenance === 'pdm').length} from PDM, ${a.evidence.filter((e) => e.provenance !== 'pdm').length} added by assessors).</p>
              <h4>Key evidence</h4>
              ${keyEvidence.length ? `<ul>${keyEvidence.map((e) => `<li><strong>${U.esc(e.title)}</strong> — ${U.esc(e.provider || '')}, ${U.fmtDate(e.date)}; reliability ${U.esc(M.reliabilityLabel(e.reliability))}; metrics ${U.esc(e.metricIds.join(', '))}</li>`).join('')}</ul>` : '<p class="muted">No high-reliability evidence linked yet.</p>'}
            </div>

            <div class="report-section"><h3>7. Key assumptions</h3>
              ${assumptions.length ? `<ul>${assumptions.map((x) => `<li><strong>${x.id}</strong> ${U.esc(x.st.assumptions)}</li>`).join('')}</ul>` : '<p class="muted">No assumptions recorded.</p>'}
            </div>

            <div class="report-section"><h3>8. Low-confidence areas</h3>
              ${calc.lowConfidence.length ? `<ul>${calc.lowConfidence.map((x) => `<li><strong>${x.id} ${U.esc(x.name)}</strong> — score ${Math.round(x.eff)}, confidence ${U.esc(M.confidenceLabel(x.st.confidence))}, ${x.evCount} evidence item(s)</li>`).join('')}</ul>` : '<p>No scored metric has low confidence.</p>'}
            </div>

            <div class="report-section"><h3>9. Risks and mitigation</h3>
              ${a.risks.length ? `<table class="compact"><thead><tr><th>ID</th><th>Risk</th><th>Dim.</th><th>Rating</th><th>Status</th><th>Mitigation</th><th>Owner</th></tr></thead><tbody>
              ${a.risks.map((r) => `<tr class="${r.critical && S.riskUnresolved(r) ? 'critical-row' : ''}"><td>${U.esc(r.id)}${r.critical ? ' <strong>(critical)</strong>' : ''}</td><td>${U.esc(r.description)}</td><td>${U.esc(r.dimension)}</td><td>${U.esc(S.riskRating(r))}</td><td>${U.esc(r.status)}</td><td>${U.esc(r.mitigation || '—')}</td><td>${C.memberName(a, r.owner)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No risks logged.</p>'}
              ${narrative(a, 'criticalSuccessFactors', 'Critical success factors', 'Key factors that must work for success')}
            </div>

            <div class="report-section"><h3>10. Recommended improvement actions</h3>
              ${recs.length ? `<table class="compact"><thead><tr><th>Priority</th><th>Action</th><th>Metrics</th><th>Possible gain</th><th>Suggested resource</th><th>Status</th></tr></thead><tbody>
              ${recs.map((r) => `<tr><td>${U.esc(r.priority)}</td><td>${U.esc(r.entry.title)}<br><small class="muted">${U.esc(r.reasons[0].text)}</small></td><td>${U.esc(r.metrics.join(', '))}</td><td>${r.gain >= 0.05 ? `+${r.gain.toFixed(1)} RSS` : '—'}</td><td>${U.esc(r.entry.resource.name)}<br><small class="muted">${U.esc(r.entry.resource.provider)}</small></td><td>${U.esc(r.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No improvement actions triggered.</p>'}
              ${(a.actionPlan || []).length ? `<h4>Team action plan</h4><table class="compact"><thead><tr><th>#</th><th>Action</th><th>Horizon</th><th>Lead</th><th>Metrics</th><th>Status</th></tr></thead><tbody>
              ${a.actionPlan.map((x) => `<tr><td>${U.esc(x.id.replace(/^AP-/, ''))}</td><td>${U.esc(x.title)}${x.output ? `<br><small class="muted">Output: ${U.esc(x.output)}</small>` : ''}</td><td>${U.esc(x.horizon)}</td><td>${U.esc(x.lead)}</td><td>${U.esc(x.metrics.join(', ') || '—')}</td><td>${U.esc(x.status)}</td></tr>`).join('')}</tbody></table>` : ''}
            </div>

            <div class="report-section"><h3>11. Alternative better-match source projects</h3>
              ${alternatives.length ? `<table class="compact"><thead><tr><th>Project</th><th>Overall match</th><th>vs current</th>${M.dimensions.map((x) => `<th>${U.esc(x.short)}</th>`).join('')}</tr></thead><tbody>
              ${alternatives.map((r) => `<tr><td>${U.esc(r.source.shortName)}</td><td>${U.fmtScore(r.overall)}</td><td>${r.deltaVsCurrent === null ? '—' : `${r.deltaVsCurrent >= 0 ? '+' : ''}${r.deltaVsCurrent.toFixed(1)}`}</td>${r.dims.map((x) => `<td>${U.fmtScore(x.score)}</td>`).join('')}</tr>`).join('')}</tbody></table>
              <p class="small muted">Indicative PDM-based similarity using the RSA dimensions and weights; not a substitute for an assessment.</p>` : '<p class="muted">No alternative source projects available.</p>'}
            </div>

            <div class="report-section"><h3>12. Adaptation roadmap</h3>
              ${['Immediate', 'Before Level 3', 'Implementation'].map((p) => { const list = phase(p); return `<h4>${p === 'Before Level 3' ? 'Before Level 3 pre-implementation validation' : p === 'Immediate' ? 'Immediate (0–3 months)' : 'Implementation'}</h4>${list.length ? `<ul>${list.map((r) => `<li>${U.esc(r.entry.title)} <small class="muted">(${U.esc(r.status)}, ${U.esc(r.priority)})</small></li>`).join('')}</ul>` : '<p class="muted small">No actions scheduled.</p>'}`; }).join('')}
              ${narrative(a, 'adaptationRoadmap', 'Roadmap notes', 'What needs to change for successful replication; milestones and go/no-go points')}
              ${narrative(a, 'capacityBuilding', 'Capacity-building needs', 'Training and support required')}
              ${narrative(a, 'financialSummary', 'Financial summary', 'Financial adjustments and funding requirements')}
            </div>

            <div class="report-section final-rec"><h3>13. Final human recommendation</h3>
              ${d.finalised ? `<p class="decision-line">${U.esc(d.value)}</p>
                <p><strong>Conditions:</strong> ${U.textOrDash(d.conditions)}</p><p><strong>Rationale:</strong> ${U.textOrDash(d.rationale)}</p>
                <p class="small">Recorded by <strong>${C.memberName(a, d.finalisedBy)}</strong> (${U.esc(M.roles[(W.member(a, d.finalisedBy) || {}).role || 'lead'].label)}) on ${U.fmtDateTime(d.finalisedAt)}.</p>`
                : '<p class="decision-line pending">Pending — to be recorded by the authorised reviewer / lead assessor.</p>'}
            </div>

            <div class="report-section"><h3>14. Next steps</h3>
              ${issues.length ? `<ul>${issues.map((i) => `<li>${U.esc(i.text)}</li>`).join('')}</ul>` : ''}
              ${d.finalised && ['GO', 'GO WITH CONDITIONS'].includes(d.value) ? '<p>Proceed to Level 3 pre-implementation validation (≈1 month): confirm assumptions, obtain 3+ competitive quotes, secure stakeholder commitments and verify financing.</p>' : ''}
              <p>Share with the replicating team: ${RSA.Resources.map((r) => `${U.esc(r.title)} (${U.esc(r.file.split('/').pop())}${r.placeholder ? ', placeholder' : ''})`).join(' and ')}.</p>
              ${narrative(a, 'nextSteps', 'Additional next steps', 'Recommended actions and timeline')}
            </div>

            <footer class="report-footer small muted">Provenance: project data as listed in section 1; scores and judgements by the named assessment team; AI suggestions (if any) were used only as support and are marked as AI-assisted in the assessment record. ${a.audit.length} audit entries recorded. CLIMINVEST RSA · ${U.esc(M.shortVersion)}.</footer>
          </article>`;
    }

    const sign = (v) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`);
    function sensitivityHtml(a, calc) {
        if (calc.rss === null) return '';
        const r = RSA.Sensitivity.compute(a, calc);
        const band = (x) => (x ? U.esc(x.label) : '—');
        return `<div class="report-section sub"><h4>Sensitivity analysis</h4>
            <p class="small muted">Recalculated with the current scores and weights (RSS now ${U.fmtScore(r.current)}).${r.source ? ` Scenarios and tests from ${U.esc(r.source)}${r.intro ? `: ${U.esc(r.intro.slice(0, 400))}` : ''}.` : ' Standard stress tests.'}</p>
            ${r.scenarios.length ? `<table class="compact"><thead><tr><th>Scenario</th><th>Metric scores changed</th><th class="num">RSS</th><th>Band</th><th class="num">vs now</th><th class="num">Workbook RSS</th></tr></thead><tbody>
              ${r.scenarios.map((x) => `<tr><td><strong>${U.esc(x.id)}</strong>${x.label ? ` <span class="muted small">${U.esc(x.label)}</span>` : ''}</td><td class="small">${x.changed.length ? U.esc(x.changed.join(', ')) : '<span class="muted">none</span>'}</td><td class="num"><strong>${U.fmtScore(x.rss)}</strong></td><td>${band(x.band)}</td><td class="num">${sign(x.change)}</td><td class="num">${x.workbookRss === null || x.workbookRss === undefined ? '—' : U.fmtScore(x.workbookRss)}</td></tr>`).join('')}
            </tbody></table>` : ''}
            <table class="compact"><thead><tr><th>Stress test</th><th class="num">RSS</th><th class="num">vs now</th>${r.tests.some((t) => t.workbookRss !== undefined) ? '<th class="num">Workbook RSS</th>' : ''}</tr></thead><tbody>
              ${r.tests.map((t) => `<tr><td>${U.esc(t.id)} ${U.esc(t.description)}</td><td class="num">${U.fmtScore(t.rss)}</td><td class="num">${sign(t.change)}</td>${r.tests.some((x) => x.workbookRss !== undefined) ? `<td class="num">${t.workbookRss === null || t.workbookRss === undefined ? '—' : U.fmtScore(t.workbookRss)}</td>` : ''}</tr>`).join('')}
            </tbody></table>
          </div>`;
    }

    RSA.Views = RSA.Views || {};
    RSA.Views.report = {
        render(app, calc) { return decisionPanel(app, calc) + reportDoc(app, calc); },
        after(app, root) {
            U.$$('[data-report-text]', root).forEach((ta) => ta.addEventListener('input', () => {
                const m = U.$(`[data-print-mirror="${ta.dataset.reportText}"]`, root);
                if (m) m.innerHTML = ta.value ? U.nl2br(ta.value) : '<span class="muted">—</span>';
            }));
        },
        actions: {
            'draft-summary'(app) {
                const a = app.a;
                const text = summaryDraft(a, app.calc());
                const from = a.report.executiveSummary;
                a.report.executiveSummary = from ? `${from}\n\n${text}` : text;
                a.report.executiveSummaryAi = true;
                app.log('AI draft inserted', 'report', 'executiveSummary', { detail: 'Data-driven draft; to be edited by the team' });
                app.save(true); app.render({ keepScroll: true });
                U.toast('Draft inserted from assessment data — review and edit it.', 'warning');
            },
            async finalise(app) {
                const a = app.a; const calc = app.calc(); const d = a.decision; const user = app.user;
                if (!W.canFinalise(user)) { U.toast('Only the Lead Assessor or Reviewer can finalise.', 'error'); return; }
                if (calc.approved < calc.total || calc.screening.label === 'Incomplete') { U.toast('Approve all metrics and complete Level 1 first.', 'error'); return; }
                if (!d.value) { U.toast('Select a recommendation.', 'error'); return; }
                if (!d.rationale || d.rationale.trim().length < 20) { U.toast('Provide a decision rationale (at least a sentence).', 'error'); return; }
                const issues = S.openIssues(a, calc).filter((i) => i.severity !== 'info');
                if (issues.length && !d.acknowledgedOpenIssues) { U.toast('Acknowledge the unresolved issues and critical risks first.', 'error'); return; }
                if (calc.risks.criticalUnresolved.length && ['GO'].includes(d.value) && !(d.conditions || '').trim()) { U.toast('A GO with unresolved critical risks requires explicit conditions.', 'error'); return; }
                const ok = await C.confirm('Finalise recommendation', `Record <strong>${U.esc(d.value)}</strong> as the final recommendation in your name (${U.esc(user.name)})? RSS ${U.fmtScore(calc.rss)} (${U.esc(calc.guidance ? calc.guidance.label : '—')} guidance) and ${calc.risks.criticalUnresolved.length} unresolved critical risk(s) will be stated alongside it.`, 'Finalise');
                if (!ok) return;
                d.finalised = true; d.finalisedBy = user.id; d.finalisedAt = U.nowIso();
                app.log('Recommendation finalised', 'decision', a.id, { to: d.value, detail: `RSS ${U.fmtScore(calc.rss)}; guidance ${calc.guidance ? calc.guidance.label : '—'}` });
                app.save(true); app.render({ keepScroll: true });
                U.toast(RSA.Edition && RSA.Edition.test ? 'Recommendation finalised.' : 'Recommendation finalised. You can now sync results to the PDM.', 'success', 5000);
            },
            async 'reopen-decision'(app) {
                const comment = await C.promptText('Reopen decision', 'Reason for reopening (required)');
                if (!comment) return;
                const d = app.a.decision;
                app.log('Recommendation reopened', 'decision', app.a.id, { from: d.value, detail: comment });
                d.finalised = false; d.finalisedBy = null; d.finalisedAt = null; d.acknowledgedOpenIssues = false;
                app.save(true); app.render({ keepScroll: true });
            }
        }
    };
})(window.RSA);
