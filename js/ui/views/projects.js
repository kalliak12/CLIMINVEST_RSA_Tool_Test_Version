/* Projects / PDM view: pairing, prefill, snapshots, change detection and sync. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C; const W = RSA.Workflow;

    const fmtVal = (v, path) => {
        if (v === null || v === undefined || v === '') return '<span class="muted">—</span>';
        if (Array.isArray(v)) return v.length ? U.esc(v.join(', ')) : '<span class="muted">—</span>';
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        const unit = M.fieldUnit(path);
        if (typeof v === 'number') return `${U.fmtNum(v, v % 1 ? 2 : 0)}${unit ? ` <small class="muted">${U.esc(unit)}</small>` : ''}`;
        return U.esc(v);
    };

    const filterList = (list, q) => {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        return list.filter((p) => {
            const hay = [p.id, p.name, p.shortName, p.country, p.region, p.adaptationType, p.technical && p.technical.technologyFamily].join(' ').toLowerCase();
            return terms.every((t) => hay.includes(t));
        });
    };

    const listHtml = (app, side) => {
        const list = side === 'source' ? app.pdmCache.sources : app.pdmCache.sites;
        const selected = side === 'source' ? app.a.pdm.sourceId : app.a.pdm.siteId;
        if (!app.pdmCache.loaded) return '<p class="muted">Loading PDM projects…</p>';
        const dbError = app.pdmCache.error ? `<p class="alert danger small">Project database unavailable: ${U.esc(app.pdmCache.error)}${list.length ? ' — showing the projects imported from Excel.' : ''}</p>` : '';
        if (app.pdmCache.error && !list.length) return dbError;
        const items = filterList(list, app.search[side] || '');
        if (!items.length) return `${app.pdmCache.error ? `<p class="alert danger small">Project database unavailable: ${U.esc(app.pdmCache.error)}</p>` : ''}<p class="muted">No matching projects.</p>`;
        return dbError + items.map((p) => `<div class="pdm-result ${p.id === selected ? 'selected' : ''}">
            <div><strong>${U.esc(p.shortName)}</strong>${p.origin === 'excel' ? ' <span class="badge info">Excel</span>' : ''}<br><span class="muted small">${U.esc(p.adaptationType)} · ${U.esc(p.status)}</span></div>
            ${p.id === selected ? '<span class="selected-mark">Selected</span>' : `<button class="button secondary small" data-action="pick" data-side="${side}" data-id="${U.esc(p.id)}">Select</button>`}
          </div>`).join('');
    };

    const diffTable = (changes) => `<table class="compact"><thead><tr><th>Field</th><th>Snapshot value</th><th>Current PDM value</th></tr></thead><tbody>
        ${changes.map((c) => `<tr><td>${U.esc(M.pdmFieldLabels[c.path] ? M.fieldLabel(c.path) : c.path)}</td><td>${U.esc(String(c.from ?? '—')).slice(0, 160)}</td><td><strong>${U.esc(String(c.to ?? '—')).slice(0, 160)}</strong></td></tr>`).join('')}</tbody></table>`;

    const inputFor = (m, canEdit) => {
        const key = `${m.side}|${m.path}`; const v = RSA.Data.display(m.value); const dis = canEdit ? '' : 'disabled';
        if (m.spec.type === 'select') return `<select data-manual="${key}" ${dis}>${C.options(m.spec.options, v, 'Select…')}</select>`;
        if (m.spec.type === 'bool') return `<select data-manual="${key}" ${dis}>${C.options([{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], v, 'Select…')}</select>`;
        return `<input data-manual="${key}" ${m.spec.type === 'number' ? 'inputmode="decimal"' : ''} value="${U.esc(v)}" placeholder="${U.esc(m.spec.hint || (m.unit ? `in ${m.unit}` : 'Enter value'))}" ${dis} />`;
    };

    const fromFile = (a, m) => {
        const src = m.filled && a.pdm.manualSources && a.pdm.manualSources[m.side] && a.pdm.manualSources[m.side][m.path];
        return src ? ` · from ${U.esc(src.file)} › ${U.esc(src.sheet)}!${U.esc(src.cell)}` : '';
    };

    function weightsPanel(app, calc) {
        const a = app.a; const w = M.weightsOf(a); const preset = M.presetFor(w);
        const canEdit = !!app.user && app.user.role === 'lead' && !a.decision.finalised;
        const scores = Object.fromEntries(calc.dims.map((d) => [d.id, d.score]));
        const complete = calc.dims.every((d) => d.score !== null);
        const rssWith = (ww) => (complete ? M.dimensions.reduce((sum, d) => sum + scores[d.id] * ww[d.id] / 100, 0) : null);
        const lockNote = a.decision.finalised ? 'Locked: the final recommendation has been recorded.' : !canEdit ? 'Only the lead assessor can change the weights.' : 'Set them before scoring starts. Changes are recorded in the audit trail.';
        return `<section class="panel" id="weights">
            <div class="panel-head"><div><h2>Dimension weights</h2><p class="muted small">How much each dimension counts in the suitability score (RSS). ${lockNote}</p></div>
              <span class="badge ${preset ? 'success' : 'warning'}">${preset ? U.esc(preset.name) : 'Custom'}</span></div>
            <div class="weights-grid">
              ${M.dimensions.map((d) => `<label>${U.esc(d.short)}<span class="w-input"><input type="number" min="0" max="100" step="5" name="w-${d.id}" data-weight="${d.id}" value="${w[d.id]}" ${canEdit ? '' : 'disabled'} /><span>%</span></span></label>`).join('')}
              <div class="w-total"><span class="label">Total</span><strong id="weightsTotal">100%</strong></div>
            </div>
            ${canEdit ? `<div class="button-row"><button class="button primary small" data-action="apply-weights">Apply weights</button></div>` : ''}
            <h3 class="presets-title">Proposed combinations</h3>
            <div class="table-wrap"><table class="compact presets"><thead><tr><th>Weighting</th>${M.dimensions.map((d) => `<th class="num">${U.esc(d.short)}</th>`).join('')}<th>Use when</th><th class="num">RSS</th><th></th></tr></thead><tbody>
              ${M.weightPresets.map((p) => { const cur = preset && preset.id === p.id; const r = rssWith(p.weights); return `<tr class="${cur ? 'is-current' : ''}">
                <td><strong>${U.esc(p.name)}</strong>${cur ? ' <span class="muted small">(in use)</span>' : ''}</td>
                ${M.dimensions.map((d) => `<td class="num">${p.weights[d.id]}%</td>`).join('')}
                <td class="small">${U.esc(p.use)}</td>
                <td class="num">${r === null ? '—' : `<strong>${r.toFixed(1)}</strong>`}</td>
                <td>${canEdit && !cur ? `<button class="button secondary small" data-action="use-preset" data-preset="${p.id}">Use</button>` : ''}</td></tr>`; }).join('')}
            </tbody></table></div>
            <p class="note">RSS shows what this assessment would score with each weighting${complete ? '' : ' (available once every dimension has a score)'}. Metric and dimension scores do not change; only how they are combined.</p>
          </section>`;
    }

    function missingPanel(app) {
        const list = RSA.Data.missing(app.a);
        if (!list.length) return '';
        const open = list.filter((m) => !m.filled).length;
        const canEdit = !!app.user && !app.a.decision.finalised;
        const groups = [];
        list.forEach((m) => { const k = `${m.side}|${m.group}`; let g = groups.find((x) => x.k === k); if (!g) { g = { k, side: m.side, group: m.group, project: m.project, items: [] }; groups.push(g); } g.items.push(m); });
        return `<section class="panel missing-panel" id="missing-data">
            <div class="panel-head"><div><h2>${RSA.Edition && RSA.Edition.test ? 'Information missing from the project data' : 'Information missing from the project database'}</h2>
              <p class="muted small">${open ? `${open} of ${list.length} still empty.` : 'All filled in.'} Fill these in by hand, or with <strong>Add from a file</strong> (a simple table with the field names and values, e.g. the RSA_FILL-IN example files). Your entries are marked as added by the team${RSA.Edition && RSA.Edition.test ? '' : ' and are sent back with the results'}.</p></div>
              <div class="button-row"><span class="badge ${open ? 'warning' : 'success'}">${list.length - open}/${list.length} filled</span>${canEdit ? '<button class="button secondary small" data-action="import-data-file" title="Fill these from a spreadsheet: one row per value, with the field name and the value">Add from a file</button>' : ''}</div></div>
            ${groups.map((g) => `<div class="missing-group">
                <h3>${U.esc(g.group)} <span class="muted small">· ${g.side === 'site' ? 'replication site' : 'source project'}: ${U.esc(g.project)}</span></h3>
                ${g.items.map((m) => `<div class="missing-row ${m.filled ? 'filled' : ''}">
                    <div><strong>${U.esc(m.label)}</strong>${m.unit ? ` <span class="muted small">(${U.esc(m.unit)})</span>` : ''}
                      <div class="muted small">${m.metrics.length ? `Used by metric ${m.metrics.join(', ')}` : ''}${m.filled ? ` · ${C.prov('human')}` : ''}${fromFile(app.a, m)}</div></div>
                    ${inputFor(m, canEdit)}
                  </div>`).join('')}
              </div>`).join('')}
          </section>`;
    }

    /* Team-added values that replace a value the project database already has (not shown in the missing-data panel). */
    function overridesPanel(app) {
        const a = app.a; const manual = a.pdm.manual || {};
        const shown = new Set(RSA.Data.missing(a).map((m) => `${m.side}|${m.path}`));
        const rows = [];
        ['source', 'site'].forEach((side) => {
            const snap = a.pdm[side];
            if (!snap || snap.local) return;
            Object.entries(manual[side] || {}).forEach(([path, value]) => {
                if (shown.has(`${side}|${path}`)) return;
                rows.push({ side, path, value, pdm: U.get(snap.data, path), project: snap.data.shortName, src: a.pdm.manualSources && a.pdm.manualSources[side] && a.pdm.manualSources[side][path] });
            });
        });
        if (!rows.length) return '';
        const canEdit = !!app.user && !a.decision.finalised;
        return `<section class="panel" id="team-values">
            <div class="panel-head"><div><h2>${RSA.Edition && RSA.Edition.test ? 'Team values that replace the imported project data' : 'Team values that replace project database data'}</h2>
              <p class="muted small">The scores use these instead of the project database values. Remove any that were added by mistake.</p></div></div>
            <div class="table-wrap"><table class="compact"><thead><tr><th>Project</th><th>Field</th><th>Team value</th><th>Project database</th><th>Added from</th><th></th></tr></thead><tbody>
              ${rows.map((r) => `<tr><td class="small">${r.side === 'site' ? 'Replication site' : 'Source project'}<br><span class="muted">${U.esc(r.project)}</span></td>
                <td>${U.esc(M.fieldLabel(r.path))}${M.fieldUnit(r.path) ? ` <span class="muted small">(${U.esc(M.fieldUnit(r.path))})</span>` : ''}</td>
                <td><strong>${U.esc(RSA.Data.display(r.value))}</strong></td>
                <td>${U.esc(RSA.Data.display(r.pdm)) || '<span class="muted">empty</span>'}</td>
                <td class="small">${r.src ? `${U.esc(r.src.file)} › ${U.esc(r.src.sheet)}!${U.esc(r.src.cell)}` : 'Typed by the team'}</td>
                <td>${canEdit ? `<button class="button secondary small" data-action="remove-manual" data-key="${U.esc(`${r.side}|${r.path}`)}">Remove</button>` : ''}</td></tr>`).join('')}
            </tbody></table></div>
          </section>`;
    }

    RSA.Views = RSA.Views || {};
    RSA.Views.projects = {
        render(app, calc) {
            const a = app.a; const user = app.user;
            const src = RSA.Data.effective(a, 'source'); const site = RSA.Data.effective(a, 'site');
            const prov = (key) => (a.provenance[key] === 'pdm' ? C.prov('pdm') : '');

            const picker = (side, label) => `<div class="picker">
                <h3>${label}</h3>
                <input type="search" class="pdm-search" data-search="${side}" placeholder="Search name, country, technology…" value="${U.esc(app.search[side] || '')}" />
                <div class="pdm-results" data-results="${side}">${listHtml(app, side)}</div>
              </div>`;

            const pairing = `<section class="panel">
                <div class="panel-head"><div><h2>Project pair</h2>${RSA.Edition && RSA.Edition.test ? '<p class="muted small">Choose the proven project and the site where it would be replicated. The lists show the projects from the Excel files you imported (menu → Import Excel or JSON).</p>' : `<p class="muted small">Choose the proven project and the site where it would be replicated. Their data is copied from the project database (${U.esc(RSA.PDM.adapterId === 'mock' ? 'demo projects — connect the CLIMINVEST database under Methodology → Settings' : RSA.PDM.adapterLabel)}). If a project is not in the database, import an Excel file with its data (menu → Import Excel or JSON).</p>`}</div>
                  <div class="button-row"><button class="button secondary small" data-action="check-updates">Check for updates</button><button class="button secondary small" data-action="new-assessment">New assessment</button></div></div>
                <div class="cols even">${picker('source', 'Source project')}${picker('site', 'Replication site')}</div>
              </section>`;

            const pending = ['source', 'site'].filter((x) => (a.pdm.pendingChanges[x] || []).length).map((side) => {
                const snap = a.pdm[side]; const latest = a.pdm[`${side}Latest`] || {}; const key = `diff-${side}`;
                return `<section class="notice">
                    <div><strong>${U.esc(snap.data.shortName)} has been updated ${RSA.Edition && RSA.Edition.test ? 'by a newer Excel import' : 'in the project database'}.</strong>
                    <p class="small">${(a.pdm.pendingChanges[side] || []).length} field(s) changed since this assessment copied the data (${U.fmtDate(snap.lastUpdated)} → ${U.fmtDate(latest.lastUpdated)}). <button class="link-button" data-action="toggle-expand" data-key="${key}">${app.ui.expanded[key] ? 'Hide' : 'Show'} changes</button></p>
                    ${app.ui.expanded[key] ? diffTable(a.pdm.pendingChanges[side]) : ''}</div>
                    <button class="button primary small" data-action="accept-update" data-side="${side}">Use updated data</button>
                  </section>`;
            }).join('');

            const details = `<section class="panel">
                <div class="panel-head"><h2>Assessment details</h2></div>
                <div class="form-grid">
                  <label>Title<input data-field="title" data-audit="title" value="${U.esc(a.title)}" data-rerender="1" /></label>
                  <label>Adaptation type ${prov('adaptationType')}<select data-field="project|adaptationType" data-provenance="adaptationType" data-rerender="1">
                    ${C.options([...new Set([...(a.project.adaptationType ? [a.project.adaptationType] : []), 'Water–energy nexus / Renewable energy', 'Renewable energy', 'Building retrofit', 'Energy efficiency / Buildings', 'Water adaptation', 'Nature-based solution', 'Other climate adaptation'])], a.project.adaptationType, 'Select')}</select></label>
                  <label>Date<input type="date" data-field="project|assessmentDate" value="${U.esc(a.project.assessmentDate)}" /></label>
                  <label>Organisation ${prov('organisation')}<input data-field="project|organisation" data-provenance="organisation" data-rerender="1" value="${U.esc(a.project.organisation)}" /></label>
                  <label class="span-2">Scope ${prov('scope')}<input data-field="project|scope" data-provenance="scope" data-rerender="1" value="${U.esc(a.project.scope)}" /></label>
                </div>
                <p class="note">${C.prov('pdm')} marks values copied from ${RSA.Edition && RSA.Edition.test ? 'the imported Excel project data' : 'the project database'}. Once you edit them they become your own and are not overwritten.</p>
              </section>`;

            const comparison = src && site ? `<details class="panel quiet">
                <summary>Compare source and site data</summary>
                <div class="cols even summary-pair"><div><h4>${U.esc(src.shortName)}</h4><p>${U.esc(src.summary)}</p></div><div><h4>${U.esc(site.shortName)}</h4><p>${U.esc(site.summary)}</p></div></div>
                <div class="table-wrap"><table class="compact comparison"><thead><tr><th></th><th>Source</th><th>Site</th></tr></thead><tbody>
                ${M.dimensions.map((d) => {
                    const fields = [...new Set(d.metrics.flatMap((m) => m.pdmFields))];
                    return `<tr class="group-row"><td colspan="3">${U.esc(d.name)}</td></tr>${fields.map((p) => `<tr><td>${U.esc(M.fieldLabel(p))}</td><td>${fmtVal(U.get(src, p), p)}</td><td>${fmtVal(U.get(site, p), p)}</td></tr>`).join('')}`;
                }).join('')}
                </tbody></table></div>
              </details>` : '';

            const versions = `<details class="panel quiet">
                <summary>Data versions used</summary>
                <table class="compact"><thead><tr><th></th><th>Record</th><th>Version</th><th>Updated</th><th>Copied</th></tr></thead><tbody>
                ${['source', 'site'].map((side) => { const x = a.pdm[side]; return x ? `<tr><td>${side === 'source' ? 'Source' : 'Site'}</td><td>${U.esc(x.data.shortName)}</td><td>v${x.version}</td><td>${U.fmtDate(x.lastUpdated)}</td><td>${U.fmtDateTime(x.fetchedAt)}</td></tr>` : ''; }).join('')}
                ${(a.pdm.snapshotHistory || []).slice().reverse().map((h) => `<tr class="muted-row"><td>Previous</td><td>${U.esc(h.data.shortName)}</td><td>v${h.version}</td><td>${U.fmtDate(h.lastUpdated)}</td><td>${U.fmtDateTime(h.fetchedAt)}</td></tr>`).join('')}
                </tbody></table>
                ${['source', 'site'].map((side) => { const x = a.pdm[side]; if (!x || !x.data.pdmMapping) return ''; const key = `raw-${side}`; return `<div class="raw-record"><p class="small"><strong>${side === 'source' ? 'Source' : 'Site'}:</strong> ${x.data.pdmMapping.found.length} RSA field${x.data.pdmMapping.found.length === 1 ? '' : 's'} recognised in the project database record (${x.data.pdmMapping.leaves} values in total). <button class="link-button" data-action="toggle-expand" data-key="${key}">${app.ui.expanded[key] ? 'Hide' : 'Show'} PDM record</button> · <button class="link-button" data-action="download-pdm" data-id="${U.esc(x.id)}">Download PDM record</button></p>
                  ${app.ui.expanded[key] ? `<pre class="raw-json">${U.esc(x.data.pdmRaw ? JSON.stringify(x.data.pdmRaw, null, 2).slice(0, 60000) : x.data.pdmRawNote || 'Not available.')}</pre>` : ''}</div>`; }).join('')}
                <p class="note">Connection: ${U.esc(RSA.PDM.adapterLabel)} · last checked ${U.fmtDateTime(a.pdm.lastCheckedAt)}. <button class="link-button" data-action="delete-assessment">Delete this assessment</button></p>
              </details>`;

            const canSync = a.decision.finalised && W.canFinalise(user);
            const syncText = { 'not-synced': 'Not sent yet', synced: `Sent ${U.fmtDateTime(a.pdm.sync.lastPushAt)}`, outdated: 'Changed since it was last sent' }[a.pdm.sync.status];
            const sync = `<section class="panel">
                <div class="panel-head"><div><h2>Send results to the project database</h2>
                <p class="muted small">${a.decision.finalised ? `${U.esc(syncText)}.` : 'Available once the final recommendation has been recorded in the report.'}</p></div>
                <button class="button primary" data-action="sync" ${canSync ? '' : 'disabled'}>Sync to PDM</button></div>
              </section>`;

            const localSides = ['source', 'site'].filter((x) => a.pdm[x] && a.pdm[x].local);
            const local = localSides.length ? `<section class="notice">
                <div><strong>${localSides.map((x) => U.esc(a.pdm[x].data.shortName)).join(' and ')} ${localSides.length > 1 ? 'come' : 'comes'} from an Excel file, not the CLIMINVEST project database.</strong>
                <p class="small">${localSides.some((x) => !a.pdm[x].excel) ? 'Fill in the missing information below, or select the matching project database record in the lists. ' : 'To use newer values, import the updated Excel file again (menu → Import Excel or JSON) and press Check for updates. '}Results can only be sent to the CLIMINVEST database once both projects are database records.${a.importReport ? ' <button class="link-button" data-action="show-import-report">What was read from the Excel file</button>' : ''}</p></div>
              </section>` : '';

            const test = RSA.Edition && RSA.Edition.test;
            return `${test ? '' : local}${pending}${missingPanel(app)}${overridesPanel(app)}${pairing}${details}${weightsPanel(app, calc)}${comparison}${test ? '' : sync}${versions}`;
        },

        after(app, root) {
            U.$$('[data-manual]', root).forEach((el) => el.addEventListener('change', () => {
                const [side, path] = el.dataset.manual.split('|');
                const value = RSA.Data.parse(M.fieldSpec(path), el.value);
                const before = RSA.Data.setManual(app.a, side, path, value);
                if (app.a.pdm.manualSources && app.a.pdm.manualSources[side]) delete app.a.pdm.manualSources[side][path]; // typed by hand now
                app.log('Missing data filled', 'pdm', `${side}:${path}`, { field: path, from: RSA.Data.display(before), to: RSA.Data.display(value) });
                app.save(true); app.render({ keepScroll: true });
            }));
            const totalEl = U.$('#weightsTotal', root);
            const updateTotal = () => {
                const t = U.$$('[data-weight]', root).reduce((sum, el) => sum + (Number(el.value) || 0), 0);
                if (totalEl) { totalEl.textContent = `${Math.round(t * 10) / 10}%`; totalEl.classList.toggle('bad', Math.round(t) !== 100); }
            };
            U.$$('[data-weight]', root).forEach((el) => el.addEventListener('input', updateTotal));
            updateTotal();
            U.$$('[data-search]', root).forEach((input) => {
                input.addEventListener('input', () => {
                    const side = input.dataset.search;
                    app.search[side] = input.value;
                    U.$(`[data-results="${side}"]`, root).innerHTML = listHtml(app, side);
                });
            });
        },

        actions: {
            pick(app, el) {
                const side = el.dataset.side;
                el.disabled = true; el.textContent = 'Importing…';
                app.selectPair(side === 'source' ? el.dataset.id : null, side === 'site' ? el.dataset.id : null);
            },
            'check-updates'(app) { app.checkPdmUpdates(false); },
            'show-import-report'(app) { RSA.ImportReport.show(app.a.importReport); },
            async 'download-pdm'(app, el) {
                try {
                    U.toast('Downloading the project record…', 'info');
                    const raw = await RSA.PDM.getRaw(el.dataset.id);
                    if (!raw) { U.toast('The project database did not return this project.', 'error'); return; }
                    U.download(`pdm-projectTree-${U.slug(el.dataset.id)}.json`, JSON.stringify(raw, null, 2));
                } catch (err) { U.toast(`Download failed: ${err.message}`, 'error', 8000); }
            },
            'import-data-file'() { document.getElementById('dataFileInput').click(); },
            'apply-weights'(app) {
                const w = Object.fromEntries(M.dimensions.map((d) => [d.id, Number((U.$(`[data-weight="${d.id}"]`) || {}).value)]));
                if (M.dimensions.some((d) => !Number.isFinite(w[d.id]) || w[d.id] < 0)) { U.toast('Enter a weight between 0 and 100 for each dimension.', 'error'); return; }
                const total = M.dimensions.reduce((sum, d) => sum + w[d.id], 0);
                if (Math.round(total * 10) / 10 !== 100) { U.toast(`The weights add up to ${Math.round(total * 10) / 10}%. They must add up to 100%.`, 'error'); return; }
                app.setWeights(w);
            },
            'use-preset'(app, el) { const p = M.weightPresets.find((x) => x.id === el.dataset.preset); if (p) app.setWeights(p.weights); },
            'accept-update'(app, el) { app.acceptPdmUpdate(el.dataset.side); },
            'remove-manual'(app, el) {
                const [side, path] = el.dataset.key.split('|');
                const before = RSA.Data.setManual(app.a, side, path, null);
                if (app.a.pdm.manualSources && app.a.pdm.manualSources[side]) delete app.a.pdm.manualSources[side][path];
                app.log('Team value removed', 'pdm', `${side}:${path}`, { field: path, from: RSA.Data.display(before), to: '' });
                app.save(true); app.render({ keepScroll: true });
                U.toast(`${M.fieldLabel(path)}: back to the project database value.`, 'success');
            },
            sync(app) { app.syncToPdm(); },
            'new-assessment'(app) { app.newAssessment({ copyTeam: true }); },
            'delete-assessment'(app) { app.deleteAssessment(); }
        }
    };
})(window.RSA);
