/* Evidence log: sources linked to metrics, provenance, reliability, attachments, coverage matrix. */
(function (RSA) {
    'use strict';

    const U = RSA.U; const M = RSA.Methodology; const C = RSA.C;

    RSA.Views = RSA.Views || {};
    RSA.Views.evidence = {
        render(app, calc) {
            const a = app.a;
            const fm = app.ui.evidenceMetric; const fp = app.ui.evidenceProv;
            const list = a.evidence.filter((e) => (!fm || e.metricIds.includes(fm)) && (!fp || e.provenance === fp));
            const pdmDocs = [...((a.pdm.site && a.pdm.site.data.documents) || []).map((d) => ({ ...d, owner: a.pdm.site.data.shortName })), ...((a.pdm.source && a.pdm.source.data.documents) || []).map((d) => ({ ...d, owner: a.pdm.source.data.shortName }))];
            const logged = new Set(a.evidence.map((e) => e.pdmDocId).filter(Boolean));
            const available = pdmDocs.filter((d) => !logged.has(d.id));

            const coverage = `<details class="panel quiet">
                <summary>Coverage by metric</summary>
                <div class="panel-head"><div></div>
                <div class="button-row"><span class="tag">${calc.evidenced}/${calc.total} metrics evidenced</span><span class="tag">Quality index ${U.fmtPct(calc.evidenceQuality)}</span></div></div>
                <div class="coverage-grid">${calc.dims.map((d) => `<div><h4>${d.id} ${U.esc(d.short)}</h4>${d.metricsState.map((x) => `
                  <button class="coverage-cell rel-${x.bestRel}" data-action="filter-metric" data-metric="${x.id}" title="${U.esc(x.name)}">
                    <span>${x.id}</span><strong>${x.evCount}</strong><small>${x.evCount ? `best: ${U.esc(M.reliabilityLabel(String(x.bestRel)))}` : 'gap'}</small></button>`).join('')}</div>`).join('')}</div>
                <p class="note">Evidence quality index = mean over the 20 metrics of the best reliability of linked evidence (0 when none). Reported separately from assessor confidence.</p>
              </details>`;

            const pdm = available.length ? `<details class="panel quiet">
                <summary>Documents available in the project database (${available.length})</summary>
                <ul class="doc-list">${available.map((d) => `<li><div><strong>${U.esc(d.title)}</strong><div class="muted small">${U.esc(d.owner)} · ${U.esc(d.provider)} · ${U.fmtDate(d.date)}</div></div><button class="button secondary small" data-action="import-doc" data-id="${U.esc(d.id)}">Add</button></li>`).join('')}</ul>
              </details>` : '';

            const table = `<div class="panel">
                <div class="panel-head"><div><h2>Evidence log</h2></div>
                <div class="button-row">
                  <select data-evidence-filter="metric"><option value="">All metrics</option>${M.allMetrics().map((m) => `<option value="${m.id}" ${fm === m.id ? 'selected' : ''}>${m.id} ${U.esc(m.name)}</option>`).join('')}</select>
                  <button class="button primary small" data-action="add-evidence" ${app.user ? '' : 'disabled'}>Add evidence</button></div></div>
                <div class="table-wrap"><table class="evidence-table"><thead><tr><th>Source</th><th>Linked to</th><th>Reliability</th><th></th></tr></thead><tbody>
                ${list.map((e) => `<tr>
                  <td><button class="link-plain" data-action="edit-evidence" data-id="${U.esc(e.id)}" ${app.user ? '' : 'disabled'}><strong>${U.esc(e.title)}</strong></button>
                    <div class="muted small">${[e.sourceType, e.provider, e.date ? U.fmtDate(e.date) : ''].filter(Boolean).map(U.esc).join(' · ')}${e.provenance === 'pdm' ? ` ${C.prov('pdm')}` : ''}${e.attachment ? ` · file: ${U.esc(e.attachment.name)}` : ''}</div>
                    ${e.assumptions ? `<div class="small">Assumes: ${U.esc(e.assumptions)}</div>` : ''}</td>
                  <td>${C.metricChips(e.metricIds) || '<span class="muted">—</span>'}</td>
                  <td>${e.reliability ? U.esc(M.reliabilityLabel(e.reliability)) : '<span class="muted">Not rated</span>'}</td>
                  <td class="actions-cell"><button class="icon-button" data-action="delete-evidence" data-id="${U.esc(e.id)}" title="Delete" aria-label="Delete" ${app.user ? '' : 'disabled'}>×</button></td>
                </tr>`).join('')}</tbody></table></div>
                ${list.length ? '' : C.empty(a.evidence.length ? 'No evidence matches the filter.' : 'No evidence recorded yet.')}
              </div>`;

            return table + pdm + coverage;
        },
        after(app, root) {
            U.$$('[data-evidence-filter]', root).forEach((sel) => sel.addEventListener('change', () => {
                if (sel.dataset.evidenceFilter === 'metric') app.ui.evidenceMetric = sel.value; else app.ui.evidenceProv = sel.value;
                app.render({ keepScroll: true });
            }));
        },
        actions: {
            'add-evidence'(app) { C.evidenceDialog(app); },
            'edit-evidence'(app, el) { const e = app.a.evidence.find((x) => x.id === el.dataset.id); if (e) C.evidenceDialog(app, e); },
            'delete-evidence'(app, el) { app.deleteEvidence(el.dataset.id); },
            'import-doc'(app, el) { app.importPdmDoc(el.dataset.id); },
            'filter-metric'(app, el) { app.ui.evidenceMetric = app.ui.evidenceMetric === el.dataset.metric ? '' : el.dataset.metric; app.render({ keepScroll: true }); }
        }
    };
})(window.RSA);
