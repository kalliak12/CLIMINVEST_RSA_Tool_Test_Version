/* Reusable UI fragments, modal and dialogs. */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;
    const W = RSA.Workflow;

    const C = {};

    C.statusBadge = (status) => `<span class="status s-${U.slug(status)}"><i aria-hidden="true"></i>${U.esc(status)}</span>`;

    C.prov = (kind, title = '') => {
        const map = { pdm: [RSA.Edition && RSA.Edition.test ? 'Project data' : 'PDM', 'prov-pdm'], human: ['Human Assessor', 'prov-human'], ai: ['AI Suggestion', 'prov-ai'], 'ai-assisted': ['AI-assisted draft', 'prov-ai'] };
        const [label, cls] = map[kind] || map.human;
        return `<span class="prov ${cls}" title="${U.esc(title || label)}">${label}</span>`;
    };

    C.bandChip = (score) => {
        const b = M.bandFor(score);
        return b ? `<span class="band-chip ${b.cls}">${U.esc(b.label)}</span>` : '<span class="band-chip none">Not scored</span>';
    };

    C.bar = (score, cls = '') => `<div class="bar ${cls}"><span style="width:${score === null || score === undefined ? 0 : U.clamp(score, 0, 100)}%" class="${(M.bandFor(score) || {}).cls || ''}"></span></div>`;

    C.riskChip = (level) => `<span class="risk-chip ${String(level).toLowerCase()}">${U.esc(level)}</span>`;

    C.memberOptions = (a, selected, opts = {}) => {
        const list = (a.team || []).filter(opts.filter || (() => true));
        return `${opts.empty !== false ? `<option value="">${U.esc(opts.emptyLabel || 'Unassigned')}</option>` : ''}${list.map((t) => `<option value="${U.esc(t.id)}" ${t.id === selected ? 'selected' : ''}>${U.esc(t.name)} — ${U.esc((M.roles[t.role] || {}).label || t.role)}</option>`).join('')}`;
    };

    C.options = (values, selected, emptyLabel) => `${emptyLabel !== undefined ? `<option value="">${U.esc(emptyLabel)}</option>` : ''}${values.map((v) => {
        const value = typeof v === 'object' ? v.value : v; const label = typeof v === 'object' ? v.label : v;
        return `<option value="${U.esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${U.esc(label)}</option>`;
    }).join('')}`;

    C.dimensionOptions = (selected) => M.dimensions.map((d) => `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${d.id}: ${U.esc(d.name)}</option>`).join('');

    C.metricChips = (ids, action = 'goto-metric') => (ids || []).map((id) => `<button type="button" class="chip" data-action="${action}" data-metric="${U.esc(id)}" title="${U.esc((M.metric(id) || {}).name || '')}">${U.esc(id)}</button>`).join(' ');

    C.empty = (text) => `<p class="empty-state">${U.esc(text)}</p>`;

    C.kpi = (label, value, detail, opts = {}) => `<article class="kpi-card ${opts.cls || ''}" ${opts.action ? `data-action="${opts.action}" data-view="${opts.view || ''}" role="button" tabindex="0"` : ''}>
        <span>${U.esc(label)}</span><strong ${opts.live ? `data-live="${opts.live}"` : ''}>${value}</strong><small>${detail}</small></article>`;

    /* ---------- Modal ---------- */
    let modalSubmit = null;
    C.modal = {
        open({ title, body, submitLabel = 'Save', onSubmit, wide = false, hideSubmit = false, onOpen }) {
            const dlg = document.getElementById('modal');
            dlg.classList.toggle('wide', !!wide);
            dlg.innerHTML = `<form id="modalForm" novalidate>
                <div class="dialog-header"><h2>${U.esc(title)}</h2><button type="button" class="icon-button" data-close aria-label="Close">×</button></div>
                <div class="dialog-body">${body}</div>
                <p class="form-error" id="modalError" hidden></p>
                <div class="dialog-actions"><button type="button" class="button secondary" data-close>${hideSubmit ? 'Close' : 'Cancel'}</button>${hideSubmit ? '' : `<button type="submit" class="button primary">${U.esc(submitLabel)}</button>`}</div>
            </form>`;
            modalSubmit = onSubmit;
            U.$$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => C.modal.close()));
            U.$('#modalForm', dlg).addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!modalSubmit) { C.modal.close(); return; }
                const form = e.currentTarget;
                const required = U.$$('[required]', form).find((el) => !String(el.value || '').trim());
                if (required) { C.modal.error(`Please complete: ${required.dataset.label || required.name}`); required.focus(); return; }
                const result = await modalSubmit(form, new FormData(form));
                if (typeof result === 'string') C.modal.error(result);
                else if (result !== false) C.modal.close();
            });
            if (!dlg.open) dlg.showModal();
            if (onOpen) onOpen(dlg);
            const first = U.$('input, select, textarea', U.$('.dialog-body', dlg));
            if (first) first.focus();
        },
        error(msg) { const el = document.getElementById('modalError'); if (el) { el.textContent = msg; el.hidden = false; } },
        close() { const dlg = document.getElementById('modal'); if (dlg.open) dlg.close(); modalSubmit = null; }
    };

    C.promptText = (title, label, placeholder = '') => new Promise((resolve) => {
        let done = false;
        C.modal.open({
            title, submitLabel: 'Confirm',
            body: `<label>${U.esc(label)}<textarea name="text" required data-label="${U.esc(label)}" placeholder="${U.esc(placeholder)}"></textarea></label>`,
            onSubmit: (form, fd) => { done = true; resolve(String(fd.get('text')).trim()); return true; }
        });
        document.getElementById('modal').addEventListener('close', () => { if (!done) resolve(null); }, { once: true });
    });

    C.confirm = (title, message, confirmLabel = 'Confirm') => new Promise((resolve) => {
        let done = false;
        C.modal.open({ title, submitLabel: confirmLabel, body: `<p>${message}</p>`, onSubmit: () => { done = true; resolve(true); return true; } });
        document.getElementById('modal').addEventListener('close', () => { if (!done) resolve(false); }, { once: true });
    });

    /* ---------- Evidence dialog ---------- */
    const MAX_TEXT = 200 * 1024;
    const readAttachment = (file) => new Promise((resolve) => {
        if (!file) { resolve(null); return; }
        const meta = { name: file.name, size: file.size, type: file.type || 'unknown', text: '' };
        const textual = /^text\//.test(file.type) || /\.(txt|md|csv|json|tsv|xml|html?)$/i.test(file.name);
        if (!textual) { resolve(meta); return; }
        const reader = new FileReader();
        reader.onload = () => { meta.text = String(reader.result || '').slice(0, MAX_TEXT); resolve(meta); };
        reader.onerror = () => resolve(meta);
        reader.readAsText(file);
    });

    C.readAttachment = readAttachment;

    C.evidenceDialog = (app, existing = null, preset = {}) => {
        const a = app.a;
        const e = existing || { title: '', sourceType: 'Project document', provider: '', date: U.today(), url: '', reliability: '', assumptions: '', notes: '', metricIds: preset.metricIds || [], provenance: 'human' };
        const metricBoxes = M.dimensions.map((d) => `<fieldset class="metric-checks"><legend>${d.id} ${U.esc(d.short)}</legend>${d.metrics.map((m) => `<label class="check"><input type="checkbox" name="metricIds" value="${m.id}" ${e.metricIds.includes(m.id) ? 'checked' : ''}/> ${m.id} ${U.esc(m.name)}</label>`).join('')}</fieldset>`).join('');
        C.modal.open({
            title: existing ? `Edit evidence ${existing.id}` : 'Add evidence', wide: true, submitLabel: existing ? 'Save evidence' : 'Add evidence',
            body: `<div class="form-grid two">
                <label class="span-2">Source / document<input name="title" required data-label="Source / document" value="${U.esc(e.title)}" /></label>
                <label>Source type<select name="sourceType">${C.options(M.evidenceSourceTypes, e.sourceType)}</select></label>
                <label>Provider<input name="provider" value="${U.esc(e.provider)}" /></label>
                <label>Date<input type="date" name="date" value="${U.esc(e.date)}" /></label>
                <label>Confidence / reliability<select name="reliability">${C.options(M.reliabilityLevels, e.reliability, 'Select')}</select></label>
                <label class="span-2">Link (URL or document reference)<input name="url" value="${U.esc(e.url)}" placeholder="https://… or internal reference" /></label>
                <label class="span-2">Assumptions<textarea name="assumptions">${U.esc(e.assumptions)}</textarea></label>
                <label class="span-2">Notes<textarea name="notes">${U.esc(e.notes)}</textarea></label>
                <label class="span-2">Attach file <small class="muted">(text-based files are indexed for the AI assistant; other files are recorded by name)</small><input type="file" name="file" />${e.attachment ? `<small>Current: ${U.esc(e.attachment.name)} (${U.fmtNum(e.attachment.size / 1024, 1)} KB)</small>` : ''}</label>
              </div>
              <p class="field-title">Linked metrics</p><div class="metric-check-grid">${metricBoxes}</div>`,
            onSubmit: async (form, fd) => {
                const file = fd.get('file');
                const attachment = file && file.size ? await readAttachment(file) : (existing ? existing.attachment : null);
                const metricIds = fd.getAll('metricIds');
                const record = {
                    ...(existing || {}),
                    id: existing ? existing.id : `EV-${String(a.evidence.length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 5)}`,
                    title: String(fd.get('title')).trim(), sourceType: fd.get('sourceType'), provider: String(fd.get('provider')).trim(), date: fd.get('date'),
                    url: String(fd.get('url')).trim(), reliability: fd.get('reliability'), assumptions: String(fd.get('assumptions')).trim(), notes: String(fd.get('notes')).trim(),
                    metricIds, attachment: attachment || null,
                    provenance: existing ? existing.provenance : (preset.provenance || 'human'),
                    createdBy: existing ? existing.createdBy : app.user && app.user.id, createdAt: existing ? existing.createdAt : U.nowIso()
                };
                app.upsertEvidence(record, existing);
                return true;
            }
        });
    };

    /* ---------- Risk dialog ---------- */
    C.riskDialog = (app, existing = null) => {
        const a = app.a;
        const r = existing || { description: '', dimension: 'D1', likelihood: 'Medium', impact: 'Medium', mitigation: '', owner: '', status: 'Open', critical: false };
        C.modal.open({
            title: existing ? `Edit risk ${existing.id}` : 'Add risk', submitLabel: existing ? 'Save risk' : 'Add risk',
            body: `<label>Description<textarea name="description" required data-label="Description">${U.esc(r.description)}</textarea></label>
              <div class="form-grid two">
                <label>Dimension<select name="dimension">${C.dimensionOptions(r.dimension)}</select></label>
                <label>Owner<select name="owner">${C.memberOptions(a, r.owner)}</select></label>
                <label>Likelihood<select name="likelihood">${C.options(M.riskLevels, r.likelihood)}</select></label>
                <label>Impact<select name="impact">${C.options(M.riskLevels, r.impact)}</select></label>
                <label>Status<select name="status">${C.options(M.riskStatuses, r.status)}</select></label>
                <label class="check-inline"><input type="checkbox" name="critical" ${r.critical ? 'checked' : ''}/> Critical risk (reported separately from the RSS)</label>
              </div>
              <label>Mitigation<textarea name="mitigation">${U.esc(r.mitigation)}</textarea></label>`,
            onSubmit: (form, fd) => {
                app.upsertRisk({
                    ...(existing || {}),
                    id: existing ? existing.id : `RK-${String(a.risks.length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 4)}`,
                    description: String(fd.get('description')).trim(), dimension: fd.get('dimension'), likelihood: fd.get('likelihood'), impact: fd.get('impact'),
                    mitigation: String(fd.get('mitigation')).trim(), owner: fd.get('owner'), status: fd.get('status'), critical: fd.get('critical') === 'on',
                    createdBy: existing ? existing.createdBy : app.user && app.user.id, createdAt: existing ? existing.createdAt : U.nowIso()
                }, existing);
                return true;
            }
        });
    };

    /* ---------- Team member dialog ---------- */
    C.memberDialog = (app, existing = null) => {
        const t = existing || { name: '', organisation: '', role: 'assessor', expertise: '', email: '', dimensions: [] };
        C.modal.open({
            title: existing ? `Edit ${existing.name}` : 'Add team member', submitLabel: existing ? 'Save' : 'Add member',
            body: `<div class="form-grid two">
                <label>Name<input name="name" required data-label="Name" value="${U.esc(t.name)}" /></label>
                <label>Organisation<input name="organisation" value="${U.esc(t.organisation)}" /></label>
                <label>Role<select name="role">${Object.entries(M.roles).map(([k, v]) => `<option value="${k}" ${t.role === k ? 'selected' : ''}>${U.esc(v.label)}</option>`).join('')}</select></label>
                <label>Email<input name="email" type="email" value="${U.esc(t.email)}" /></label>
                <label class="span-2">Expertise<input name="expertise" value="${U.esc(t.expertise)}" /></label>
              </div>
              <p class="field-title">Dimension assignment</p>
              <div class="chip-checks">${M.dimensions.map((d) => `<label class="check"><input type="checkbox" name="dimensions" value="${d.id}" ${t.dimensions.includes(d.id) ? 'checked' : ''}/> ${d.id} ${U.esc(d.short)}</label>`).join('')}</div>`,
            onSubmit: (form, fd) => {
                app.upsertMember({
                    ...(existing || {}), id: existing ? existing.id : U.uid('usr'),
                    name: String(fd.get('name')).trim(), organisation: String(fd.get('organisation')).trim(), role: fd.get('role'),
                    email: String(fd.get('email')).trim(), expertise: String(fd.get('expertise')).trim(), dimensions: fd.getAll('dimensions')
                }, existing);
                return true;
            }
        });
    };

    C.memberName = (a, id) => U.esc(W.memberName(a, id));

    RSA.C = C;
})(window.RSA);
