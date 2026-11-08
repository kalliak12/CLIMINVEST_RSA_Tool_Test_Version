/* Overview: the few numbers that matter, dimension scores and personal next steps. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const W = RSA.Workflow;

    function nextSteps(app, calc) {
        const a = app.a; const user = app.user; const steps = [];
        if (!user) return steps;
        const mine = calc.metrics.filter((x) => x.st.assessorId === user.id);
        const toScore = mine.filter((x) => ['Not started', 'Draft'].includes(x.st.status));
        toScore.slice(0, 4).forEach((x) => steps.push({ text: `${x.st.status === 'Draft' ? 'Finish and submit' : 'Score'} ${x.id} ${x.name}`, metric: x.id }));
        const canReview = M.roles[user.role].canReview;
        const toReview = calc.metrics.filter((x) => x.st.status === 'Submitted' && x.st.assessorId !== user.id && (x.st.reviewerId === user.id || canReview));
        if (toReview.length) steps.push({ text: `Review ${toReview.length} submitted metric${toReview.length > 1 ? 's' : ''}`, view: 'assessment', filter: 'review' });
        if (M.roles[user.role].canApprove) {
            const toApprove = calc.metrics.filter((x) => x.st.status === 'Reviewed' && x.st.assessorId !== user.id);
            if (toApprove.length) steps.push({ text: `Approve ${toApprove.length} reviewed metric${toApprove.length > 1 ? 's' : ''}`, view: 'assessment', filter: 'review' });
        }
        if (user.role === 'lead' && calc.screening.label !== 'Incomplete' && !a.screening.confirmedBy) steps.push({ text: 'Confirm the screening outcome', view: 'screening' });
        if (W.canFinalise(user) && calc.approved === calc.total && !a.decision.finalised) steps.push({ text: 'Record the final recommendation', view: 'report' });
        if (W.canFinalise(user) && a.decision.finalised && a.pdm.sync.status !== 'synced') steps.push({ text: 'Send the results to the project database', view: 'projects' });
        return steps;
    }

    RSA.Views = RSA.Views || {};
    RSA.Views.dashboard = {
        render(app, calc) {
            const a = app.a;
            const src = a.pdm.source && a.pdm.source.data; const site = a.pdm.site && a.pdm.site.data;
            const st = W.assessmentStatus(a, calc);
            const g = calc.guidance;
            const crit = calc.risks.criticalUnresolved.length;
            const steps = nextSteps(app, calc);

            const header = `<section class="hero">
                <div class="hero-pair">
                  <div><span class="label">Source project</span><strong>${src ? U.esc(src.shortName) : '—'}</strong></div>
                  <span class="hero-arrow" aria-hidden="true">→</span>
                  <div><span class="label">Replication site</span><strong>${site ? U.esc(site.shortName) : '—'}</strong></div>
                </div>
                <div class="hero-status"><span class="status-text ${st.cls}">${U.esc(st.label)}</span>${a.decision.finalised ? `<span class="muted">Decision: <strong>${U.esc(a.decision.value)}</strong></span>` : ''}</div>
              </section>`;

            const tiles = `<div class="tiles">
                <div class="tile tile-main">
                  <span class="label">Suitability score (RSS)</span>
                  <strong data-live="rss">${U.fmtScore(calc.rss)}</strong>
                  <small>${calc.rssStatus === 'final' ? 'Final' : 'Provisional'}${g ? ` · guidance: ${U.esc(g.label.toLowerCase())}` : ''}</small>
                </div>
                <button class="tile" data-action="nav" data-view="assessment">
                  <span class="label">Approved metrics</span>
                  <strong>${calc.approved}<span class="of">/${calc.total}</span></strong>
                  <div class="progress"><span style="width:${(calc.approved / calc.total) * 100}%"></span></div>
                </button>
                <button class="tile" data-action="nav" data-view="evidence">
                  <span class="label">Metrics with evidence</span>
                  <strong>${calc.evidenced}<span class="of">/${calc.total}</span></strong>
                  <div class="progress"><span style="width:${(calc.evidenced / calc.total) * 100}%"></span></div>
                </button>
                <button class="tile ${crit ? 'tile-alert' : ''}" data-action="nav" data-view="risks">
                  <span class="label">Critical risks open</span>
                  <strong>${crit}</strong>
                  <small>${crit ? 'Must be addressed in the decision' : 'None'}</small>
                </button>
              </div>`;

            const dims = `<section class="panel dash-dims">
                <h2>Scores by dimension</h2>
                <div class="dim-bars">${calc.dims.map((d) => `<button class="dim-bar" data-action="nav" data-view="assessment" data-dim="${d.id}">
                    <span class="dim-name">${U.esc(d.name)} <small>${Math.round(d.weight * 100)}%</small></span>
                    ${C.bar(d.score)}
                    <strong data-live="dim:${d.id}">${U.fmtScore(d.score)}</strong>
                  </button>`).join('')}</div>
                <p class="note">Scores are provisional until every metric is approved. The final recommendation is always made by the lead assessor or reviewer.</p>
              </section>`;

            const todo = steps.length ? `<section class="panel compact-panel dash-todo">
                <h2>Your next steps</h2>
                <p class="muted small">Acting as ${app.user ? U.esc(app.user.name) : '—'}</p>
                <ul class="todo">${steps.map((s) => `<li><button class="link-row" data-action="todo" ${s.metric ? `data-metric="${s.metric}"` : ''} ${s.view ? `data-view="${s.view}"` : ''} ${s.filter ? `data-filter="${s.filter}"` : ''}>${U.esc(s.text)}<span aria-hidden="true">›</span></button></li>`).join('')}</ul>
              </section>` : `<section class="panel compact-panel dash-todo"><h2>Your next steps</h2><p class="small muted">Nothing waiting for you right now (acting as ${app.user ? U.esc(app.user.name) : '—'}).</p></section>`;

            const activity = `<details class="panel quiet">
                <summary>Recent activity</summary>
                <ul class="activity">${a.audit.slice(0, 8).map((e) => `<li><span class="muted">${U.fmtDateTime(e.at)}</span> ${U.esc(e.userName)} — ${U.esc(e.action.toLowerCase())} ${U.esc(e.entityId)}</li>`).join('') || '<li class="muted">No activity yet.</li>'}</ul>
              </details>`;

            const allRecs = RSA.Recommend.Improvement.generate(a, app.catalogue, calc).filter((r) => r.status !== 'Dismissed' && r.gain >= 0.05).sort((x, y) => y.gain - x.gain);
            const finRecs = allRecs.filter((r) => r.dimensions.includes('D3')).slice(0, 3);
            const otherRecs = allRecs.filter((r) => !finRecs.includes(r)).slice(0, 3);
            const recs = [...finRecs, ...otherRecs];
            const recItem = (r) => `<li><span class="gain-pill">+${r.gain.toFixed(1)}</span><div><strong>${U.esc(r.entry.title)}</strong><div class="muted small">${U.esc(r.entry.type)} · ${U.esc(r.entry.resource.name)} · metrics ${U.esc(r.metrics.join(', '))}</div></div></li>`;
            const notPerfect = calc.rss !== null && calc.metrics.some((x) => x.eff !== null && x.eff < 90);
            const improve = notPerfect && recs.length ? `<section class="panel dash-improve">
                <div class="panel-head"><div><h2>How to raise the score</h2><p class="muted small">Suggested courses, tools and actions, with the most the score could rise (RSS points) if each affected metric moves up one scoring band.</p></div>
                <button class="button secondary small" data-action="nav" data-view="recommendations">All actions</button></div>
                ${finRecs.length ? `<p class="improve-group">Investment performance</p><ul class="improve-list">${finRecs.map(recItem).join('')}</ul>` : ''}
                ${otherRecs.length ? `<p class="improve-group">Other dimensions</p><ul class="improve-list">${otherRecs.map(recItem).join('')}</ul>` : ''}
              </section>` : '';

            const siteEff = RSA.Data.effective(a, 'site');
            const ranked = siteEff && app.pdmCache.loaded ? RSA.Recommend.Match.rank(siteEff, app.pdmCache.sources, a.pdm.sourceId) : [];
            const current = ranked.find((r) => r.isCurrent);
            const better = ranked.filter((r) => !r.isCurrent && current && r.overall !== null && r.overall - current.overall >= 3).slice(0, 2);
            const missing = RSA.Data.missing(a).filter((m) => !m.filled);
            const side = `<div class="side-stack dash-side">
                ${todo}
                ${missing.length ? `<section class="panel compact-panel dash-missing"><h2>Missing information</h2><p class="small">${missing.length} field${missing.length > 1 ? 's are' : ' is'} ${RSA.Edition && RSA.Edition.test ? 'missing from the project data' : 'not in the project database'}${missing.some((m) => m.group === 'Investment performance') ? `, including ${missing.filter((m) => m.group === 'Investment performance').length} on investment performance` : ''}.</p><button class="button secondary small" data-action="todo" data-view="projects">Fill in</button></section>` : ''}
                ${better.length ? `<section class="panel compact-panel dash-better"><h2>A better match may exist</h2>${better.map((r) => `<p class="small"><strong>${U.esc(r.source.shortName)}</strong> matches this site at ${U.fmtScore(r.overall)} against ${U.fmtScore(current.overall)} for the current source.</p>`).join('')}<button class="button secondary small" data-action="rec-tab-go" data-tab="match">Compare projects</button></section>` : ''}
                <section class="panel compact-panel dash-guides"><h2>Guides</h2>${RSA.Resources.map((r) => `<p class="small"><a href="${U.esc(r.file)}" target="_blank" rel="noopener">${U.esc(r.title)}</a>${r.placeholder ? ' <span class="muted">(placeholder)</span>' : ''}</p>`).join('')}</section>
              </div>`;

            return `${header}${tiles}<div class="cols dash-cols"><div class="side-stack dash-main">${dims}${improve}</div>${side}</div>${activity}`;
        },
        actions: {
            'rec-tab-go'(app, el) { app.ui.recTab = el.dataset.tab; app.setView('recommendations'); },
            todo(app, el) {
                if (el.dataset.metric) { app.ui.openMetric = el.dataset.metric; app.ui.metricFilter = 'all'; app.actions['goto-metric'].call(app, el); return; }
                if (el.dataset.filter) app.ui.metricFilter = el.dataset.filter;
                app.setView(el.dataset.view);
            }
        }
    };
})(window.RSA);
