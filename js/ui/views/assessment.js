/* Level 2 assessment: one dimension at a time, metrics as a compact list, one metric open at a time. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const W = RSA.Workflow;

    const fmtVal = (v, path) => {
        if (v === null || v === undefined || v === '') return '<span class="muted">—</span>';
        if (Array.isArray(v)) return v.length ? U.esc(v.join(', ')) : '<span class="muted">—</span>';
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        const unit = M.fieldUnit(path);
        return typeof v === 'number' ? `${U.fmtNum(v, v % 1 ? 2 : 0)}${unit ? ` <span class="muted">${U.esc(unit)}</span>` : ''}` : U.esc(v);
    };

    const refVal = (a, side, rec, p) => {
        const v = U.get(rec, p);
        const required = (M.requiredData[side] || []).some(([, paths]) => paths.includes(p));
        if ((v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) && required) return '<button class="link-button small" data-action="nav" data-view="projects">missing · add</button>';
        return `${fmtVal(v, p)}${RSA.Data.isManual(a, side, p) ? ' <span class="muted small">(added)</span>' : ''}`;
    };

    const FILTERS = [['all', 'By dimension'], ['mine', 'Assigned to me'], ['review', 'To review']];

    const initials = (name) => (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2);

    function listFor(app, calc) {
        const f = app.ui.metricFilter; const user = app.user; const uid = user && user.id;
        if (f === 'mine') return calc.metrics.filter((x) => x.st.assessorId === uid);
        if (f === 'review') return calc.metrics.filter((x) => x.st.assessorId !== uid && user && ((x.st.status === 'Submitted' && (x.st.reviewerId === uid || M.roles[user.role].canReview)) || (x.st.status === 'Reviewed' && M.roles[user.role].canApprove)));
        return calc.dims.find((d) => d.id === app.ui.dimTab).metricsState;
    }

    function row(app, x) {
        const a = app.a; const open = app.ui.openMetric === x.id;
        const assessor = W.member(a, x.st.assessorId);
        return `<article class="metric ${open ? 'open' : ''}" id="metric-${x.id.replace('.', '-')}">
            <button class="metric-row" data-action="toggle-metric" data-metric="${x.id}" aria-expanded="${open}">
              <span class="m-id">${x.id}</span>
              <span class="m-name">${U.esc(x.name)}</span>
              <span class="m-who" title="${U.esc(assessor ? assessor.name : 'Unassigned')}">${assessor ? U.esc(initials(assessor.name)) : '—'}</span>
              <span class="m-score">${x.eff === null ? '—' : Math.round(x.eff)}</span>
              <span class="m-status" data-live="status:${x.id}">${C.statusBadge(x.st.status)}</span>
              <span class="m-chev" aria-hidden="true">${open ? '−' : '+'}</span>
            </button>
            ${open ? detail(app, x) : ''}
          </article>`;
    }

    function detail(app, x) {
        const a = app.a; const user = app.user; const st = x.st; const id = x.id;
        const canEdit = W.canEditAssessorFields(a, user, id);
        const canReview = W.canEditReviewerFields(a, user, id);
        const actions = W.actionsFor(a, user, id);
        const src = RSA.Data.effective(a, 'source'); const site = RSA.Data.effective(a, 'site');
        const ind = RSA.Indicators.compute(id, src, site);
        const dis = canEdit ? '' : 'disabled';
        const scoreNum = st.score === '' ? '' : Number(st.score);
        const linkable = a.evidence.filter((e) => !st.evidenceIds.includes(e.id));
        const showReview = ['Submitted', 'Reviewed', 'Approved'].includes(st.status) || st.reviewerComment;
        const lockMsg = st.status === 'Approved' ? 'Approved and locked.' : ['Submitted', 'Reviewed'].includes(st.status) ? 'With the reviewer.'
            : !user ? '' : !canEdit ? `Only ${W.memberName(a, st.assessorId)} or the lead assessor can edit this metric.`
            : st.assessorId && st.assessorId !== user.id ? `Only ${W.memberName(a, st.assessorId)} can submit this metric for review.` : '';
        const changed = [...(a.pdm.pendingChanges.source || []), ...(a.pdm.pendingChanges.site || [])].filter((c) => x.pdmFields.includes(c.path));
        const refKey = `ref-${id}`; const histKey = `hist-${id}`;
        const missingHere = RSA.Data.missing(a).filter((m) => !m.filled && m.metrics.includes(id));
        const history = app.ui.expanded[histKey] ? a.audit.filter((e) => e.entity === 'metric' && e.entityId === id).slice(0, 10) : [];

        return `<div class="metric-detail">
            <p class="m-desc">${U.esc(x.description)} <span class="muted">Assessor: ${C.memberName(a, st.assessorId)} · Reviewer: ${C.memberName(a, st.reviewerId)}</span></p>
            ${changed.length ? `<p class="alert warning small">Reference data for this metric has changed in the project database.</p>` : ''}
            <div class="m-grid">
              <div class="m-main">
                <div class="score-line">
                  <label>Score<div class="score-input-wrap">
                    <input type="range" min="0" max="100" step="1" value="${scoreNum === '' ? 0 : scoreNum}" class="${scoreNum === '' ? 'unset' : ''}" data-field="metrics|${id}|score" data-metric="${id}" data-type="score" data-audit="score" aria-label="Score" ${dis} />
                    <input class="score-number" type="number" min="0" max="100" value="${scoreNum}" data-field="metrics|${id}|score" data-metric="${id}" data-type="score" data-audit="score" aria-label="Score value" ${dis} />
                  </div></label>
                  <label>Confidence<select data-field="metrics|${id}|confidence" data-metric="${id}" data-audit="confidence" ${dis}>${C.options(M.confidenceLevels, st.confidence, 'Select')}</select></label>
                </div>
                <label>Why this score?${st.rationaleAiAssisted ? ' <span class="tag-ai">contains assistant draft</span>' : ''}<textarea data-field="metrics|${id}|rationale" data-metric="${id}" data-audit="rationale" placeholder="Explain the score with reference to the scoring guide and evidence" ${dis}>${U.esc(st.rationale)}</textarea></label>
                <label>Assumptions<textarea class="short" data-field="metrics|${id}|assumptions" data-metric="${id}" data-audit="assumptions" placeholder="Optional" ${dis}>${U.esc(st.assumptions)}</textarea></label>
                <div class="evidence-links">
                  <span class="field-label">Evidence</span>
                  <div class="chips">${x.evidence.map((e) => `<span class="ev-chip"><button class="link-button" data-action="edit-evidence" data-id="${e.id}" title="${U.esc(e.title)}">${U.esc(e.title.length > 52 ? `${e.title.slice(0, 52)}…` : e.title)}</button>${canEdit ? `<button class="icon-button tiny" data-action="unlink-evidence" data-metric="${id}" data-id="${e.id}" aria-label="Remove">×</button>` : ''}</span>`).join('') || '<span class="muted small">None linked yet</span>'}</div>
                  ${canEdit ? `<div class="inline-row"><select data-link-evidence="${id}"><option value="">Link existing evidence…</option>${linkable.map((e) => `<option value="${e.id}">${U.esc(e.title.slice(0, 70))}</option>`).join('')}</select><button class="button secondary small" data-action="new-evidence" data-metric="${id}">Add new</button></div>` : ''}
                </div>
                ${showReview ? `<div class="review-box">
                  <span class="field-label">Review</span>
                  <div class="score-line">
                    <label>Agreed score<input type="number" min="0" max="100" value="${st.finalScore === '' ? '' : Number(st.finalScore)}" data-field="metrics|${id}|finalScore" data-type="score" data-audit="agreed score" placeholder="${st.score === '' ? '' : st.score}" ${canReview ? '' : 'disabled'} /></label>
                    <p class="muted small">Assessor scored ${st.score === '' ? '—' : U.esc(st.score)}${st.approvedAt ? ` · approved ${U.fmtDate(st.approvedAt)} by ${C.memberName(a, st.approvedBy)}` : ''}</p>
                  </div>
                  <label>Reviewer comments<textarea class="short" data-field="metrics|${id}|reviewerComment" data-audit="reviewer comment" ${canReview ? '' : 'disabled'}>${U.esc(st.reviewerComment)}</textarea></label>
                </div>` : ''}
              </div>

              <aside class="m-side">
                <span class="field-label">Scoring guide</span>
                <p class="small muted">${U.esc(x.guidance)}</p>
                <div class="band-table">${x.criteria.map((c) => `<button type="button" class="band-row ${x.eff !== null && (M.bandFor(c.score) || {}).cls === (M.bandFor(x.eff) || {}).cls ? 'current' : ''}" data-action="set-band" data-metric="${id}" data-score="${c.score}" ${dis}><strong>${c.score}</strong><span>${U.esc(c.text)}</span></button>`).join('')}</div>
                ${ind ? `<p class="hint">Project data suggests about <strong>${ind.score}</strong>. <button class="link-button" data-action="ask-ai" data-metric="${id}" data-prompt="Why would ${id} fall in this band?">Why?</button></p>` : ''}
                ${missingHere.length ? `<p class="hint warn">The project database is missing ${missingHere.map((m) => U.esc(m.label.toLowerCase())).join(', ')}. <button class="link-button" data-action="goto-missing">Add it</button></p>` : ''}
                ${src && site ? `<button class="link-button small" data-action="toggle-expand" data-key="${refKey}">${app.ui.expanded[refKey] ? 'Hide' : 'Show'} reference data</button>
                  ${app.ui.expanded[refKey] ? `<table class="mini-table"><thead><tr><th></th><th>Source</th><th>Site</th></tr></thead><tbody>${x.pdmFields.map((p) => `<tr><td>${U.esc(M.fieldLabel(p))}</td><td>${refVal(a, 'source', src, p)}</td><td>${refVal(a, 'site', site, p)}</td></tr>`).join('')}</tbody></table>` : ''}` : ''}
              </aside>
            </div>
            <footer class="m-foot">
              <div class="button-row">${actions.map((ac) => `<button class="button ${ac.cls} small" data-action="metric-transition" data-metric="${id}" data-transition="${ac.id}">${U.esc(ac.label)}</button>`).join('')}
                ${lockMsg ? `<span class="muted small">${U.esc(lockMsg)}</span>` : ''}</div>
              <div class="button-row">
                ${canEdit ? `<button class="link-button small" data-action="ask-ai" data-metric="${id}" data-prompt="Draft rationale for ${id}">Draft with assistant</button>` : ''}
                <button class="link-button small" data-action="toggle-expand" data-key="${histKey}">${app.ui.expanded[histKey] ? 'Hide history' : 'History'}</button>
              </div>
            </footer>
            ${app.ui.expanded[histKey] ? `<ul class="activity">${history.map((e) => `<li><span class="muted">${U.fmtDateTime(e.at)}</span> ${U.esc(e.userName)} — ${U.esc(e.action.toLowerCase())}${e.from !== '' || e.to !== '' ? `: ${U.esc(String(e.from).slice(0, 50))} → ${U.esc(String(e.to).slice(0, 50))}` : ''}</li>`).join('') || '<li class="muted">No changes recorded.</li>'}</ul>` : ''}
          </div>`;
    }

    RSA.Views = RSA.Views || {};
    RSA.Views.assessment = {
        render(app, calc) {
            const f = app.ui.metricFilter;
            const list = listFor(app, calc);
            const tabs = f === 'all' ? `<nav class="dim-tabs" role="tablist">${calc.dims.map((d) => `
                <button class="dim-tab ${app.ui.dimTab === d.id ? 'active' : ''}" role="tab" data-action="dim-tab" data-dim="${d.id}">
                  <span class="dim-tab-name">${U.esc(d.short)}</span>
                  <strong data-live="dim:${d.id}">${U.fmtScore(d.score)}</strong>
                  <span class="dim-tab-meta">${Math.round(d.weight * 100)}% · ${d.approved}/4 approved</span>
                </button>`).join('')}</nav>` : '';
            const d = calc.dims.find((x) => x.id === app.ui.dimTab);
            const title = f === 'all' ? `<div class="list-head"><div><h2>${U.esc(d.name)}</h2><p class="muted small">${U.esc(d.purpose)}</p></div></div>` : '';

            return `<div class="toolbar">
                <div class="segmented-small">${FILTERS.map(([k, l]) => `<button class="${f === k ? 'active' : ''}" data-action="metric-filter" data-filter="${k}">${U.esc(l)}</button>`).join('')}</div>
                <span class="muted small">${calc.scored}/20 scored · ${calc.approved}/20 approved</span>
              </div>
              ${tabs}
              <section class="panel flush">
                ${title}
                <div class="metric-list">
                  <div class="metric-list-head"><span>#</span><span>Metric</span><span>By</span><span>Score</span><span>Status</span><span></span></div>
                  ${list.length ? list.map((x) => row(app, x)).join('') : '<p class="empty-inline pad">Nothing here.</p>'}
                </div>
              </section>`;
        },

        after(app, root) {
            U.$$('[data-link-evidence]', root).forEach((sel) => sel.addEventListener('change', () => {
                if (sel.value) app.linkEvidence(sel.dataset.linkEvidence, sel.value, true);
            }));
            U.$$('input[type=range].unset', root).forEach((r) => r.addEventListener('input', () => r.classList.remove('unset'), { once: true }));
        },

        actions: {
            'toggle-metric'(app, el) {
                const id = el.dataset.metric;
                app.ui.openMetric = app.ui.openMetric === id ? null : id;
                app.render({ keepScroll: true });
            },
            'dim-tab'(app, el) { app.ui.dimTab = el.dataset.dim; app.ui.openMetric = null; app.render({ keepScroll: true }); },
            'metric-filter'(app, el) { app.ui.metricFilter = el.dataset.filter; app.ui.openMetric = null; app.render({ keepScroll: true }); },
            'set-band'(app, el) {
                const id = el.dataset.metric; const a = app.a;
                if (!W.canEditAssessorFields(a, app.user, id)) return;
                const from = a.metrics[id].score;
                a.metrics[id].score = el.dataset.score;
                W.touchMetric(a, app.user, id);
                app.log('Edited score', 'metric', id, { field: 'score', from, to: el.dataset.score, detail: 'Set from scoring guide' });
                app.save(true); app.render({ keepScroll: true });
            },
            'goto-missing'(app) { app.setView('projects'); requestAnimationFrame(() => { const el = document.getElementById('missing-data'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }); },
            'metric-transition'(app, el) { app.metricAction(el.dataset.metric, el.dataset.transition); },
            'unlink-evidence'(app, el) { app.linkEvidence(el.dataset.metric, el.dataset.id, false); },
            'new-evidence'(app, el) { C.evidenceDialog(app, null, { metricIds: [el.dataset.metric] }); },
            'edit-evidence'(app, el) { const e = app.a.evidence.find((x) => x.id === el.dataset.id); if (e) C.evidenceDialog(app, e); }
        }
    };
})(window.RSA);
