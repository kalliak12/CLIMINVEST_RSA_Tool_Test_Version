/* AI Assessment Assistant chat panel. */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C;

    const P = {
        busy: false,
        init(app) {
            const panel = U.$('#aiPanel');
            U.$('#aiClose').addEventListener('click', () => P.close());
            U.$('#aiQuick').innerHTML = RSA.AI.quickPrompts.map((q) => `<button type="button" class="chip" data-ai-prompt="${U.esc(q)}">${U.esc(q)}</button>`).join('');
            U.$('#aiMetric').innerHTML = `<option value="">Whole assessment</option>${M.allMetrics().map((m) => `<option value="${m.id}">${m.id} ${U.esc(m.name)}</option>`).join('')}`;
            panel.addEventListener('click', (e) => {
                const q = e.target.closest('[data-ai-prompt]');
                if (q) { P.ask(app, q.dataset.aiPrompt); return; }
                const act = e.target.closest('[data-ai-action]');
                if (act) P.runAction(app, act);
                const clear = e.target.closest('#aiClear');
                if (clear) { app.a.aiLog = []; app.save(false); P.renderLog(app); }
            });
            U.$('#aiForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const input = U.$('#aiInput');
                const q = input.value.trim();
                if (!q) return;
                input.value = '';
                P.ask(app, q);
            });
            U.$('#aiFile').addEventListener('change', (e) => { P.attach(app, [...e.target.files]); e.target.value = ''; });
            panel.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); panel.classList.add('dragging'); } });
            panel.addEventListener('dragleave', (e) => { if (!panel.contains(e.relatedTarget)) panel.classList.remove('dragging'); });
            panel.addEventListener('drop', (e) => { e.preventDefault(); panel.classList.remove('dragging'); if (e.dataTransfer && e.dataTransfer.files.length) P.attach(app, [...e.dataTransfer.files]); });
            U.$('#aiInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); U.$('#aiForm').requestSubmit(); }
            });
        },
        isOpen() { return document.body.classList.contains('ai-open'); },
        toggle(app) { if (P.isOpen()) P.close(); else P.open(app); },
        open(app, prompt, metricId) {
            document.body.classList.add('ai-open');
            U.$('#aiPanel').setAttribute('aria-hidden', 'false');
            U.$('#aiToggle').classList.add('active');
            if (metricId !== undefined) U.$('#aiMetric').value = metricId || '';
            P.renderLog(app);
            if (prompt) P.ask(app, prompt);
            else U.$('#aiInput').focus();
        },
        close() {
            document.body.classList.remove('ai-open');
            U.$('#aiPanel').setAttribute('aria-hidden', 'true');
            U.$('#aiToggle').classList.remove('active');
        },
        refreshContext(app) {
            if (!app.a) return;
            const s = app.settings.ai;
            U.$('#aiProvider').textContent = s.provider === 'remote' && s.endpoint ? 'Remote AI endpoint' : 'Local analysis engine';
            if (P.isOpen()) P.renderLog(app);
        },
        renderLog(app) {
            const log = app.a.aiLog || [];
            const el = U.$('#aiLog');
            el.innerHTML = log.length ? log.map((m) => m.role === 'user'
                ? `<div class="msg user"><div class="bubble">${U.nl2br(m.text)}</div><small>${U.esc(m.userName || '')} · ${U.fmtDateTime(m.at)}${m.metricId ? ` · ${U.esc(m.metricId)}` : ''}</small></div>`
                : `<div class="msg ai"><div class="bubble">${m.html}
                    ${(m.actions || []).length ? `<div class="ai-actions">${m.actions.map((a, i) => { const done = a.type === 'importPdmDoc' && app.a.evidence.some((e) => e.pdmDocId === a.docId); return `<button type="button" class="button secondary small" data-ai-action="${U.esc(a.type)}" data-msg="${U.esc(m.id)}" data-idx="${i}" ${done ? 'disabled' : ''}>${done ? 'In Evidence Log ✓' : U.esc(a.label)}</button>`; }).join('')}</div>` : ''}
                    ${(m.sources || []).length ? `<div class="ai-sources"><strong>Based on</strong>${m.sources.map((s) => `<span class="src src-${U.slug(s.kind)}">${U.esc(s.kind)}</span> ${U.esc(s.label)}`).map((x) => `<div>${x}</div>`).join('')}</div>` : '<div class="ai-sources muted">No specific sources.</div>'}
                  </div><small>${U.fmtDateTime(m.at)}</small></div>`).join('')
                : `<div class="ai-empty"><p><strong>Ask about this assessment.</strong></p><p>Examples: "Explain 3.2", "Why would 1.2 be in the 50 band?", "Draft rationale for 2.2", "search documents for concession".</p><p class="muted">The assistant reads PDM snapshots, metrics, evidence (including attached text files) and risks, and always lists its sources.</p></div>`;
            el.scrollTop = el.scrollHeight;
        },
        async ask(app, question) {
            if (P.busy) return;
            if (!P.isOpen()) P.open(app);
            const a = app.a;
            const metricId = U.$('#aiMetric').value || null;
            const user = app.user;
            a.aiLog = a.aiLog || [];
            a.aiLog.push({ id: U.uid('ai'), role: 'user', text: question, metricId, at: U.nowIso(), userId: user && user.id, userName: user && user.name });
            P.renderLog(app);
            P.busy = true;
            const el = U.$('#aiLog');
            el.insertAdjacentHTML('beforeend', '<div class="msg ai typing"><div class="bubble">Analysing assessment data…</div></div>');
            el.scrollTop = el.scrollHeight;
            try {
                const res = await RSA.AI.ask(question, a, { metricId, settings: app.settings.ai, sources: app.pdmCache.sources, catalogue: app.catalogue });
                a.aiLog.push({ id: U.uid('ai'), role: 'ai', html: res.html, sources: res.sources || [], actions: res.actions || [], provider: res.provider, at: U.nowIso() });
            } catch (err) {
                a.aiLog.push({ id: U.uid('ai'), role: 'ai', html: `<p class="ai-warn">The assistant could not answer: ${U.esc(err.message)}</p>`, sources: [], actions: [], at: U.nowIso() });
            }
            if (a.aiLog.length > 80) a.aiLog = a.aiLog.slice(-80);
            P.busy = false;
            app.save(false);
            P.renderLog(app);
        },
        /* Files dropped or picked in the panel become evidence items (linked to the focused metric, if any). */
        async attach(app, files) {
            if (!files.length) return;
            if (!app.user) { U.toast('Choose a team member in "Acting as" first.', 'error'); return; }
            const a = app.a;
            const metricId = U.$('#aiMetric').value || null;
            a.aiLog = a.aiLog || [];
            for (const file of files) {
                const attachment = await RSA.C.readAttachment(file);
                const id = `EV-${String(a.evidence.length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 5)}`;
                app.upsertEvidence({
                    id, title: file.name.replace(/\.[^.]+$/, ''), sourceType: 'Project document', provider: '', date: U.today(), url: '', reliability: '',
                    assumptions: '', notes: 'Added from the Assistant panel. Rate its reliability and link it to metrics.', metricIds: metricId ? [metricId] : [],
                    attachment, provenance: 'human', createdBy: app.user.id, createdAt: U.nowIso()
                }, null);
                const readable = !!(attachment && attachment.text);
                a.aiLog.push({
                    id: U.uid('ai'), role: 'ai', provider: 'local', at: U.nowIso(), actions: [],
                    html: `<p>Added <strong>${U.esc(file.name)}</strong> to the Evidence log (${U.esc(id)})${metricId ? `, linked to metric ${U.esc(metricId)}` : ''}.</p>
                      <p>${readable ? 'Its text can now be searched, e.g. "search documents for …".' : 'This file type cannot be read here, so only its name is stored. Text files (txt, csv, md, json) are searchable.'}</p>
                      ${metricId ? '' : '<p class="muted">Open Evidence to link it to metrics and rate its reliability.</p>'}`,
                    sources: [{ kind: 'Evidence', label: `${id} ${file.name}` }]
                });
            }
            app.save(false);
            P.renderLog(app);
        },

        runAction(app, btn) {
            const msg = (app.a.aiLog || []).find((m) => m.id === btn.dataset.msg);
            const action = msg && msg.actions && msg.actions[Number(btn.dataset.idx)];
            if (!action) return;
            if (action.type === 'insertRationale') app.insertAiRationale(action.metricId, action.text);
            if (action.type === 'importPdmDoc') { app.importPdmDoc(action.docId); btn.disabled = true; btn.textContent = 'Added to Evidence Log'; }
        }
    };

    RSA.AIPanel = P;
})(window.RSA);
