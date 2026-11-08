/* Level 1 rapid screening (five binary questions, D4.1 §3.2). */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const W = RSA.Workflow;

    const hintValue = (v) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v));

    RSA.Views = RSA.Views || {};
    RSA.Views.screening = {
        render(app, calc) {
            const a = app.a; const user = app.user;
            const canAnswer = !!user && user.role !== 'reviewer' && !a.decision.finalised;
            const src = RSA.Data.effective(a, 'source'); const site = RSA.Data.effective(a, 'site');
            const d = calc.screening;
            const confirmed = a.screening.confirmedBy;

            return `<div class="panel">
                <div class="panel-head"><div><h2>Rapid screening</h2></div><span class="tag">5 binary questions</span></div>
                <p class="muted">Use this initial gate to decide whether the solution is worth a detailed Level 2 assessment. PDM context is shown for each question; the answer is a human judgement.</p>
                <div class="screening-list">${M.screeningQuestions.map((q, i) => {
                    const ans = a.screening.answers[i];
                    return `<div class="screening-item">
                        <div><p>${i + 1}. ${U.esc(q.text)}</p>
                          ${src || site ? `<p class="pdm-hint">${C.prov('pdm')} ${q.pdmHint.map((p) => `${U.esc(M.fieldLabel(p))}: <strong>${U.esc(hintValue(src && U.get(src, p)))}</strong> → <strong>${U.esc(hintValue(site && U.get(site, p)))}</strong>`).join(' · ')}</p>` : ''}
                          <textarea class="compact-text" data-field="screening|answers|${i}|note" data-audit="screening note" placeholder="Justification / note" ${canAnswer ? '' : 'disabled'}>${U.esc(ans.note)}</textarea>
                        </div>
                        <div class="segmented" role="group" aria-label="Answer to question ${i + 1}">
                          ${['yes', 'uncertain', 'no'].map((v) => `<button type="button" data-action="screen" data-index="${i}" data-value="${v}" class="${ans.value === v ? `selected ${v}` : ''}" ${canAnswer ? '' : 'disabled'}>${v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Uncertain'}</button>`).join('')}
                        </div>
                      </div>`;
                }).join('')}</div>
                <div class="screening-result ${d.cls}">
                  <div><span>Preliminary guidance</span><strong>${U.esc(d.label)}</strong></div>
                  <p>${U.esc(d.note)}</p>
                  <div class="confirm-box">${confirmed ? `<span>Confirmed by <strong>${C.memberName(a, confirmed)}</strong><br><small>${U.fmtDateTime(a.screening.confirmedAt)}</small></span>`
                    : d.label !== 'Incomplete' && user && user.role === 'lead' ? '<button class="button primary" data-action="confirm-screening">Confirm screening outcome</button>' : '<span class="muted">Awaiting confirmation by the Lead Assessor</span>'}</div>
                </div>
                <p class="note">Decision rule: all Yes = GO; any No = NO-GO; otherwise = MAYBE. This is a preliminary result. Changing an answer after confirmation clears the confirmation.</p>
              </div>`;
        },
        actions: {
            screen(app, el) {
                const a = app.a; const i = Number(el.dataset.index);
                const from = a.screening.answers[i].value;
                const to = from === el.dataset.value ? '' : el.dataset.value;
                a.screening.answers[i].value = to;
                app.log('Screening answer', 'screening', M.screeningQuestions[i].id, { field: 'answer', from, to });
                if (a.screening.confirmedBy) { a.screening.confirmedBy = null; a.screening.confirmedAt = null; app.log('Screening confirmation cleared', 'screening', 'L1', { detail: 'Answer changed after confirmation' }); }
                app.save(true); app.render({ keepScroll: true });
            },
            'confirm-screening'(app) {
                const a = app.a; const d = RSA.Scoring.screeningDecision(a.screening.answers);
                a.screening.confirmedBy = app.user.id; a.screening.confirmedAt = U.nowIso();
                app.log('Screening confirmed', 'screening', 'L1', { to: d.label });
                app.save(true); app.render({ keepScroll: true });
            }
        }
    };
})(window.RSA);
