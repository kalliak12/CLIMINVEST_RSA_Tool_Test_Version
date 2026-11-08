/* About & Methodology view, including integration settings (PDM adapter, AI provider). */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C;
    const D41_WEIGHTS = { D1: 25, D2: 20, D3: 25, D4: 15, D5: 15 };

    const excelPanel = () => {
        const files = RSA.ExcelProjects ? RSA.ExcelProjects.files() : [];
        const projects = RSA.ExcelProjects ? RSA.ExcelProjects.all() : [];
        const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
        return `<div class="excel-db">
            <div class="panel-head"><div><h3>Projects imported from Excel</h3>
              <p class="muted small">Every Excel file you import with <strong>Import Excel or JSON</strong> (menu) adds its "Source Project" / "Replication Site" sheets here, and they appear in the Projects lists marked "Excel". Importing a file again with changed values creates a new version, and assessments using it are told the data changed.</p></div></div>
            ${files.length ? `<div class="table-wrap"><table class="compact"><thead><tr><th>File</th><th>Projects</th><th>Loaded</th><th></th></tr></thead><tbody>
              ${files.map((f) => `<tr><td>${U.esc(f.name)}</td><td class="small">${f.projectIds.map((id) => byId[id] ? `${U.esc(byId[id].shortName)} <span class="muted">(${byId[id].roles[0] === 'source' ? 'source' : 'site'}, v${byId[id].version})</span>` : '').filter(Boolean).join('<br>')}</td><td class="small">${U.fmtDateTime(f.loadedAt)}</td>
                <td><button type="button" class="link-button small" data-action="remove-excel-file" data-file="${U.esc(f.name)}">Remove</button></td></tr>`).join('')}
            </tbody></table></div>` : '<p class="empty-inline">No Excel files loaded yet.</p>'}
          </div>`;
    };

    const testSettings = (app) => `<div class="panel">
                <div class="panel-head"><div><h2>Settings</h2><p class="muted small">Test version: projects come from the Excel files you import (menu → Import Excel or JSON). "Delete all data" in the menu removes all assessments and these imports.</p></div></div>
                ${excelPanel(app)}
              </div>`;
    const fullSettings = (app, s) => `              <div class="panel">
                <div class="panel-head"><div><h2>Settings</h2></div></div>
                <form id="settingsForm" class="form-grid">
                  <label>Project database<select name="pdmAdapter">
                    <option value="mock" ${s.pdm.adapter === 'mock' ? 'selected' : ''}>Demo projects (built in)</option>
                    <option value="climinvest" ${s.pdm.adapter === 'climinvest' ? 'selected' : ''}>CLIMINVEST project database (PDM)</option>
                    <option value="rest" ${s.pdm.adapter === 'rest' ? 'selected' : ''}>Other REST API</option></select></label>
                  <label>Address (API base URL)<input name="pdmBaseUrl" value="${U.esc(s.pdm.baseUrl || (s.pdm.adapter === 'climinvest' ? RSA.CliminvestPdmAdapter.DEFAULT_URL : ''))}" placeholder="${U.esc(RSA.CliminvestPdmAdapter.DEFAULT_URL)}" /></label>
                  <label>Your PDM token<input name="pdmToken" type="password" value="${U.esc(s.pdm.token)}" autocomplete="off" placeholder="${RSA.LocalConfig && RSA.LocalConfig.pdmToken ? 'Using the token from config.local.js' : 'Paste the token from the PDM Developers menu'}" /></label>
                  <label>AI provider<select name="aiProvider"><option value="local" ${s.ai.provider === 'local' ? 'selected' : ''}>Local analysis engine (offline)</option><option value="remote" ${s.ai.provider === 'remote' ? 'selected' : ''}>Remote AI endpoint</option></select></label>
                  <label>AI endpoint URL<input name="aiEndpoint" value="${U.esc(s.ai.endpoint)}" placeholder="https://ai-gateway.example.org/rsa-assistant" /></label>
                  <label>AI endpoint token<input name="aiToken" type="password" value="${U.esc(s.ai.token)}" autocomplete="off" /></label>
                  <div class="span-3 button-row"><button type="button" class="button primary small" data-action="save-settings">Save settings</button><button type="button" class="button secondary small" data-action="test-pdm">Test connection</button><span class="muted small">Now using: ${U.esc(RSA.PDM.adapterLabel)}</span></div>
                </form>
                <p class="note"><strong>Connecting to the CLIMINVEST project database:</strong> in the PDM, open the Developers menu → User token generation → Generate token, then paste it above, save and press Test connection. The token is kept only in this browser. Alternatively put it in the private file config.local.js on your computer (excluded from GitHub). Never publish or share the token; generating a new token replaces the old one. The connection reads projects only; sending results back is switched on once the PDM team agrees where RSA results are stored. Remote AI contract: POST { question, context, instructions } → { answer, sources[] }.</p>
                ${excelPanel(app)}
              </div>`;

    RSA.Views = RSA.Views || {};
    RSA.Views.about = {
        render(app) {
            const s = app.settings;
            const flow = [['projects', 'PDM / project database', 'Source & site data, snapshot'], ['assessment', 'RSA assessment', 'Level 1 screening, Level 2 metrics'], ['team', 'Team scoring & review', 'Draft → Submitted → Reviewed → Approved'],
                ['recommendations', 'Recommendations', 'Improvement actions, better matches'], ['report', 'Final report', 'Human recommendation'], ['projects', 'Sync to PDM', 'Approved results']];
            return `<div class="panel">
                <div class="panel-head"><div><h2>Replication Suitability Assessment</h2></div><span class="tag">${U.esc(M.basis)}</span></div>
                <p class="muted">The RSA provides an evidence-based mechanism for evaluating whether a proven climate adaptation/resilience solution can be transferred to a new location while maintaining or improving its bankability. It answers the question: <strong>"Should we replicate this solution here?"</strong></p>
                <div class="flow">${flow.map(([v, t, d], i) => `<button class="flow-step" data-action="nav" data-view="${v}"><span>${i + 1}</span><strong>${U.esc(t)}</strong><small>${U.esc(d)}</small></button>`).join('<i class="flow-arrow">→</i>')}</div>
              </div>

              <div class="panel rule-card">
                
                <ul class="rule-list">
                  <li><strong>The assessment team</strong> makes the judgement.</li>
                  <li><strong>PDM</strong> provides data ${C.prov('pdm')}.</li>
                  <li><strong>RSA</strong> structures the assessment and calculations.</li>
                  <li><strong>AI</strong> supports the assessors ${C.prov('ai')} — it never sets, approves or finalises scores.</li>
                  <li><strong>Reviewer / Lead Assessor</strong> approves the result ${C.prov('human')}.</li>
                </ul>
              </div>

              <div class="content-grid halves">
                <div class="panel">
                  <h2>Three-level approach</h2>
                  <div class="guide-box"><strong>Level 1 — Rapid screening (1–2 weeks)</strong><p>Five binary questions; preliminary GO / NO-GO / MAYBE.</p></div>
                  <div class="guide-box"><strong>Level 2 — Detailed assessment (2–3 months)</strong><p>Multidisciplinary team (6–10 people) scores 20 metrics across five dimensions with evidence, risk register and adaptation roadmap.</p></div>
                  <div class="guide-box"><strong>Level 3 — Pre-implementation validation (≈1 month)</strong><p>Only after a GO: validate assumptions, 3+ competitive quotes, stakeholder commitments, financing. Output: implementation readiness approval (outside this tool).</p></div>
                </div>
                <div class="panel">
                  <h2>Dimension weights</h2>
                  <table class="compact"><thead><tr><th>Dimension</th><th>Standard</th><th>This assessment</th></tr></thead><tbody>
                  ${M.dimensions.map((d) => `<tr><td>${d.id} ${U.esc(d.name)}</td><td>${D41_WEIGHTS[d.id]}%</td><td><strong>${Math.round(d.weight * 100)}%</strong></td></tr>`).join('')}</tbody></table>
                  <p class="note">${U.esc(M.weightsNote)} This assessment: ${U.esc(M.weightsLabel(M.weightsOf(app.a)))}. <button class="link-button" data-action="nav" data-view="projects">Change weights</button></p>
                </div>
              </div>

              <div class="panel">
                <h2>Dimensions and metrics</h2>
                <div class="metric-overview">${M.dimensions.map((d) => `<div><h4>${d.id} ${U.esc(d.name)} · ${Math.round(d.weight * 100)}%</h4><p class="small muted">${U.esc(d.purpose)}</p><ul>${d.metrics.map((m) => `<li><button class="link-button" data-action="goto-metric" data-metric="${m.id}">${m.id} ${U.esc(m.name)}</button> <small class="muted">— ${U.esc(m.description)}</small></li>`).join('')}</ul></div>`).join('')}</div>
              </div>

              <div class="content-grid halves">
                <div class="panel">
                  <h2>Scoring bands</h2>
                  <div class="band-list">${M.scoreBands.map((b) => `<span class="band-item ${b.cls}"><strong>${Math.round(b.min)}–${Math.floor(b.max)}</strong> ${b.label}</span>`).join('')}</div>
                  <p class="note">Confidence (assessor): Low 25 · Moderate 50 · High 75 · Verified 100. Evidence reliability uses the same scale.</p>
                </div>
                <div class="panel">
                  <h2>RSS interpretation</h2>
                  <table class="compact"><thead><tr><th>RSS</th><th>Guidance</th><th>Success</th><th>Contingency</th></tr></thead><tbody>
                  ${M.decisionBands.map((b, i) => `<tr><td>${b.min}–${i === 0 ? 100 : M.decisionBands[i - 1].min - 1}</td><td><strong>${U.esc(b.label)}</strong><br><small>${U.esc(b.suitability)}: ${U.esc(b.detail)}</small></td><td>${U.esc(b.success)}</td><td>${U.esc(b.contingency)}</td></tr>`).join('')}</tbody></table>
                  <p class="note">The RSS band is guidance only. It is presented next to evidence quality, confidence, critical risks and unresolved issues; an authorised human records the recommendation.</p>
                </div>
              </div>

              <div class="panel">
                <h2>Who does what</h2>
                <table class="compact"><thead><tr><th>Role</th><th>Edit draft metrics</th><th>Review / agree score</th><th>Approve metrics</th><th>Finalise & sync</th></tr></thead><tbody>
                ${Object.values(M.roles).map((r) => `<tr><td>${U.esc(r.label)}</td><td>${r.canEditAll ? 'All' : 'Assigned'}</td><td>${r.canReview ? 'Yes' : '—'}</td><td>${r.canApprove ? 'Yes' : '—'}</td><td>${r.canFinalise ? 'Yes' : '—'}</td></tr>`).join('')}</tbody></table>
                <p class="note">Statuses: Not started → Draft → Submitted → Reviewed → Approved. Nobody reviews or approves a metric they assessed. Every change is recorded in the audit trail with user and timestamp. Level 1 and scope: technology selection, detailed engineering, financial modelling, procurement and full due diligence remain outside the RSA.</p>
              </div>

              ${RSA.Edition && RSA.Edition.test ? testSettings(app) : fullSettings(app, s)}`;
        },
        actions: {
            async 'test-pdm'() {
                U.toast('Testing the connection…', 'info');
                try {
                    const fd = new FormData(U.$('#settingsForm'));
                    const kind = fd.get('pdmAdapter'); const url = String(fd.get('pdmBaseUrl')).trim(); const token = String(fd.get('pdmToken'));
                    if (kind === 'mock') { U.toast('Demo projects are built in — nothing to test.', 'info'); return; }
                    if (kind === 'climinvest' && !token && !(RSA.LocalConfig && RSA.LocalConfig.pdmToken)) { U.toast('Paste your PDM token first, or add it to config.local.js.', 'error'); return; }
                    const adapter = kind === 'climinvest' ? RSA.CliminvestPdmAdapter(url, token) : null;
                    const r = adapter ? await adapter.test() : await RSA.PDM.test();
                    U.toast(`Connected: ${r.projects} project${r.projects === 1 ? '' : 's'} visible${r.types ? `, ${r.types} data types` : ''}. Press Save settings to use this connection.`, 'success', 9000);
                } catch (err) { U.toast(`Connection failed: ${err.message}`, 'error', 12000); }
            },
            async 'remove-excel-file'(app, el) {
                const ok = await RSA.C.confirm('Remove Excel file', `Remove <strong>${U.esc(el.dataset.file)}</strong> and its projects from this browser? Assessments that already use them keep their copy of the data.`, 'Remove');
                if (!ok) return;
                RSA.ExcelProjects.removeFile(el.dataset.file);
                await app.loadPdmCatalogue();
                app.render({ keepScroll: true });
                U.toast('Excel file removed.', 'success');
            },
            'save-settings'(app) {
                const fd = new FormData(U.$('#settingsForm'));
                const s = app.settings;
                s.pdm = { adapter: fd.get('pdmAdapter'), baseUrl: String(fd.get('pdmBaseUrl')).trim(), token: String(fd.get('pdmToken')) };
                s.ai = { provider: fd.get('aiProvider'), endpoint: String(fd.get('aiEndpoint')).trim(), token: String(fd.get('aiToken')) };
                if (s.pdm.adapter === 'rest' && !s.pdm.baseUrl) { U.toast('Enter the API address or use the demo projects.', 'error'); return; }
                if (s.pdm.adapter === 'climinvest' && !s.pdm.baseUrl) s.pdm.baseUrl = RSA.CliminvestPdmAdapter.DEFAULT_URL;
                if (s.pdm.adapter === 'climinvest' && !s.pdm.token && !(RSA.LocalConfig && RSA.LocalConfig.pdmToken)) { U.toast('Paste your PDM token first (PDM → Developers menu → Generate token), or add it to config.local.js.', 'error'); return; }
                RSA.PDM.configure(s.pdm);
                app.save(true);
                app.pdmCache = { sources: [], sites: [], loaded: false };
                app.loadPdmCatalogue();
                app.render({ keepScroll: true });
                U.toast('Settings saved.', 'success');
            }
        }
    };
})(window.RSA);
