/* Risk register with critical-risk panel (kept separate from the RSS) and likelihood × impact matrix. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const S = RSA.Scoring;

    RSA.Views = RSA.Views || {};
    RSA.Views.risks = {
        render(app, calc) {
            const a = app.a; const f = app.ui.riskFilter;
            const crit = calc.risks.criticalUnresolved;
            const list = a.risks.filter((r) => f === 'all' || (f === 'unresolved' && S.riskUnresolved(r)) || (f === 'critical' && r.critical) || (f === 'high' && S.riskRating(r) === 'High'));
            const levels = ['High', 'Medium', 'Low'];
            const cell = (l, i) => a.risks.filter((r) => S.riskUnresolved(r) && r.likelihood === l && r.impact === i);

            const critical = crit.length ? `<section class="notice danger">
                <div><strong>${crit.length} critical risk${crit.length > 1 ? 's are' : ' is'} still open.</strong>
                <p class="small">These are reported separately from the score and must be addressed in the final recommendation.</p>
                <ul class="plain">${crit.map((r) => `<li>${U.esc(r.description)} <span class="muted">— ${C.memberName(a, r.owner)}, ${U.esc(r.status.toLowerCase())}</span></li>`).join('')}</ul></div>
              </section>` : '';

            const matrix = `<details class="panel quiet">
                <summary>Likelihood × impact overview</summary>
                <div class="heatmap"><div class="hm-corner">Likelihood ↓ / Impact →</div>${levels.slice().reverse().map((i) => `<div class="hm-head">${i}</div>`).join('')}
                ${levels.map((l) => `<div class="hm-head">${l}</div>${levels.slice().reverse().map((i) => { const n = cell(l, i); const sev = S.riskRating({ likelihood: l, impact: i }); return `<div class="hm-cell ${sev.toLowerCase()}">${n.length ? `<strong>${n.length}</strong>` : ''}</div>`; }).join('')}`).join('')}</div>
                <p class="note">Rating = likelihood × impact. Open and mitigating risks only.</p>
              </details>`;

            const table = `<section class="panel">
                <div class="panel-head"><h2>Risk register</h2>
                <div class="button-row"><div class="segmented-small">${[['all', 'All'], ['unresolved', 'Open'], ['critical', 'Critical']].map(([k, l]) => `<button class="${f === k ? 'active' : ''}" data-action="risk-filter" data-filter="${k}">${l}</button>`).join('')}</div>
                <button class="button primary small" data-action="add-risk" ${app.user ? '' : 'disabled'}>Add risk</button></div></div>
                <div class="table-wrap"><table><thead><tr><th>Risk</th><th>Rating</th><th>Owner</th><th>Status</th><th></th></tr></thead><tbody>
                ${list.map((r) => `<tr class="${r.critical && S.riskUnresolved(r) ? 'critical-row' : ''}">
                  <td><button class="link-plain" data-action="edit-risk" data-id="${U.esc(r.id)}" ${app.user ? '' : 'disabled'}><strong>${U.esc(r.description)}</strong></button>
                    <div class="muted small">${U.esc((M.dimension(r.dimension) || {}).name || r.dimension)}${r.critical ? ' · <span class="neg">critical</span>' : ''}</div>
                    ${r.mitigation ? `<div class="small">Mitigation: ${U.esc(r.mitigation)}</div>` : ''}</td>
                  <td>${C.riskChip(S.riskRating(r))}</td>
                  <td>${C.memberName(a, r.owner)}</td>
                  <td><select data-risk-status="${U.esc(r.id)}" ${app.user ? '' : 'disabled'}>${C.options(M.riskStatuses, r.status)}</select></td>
                  <td class="actions-cell"><button class="icon-button" data-action="delete-risk" data-id="${U.esc(r.id)}" title="Delete" aria-label="Delete" ${app.user ? '' : 'disabled'}>×</button></td>
                </tr>`).join('')}</tbody></table></div>
                ${list.length ? '' : C.empty(a.risks.length ? 'No risks match the filter.' : 'No risks have been added.')}
              </section>`;

            return `${critical}${table}${matrix}`;
        },
        after(app, root) {
            U.$$('[data-risk-status]', root).forEach((sel) => sel.addEventListener('change', () => {
                const r = app.a.risks.find((x) => x.id === sel.dataset.riskStatus);
                if (!r) return;
                app.upsertRisk({ ...r, status: sel.value }, r);
            }));
        },
        actions: {
            'add-risk'(app) { C.riskDialog(app); },
            'edit-risk'(app, el) { const r = app.a.risks.find((x) => x.id === el.dataset.id); if (r) C.riskDialog(app, r); },
            'delete-risk'(app, el) { app.deleteRisk(el.dataset.id); },
            'risk-filter'(app, el) { app.ui.riskFilter = el.dataset.filter; app.render({ keepScroll: true }); }
        }
    };
})(window.RSA);
