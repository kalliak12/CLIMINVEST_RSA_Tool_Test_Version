/*
 * "Add project data from a file": shows what was found in an uploaded spreadsheet, lets the user
 * confirm or correct it, then fills the project fields (as team-added values with their file origin)
 * and adds the file to the Evidence log so the Assistant can search it.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C;
    const SIDES = { site: 'Replication site', source: 'Source project' };

    const show = (v) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
    const label = (path) => (path === '_name' ? 'Project name' : path === '_location' ? 'Location' : M.fieldLabel(path));
    const unit = (path) => (path.startsWith('_') ? '' : M.fieldUnit(path));

    function parseInput(path, text) {
        if (path.startsWith('_')) return text.trim();
        const spec = M.fieldSpec(path);
        if (spec.type === 'bool') return /^(y|true|1)/i.test(text.trim()) ? true : /^(n|false|0)/i.test(text.trim()) ? false : null;
        if (spec.type === 'number' || spec.numeric) { const n = RSA.DataExtract.parseNumber(text); return n === null ? null : spec.numeric ? String(n) : n; }
        if (spec.type === 'select') return spec.options.find((o) => o.toLowerCase() === text.trim().toLowerCase()) || null;
        return RSA.Data.parse(spec, text);
    }

    const current = (a, side, path) => {
        if (path === '_name') return a.pdm[side] ? a.pdm[side].data.name : '';
        if (path === '_location') return a.pdm[side] ? [a.pdm[side].data.country, a.pdm[side].data.region].filter(Boolean).join(', ') : '';
        const eff = RSA.Data.effective(a, side);
        return eff ? U.get(eff, path) : null;
    };

    function tableHtml(app, items) {
        const a = app.a;
        if (!items.length) return '<p class="empty-inline">No recognisable project values found in the sheets assigned to a project. Try assigning sheets differently above.</p>';
        return ['site', 'source'].map((side) => {
            const list = items.filter((x) => x.side === side).sort((x, y) => (x.path.startsWith('_') ? -1 : 0) - (y.path.startsWith('_') ? -1 : 0) || label(x.path).localeCompare(label(y.path)));
            if (!list.length) return '';
            return `<h3 class="import-side">${SIDES[side]}${a.pdm[side] ? ` <span class="muted small">· ${U.esc(a.pdm[side].data.shortName)}</span>` : ' <span class="muted small">· new, not in the project database</span>'}</h3>
              <div class="table-wrap"><table class="compact import-table"><thead><tr><th></th><th>Field</th><th>Value from the file</th><th>Found in</th><th>Now</th></tr></thead><tbody>
              ${list.map((x) => {
                  const id = `${x.side}|${x.path}`; const now = current(a, x.side, x.path);
                  const has = now !== null && now !== undefined && now !== '' && !(Array.isArray(now) && !now.length);
                  const pdmValue = has && !x.path.startsWith('_') && !RSA.Data.isManual(a, x.side, x.path) && !(a.pdm[x.side] && a.pdm[x.side].local);
                  return `<tr>
                    <td><input type="checkbox" name="use" value="${U.esc(id)}" ${has || x.weak ? '' : 'checked'} aria-label="Use this value" /></td>
                    <td><strong>${U.esc(label(x.path))}</strong>${unit(x.path) ? ` <span class="muted small">(${U.esc(unit(x.path))})</span>` : ''}</td>
                    <td><input name="val:${U.esc(id)}" value="${U.esc(show(x.value))}" />
                      ${x.alternatives.length ? `<select class="alt-pick" data-target="val:${U.esc(id)}" aria-label="Other values found"><option value="">${x.alternatives.length} other value${x.alternatives.length > 1 ? 's' : ''} found…</option>${x.alternatives.map((o) => `<option value="${U.esc(show(o.value))}">${U.esc(show(o.value).slice(0, 40))} — ${U.esc(o.sheet)}!${U.esc(o.cell)}</option>`).join('')}</select>` : ''}</td>
                    <td class="small"><span class="muted">${U.esc(x.sheet)}!${U.esc(x.cell)}</span><br>“${U.esc(x.label.slice(0, 60))}”${x.weak ? '<br><span class="muted">Weak match — check before using</span>' : ''}</td>
                    <td class="small">${has ? `${U.esc(show(now).slice(0, 40))}${pdmValue ? ' <span class="muted">(PDM)</span><br><span class="muted">Ticking replaces it</span>' : ''}` : '<span class="muted">empty</span>'}</td>
                  </tr>`;
              }).join('')}</tbody></table></div>`;
        }).join('');
    }

    const shortOf = (name) => String(name).replace(/["“”]/g, '').split(/\s[—–-]\s|,/)[0].trim().slice(0, 60);

    function apply(app, book, items, fd) {
        const a = app.a; const user = app.user;
        const use = new Set(fd.getAll('use'));
        const chosen = items.filter((x) => use.has(`${x.side}|${x.path}`)).map((x) => ({ ...x, value: parseInput(x.path, String(fd.get(`val:${x.side}|${x.path}`) || '')) })).filter((x) => x.value !== null && x.value !== '');
        if (!chosen.length && !fd.get('evidence')) return 'Nothing selected.';
        const now = U.nowIso();
        const date = U.today();
        a.pdm.manualSources = a.pdm.manualSources || { site: {}, source: {} };
        ['site', 'source'].forEach((side) => {
            const mine = chosen.filter((x) => x.side === side);
            if (!mine.length) return;
            const nameItem = mine.find((x) => x.path === '_name');
            if (!a.pdm[side]) {
                a.pdm[side] = RSA.ExcelImport.localSnapshot(side, nameItem ? nameItem.value : `${SIDES[side]} (from ${book.fileName})`, date);
                a.pdm[side].data.shortName = shortOf(a.pdm[side].data.name);
                a.pdm[`${side}Id`] = a.pdm[side].id;
                app.log('Project added from file', 'pdm', a.pdm[side].id, { detail: `${book.fileName} — not in the project database` });
            } else if (a.pdm[side].local && nameItem) {
                a.pdm[side].data.name = nameItem.value; a.pdm[side].data.shortName = shortOf(nameItem.value);
            }
            const loc = mine.find((x) => x.path === '_location');
            if (loc && a.pdm[side].local) a.pdm[side].data.region = loc.value;
            if (a.pdm[side].local && !a.pdm[side].excel) a.pdm[side].data.summary = `Project data added from ${book.fileName}; not in the project database.`;
            a.pdm.manualSources[side] = a.pdm.manualSources[side] || {};
            mine.filter((x) => !x.path.startsWith('_')).forEach((x) => {
                const before = RSA.Data.setManual(a, side, x.path, x.value);
                a.pdm.manualSources[side][x.path] = { file: book.fileName, sheet: x.sheet, cell: x.cell, label: x.label, at: now };
                app.log('Data imported from file', 'pdm', `${side}:${x.path}`, { field: x.path, from: RSA.Data.display(before), to: RSA.Data.display(x.value), detail: `${book.fileName} › ${x.sheet}!${x.cell}` });
            });
        });
        if (fd.get('evidence')) {
            const text = book.wb.SheetNames.map((n) => `## ${n}\n${RSA.ExcelImport.sheetText(book.XLSX, book.wb.Sheets[n])}`).join('\n\n');
            app.upsertEvidence({
                id: `EV-${String(a.evidence.length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 5)}`, title: book.fileName.replace(/\.[^.]+$/, ''), sourceType: 'Project document', provider: '', date,
                url: book.fileName, reliability: '', assumptions: '', notes: `Uploaded project file (${book.wb.SheetNames.length} sheets). ${chosen.filter((x) => !x.path.startsWith('_')).length} values copied to the project fields. Rate its reliability and link it to metrics.`,
                metricIds: [], provenance: 'human', createdBy: user ? user.id : null, createdAt: now,
                attachment: { name: book.fileName, size: text.length, type: 'text/plain', text: text.slice(0, 200000) }
            }, null);
        }
        if (a.pdm.source && a.pdm.site && a.title === 'New replication assessment') a.title = `${a.pdm.source.data.shortName.split(' (')[0]} → ${a.pdm.site.data.shortName.split(' (')[0]}`;
        app.save(true);
        app.setView('projects');
        const n = chosen.filter((x) => !x.path.startsWith('_')).length;
        U.toast(`${n} value${n === 1 ? '' : 's'} added from ${book.fileName}${fd.get('evidence') ? ' and the file added to the Evidence log' : ''}. Values are marked as added by the team.`, 'success', 7000);
        return true;
    }

    RSA.DataImport = {
        open(app, book) {
            if (!app.user) { U.toast('Choose a team member in "Acting as" first.', 'error'); return; }
            const a = app.a;
            const first = (side) => (a.pdm[side] && !a.pdm[side].local ? String(a.pdm[side].data.shortName || '').split(/[ (]/)[0] : '');
            const { sheets, found } = RSA.DataExtract.extract(book, { sourceName: first('source'), siteName: first('site'), fileName: book.fileName });
            const sides = Object.fromEntries(sheets.map((s) => [s.name, s.side]));
            let items = RSA.DataExtract.group(found, sides);
            const sheetRows = () => sheets.map((s) => `<label class="sheet-side"><span>${U.esc(s.name)}</span><select data-sheet="${U.esc(s.name)}">${C.options([{ value: 'site', label: 'Replication site' }, { value: 'source', label: 'Source project' }, { value: 'ignore', label: 'Ignore' }], sides[s.name])}</select></label>`).join('');
            const usedBefore = ['site', 'source'].some((sd) => Object.values((a.pdm.manualSources && a.pdm.manualSources[sd]) || {}).some((x) => x.file === book.fileName))
                || (a.evidence || []).some((e) => e.url === book.fileName && e.sourceType === 'Project document');
            C.modal.open({
                title: `Add project data from ${book.fileName}`, wide: true, submitLabel: 'Add selected values',
                body: `${usedBefore ? `<p class="alert warning small"><strong>${U.esc(book.fileName)} was already added to this assessment.</strong> Values that are already filled are not ticked; tick them only if you want to replace them.</p>` : ''}<p class="small">The tool looked for clearly labelled values (e.g. "Total CAPEX", "Payback", "Mean annual temperature"). Check each one before adding it; unticked rows are skipped. Values you add are marked as added by the team, with the sheet and cell they came from.</p>
                  <div class="import-sheets"><p class="small"><strong>Which project does each sheet describe?</strong> <span class="muted">Guessed from the file and sheet names. Check this first: the values go to the project chosen here.</span></p><div class="sheet-sides">${sheetRows()}</div></div>
                  <div id="importTable">${tableHtml(app, items)}</div>
                  <label class="check"><input type="checkbox" name="evidence" value="1" ${usedBefore ? '' : 'checked'} /> Also add the whole file to the Evidence log (searchable by the Assistant)</label>`,
                onOpen(dlg) {
                    dlg.addEventListener('change', (e) => {
                        const sel = e.target.closest('[data-sheet]');
                        if (sel) { sides[sel.dataset.sheet] = sel.value; items = RSA.DataExtract.group(found, sides); U.$('#importTable', dlg).innerHTML = tableHtml(app, items); return; }
                        const alt = e.target.closest('.alt-pick');
                        if (alt && alt.value) { const input = dlg.querySelector(`[name="${CSS.escape(alt.dataset.target)}"]`); if (input) input.value = alt.value; alt.value = ''; }
                    });
                },
                onSubmit: (form, fd) => apply(app, book, items, fd)
            });
        }
    };
})(window.RSA);
