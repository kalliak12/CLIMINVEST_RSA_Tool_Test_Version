/*
 * "What was read from the Excel file": one row per sheet with what the tool used and what it did not.
 * Shown after an Excel import and kept with the assessment (Projects page) or the Excel project list (Settings).
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const STATUS = {
        read: ['success', 'Read'],
        partly: ['warning', 'Partly read'],
        reference: ['info', 'Kept as reference only'],
        skipped: ['danger', 'Not read'],
        none: ['info', 'No data']
    };

    function html(report) {
        if (!report) return '<p class="muted">No import report.</p>';
        const notReadCount = report.sections.reduce((n, s) => n + (s.notRead || []).length, 0);
        return `<p class="small">${U.esc(report.fileName)} · ${U.fmtDateTime(report.at)}. ${notReadCount ? `<strong>${notReadCount} item${notReadCount === 1 ? '' : 's'} not read or needing a check</strong> — see the last column.` : 'Everything in the file was read.'}</p>
            ${(report.notes || []).length ? `<div class="alert info small"><ul class="tight">${report.notes.map((w) => `<li>${U.esc(w)}</li>`).join('')}</ul></div>` : ''}
            ${(report.warnings || []).length ? `<div class="alert warning small"><ul class="tight">${report.warnings.map((w) => `<li>${U.esc(w)}</li>`).join('')}</ul></div>` : ''}
            <div class="table-wrap"><table class="compact import-report"><thead><tr><th>Sheet</th><th>Status</th><th>What the tool used</th><th>Not read / check</th></tr></thead><tbody>
            ${report.sections.map((s) => { const [cls, label] = STATUS[s.status] || STATUS.read; return `<tr>
                <td><strong>${U.esc(s.sheet)}</strong></td>
                <td><span class="badge ${cls}">${label}</span></td>
                <td class="small">${U.esc(s.summary || '')}</td>
                <td class="small">${(s.notRead || []).length ? `<ul class="tight">${s.notRead.slice(0, 40).map((x) => `<li>${U.esc(x)}</li>`).join('')}${s.notRead.length > 40 ? `<li>…and ${s.notRead.length - 40} more</li>` : ''}</ul>` : '<span class="muted">—</span>'}</td>
              </tr>`; }).join('')}
            </tbody></table></div>`;
    }

    function show(report, title = 'What was read from the Excel file') {
        RSA.C.modal.open({ title, wide: true, hideSubmit: true, body: html(report) });
    }

    RSA.ImportReport = { html, show };
})(window.RSA);
