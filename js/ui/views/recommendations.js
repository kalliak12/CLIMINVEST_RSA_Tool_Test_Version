/* Recommendations: improvement actions (catalogue-driven), better-match source projects, catalogue management. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const W = RSA.Workflow;
    const R = RSA.Recommend;

    const TYPES = ['Course', 'CLIMINVEST tool', 'Assessment / study', 'Stakeholder engagement', 'Technical adaptation', 'Financial action', 'Funding preparation', 'Governance / capacity building', 'Data collection'];

    function improvementTab(app, calc) {
        const a = app.a;
        const recs = R.Improvement.generate(a, app.catalogue, calc);
        const active = recs.filter((r) => r.status !== 'Dismissed');
        const dismissed = recs.filter((r) => r.status === 'Dismissed');
        const item = (r) => {
            const key = `rec-${r.key}`; const open = app.ui.expanded[key];
            return `<li class="rec ${open ? 'open' : ''} ${r.status === 'Dismissed' ? 'dismissed' : ''}">
              <div class="rec-row">
                <span class="prio prio-${r.priority.toLowerCase()}" title="${r.priority} priority">${r.priority}</span>
                <button class="rec-title" data-action="toggle-expand" data-key="${key}">
                  <strong>${U.esc(r.entry.title)}</strong>
                  <span class="muted small">${U.esc(r.entry.type)} · ${U.esc(r.entry.resource.name)}</span>
                </button>
                <span class="rec-affects small">${r.gain >= 0.05 ? `<strong class="gain">+${r.gain.toFixed(1)}</strong> RSS · ` : ''}${U.esc(r.metrics.join(', '))}</span>
                <select data-rec-status="${U.esc(r.key)}" aria-label="Status" ${app.user ? '' : 'disabled'}>${C.options(M.recommendationStatuses, r.status)}</select>
              </div>
              ${open ? `<div class="rec-detail">
                <p>${U.esc(r.entry.description)}</p>
                <p><span class="field-label">Why</span> ${r.reasons.slice(0, 4).map((x) => U.esc(x.text)).join('; ')}${r.reasons.length > 4 ? ` (+${r.reasons.length - 4} more)` : ''}.</p>
                <p><span class="field-label">Expected improvement</span> ${U.esc(r.entry.expectedImprovement)}${r.gain >= 0.05 ? ` Up to +${r.gain.toFixed(1)} RSS points.` : ''}</p>
                <p><span class="field-label">Resource</span> ${U.esc(r.entry.resource.name)}, ${U.esc(r.entry.resource.provider)} · effort ${U.esc(r.entry.effort.toLowerCase())} · ${U.esc(r.entry.phase.toLowerCase())}</p>
                <label class="inline-label">Note<input data-rec-note="${U.esc(r.key)}" value="${U.esc(r.note)}" placeholder="Owner, timing…" ${app.user ? '' : 'disabled'} /></label>
              </div>` : ''}
            </li>`;
        };
        const plan = a.actionPlan || [];
        const planPanel = plan.length ? `<section class="panel">
            <div class="panel-head"><div><h2>Team action plan</h2><p class="muted small">Actions written by the team (imported from the Excel workbook). They appear in the report next to the suggestions below.</p></div></div>
            <div class="table-wrap"><table class="compact"><thead><tr><th>#</th><th>Action</th><th>Trigger</th><th>Horizon</th><th>Lead</th><th>Metrics</th><th>Status</th></tr></thead><tbody>
            ${plan.map((x) => `<tr><td>${U.esc(x.id.replace(/^AP-/, ''))}</td><td>${U.esc(x.title)}${x.output ? `<br><small class="muted">Output: ${U.esc(x.output)}</small>` : ''}</td><td class="small">${U.esc(x.trigger)}</td><td class="small">${U.esc(x.horizon)}</td><td class="small">${U.esc(x.lead)}</td><td class="small">${U.esc(x.metrics.join(', ') || '—')}</td>
              <td><select data-plan-status="${U.esc(x.id)}" aria-label="Status" ${app.user ? '' : 'disabled'}>${C.options(M.recommendationStatuses, x.status)}</select></td></tr>`).join('')}
            </tbody></table></div>
          </section>` : '';
        return `${planPanel}<section class="panel">
            <div class="panel-head"><div><h2>Improvement actions</h2><p class="muted small">Suggested from low scores, evidence gaps and open risks. <strong>+x RSS</strong> is the most the score could rise if each affected metric moved up one scoring band, using this assessment's weights (Financial ${Math.round(M.dimension('D3').weight * 100)}%). Accept the actions the team will pursue; they feed the roadmap in the report.</p></div></div>
            ${active.length ? `<ul class="rec-list">${(app.ui.expanded.allRecs ? active : active.slice(0, 6)).map(item).join('')}</ul>
              ${active.length > 6 ? `<button class="link-button small" data-action="toggle-expand" data-key="allRecs">${app.ui.expanded.allRecs ? 'Show top 6 only' : `Show all ${active.length} suggestions`}</button>` : ''}` : '<p class="empty-inline">No actions suggested.</p>'}
          </section>
          ${dismissed.length ? `<details class="panel quiet"><summary>Dismissed (${dismissed.length})</summary><ul class="rec-list">${dismissed.map(item).join('')}</ul></details>` : ''}`;
    }

    function matchTab(app) {
        const a = app.a;
        const site = RSA.Data.effective(a, 'site');
        if (!site) return `<section class="panel"><p class="empty-inline">Select a replication site under Projects first.</p></section>`;
        if (!app.pdmCache.loaded) return '<section class="panel"><p class="muted">Loading projects…</p></section>';
        const ranked = R.Match.rank(site, app.pdmCache.sources, a.pdm.sourceId);
        const current = ranked.find((r) => r.isCurrent);
        const rowHtml = (r) => {
            const s = r.source; const key = `match-${s.id}`; const open = app.ui.expanded[key];
            return `<tr class="${r.isCurrent ? 'is-current' : ''}">
                <td><button class="link-plain" data-action="toggle-expand" data-key="${key}"><strong>${U.esc(s.shortName)}</strong></button>${r.isCurrent ? ' <span class="muted small">(current)</span>' : ''}</td>
                <td class="num"><strong>${U.fmtScore(r.overall)}</strong>${r.deltaVsCurrent !== null ? ` <small class="${r.deltaVsCurrent >= 0 ? 'pos' : 'neg'}">${r.deltaVsCurrent >= 0 ? '+' : ''}${r.deltaVsCurrent.toFixed(1)}</small>` : ''}</td>
                ${r.dims.map((d) => `<td class="num">${U.fmtScore(d.score)}</td>`).join('')}
                <td class="actions-cell">${r.isCurrent ? '' : `<button class="button secondary small" data-action="compare-match" data-id="${U.esc(s.id)}" ${current ? '' : 'disabled'}>Compare</button> <button class="button secondary small" data-action="start-with" data-id="${U.esc(s.id)}">Assess</button>`}</td>
              </tr>
              ${open ? `<tr class="detail-row"><td colspan="9">
                <p>${U.esc(r.explanation)}</p>
                ${r.gaps.length ? `<p><span class="field-label">Main gaps</span> ${r.gaps.slice(0, 3).map((g) => `${g.metricId}: ${U.esc(g.detail)}`).join(' · ')}</p>` : ''}
                <p><span class="field-label">Evidence in database</span> ${(s.documents || []).length} document(s)${(s.documents || []).length ? `: ${(s.documents || []).slice(0, 3).map((d) => U.esc(d.title)).join('; ')}` : ''}</p>
              </td></tr>` : ''}`;
        };
        return `<section class="panel">
            <div class="panel-head"><div><h2>Other source projects for ${U.esc(site.shortName)}</h2><p class="muted small">Similarity to the replication site across the five dimensions, using the same weights as the RSS (Financial ${Math.round(M.dimension('D3').weight * 100)}%). Indicative only.</p></div></div>
            <div class="table-wrap"><table class="match-table"><thead><tr><th>Project</th><th class="num">Match</th>${M.dimensions.map((d) => `<th class="num">${U.esc(d.short)}</th>`).join('')}<th></th></tr></thead>
            <tbody>${ranked.map(rowHtml).join('')}</tbody></table></div>
          </section>`;
    }

    function guidesTab(app) {
        return `<section class="panel">
            <div class="panel-head"><div><h2>Guides for the replicating team</h2><p class="muted small">Hand these out with the results. They are placeholders until CLIMINVEST partners provide the final versions.</p></div></div>
            <div class="resource-grid">${RSA.Resources.map((r) => `<article class="resource">
                <div class="resource-icon" aria-hidden="true">PDF</div>
                <div><h3>${U.esc(r.title)}${r.placeholder ? ' <span class="badge warning">Placeholder</span>' : ''}</h3>
                <p class="small muted">${U.esc(r.description)}</p><p class="tiny muted">${U.esc(r.provider)}</p>
                <div class="button-row"><a class="button secondary small" href="${U.esc(r.file)}" target="_blank" rel="noopener">Open</a><a class="button secondary small" href="${U.esc(r.file)}" download>Download</a></div></div>
              </article>`).join('')}</div>
          </section>`;
    }

    function catalogueTab(app) {
        const cat = app.catalogue;
        const canEdit = app.user && ['lead', 'reviewer'].includes(app.user.role);
        return `<section class="panel">
            <div class="panel-head"><div><h2>Recommendation catalogue <small class="muted">${U.esc(cat.version || '')}</small></h2></div>
            <div class="button-row">${canEdit ? '<button class="button primary small" data-action="add-cat">Add entry</button>' : ''}
              <button class="button secondary small" data-action="export-cat">Export JSON</button>
              ${canEdit ? '<label class="button secondary small file-button">Import JSON<input type="file" accept="application/json" data-import-cat /></label><button class="button danger-outline small" data-action="reset-cat">Reset to default</button>' : ''}</div></div>
            <p class="muted small">Courses, tools, studies and actions that can be suggested, and when each one applies. ${canEdit ? '' : 'Only the Lead Assessor or Reviewer can change the catalogue.'}</p>
            <div class="table-wrap"><table class="compact"><thead><tr><th>On</th><th>Type</th><th>Action</th><th>Resource</th><th>Metrics</th><th>Triggers</th><th>Phase</th></tr></thead><tbody>
            ${cat.entries.map((e, i) => {
                const t = e.triggers || {};
                const trig = [t.belowScore !== undefined ? `score < ${t.belowScore}` : '', t.lowConfidence ? 'low confidence' : '', t.evidenceGap ? 'evidence gap' : '', (t.riskDimensions || []).length ? `risks in ${t.riskDimensions.join(', ')}` : ''].filter(Boolean).join(' · ');
                return `<tr class="${e.enabled === false ? 'muted-row' : ''}"><td><input type="checkbox" data-cat-toggle="${i}" ${e.enabled === false ? '' : 'checked'} ${canEdit ? '' : 'disabled'} aria-label="Enable ${U.esc(e.title)}" /></td>
                  <td>${U.esc(e.type)}</td><td><strong>${U.esc(e.title)}</strong><br><small class="muted">${U.esc(e.id)}</small></td><td>${U.esc(e.resource.name)}<br><small class="muted">${U.esc(e.resource.provider)}</small></td>
                  <td>${U.esc((e.metrics || []).join(', '))}</td><td><small>${U.esc(trig)}</small></td><td>${U.esc(e.phase)}</td></tr>`;
            }).join('')}</tbody></table></div>
          </section>`;
    }

    function addCatalogueDialog(app) {
        const types = TYPES;
        C.modal.open({
            title: 'Add catalogue entry', wide: true, submitLabel: 'Add entry',
            body: `<div class="form-grid two">
                <label class="span-2">Action title<input name="title" required data-label="Action title" /></label>
                <label>Type<select name="type">${C.options(types, 'Course')}</select></label>
                <label>Phase<select name="phase">${C.options(['Immediate', 'Before Level 3', 'Implementation'], 'Before Level 3')}</select></label>
                <label class="span-2">Description<textarea name="description"></textarea></label>
                <label>Resource (course / tool / study)<input name="resource" required data-label="Resource" /></label>
                <label>Provider<input name="provider" /></label>
                <label class="span-2">Expected improvement<input name="expected" /></label>
                <label>Trigger: score below<input type="number" name="below" min="0" max="100" value="60" /></label>
                <label>Effort<select name="effort">${C.options(['Low', 'Medium', 'High'], 'Medium')}</select></label>
                <label class="check-inline"><input type="checkbox" name="lowConfidence" /> Trigger on low confidence</label>
                <label class="check-inline"><input type="checkbox" name="evidenceGap" /> Trigger on evidence gap</label>
              </div>
              <p class="field-title">Metrics</p><div class="chip-checks">${M.allMetrics().map((m) => `<label class="check"><input type="checkbox" name="metrics" value="${m.id}" /> ${m.id}</label>`).join('')}</div>
              <p class="field-title">Risk dimensions</p><div class="chip-checks">${M.dimensions.map((d) => `<label class="check"><input type="checkbox" name="riskDims" value="${d.id}" /> ${d.id} ${U.esc(d.short)}</label>`).join('')}</div>`,
            onSubmit: (form, fd) => {
                const metrics = fd.getAll('metrics');
                if (!metrics.length && !fd.getAll('riskDims').length) return 'Select at least one metric or risk dimension.';
                const below = fd.get('below');
                app.catalogue.entries.push({
                    id: U.uid('CAT-CUSTOM'), enabled: true, type: fd.get('type'), title: String(fd.get('title')).trim(), description: String(fd.get('description')).trim(),
                    resource: { name: String(fd.get('resource')).trim(), provider: String(fd.get('provider')).trim() || 'Custom' },
                    expectedImprovement: String(fd.get('expected')).trim(), metrics, phase: fd.get('phase'), effort: fd.get('effort'),
                    triggers: { ...(below !== '' ? { belowScore: Number(below) } : {}), lowConfidence: fd.get('lowConfidence') === 'on', evidenceGap: fd.get('evidenceGap') === 'on', riskDimensions: fd.getAll('riskDims') }
                });
                app.catalogue.version = `${(app.catalogue.version || 'custom').replace(/\+custom$/, '')}+custom`;
                app.log('Catalogue entry added', 'catalogue', 'entries', { detail: String(fd.get('title')) });
                app.save(true); app.render({ keepScroll: true });
                return true;
            }
        });
    }

    function compareDialog(app, candidateId) {
        const a = app.a; const site = RSA.Data.effective(a, 'site');
        const cand = app.pdmCache.sources.find((s) => s.id === candidateId);
        const cur = app.pdmCache.sources.find((s) => s.id === a.pdm.sourceId);
        if (!cand || !cur) return;
        const x = R.Match.compare(cur, site); const y = R.Match.compare(cand, site);
        C.modal.open({
            title: `Compare for ${site.shortName}`, wide: true, hideSubmit: true,
            body: `<div class="table-wrap"><table class="compact comparison"><thead><tr><th>Indicator</th><th>${U.esc(cur.shortName)} (current)</th><th>${U.esc(cand.shortName)}</th></tr></thead><tbody>
              <tr class="group-row"><td>Overall match</td><td>${U.fmtScore(x.overall)}</td><td>${U.fmtScore(y.overall)}</td></tr>
              ${x.dims.map((d, i) => `<tr class="group-row"><td>${d.id} ${U.esc(d.name)} (${Math.round(d.weight * 100)}%)</td><td>${U.fmtScore(d.score)}</td><td>${U.fmtScore(y.dims[i].score)}</td></tr>
                ${d.factors.map((f, j) => { const g = y.dims[i].factors[j]; return `<tr><td>${f.metricId} ${U.esc(f.name)}</td><td><strong>${f.score ?? '—'}</strong> <small>${U.esc(f.detail)}</small></td><td><strong>${g.score ?? '—'}</strong> <small>${U.esc(g.detail)}</small></td></tr>`; }).join('')}`).join('')}
            </tbody></table></div><p class="method-note">Indicative PDM-based comparison. Scores are band values from the Scoring Toolkit criteria.</p>`
        });
    }

    RSA.Views = RSA.Views || {};
    RSA.Views.recommendations = {
        render(app, calc) {
            const tab = app.ui.recTab;
            const tabs = `<div class="tabs">${[['improve', 'Actions'], ['match', 'Other source projects'], ['guides', 'Guides & flyer'], ['catalogue', 'Catalogue']].map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-action="rec-tab" data-tab="${k}">${l}</button>`).join('')}</div>`;
            const body = tab === 'match' ? matchTab(app) : tab === 'guides' ? guidesTab(app) : tab === 'catalogue' ? catalogueTab(app) : improvementTab(app, calc);
            return tabs + body;
        },
        after(app, root) {
            const setRec = (key, patch) => {
                const cur = app.a.recommendations.statuses[key] || { status: 'Proposed', note: '' };
                const next = { ...cur, ...patch, updatedBy: app.user && app.user.id, updatedAt: U.nowIso() };
                app.a.recommendations.statuses[key] = next;
                return cur;
            };
            U.$$('[data-plan-status]', root).forEach((sel) => sel.addEventListener('change', () => {
                const x = (app.a.actionPlan || []).find((p) => p.id === sel.dataset.planStatus);
                if (!x) return;
                const from = x.status; x.status = sel.value;
                app.log('Action status changed', 'action', x.id, { field: 'status', from, to: x.status, detail: x.title });
                app.save(true);
            }));
            U.$$('[data-rec-status]', root).forEach((sel) => sel.addEventListener('change', () => {
                const prev = setRec(sel.dataset.recStatus, { status: sel.value });
                app.log('Recommendation status', 'recommendation', sel.dataset.recStatus, { field: 'status', from: prev.status || 'Proposed', to: sel.value });
                app.save(true); app.render({ keepScroll: true });
            }));
            U.$$('[data-rec-note]', root).forEach((inp) => inp.addEventListener('change', () => {
                const prev = setRec(inp.dataset.recNote, { note: inp.value });
                app.log('Recommendation note', 'recommendation', inp.dataset.recNote, { field: 'note', from: prev.note || '', to: inp.value });
                app.save(true);
            }));
            U.$$('[data-cat-toggle]', root).forEach((cb) => cb.addEventListener('change', () => {
                const e = app.catalogue.entries[Number(cb.dataset.catToggle)];
                e.enabled = cb.checked;
                app.log(cb.checked ? 'Catalogue entry enabled' : 'Catalogue entry disabled', 'catalogue', e.id);
                app.save(true); app.render({ keepScroll: true });
            }));
            const imp = U.$('[data-import-cat]', root);
            if (imp) imp.addEventListener('change', () => {
                const file = imp.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const parsed = JSON.parse(reader.result);
                        if (!Array.isArray(parsed.entries) || parsed.entries.some((e) => !e.id || !e.title || !e.resource)) throw new Error('invalid');
                        app.data.catalogue = parsed;
                        app.log('Catalogue imported', 'catalogue', parsed.version || 'custom', { detail: `${parsed.entries.length} entries` });
                        app.save(true); app.render({ keepScroll: true });
                        U.toast(`Catalogue imported (${parsed.entries.length} entries).`, 'success');
                    } catch (err) { U.toast('Invalid catalogue file: expected { version, entries: [{ id, title, resource, metrics, triggers }] }.', 'error', 6000); }
                };
                reader.readAsText(file);
            });
        },
        actions: {
            'rec-tab'(app, el) { app.ui.recTab = el.dataset.tab; app.render(); },
            'compare-match'(app, el) { compareDialog(app, el.dataset.id); },
            'start-with'(app, el) {
                const src = app.pdmCache.sources.find((s) => s.id === el.dataset.id);
                const site = RSA.Data.effective(app.a, 'site');
                C.confirm('Start new assessment', `Create a new assessment <strong>${U.esc(src.shortName)} → ${U.esc(site.shortName)}</strong> with the same team? The current assessment is kept unchanged.`, 'Start assessment').then((ok) => {
                    if (!ok) return;
                    app.newAssessment({ copyTeam: true, sourceId: src.id, siteId: app.a.pdm.siteId, title: `${src.shortName.split(' (')[0]} → ${site.shortName.split(' (')[0]}`, detail: `Started from better-match recommendation (previous: ${app.a.title})` })
                        .then(() => U.toast('New assessment created with PDM data prefilled.', 'success'));
                });
            },
            'export-cat'(app) { U.download(`rsa-recommendation-catalogue-${U.slug(app.catalogue.version || 'custom')}.json`, JSON.stringify(app.catalogue, null, 2)); },
            'reset-cat'(app) {
                C.confirm('Reset catalogue', 'Restore the default recommendation catalogue? Custom entries will be removed.', 'Reset').then((ok) => {
                    if (!ok) return;
                    app.data.catalogue = U.clone(RSA.DefaultCatalogue);
                    app.log('Catalogue reset', 'catalogue', 'default');
                    app.save(true); app.render({ keepScroll: true });
                });
            },
            'add-cat'(app) { addCatalogueDialog(app); }
        }
    };
})(window.RSA);
