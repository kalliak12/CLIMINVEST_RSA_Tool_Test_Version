/* Assessment Team view: members, roles, dimension assignment and metric assessor/reviewer assignment. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const W = RSA.Workflow;

    RSA.Views = RSA.Views || {};
    RSA.Views.team = {
        render(app, calc) {
            const a = app.a; const user = app.user;
            const canManage = W.canManageTeam(user);
            const st = W.assessmentStatus(a, calc);
            const reviewers = (t) => t.role === 'reviewer' || t.role === 'lead';

            const members = `<div class="panel">
                <div class="panel-head"><div><h2>Team members & roles</h2></div>
                  <div class="button-row"><span class="badge ${st.cls}">Assessment: ${U.esc(st.label)}</span>${canManage ? '<button class="button primary small" data-action="add-member">Add member</button>' : ''}</div></div>
                ${canManage ? '' : '<p class="alert info">Only the Lead Assessor can change the team and assignments. Switch "Acting as" in the top bar to act as another member.</p>'}
                <div class="team-grid">${a.team.map((t) => {
                    const mine = calc.metrics.filter((x) => x.st.assessorId === t.id);
                    const rev = calc.metrics.filter((x) => x.st.reviewerId === t.id);
                    return `<article class="member-card ${t.id === a.currentUserId ? 'current' : ''}">
                        <div class="member-head"><div class="avatar">${U.esc(t.name.split(' ').map((p) => p[0]).join('').slice(0, 2))}</div>
                          <div><strong>${U.esc(t.name)}</strong><br><small class="muted">${U.esc(t.organisation || '—')}</small></div>
                          <span class="badge role-${t.role}">${U.esc((M.roles[t.role] || {}).label)}</span></div>
                        <p class="small">${U.esc(t.expertise || '')}</p>
                        <p class="small">Dimensions: ${t.dimensions.length ? t.dimensions.map((d) => `<span class="chip static">${d}</span>`).join(' ') : '<span class="muted">none</span>'}</p>
                        <p class="small muted">Assessor of ${mine.length} metric(s) · reviewer of ${rev.length}</p>
                        <div class="button-row">${t.id === a.currentUserId ? '<span class="badge info">Acting as</span>' : `<button class="button secondary small" data-action="act-as" data-id="${t.id}">Act as</button>`}
                        ${canManage ? `<button class="button secondary small" data-action="edit-member" data-id="${t.id}">Edit</button><button class="button danger-outline small" data-action="remove-member" data-id="${t.id}">Remove</button>` : ''}</div>
                      </article>`;
                }).join('')}</div>
                <p class="note">Roles: <strong>Lead Assessor</strong> coordinates, may edit all draft metrics, approves and finalises. <strong>Assessors / Domain Experts</strong> score their assigned metrics. <strong>Reviewer / Validator</strong> reviews, agrees final scores, approves and may finalise. Four-eyes rule: nobody reviews or approves a metric they assessed.</p>
              </div>`;

            const assign = `<div class="panel">
                <div class="panel-head"><div><h2>Metric assignments</h2></div>
                ${canManage ? '<button class="button secondary small" data-action="auto-assign">Auto-assign from dimensions</button>' : ''}</div>
                <div class="table-wrap"><table class="compact"><thead><tr><th>Metric</th><th>Status</th><th>Assessor</th><th>Reviewer</th></tr></thead><tbody>
                ${M.dimensions.map((d) => `<tr class="group-row"><td colspan="4">${d.id} ${U.esc(d.name)} · ${Math.round(d.weight * 100)}%</td></tr>
                  ${d.metrics.map((m) => {
                    const s = a.metrics[m.id];
                    const locked = !canManage || s.status === 'Approved';
                    return `<tr><td><button class="link-button" data-action="goto-metric" data-metric="${m.id}">${m.id} ${U.esc(m.name)}</button></td><td>${C.statusBadge(s.status)}</td>
                      <td><select data-field="metrics|${m.id}|assessorId" data-audit="assessor" data-rerender="1" ${locked ? 'disabled' : ''}>${C.memberOptions(a, s.assessorId)}</select></td>
                      <td><select data-field="metrics|${m.id}|reviewerId" data-audit="reviewer" data-rerender="1" ${locked ? 'disabled' : ''}>${C.memberOptions(a, s.reviewerId, { filter: reviewers })}</select></td></tr>`;
                }).join('')}`).join('')}
                </tbody></table></div>
              </div>`;

            return members + assign;
        },

        actions: {
            'add-member'(app) { C.memberDialog(app); },
            'edit-member'(app, el) { C.memberDialog(app, app.a.team.find((t) => t.id === el.dataset.id)); },
            'remove-member'(app, el) { app.removeMember(el.dataset.id); },
            'act-as'(app, el) { app.a.currentUserId = el.dataset.id; app.save(false); app.render({ keepScroll: true }); U.toast(`Now acting as ${W.memberName(app.a, el.dataset.id)}.`); },
            'auto-assign'(app) {
                const a = app.a;
                const changes = app.autoAssign(a);
                const moved = changes.filter((c) => c.field === 'assessor');
                const name = (id) => (id ? W.memberName(a, id) : 'nobody');
                changes.forEach((c) => app.log(c.field === 'assessor' ? 'Assessor changed' : 'Reviewer changed', 'metric', c.metricId, { field: c.field, from: name(c.from), to: name(c.to), detail: 'Auto-assign from dimensions' }));
                app.save(true); app.render({ keepScroll: true });
                U.toast(changes.length
                    ? `${moved.length} metric(s) assigned${moved.length ? `: ${moved.map((c) => `${c.metricId} → ${name(c.to)}`).join(', ')}` : ''}${changes.length > moved.length ? `; ${changes.length - moved.length} reviewer(s) set` : ''}. Submitted, reviewed and approved metrics were not moved.`
                    : 'Assignments already match the ticked dimensions.', 'success', 8000);
                if (changes.noReviewer) U.toast(`${changes.noReviewer} metric(s) have no possible reviewer (the lead scored them and there is no Reviewer in the team). Add a Reviewer and run Auto-assign again.`, 'warning', 9000);
            }
        }
    };
})(window.RSA);
