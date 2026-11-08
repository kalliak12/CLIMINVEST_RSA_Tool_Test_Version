/*
 * CLIMINVEST RSA — application controller.
 * Flow: PDM/project database → RSA assessment → team scoring/review → recommendations → final report → sync to PDM.
 * Rule: the assessment team makes the judgement; PDM provides data; RSA structures and calculates;
 *       AI supports assessors; the reviewer / lead assessor approves.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;
    const S = RSA.Scoring;
    const W = RSA.Workflow;
    const C = RSA.C;

    const VIEWS = [
        { id: 'dashboard', label: 'Overview', group: '' },
        { id: 'projects', label: 'Projects', title: 'Projects & PDM data', group: 'Set up' },
        { id: 'team', label: 'Team', title: 'Assessment team', group: 'Set up' },
        { id: 'screening', label: 'Screening', title: 'Level 1 screening', group: 'Assess' },
        { id: 'assessment', label: 'Assessment', title: 'Level 2 assessment', group: 'Assess' },
        { id: 'evidence', label: 'Evidence', group: 'Assess' },
        { id: 'risks', label: 'Risks', group: 'Assess' },
        { id: 'recommendations', label: 'Recommendations', group: 'Results' },
        { id: 'report', label: 'Report', title: 'Decision & report', group: 'Results' },
        { id: 'about', label: 'Methodology', title: 'About & methodology', group: 'Help' }
    ];

    const SETTINGS_VERSION = 7;
    /* Default from v07: the CLIMINVEST project database (PDM). Demo projects remain available in Methodology → Settings. */
    const defaultSettings = () => ({
        version: SETTINGS_VERSION,
        ai: { provider: 'local', endpoint: '', token: '' },
        pdm: { adapter: 'climinvest', baseUrl: '', token: '' }
    });

    const App = {
        data: null,
        view: 'dashboard',
        ui: { openMetric: null, dimTab: 'D1', recTab: 'improve', evidenceMetric: '', evidenceProv: '', metricFilter: 'all', riskFilter: 'all', expanded: {} },
        pdmCache: { sources: [], sites: [], loaded: false },
        search: { source: '', site: '' },
        calcCache: null,

        get a() { return this.data.assessments[this.data.activeId]; },
        get user() { return W.currentUser(this.a); },
        get catalogue() { return this.data.catalogue; },
        get settings() { return this.data.settings; },
        calc() { this.calcCache = S.compute(this.a); return this.calcCache; },

        /* ---------------- Initialisation & persistence ---------------- */
        init() {
            const stored = RSA.Storage.load();
            if (stored && stored.assessments && Object.keys(stored.assessments).length) {
                this.data = stored;
                Object.keys(this.data.assessments).forEach((id) => { this.data.assessments[id] = RSA.Model.normalise(this.data.assessments[id]); });
                const storedVersion = (stored.settings && stored.settings.version) || 0;
                this.data.settings = { ...defaultSettings(), ...(stored.settings || {}) };
                if (storedVersion < SETTINGS_VERSION) {
                    // one-time switch to the real project database when upgrading to v07
                    if (this.data.settings.pdm && this.data.settings.pdm.adapter === 'mock') this.data.settings.pdm = { ...this.data.settings.pdm, adapter: 'climinvest' };
                    this.data.settings.version = SETTINGS_VERSION;
                }
                this.data.catalogue = stored.catalogue && stored.catalogue.entries ? stored.catalogue : U.clone(RSA.DefaultCatalogue);
                if (!this.data.assessments[this.data.activeId]) this.data.activeId = Object.keys(this.data.assessments)[0];
            } else {
                this.data = this.freshData();
                const legacy = RSA.Storage.loadLegacy();
                if (legacy && legacy.metrics) {
                    const migrated = RSA.Model.fromLegacy(legacy);
                    this.data.assessments[migrated.id] = migrated;
                    RSA.Storage.clearLegacy();
                    setTimeout(() => U.toast('Your previous prototype assessment was migrated to the new format.', 'info', 5000), 400);
                }
            }
            RSA.PDM.configure(this.settings.pdm);
            if (RSA.Edition && RSA.Edition.test) {
                const rb = U.$('#resetLabel'); if (rb) rb.textContent = 'Delete all data';
                const tag = document.querySelector('.brand span'); if (tag) tag.textContent = 'Replication Suitability Assessment — test version';
            }
            this.bindGlobalEvents();
            this.render();
            this.save(false);
            this.loadPdmCatalogue().then(() => this.checkPdmUpdates(true));
        },

        freshData() {
            if (RSA.Edition && RSA.Edition.test) {
                // Test version: one empty assessment with a lead to rename; no demo data.
                const a = RSA.Model.newAssessment({ title: 'New replication assessment', team: [] });
                const lead = { id: U.uid('usr'), name: 'Lead Assessor (rename)', organisation: '', role: 'lead', expertise: '', email: '', dimensions: M.dimensions.map((d) => d.id) };
                a.team = [lead]; a.currentUserId = lead.id;
                return { version: 2, activeId: a.id, assessments: { [a.id]: a }, settings: defaultSettings(), catalogue: U.clone(RSA.DefaultCatalogue) };
            }
            const demo = RSA.Demo.createAssessment();
            return { version: 2, activeId: demo.id, assessments: { [demo.id]: demo }, settings: defaultSettings(), catalogue: U.clone(RSA.DefaultCatalogue) };
        },

        save(showStatus = true) {
            if (this.a) this.a.updatedAt = U.nowIso();
            this.refreshSyncState();
            const ok = RSA.Storage.save(this.data);
            const el = U.$('#saveStatus');
            if (el) {
                el.textContent = ok ? (showStatus ? 'Saved locally' : 'Saved') : 'Not saved — storage unavailable';
                el.classList.toggle('error', !ok);
                if (ok && showStatus) { clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => { el.textContent = 'Saved'; }, 1400); }
            }
            return ok;
        },

        log(action, entity, entityId, extra = {}) { W.log(this.a, this.user, action, entity, entityId, extra); },

        /* ---------------- Rendering ---------------- */
        render(opts = {}) {
            const calc = this.calc();
            this.renderChrome(calc);
            const view = RSA.Views[this.view];
            const root = U.$('#viewRoot');
            const keepScroll = opts.keepScroll ? window.scrollY : 0;
            root.innerHTML = view ? view.render(this, calc) : '';
            if (view && view.after) view.after(this, root, calc);
            if (opts.keepScroll) window.scrollTo(0, keepScroll);
            RSA.AIPanel.refreshContext(this);
        },

        renderChrome(calc) {
            const a = this.a;
            const vdef = VIEWS.find((v) => v.id === this.view) || {};
            this.renderBackupHint();
            U.$('#pageTitle').textContent = (RSA.Edition && RSA.Edition.test && vdef.id === 'projects') ? 'Projects' : (vdef.title || vdef.label || '');
            U.$$('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === this.view));
            const badges = {
                assessment: `${calc.approved}/${calc.total}`,
                risks: calc.risks.criticalUnresolved.length ? String(calc.risks.criticalUnresolved.length) : ''
            };
            U.$$('.nav-item[data-view]').forEach((b) => {
                const el = U.$('.nav-badge', b);
                if (!el) return;
                const v = badges[b.dataset.view];
                el.textContent = v || '';
                el.hidden = !v;
                el.classList.toggle('alert', b.dataset.view === 'risks' && calc.risks.criticalUnresolved.length > 0);
            });
            const sel = U.$('#assessmentSelect');
            sel.innerHTML = Object.values(this.data.assessments).sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''))
                .map((x) => `<option value="${U.esc(x.id)}" ${x.id === a.id ? 'selected' : ''}>${U.esc(x.title)}</option>`).join('');
            U.$('#actingAs').innerHTML = C.memberOptions(a, a.currentUserId, { empty: !a.team.length, emptyLabel: 'No team members' });
            const src = a.pdm.source ? a.pdm.source.data.shortName : 'No source project';
            const site = a.pdm.site ? a.pdm.site.data.shortName : 'No replication site';
            U.$('#pairLine').innerHTML = `${U.esc(src)} <span class="arrow">→</span> ${U.esc(site)}`;

            const alerts = [];
            const changes = (a.pdm.pendingChanges.source || []).length + (a.pdm.pendingChanges.site || []).length;
            if (changes && ['dashboard', 'assessment'].includes(this.view)) alerts.push(`<div class="alert warning">${RSA.Edition && RSA.Edition.test ? 'A newer Excel import has different data' : 'The project database has newer data'} for this pairing (${changes} field${changes > 1 ? 's' : ''}). <button class="link-button" data-action="nav" data-view="projects">Review</button></div>`);
            if (!this.user) alerts.push('<div class="alert info">Add team members in <button class="link-button" data-action="nav" data-view="team">Team</button> to start assessing.</div>');
            U.$('#globalAlerts').innerHTML = alerts.join('');
        },

        /* Lightweight refresh while typing (no re-render of the active view). */
        refreshLive() {
            const calc = this.calc();
            this.renderChrome(calc);
            U.$$('[data-live]').forEach((el) => {
                const key = el.dataset.live;
                if (key === 'rss') el.textContent = U.fmtScore(calc.rss);
                else if (key.startsWith('dim:')) { const d = calc.dims.find((x) => x.id === key.slice(4)); el.textContent = d ? U.fmtScore(d.score) : '—'; }
                else if (key.startsWith('eff:')) { const x = calc.metrics.find((m) => m.id === key.slice(4)); el.innerHTML = x && x.eff !== null ? C.bandChip(x.eff) : C.bandChip(null); }
                else if (key.startsWith('status:')) { const x = calc.metrics.find((m) => m.id === key.slice(7)); el.innerHTML = x ? C.statusBadge(x.st.status) : ''; }
                else if (key === 'scored') el.textContent = `${calc.scored}/${calc.total}`;
            });
        },

        setView(view, opts = {}) {
            if (!RSA.Views[view]) return;
            this.view = view;
            if (opts.dim) this.ui.dimTab = opts.dim;
            this.render();
            if (opts.metric) {
                requestAnimationFrame(() => {
                    const el = document.getElementById(`metric-${opts.metric.replace('.', '-')}`);
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
                });
            } else window.scrollTo({ top: 0 });
        },

        /* ---------------- Events ---------------- */
        bindGlobalEvents() {
            let lastGroup = null;
            U.$('#nav').innerHTML = VIEWS.map((v) => {
                const head = v.group !== lastGroup && v.group ? `<p class="nav-group">${U.esc(v.group)}</p>` : '';
                lastGroup = v.group;
                return `${head}<button class="nav-item" data-view="${v.id}" type="button"><span>${U.esc(v.label)}</span><span class="nav-badge" hidden></span></button>`;
            }).join('');
            U.$('#nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-item[data-view]'); if (b) this.setView(b.dataset.view); });

            document.addEventListener('click', (e) => {
                const el = e.target.closest('[data-action]');
                if (!el || el.disabled) return;
                const name = el.dataset.action;
                const view = RSA.Views[this.view];
                const viewHandler = view && view.actions && view.actions[name];
                if (viewHandler) { e.preventDefault(); viewHandler(this, el, e); return; }
                if (this.actions[name]) { e.preventDefault(); this.actions[name].call(this, el, e); }
            });
            document.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.kpi-card[data-action]')) { e.preventDefault(); e.target.click(); }
            });

            const root = U.$('#viewRoot');
            root.addEventListener('focusin', (e) => { const el = e.target.closest('[data-field]'); if (el) el.dataset.orig = this.fieldValue(el); });
            root.addEventListener('input', (e) => { const el = e.target.closest('[data-field]'); if (el) this.onFieldInput(el); });
            root.addEventListener('change', (e) => { const el = e.target.closest('[data-field]'); if (el) this.onFieldChange(el); });

            U.$('#assessmentSelect').addEventListener('change', (e) => { this.data.activeId = e.target.value; this.save(false); this.render(); this.checkPdmUpdates(true); });
            U.$('#actingAs').addEventListener('change', (e) => { this.a.currentUserId = e.target.value; this.save(false); this.render({ keepScroll: true }); U.toast(`Now acting as ${W.memberName(this.a, e.target.value)}.`); });
            U.$('#newAssessmentBtn').addEventListener('click', () => this.newAssessment());
            U.$('#deleteAssessmentBtn').addEventListener('click', () => this.deleteAssessment());
            U.$('#exportBtn').addEventListener('click', () => this.exportAssessment());
            U.$('#exportXlsxBtn').addEventListener('click', () => this.exportExcel());
            // Leaving the page with changes that are not in a JSON backup: the browser asks for confirmation
            // (browsers show their own standard message; the sidebar hint explains why).
            window.addEventListener('beforeunload', (e) => { if (this.unsavedBackups().length) { e.preventDefault(); e.returnValue = ''; } });
            U.$('#dataFileInput').addEventListener('change', (e) => { if (e.target.files[0]) this.importSpreadsheet(e.target.files[0], { dataOnly: true }); e.target.value = ''; });
            U.$('#importInput').addEventListener('change', (e) => { if (e.target.files[0]) this.importAssessment(e.target.files[0]); e.target.value = ''; });
            U.$('#excelProjectsInput').addEventListener('change', (e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) this.loadExcelProjects(files); });
            U.$('#resetBtn').addEventListener('click', () => this.resetAll());
            U.$('#feedbackBtn').addEventListener('click', () => RSA.Feedback.open(this));
            if (RSA.Login && RSA.Login.enabled()) { const so = U.$('#signOutBtn'); so.hidden = false; const who = U.$('#signedInAs'); if (who && RSA.Edition.login) who.textContent = `Signed in as ${RSA.Edition.login.user}`; so.addEventListener('click', () => RSA.Login.signOut()); }
            U.$('#printBtn').addEventListener('click', () => this.printReport());
            U.$('#aiToggle').addEventListener('click', () => RSA.AIPanel.toggle(this));
            RSA.AIPanel.init(this);
        },

        fieldValue(el) { return el.type === 'checkbox' ? (el.checked ? 'true' : 'false') : el.value; },

        parseField(el) {
            if (el.type === 'checkbox') return el.checked;
            let v = el.value;
            if (el.dataset.type === 'score') {
                if (v === '') return '';
                v = String(U.clamp(Math.round(Number(v)), 0, 100));
                return isNaN(Number(v)) ? '' : v;
            }
            if (el.dataset.type === 'number') return v === '' ? null : Number(v);
            return v;
        },

        onFieldInput(el) {
            const path = el.dataset.field;
            const value = this.parseField(el);
            U.setField(this.a, path, value);
            if (el.dataset.metric) {
                W.touchMetric(this.a, this.user, el.dataset.metric);
                if (path.endsWith('|score')) this.a.metrics[el.dataset.metric].scoreAiAssisted = false;
            }
            U.$$(`[data-field="${CSS.escape(path)}"]`).forEach((other) => { if (other !== el && other.type !== 'checkbox') other.value = value === null ? '' : value; });
            if (el.dataset.provenance) this.a.provenance[el.dataset.provenance] = 'human';
            this.refreshLive();
            this.debouncedSave();
        },

        onFieldChange(el) {
            const path = el.dataset.field;
            const value = this.parseField(el);
            U.setField(this.a, path, value);
            const from = el.dataset.orig !== undefined ? el.dataset.orig : '';
            const to = this.fieldValue(el);
            if (from !== to) {
                const parts = path.split('|');
                const entity = el.dataset.metric ? 'metric' : parts[0];
                const entityId = el.dataset.metric || parts[1] || parts[0];
                this.log(`Edited ${el.dataset.audit || parts[parts.length - 1]}`, entity, entityId, { field: parts[parts.length - 1], from: String(from).slice(0, 200), to: String(to).slice(0, 200) });
                el.dataset.orig = to;
            }
            if (el.dataset.provenance) this.a.provenance[el.dataset.provenance] = 'human';
            this.save(true);
            if (el.dataset.rerender) this.render({ keepScroll: true });
            else this.refreshLive();
        },

        debouncedSave: U.debounce(function () { App.save(true); }, 600),

        /* ---------------- Global actions ---------------- */
        actions: {
            nav(el) { App.setView(el.dataset.view, { metric: el.dataset.metric, dim: el.dataset.dim }); },
            'goto-metric'(el) {
                const id = el.dataset.metric;
                const d = M.dimensionOfMetric(id);
                App.ui.openMetric = id;
                App.ui.metricFilter = 'all';
                App.setView('assessment', { dim: d && d.id, metric: id });
            },
            'ask-ai'(el) { RSA.AIPanel.open(App, el.dataset.prompt, el.dataset.metric); },
            'toggle-expand'(el) { App.ui.expanded[el.dataset.key] = !App.ui.expanded[el.dataset.key]; App.render({ keepScroll: true }); },
            print() { App.printReport(); }
        },

        /* ---------------- Assessment lifecycle ---------------- */
        newAssessment(opts = {}) {
            const team = opts.copyTeam && this.a ? U.clone(this.a.team) : [];
            const a = RSA.Model.newAssessment({ title: opts.title || 'New replication assessment', team });
            if (!team.length) {
                const lead = { id: U.uid('usr'), name: 'Lead Assessor (rename)', organisation: '', role: 'lead', expertise: '', email: '', dimensions: M.dimensions.map((d) => d.id) };
                a.team = [lead]; a.currentUserId = lead.id;
            } else { a.currentUserId = this.a.currentUserId; this.autoAssign(a); }
            W.log(a, W.currentUser(a), 'Assessment created', 'assessment', a.id, { detail: opts.detail || '' });
            this.data.assessments[a.id] = a;
            this.data.activeId = a.id;
            this.save(false);
            if (opts.sourceId || opts.siteId) return this.selectPair(opts.sourceId, opts.siteId, { silent: true }).then(() => this.setView('projects'));
            this.setView('projects');
            U.toast('New assessment created. Select a source project and replication site.');
            return Promise.resolve();
        },

        /*
         * Assign metrics from the dimensions ticked for each member.
         * - Specialists (non-lead, non-reviewer) with the dimension ticked come first; the lead only keeps
         *   metrics nobody else covers.
         * - A dimension's metrics are shared between its specialists. Reviewers are never auto-assigned as assessors,
 *   but a reviewer assigned by hand is kept.
 * - Reviewer column: Reviewer-role members first (shared between them); the lead only when there is none.
 *   Nobody reviews their own metric.
         * - Metrics already Submitted, Reviewed or Approved are never moved; Draft scores stay with the metric.
         * Returns a list of changes { metricId, field, from, to }.
         */
        autoAssign(a) {
            const changes = [];
            const locked = (s) => ['Submitted', 'Reviewed', 'Approved'].includes(s.status);
            M.dimensions.forEach((d) => {
                const covers = a.team.filter((t) => t.dimensions.includes(d.id) && t.role !== 'reviewer');
                const specialists = covers.filter((t) => t.role !== 'lead');
                const pool = specialists.length ? specialists : covers;
                if (!pool.length) return;
                const load = Object.fromEntries(pool.map((t) => [t.id, d.metrics.filter((m) => a.metrics[m.id].assessorId === t.id).length]));
                d.metrics.forEach((m) => {
                    const s = a.metrics[m.id];
                    if (locked(s)) return;
                    if (pool.some((t) => t.id === s.assessorId)) return; // already with a suitable person
                    if ((W.member(a, s.assessorId) || {}).role === 'reviewer') return; // reviewer assigned by hand: keep
                    const next = pool.slice().sort((x, y) => load[x.id] - load[y.id])[0];
                    if (s.assessorId && load[s.assessorId] !== undefined) load[s.assessorId] -= 1;
                    load[next.id] += 1;
                    changes.push({ metricId: m.id, field: 'assessor', from: s.assessorId, to: next.id });
                    s.assessorId = next.id;
                });
            });
            /* Reviewers: people with the Reviewer role first (shared between them), the lead only when there is none. */
            const reviewers = a.team.filter((t) => t.role === 'reviewer');
            const lead = a.team.find((t) => t.role === 'lead');
            const rLoad = Object.fromEntries(reviewers.map((t) => [t.id, Object.values(a.metrics).filter((s) => s.reviewerId === t.id).length]));
            M.allMetrics().forEach((m) => {
                const s = a.metrics[m.id];
                if (locked(s)) return;
                const current = W.member(a, s.reviewerId);
                const ok = current && current.id !== s.assessorId && (reviewers.length ? current.role === 'reviewer' : true);
                if (ok) return;
                const free = reviewers.filter((t) => t.id !== s.assessorId).sort((x, y) => rLoad[x.id] - rLoad[y.id]);
                const next = free[0] || (lead && lead.id !== s.assessorId ? lead : null);
                if (!next) {
                    if (s.reviewerId) { changes.push({ metricId: m.id, field: 'reviewer', from: s.reviewerId, to: '' }); s.reviewerId = ''; }
                    changes.noReviewer = (changes.noReviewer || 0) + 1;
                    return;
                }
                if (next.id === s.reviewerId) return;
                if (current && rLoad[current.id] !== undefined) rLoad[current.id] -= 1;
                if (rLoad[next.id] !== undefined) rLoad[next.id] += 1;
                changes.push({ metricId: m.id, field: 'reviewer', from: s.reviewerId, to: next.id });
                s.reviewerId = next.id;
            });
            return changes;
        },

        exportAssessment() {
            this.log('Exported JSON', 'assessment', this.a.id);
            this.a.backupAuditLen = this.a.audit.length;
            const payload = { format: 'climinvest-rsa-assessment', schemaVersion: RSA.Model.SCHEMA, exportedAt: U.nowIso(), assessment: this.a };
            U.download(`${U.slug(this.a.title)}.rsa.json`, JSON.stringify(payload, null, 2));
            this.save(false);
            this.renderBackupHint();
        },

        /* One JSON file with all assessments in this browser (offered before deleting all data). */
        exportBackup() {
            Object.values(this.data.assessments).forEach((a) => { W.log(a, W.currentUser(a), 'Exported JSON backup', 'assessment', a.id); a.backupAuditLen = a.audit.length; });
            const payload = { format: 'climinvest-rsa-backup', schemaVersion: RSA.Model.SCHEMA, exportedAt: U.nowIso(), assessments: Object.values(this.data.assessments) };
            U.download(`rsa-backup-${U.today()}.rsa.json`, JSON.stringify(payload, null, 2));
            this.save(false);
            this.renderBackupHint();
        },

        async exportExcel() {
            try {
                await RSA.ExcelExport.download(this, this.a);
                const wasSaved = this.a.audit.length <= (this.a.backupAuditLen || 0);
                this.log('Exported Excel', 'assessment', this.a.id);
                if (wasSaved) this.a.backupAuditLen = this.a.audit.length; // exporting is not a change
                this.save(false);
                U.toast('Excel exported in the RSA Scoring Toolkit layout. You can import it again with "Import Excel or JSON".', 'success', 6000);
            } catch (err) { U.toast(`Could not export Excel: ${err.message}`, 'error', 6000); }
        },

        /* Assessments with changes since their last JSON export (an untouched empty assessment does not count). */
        unsavedBackups() {
            return Object.values(this.data.assessments || {}).filter((a) => {
                const empty = !a.pdm.source && !a.pdm.site && Object.values(a.metrics).every((m) => m.status === 'Not started') && !(a.evidence || []).length && !(a.risks || []).length;
                return !empty && (a.audit || []).length > (a.backupAuditLen || 0);
            });
        },

        renderBackupHint() {
            const el = U.$('#backupHint'); if (!el) return;
            const list = this.unsavedBackups(); const n = list.length;
            el.hidden = !n;
            const dot = U.$('#backupDot'); if (dot) dot.hidden = !n;
            if (!n) return;
            U.$('#backupHintTitle').textContent = n === 1 ? 'Changes not saved to a file' : `${n} assessments not saved to a file`;
            U.$('#backupHintText').textContent = n === 1 ? `"${list[0].title}" changed since the last export. Click Export JSON to keep a backup.` : 'Export JSON saves the current one; switch assessment to save the others.';
            el.title = 'Your work stays in this browser, but a JSON file is your backup if the browser data is cleared or you change computer.';
        },

        /* Any spreadsheet: an RSA Scoring Toolkit workbook becomes a new assessment; any other file adds project data. */
        async importSpreadsheet(file, opts = {}) {
            let book;
            try { book = await RSA.ExcelImport.read(file); } catch (err) { U.toast(`Could not read ${file.name}: ${err.message}`, 'error', 7000); return; }
            if (!opts.dataOnly && RSA.ExcelImport.isToolkit(book.wb)) {
                const hash = await this.fileHash(file);
                if (await this.checkDuplicate(file, hash) !== 'import') return;
                this.importToolkit(book, { name: file.name, hash, at: U.nowIso() });
                return;
            }
            if (!opts.dataOnly && RSA.ExcelProjects.readWorkbook(book).length) { this.loadExcelProjects([file]); return; }
            RSA.DataImport.open(this, book);
        },

        importToolkit(book, importedFile) {
            U.toast('Reading the RSA Scoring Toolkit workbook…', 'info');
            RSA.ExcelImport.parse(book).then((parsed) => {
                const { assessment: a, summary } = RSA.ExcelImport.toAssessment(parsed);
                if (importedFile) a.importedFile = importedFile;
                if (parsed.projects.length) { RSA.ExcelProjects.addRecords(parsed.fileName, parsed.projects.map((x) => x.record)); this.loadPdmCatalogue(); }
                this.dropEmptyStarter();
                this.data.assessments[a.id] = a;
                this.data.activeId = a.id;
                this.save(true);
                this.setView('dashboard');
                const calc = this.calc();
                const rssNote = summary.workbookRss !== null && calc.rss !== null ? (Math.abs(calc.rss - summary.workbookRss) < 0.05 ? ` RSS ${calc.rss.toFixed(2)}, same as the workbook (weights taken from the workbook).` : ` RSS here ${calc.rss.toFixed(2)} vs ${summary.workbookRss.toFixed(2)} in the workbook.`) : '';
                const counts = M.metricStatuses.map((st) => [st, Object.values(a.metrics).filter((m) => m.status === st).length]).filter(([, n]) => n).map(([st, n]) => `${n} ${st}`).join(', ');
                const teamNote = a.team.length > 1 ? `Team of ${a.team.length}.` : 'Add the team on the Team page.';
                U.toast(`Imported "${a.title}": ${summary.scored} scores (${counts}), ${summary.facts} project fields, ${summary.risks} risks, ${summary.actions} actions. ${teamNote}${rssNote}`, 'success', 9000);
                if (a.importReport) RSA.ImportReport.show(a.importReport);
            }).catch((err) => U.toast(`Excel import failed: ${err.message}`, 'error', 7000));
        },

        /* Excel files as the project database: read their project sheets and keep the projects in this browser. */
        async loadExcelProjects(files) {
            const sections = []; const warnings = []; let total = 0;
            for (const file of files) {
                let book;
                try { book = await RSA.ExcelImport.read(file); } catch (err) { warnings.push(`${file.name}: could not be read (${err.message}).`); continue; }
                const found = RSA.ExcelProjects.readWorkbook(book);
                if (!found.length) { warnings.push(`${file.name}: no project sheet found. Add a sheet called "Source project" or "Replication site" with a Field / Value table (see the example workbooks).`); continue; }
                const res = RSA.ExcelProjects.addRecords(file.name, found.map((x) => x.record));
                total += found.length;
                found.forEach((x) => {
                    const r = x.report; const verb = res.updated.includes(x.record.shortName) ? 'updated (new version)' : res.unchanged.includes(x.record.shortName) ? 'unchanged' : 'added';
                    sections.push({ sheet: `${file.name} › ${r.sheet}`, status: r.notRead.length || r.invalid.length ? 'partly' : 'read', summary: `${x.record.shortName} — ${r.role === 'source' ? 'source project' : 'replication site'}, ${verb}: ${r.read} fields read${r.empty ? `, ${r.empty} empty` : ''}.`, notRead: [...r.invalid, ...r.notRead.map((t) => `Unknown field — ${t}`)] });
                });
                const other = book.wb.SheetNames.filter((n) => !found.some((x) => x.report.sheet === n) && !/^lists?$/i.test(n.trim()));
                if (other.length) sections.push({ sheet: `${file.name} › other sheets`, status: 'reference', summary: `${other.join(', ')} — not used here. To create an assessment with the scores, import the workbook with "Import file" in the menu.`, notRead: [] });
            }
            this.excelReport = { fileName: files.map((f) => f.name).join(', '), at: U.nowIso(), sections, warnings };
            if (total) this.excelReport.notes = ['The projects are now in the Projects lists (marked "Excel"). Choose them as source project and replication site.'];
            if (total && sections.filter((x) => / unchanged: /.test(x.summary)).length === total) this.excelReport.notes.unshift('This file was already imported: the projects are already in the lists and nothing has changed.');
            await this.loadPdmCatalogue();
            this.render({ keepScroll: true });
            RSA.ImportReport.show(this.excelReport, `Projects loaded from Excel (${total})`);
        },

        /* A JSON file carries copies of its two projects. Add them to the project lists (as "Excel" projects,
           with the file name) when they are not there yet, so they can be chosen for other assessments too. */
        addProjectsFromAssessments(list, fileName) {
            if (!RSA.ExcelProjects) return 0;
            const cache = this.pdmCache || { sources: [], sites: [] };
            const known = (role, rec) => [...(role === 'source' ? cache.sources : cache.sites), ...RSA.ExcelProjects.all()]
                .some((p) => p.id === rec.id || (p.shortName && p.shortName === rec.shortName && p.roles && p.roles.includes(role)));
            const recs = [];
            list.forEach((a) => ['source', 'site'].forEach((role) => {
                const snap = a.pdm && a.pdm[role]; if (!snap || !snap.data || !snap.data.shortName) return;
                if (known(role, snap.data)) return;
                const rec = U.clone(snap.data);
                const keepId = /^XLS-/.test(a.pdm[`${role}Id`] || '') ? a.pdm[`${role}Id`] : null;
                rec.id = keepId || `XLS-${role === 'source' ? 'SRC' : 'SITE'}-${U.slug(rec.shortName).toUpperCase().slice(0, 40)}`;
                rec.roles = [role]; rec.origin = 'excel'; rec.fileName = fileName; rec.version = rec.version || 1; rec.lastUpdated = rec.lastUpdated || U.today();
                ['climate', 'technical', 'financial', 'esg', 'institutional'].forEach((k) => { rec[k] = rec[k] || {}; }); rec.documents = rec.documents || [];
                if (!recs.some((r) => r.id === rec.id)) recs.push(rec);
            }));
            if (recs.length) { RSA.ExcelProjects.addRecords(fileName, recs); this.loadPdmCatalogue(); }
            return recs.length;
        },

        /* Drop an untouched empty starter assessment so an import replaces it. */
        dropEmptyStarter() {
            Object.values(this.data.assessments).forEach((x) => {
                const untouched = x.title === 'New replication assessment' && !x.pdm.source && !x.pdm.site && Object.values(x.metrics).every((m) => m.status === 'Not started') && !(x.evidence || []).length && !(x.risks || []).length;
                if (untouched) delete this.data.assessments[x.id];
            });
        },

        /* Fingerprint of a file's content, to notice the same file being imported twice. */
        async fileHash(file) {
            try { const buf = await file.arrayBuffer(); const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join(''); } catch (err) { return ''; }
        },

        /* Before importing an assessment file: is it already here? Returns 'import', 'open' or 'cancel'. */
        async checkDuplicate(file, hash, sameId) {
            const list = Object.values(this.data.assessments);
            const exact = list.find((x) => (hash && x.importedFile && x.importedFile.hash === hash) || (sameId && x.id === sameId));
            const named = !exact && list.find((x) => x.importedFile && x.importedFile.name === file.name);
            const hit = exact || named;
            if (!hit) return 'import';
            const when = hit.importedFile && hit.importedFile.at ? ` on ${U.fmtDateTime(hit.importedFile.at)}` : '';
            return new Promise((resolve) => {
                let done = false;
                C.modal.open({
                    title: exact ? 'This file is already imported' : 'A file with this name was imported before',
                    submitLabel: 'Import again as a new copy',
                    body: exact
                        ? `<p><strong>${U.esc(file.name)}</strong> is already here as the assessment <strong>${U.esc(hit.title)}</strong>${when}.</p><p class="small muted">Importing it again creates a second, separate copy. To continue working, open the existing one.</p>`
                        : `<p>A file called <strong>${U.esc(file.name)}</strong> was imported${when} as <strong>${U.esc(hit.title)}</strong>, but this file has <strong>different content</strong> (perhaps a newer version).</p><p class="small muted">Importing it creates a new assessment; the earlier one stays as it is.</p>`,
                    onSubmit: () => { done = true; resolve('import'); return true; }
                });
                const dlg = document.getElementById('modal');
                const actions = U.$('.dialog-actions', dlg);
                const open = document.createElement('button'); open.type = 'button'; open.className = 'button secondary'; open.textContent = 'Open the existing one';
                open.addEventListener('click', () => { done = true; resolve('open'); C.modal.close(); });
                actions.insertBefore(open, actions.lastElementChild);
                dlg.addEventListener('close', () => { if (!done) resolve('cancel'); }, { once: true });
            }).then((choice) => {
                if (choice === 'open') { this.data.activeId = hit.id; this.save(false); this.setView('dashboard'); U.toast(`Opened "${hit.title}".`, 'info'); }
                return choice;
            });
        },

        async importAssessment(file) {
            if (RSA.ExcelImport && RSA.ExcelImport.isSpreadsheet(file)) { this.importSpreadsheet(file); return; }
            const hash = await this.fileHash(file);
            let peekId = null;
            try { const j = JSON.parse(await file.text()); peekId = j.format === 'climinvest-rsa-assessment' && j.assessment ? j.assessment.id : j.schemaVersion === 2 ? j.id : null; } catch (err) { /* reported below */ }
            if (await this.checkDuplicate(file, hash, peekId) !== 'import') return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parsed = JSON.parse(reader.result);
                    let a;
                    if (parsed.format === 'climinvest-rsa-backup' && Array.isArray(parsed.assessments)) {
                        this.dropEmptyStarter();
                        parsed.assessments.forEach((x) => { const b = RSA.Model.normalise(x); if (this.data.assessments[b.id]) b.id = U.uid('RSA'); b.aiLog = []; b.backupAuditLen = b.audit.length; this.data.assessments[b.id] = b; this.data.activeId = b.id; });
                        this.addProjectsFromAssessments(parsed.assessments, file.name);
                        this.save(true); this.render(); this.checkPdmUpdates(true);
                        U.toast(`Restored ${parsed.assessments.length} assessment${parsed.assessments.length === 1 ? '' : 's'} from the backup.`, 'success');
                        return;
                    }
                    if (parsed.format === 'climinvest-rsa-assessment' && parsed.assessment) a = RSA.Model.normalise(parsed.assessment);
                    else if (parsed.version === 1 && parsed.metrics) a = RSA.Model.fromLegacy(parsed);
                    else if (parsed.schemaVersion === 2 && parsed.metrics) a = RSA.Model.normalise(parsed);
                    else throw new Error('Unrecognised file');
                    if (this.data.assessments[a.id]) a.id = U.uid('RSA');
                    a.importedFile = { name: file.name, hash, at: U.nowIso() };
                    a.aiLog = []; // chat HTML is never imported from files
                    W.log(a, W.currentUser(a), 'Imported JSON', 'assessment', a.id, { detail: file.name });
                    a.backupAuditLen = a.audit.length; // it is already in a file
                    this.dropEmptyStarter();
                    this.data.assessments[a.id] = a;
                    const nProj = this.addProjectsFromAssessments([a], file.name);
                    this.data.activeId = a.id;
                    this.save(true);
                    this.render();
                    this.checkPdmUpdates(true);
                    U.toast(`Imported "${a.title}".${nProj ? ` Its ${nProj === 1 ? 'project was' : `${nProj} projects were`} added to the project lists.` : ''}`, 'success');
                } catch (err) {
                    U.toast('The selected file is not a valid RSA assessment JSON file or RSA Scoring Toolkit workbook.', 'error', 5000);
                }
            };
            reader.readAsText(file);
        },

        async resetAll() {
            const test = RSA.Edition && RSA.Edition.test;
            const unsaved = this.unsavedBackups();
            const choice = await new Promise((resolve) => {
                let done = false;
                C.modal.open({
                    title: test ? 'Delete all data' : 'Reset demo data',
                    submitLabel: test ? 'Delete without backup' : 'Reset without backup',
                    body: `<p>This deletes <strong>all assessments and all projects imported from Excel</strong> in this browser${test ? ' and starts with an empty assessment' : ' and restores the demo assessment'}. It cannot be undone.</p>
                        ${unsaved.length ? `<p class="alert warning small"><strong>${unsaved.length === 1 ? '1 assessment has' : `${unsaved.length} assessments have`} changes that are not saved to a JSON file</strong> (${unsaved.map((a) => U.esc(a.title)).join(', ')}).</p>` : ''}
                        <p class="small">A <strong>JSON backup</strong> is an exact copy of everything — scores, reviews, history, evidence files — that you can import again to continue where you stopped. (An Excel export keeps the content in the toolkit layout, but not the history or files.)</p>
                        <p><button type="button" class="button primary" id="backupThenDelete">Save JSON backup, then delete</button></p>`,
                    onSubmit: () => { done = true; resolve('delete'); return true; }
                });
                const dlg = document.getElementById('modal');
                U.$('#backupThenDelete', dlg).addEventListener('click', () => { done = true; resolve('backup'); C.modal.close(); });
                dlg.addEventListener('close', () => { if (!done) resolve('cancel'); }, { once: true });
            });
            if (choice === 'cancel') return;
            if (choice === 'backup') this.exportBackup();
            RSA.Storage.clear();
            if (RSA.ExcelProjects) RSA.ExcelProjects.clearAll();
            this.data = this.freshData();
            RSA.PDM.configure(this.settings.pdm);
            this.view = 'dashboard';
            this.save(false);
            this.loadPdmCatalogue();
            this.render();
            this.checkPdmUpdates(true);
            U.toast(test ? 'All data deleted.' : 'Demo data restored.', 'success');
        },

        /* Delete the current assessment (only this one; imported Excel projects stay in the project lists). */
        async deleteAssessment() {
            const a = this.a;
            const unsaved = this.unsavedBackups().includes(a);
            const last = Object.keys(this.data.assessments).length < 2;
            const choice = await new Promise((resolve) => {
                let done = false;
                C.modal.open({
                    title: 'Delete assessment', submitLabel: unsaved ? 'Delete without backup' : 'Delete',
                    body: `<p>Delete <strong>${U.esc(a.title)}</strong> from this browser? It cannot be undone.</p>
                        <p class="small muted">Only this assessment is deleted. Other assessments and the projects imported from Excel stay.${last ? ' As it is the only assessment, an empty one is started in its place.' : ''}</p>
                        ${unsaved ? `<p class="alert warning small">This assessment has changes that are not saved to a JSON file.</p>
                        <p><button type="button" class="button primary" id="backupThenDeleteOne">Save JSON backup, then delete</button></p>` : ''}`,
                    onSubmit: () => { done = true; resolve('delete'); return true; }
                });
                const dlg = document.getElementById('modal');
                const bk = U.$('#backupThenDeleteOne', dlg); if (bk) bk.addEventListener('click', () => { done = true; resolve('backup'); C.modal.close(); });
                dlg.addEventListener('close', () => { if (!done) resolve('cancel'); }, { once: true });
            });
            if (choice === 'cancel') return;
            if (choice === 'backup') this.exportAssessment();
            const title = a.title;
            delete this.data.assessments[a.id];
            if (last) { this.data = { ...this.freshData(), settings: this.data.settings, catalogue: this.data.catalogue }; }
            else this.data.activeId = Object.keys(this.data.assessments)[0];
            this.save(true);
            this.setView('dashboard');
            U.toast(`"${title}" deleted.`, 'success');
        },

        printReport() {
            if (this.view !== 'report') this.setView('report');
            setTimeout(() => window.print(), 120);
        },

        /* ---------------- PDM ---------------- */
        async loadPdmCatalogue() {
            try {
                const [sources, sites] = await Promise.all([RSA.PDM.list('source'), RSA.PDM.list('site')]);
                this.pdmCache = { sources, sites, loaded: true, error: null };
            } catch (err) {
                this.pdmCache = { sources: [], sites: [], loaded: true, error: err.message };
            }
            // Projects imported from Excel files are always offered too (marked "Excel").
            const xls = RSA.ExcelProjects ? RSA.ExcelProjects.all() : [];
            ['source', 'site'].forEach((role) => {
                const key = role === 'source' ? 'sources' : 'sites';
                const ids = new Set(this.pdmCache[key].map((p) => p.id));
                xls.filter((p) => p.roles.includes(role) && !ids.has(p.id)).forEach((p) => this.pdmCache[key].push(U.clone(p)));
            });
            if (['dashboard', 'projects', 'recommendations', 'report'].includes(this.view)) this.render({ keepScroll: true });
        },

        async selectPair(sourceId, siteId, opts = {}) {
            const a = this.a;
            const hasWork = Object.values(a.metrics).some((m) => m.status !== 'Not started');
            const changing = (sourceId && a.pdm.sourceId && sourceId !== a.pdm.sourceId) || (siteId && a.pdm.siteId && siteId !== a.pdm.siteId);
            if (hasWork && changing && !opts.silent) {
                const nextSource = sourceId || a.pdm.sourceId; const nextSite = siteId || a.pdm.siteId;
                const nameOf = (id) => { const p = [...this.pdmCache.sources, ...this.pdmCache.sites].find((x) => x.id === id); return p ? p.shortName : id; };
                const choice = await new Promise((resolve) => {
                    let done = false;
                    C.modal.open({
                        title: 'Change project pair',
                        submitLabel: 'Start a new assessment with this pair',
                        body: `<p>This assessment already has scores for <strong>${U.esc(a.pdm.source ? a.pdm.source.data.shortName : '—')} → ${U.esc(a.pdm.site ? a.pdm.site.data.shortName : '—')}</strong>. Scores judge one specific pair, so they do not carry over to <strong>${U.esc(nameOf(nextSource))} → ${U.esc(nameOf(nextSite))}</strong>.</p>
                            <ul class="tight small">
                              <li><strong>Start a new assessment with this pair</strong> (recommended): this assessment stays as it is; the new one gets the same team and weights.</li>
                              <li><strong>Change pair and reset the scores</strong>: scores, confidence, statuses, reviews, screening and the recommendation are cleared. Team, weights, evidence and risks stay; the old scores remain in the History.</li>
                            </ul>
                            <p><button type="button" class="button secondary" id="pairReset">Change pair and reset the scores</button></p>`,
                        onSubmit: () => { done = true; resolve('new'); return true; }
                    });
                    const dlg = document.getElementById('modal');
                    U.$('#pairReset', dlg).addEventListener('click', () => { done = true; resolve('reset'); C.modal.close(); });
                    dlg.addEventListener('close', () => { if (!done) resolve('cancel'); }, { once: true });
                });
                if (choice === 'cancel') return;
                if (choice === 'new') {
                    const weights = a.weights ? { ...a.weights } : null; const preset = a.weightsPreset;
                    await this.newAssessment({ copyTeam: true, sourceId: nextSource, siteId: nextSite, detail: `New pair started from "${a.title}"` });
                    if (weights) { this.a.weights = weights; this.a.weightsPreset = preset; this.save(false); this.render({ keepScroll: true }); }
                    U.toast(`New assessment started for this pair. "${a.title}" is unchanged (Assessment selector, top left).`, 'success', 6000);
                    return;
                }
                // Reset: keep a record of the old scores in the History, then clear the pair-specific judgements.
                const old = Object.entries(a.metrics).filter(([, m]) => m.score !== '').map(([id, m]) => `${id}: ${m.score}${m.finalScore !== '' && m.finalScore !== m.score ? ` (agreed ${m.finalScore})` : ''} ${m.status}`).join('; ');
                this.log('Scores reset for a new project pair', 'assessment', a.id, { detail: `Previous pair ${a.pdm.sourceId || '—'} → ${a.pdm.siteId || '—'}. Previous scores: ${old}` });
                Object.values(a.metrics).forEach((m) => Object.assign(m, { score: '', confidence: '', scoreAiAssisted: false, finalScore: '', reviewerComment: '', status: 'Not started', submittedAt: null, reviewedAt: null, reviewedBy: null, approvedAt: null, approvedBy: null }));
                a.screening.answers = a.screening.answers.map(() => ({ value: '', note: '' })); a.screening.confirmedBy = null; a.screening.confirmedAt = null;
                a.decision = { value: '', conditions: '', rationale: '', finalised: false, finalisedBy: null, finalisedAt: null, acknowledgedOpenIssues: false };
                opts = { ...opts, retitle: true };
            }
            try {
                const [source, site] = await Promise.all([sourceId ? RSA.PDM.get(sourceId) : null, siteId ? RSA.PDM.get(siteId) : null]);
                if (source) { if (a.pdm.source) a.pdm.snapshotHistory.push({ side: 'source', ...a.pdm.source, replacedAt: U.nowIso() }); a.pdm.source = RSA.PDM.snapshot(source); a.pdm.sourceId = source.id; a.pdm.pendingChanges.source = []; }
                if (site) { if (a.pdm.site) a.pdm.snapshotHistory.push({ side: 'site', ...a.pdm.site, replacedAt: U.nowIso() }); a.pdm.site = RSA.PDM.snapshot(site); a.pdm.siteId = site.id; a.pdm.pendingChanges.site = []; }
                this.prefillFromPdm();
                this.log('PDM data imported', 'pdm', `${a.pdm.sourceId || '—'} → ${a.pdm.siteId || '—'}`, { detail: `Snapshot: ${a.pdm.source ? `${a.pdm.source.id} v${a.pdm.source.version}` : '—'}, ${a.pdm.site ? `${a.pdm.site.id} v${a.pdm.site.version}` : '—'}` });
                if (a.pdm.source && a.pdm.site && (a.title === 'New replication assessment' || opts.retitle)) a.title = `${a.pdm.source.data.shortName.split(' (')[0]} → ${a.pdm.site.data.shortName.split(' (')[0]}`;
                this.save(true);
                this.render({ keepScroll: true });
                if (!opts.silent) U.toast((a.pdm.source && a.pdm.source.excel) || (a.pdm.site && a.pdm.site.excel) ? 'Project data copied (Excel projects included).' : 'PDM data imported and snapshot stored.', 'success');
            } catch (err) {
                U.toast(`PDM error: ${err.message}`, 'error', 5000);
            }
        },

        prefillFromPdm() {
            const a = this.a;
            const src = a.pdm.source && a.pdm.source.data;
            const site = a.pdm.site && a.pdm.site.data;
            const setIfPdm = (key, value) => {
                if (value === undefined || value === null || value === '') return;
                if (a.provenance[key] === 'human' && a.project[key]) return; // never overwrite manual values
                a.project[key] = value; a.provenance[key] = 'pdm';
            };
            if (src) setIfPdm('adaptationType', src.adaptationType);
            if (site) setIfPdm('organisation', site.institutional && site.institutional.organisation);
            if (src && site) setIfPdm('scope', `Replication of ${src.name} at ${site.name}.`);
        },

        async checkPdmUpdates(silent = false) {
            const a = this.a;
            if (!a || (!a.pdm.source && !a.pdm.site)) return;
            try {
                let changed = false;
                for (const side of ['source', 'site']) {
                    const snap = a.pdm[side];
                    if (!snap || (snap.local && !snap.excel)) continue;
                    const current = await RSA.PDM.get(snap.id);
                    if (!current) continue;
                    const diff = current.version !== snap.version ? RSA.PDM.diff(snap.data, current) : [];
                    if (JSON.stringify(diff) !== JSON.stringify(a.pdm.pendingChanges[side] || [])) changed = true;
                    a.pdm.pendingChanges[side] = diff;
                    a.pdm[`${side}Latest`] = { version: current.version, lastUpdated: current.lastUpdated };
                }
                a.pdm.lastCheckedAt = U.nowIso();
                this.save(false);
                if (changed || !silent) this.render({ keepScroll: true });
                if (!silent) U.toast('PDM checked for updates.', 'info');
            } catch (err) {
                if (!silent) U.toast(`Could not reach PDM: ${err.message}`, 'error');
            }
        },

        async acceptPdmUpdate(side) {
            const a = this.a;
            const snap = a.pdm[side];
            if (!snap) return;
            let current;
            try { current = await RSA.PDM.get(snap.id); } catch (err) {
                U.toast(`Could not get the updated data: ${err.message}`, 'error', 9000); return;
            }
            if (!current) {
                const name = (snap.data && (snap.data.shortName || snap.data.name)) || snap.id;
                U.toast(`${name} was not found in ${RSA.PDM.adapterLabel}. If this is a demo project, choose "Demo projects (built in)" in Settings and try again.`, 'error', 9000);
                return;
            }
            const changes = a.pdm.pendingChanges[side] || [];
            a.pdm.snapshotHistory.push({ side, ...snap, replacedAt: U.nowIso() });
            a.pdm[side] = RSA.PDM.snapshot(current);
            a.pdm.pendingChanges[side] = [];
            this.prefillFromPdm();
            this.log('PDM snapshot updated', 'pdm', snap.id, { from: `v${snap.version}`, to: `v${current.version}`, detail: changes.map((c) => c.path).join(', ') });
            const affected = RSA.Methodology.allMetrics().filter((m) => m.pdmFields.some((p) => changes.some((c) => c.path === p)) && a.metrics[m.id].status !== 'Not started');
            this.save(true);
            this.render({ keepScroll: true });
            U.toast(affected.length ? `Snapshot updated. Re-check metrics scored on changed data: ${affected.map((m) => m.id).join(', ')}.` : 'Snapshot updated.', affected.length ? 'warning' : 'success', 6000);
        },

        setWeights(w) {
            const a = this.a;
            if (a.decision.finalised) { U.toast('Weights are locked after the final recommendation.', 'error'); return; }
            if (!this.user || this.user.role !== 'lead') { U.toast('Only the lead assessor can change the weights.', 'error'); return; }
            const before = M.weightsOf(a);
            a.weights = { ...w };
            const p = M.presetFor(a.weights);
            this.log('Weights changed', 'assessment', a.id, { field: 'weights', from: M.weightsLabel(before), to: M.weightsLabel(a.weights), detail: p ? p.name : 'Custom weights' });
            this.save(true);
            this.render({ keepScroll: true });
            const calc = this.calcCache;
            U.toast(`Weights set to ${p ? p.name : 'custom'} (${M.weightsLabel(a.weights)}).${calc && calc.rss !== null ? ` RSS is now ${calc.rss.toFixed(1)}.` : ''}`, 'success', 6000);
        },

        syncPayload() {
            const a = this.a; const calc = this.calcCache || this.calc();
            return {
                assessmentId: a.id, title: a.title, methodologyVersion: a.methodologyVersion,
                sourceProjectId: a.pdm.sourceId, sourceVersionUsed: a.pdm.source && a.pdm.source.version,
                replicationSiteId: a.pdm.siteId, siteVersionUsed: a.pdm.site && a.pdm.site.version,
                rss: calc.rss === null ? null : Number(calc.rss.toFixed(1)), rssStatus: calc.rssStatus,
                weights: M.weightsOf(a), weightsPreset: (M.presetFor(M.weightsOf(a)) || { name: 'Custom' }).name,
                dimensions: calc.dims.map((d) => ({ id: d.id, name: d.name, weight: d.weight, score: d.score === null ? null : Number(d.score.toFixed(1)) })),
                evidenceQualityPct: calc.evidenceQuality === null ? null : Math.round(calc.evidenceQuality),
                confidencePct: calc.confidence === null ? null : Math.round(calc.confidence),
                criticalRisksUnresolved: calc.risks.criticalUnresolved.map((r) => ({ id: r.id, description: r.description })),
                decision: { value: a.decision.value, conditions: a.decision.conditions, finalisedBy: W.memberName(a, a.decision.finalisedBy), finalisedAt: a.decision.finalisedAt },
                team: a.team.map((t) => ({ name: t.name, role: t.role, organisation: t.organisation })),
                dataAddedByTeam: U.clone(a.pdm.manual || {})
            };
        },

        fingerprint(p) { return JSON.stringify([p.rss, p.dimensions.map((d) => d.score), p.decision.value, p.decision.finalisedAt, p.sourceVersionUsed, p.siteVersionUsed, p.dataAddedByTeam]); },

        refreshSyncState() {
            const a = this.a;
            if (!a || a.pdm.sync.status === 'not-synced') return;
            const fp = this.fingerprint(this.syncPayload());
            a.pdm.sync.status = fp === a.pdm.sync.pushedFingerprint ? 'synced' : 'outdated';
        },

        async syncToPdm() {
            const a = this.a;
            if (!a.decision.finalised) { U.toast('Only finalised (approved) results can be synced to the PDM.', 'error'); return; }
            if (!W.canFinalise(this.user)) { U.toast('Only the lead assessor or reviewer can sync results.', 'error'); return; }
            if ((a.pdm.source && a.pdm.source.local) || (a.pdm.site && a.pdm.site.local)) { U.toast('This assessment uses projects imported from Excel that are not in the project database yet. Select the matching PDM records under Projects before syncing.', 'error', 7000); return; }
            const payload = this.syncPayload();
            try {
                const res = await RSA.PDM.pushResults(payload);
                a.pdm.sync = { ...a.pdm.sync, status: 'synced', lastPushAt: res.receivedAt || U.nowIso(), receiptId: res.receiptId, pushedFingerprint: this.fingerprint(payload), history: [...(a.pdm.sync.history || []), { at: U.nowIso(), receiptId: res.receiptId, by: this.user.id, rss: payload.rss, decision: payload.decision.value }] };
                this.log('Synced to PDM', 'pdm', res.receiptId, { detail: `RSS ${payload.rss}; decision ${payload.decision.value}` });
                this.save(true);
                this.render({ keepScroll: true });
                U.toast(`Results synced to PDM (receipt ${res.receiptId}).`, 'success');
            } catch (err) {
                U.toast(`Sync failed: ${err.message}`, 'error', 5000);
            }
        },

        importPdmDoc(docId) {
            const a = this.a;
            const docs = [...((a.pdm.site && a.pdm.site.data.documents) || []).map((d) => ({ ...d, owner: a.pdm.site.data.shortName })), ...((a.pdm.source && a.pdm.source.data.documents) || []).map((d) => ({ ...d, owner: a.pdm.source.data.shortName }))];
            const d = docs.find((x) => x.id === docId);
            if (!d) return;
            if (a.evidence.some((e) => e.pdmDocId === docId)) { U.toast('Already in the Evidence Log.'); return; }
            const rec = {
                id: `EV-${String(a.evidence.length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 5)}`, title: d.title, sourceType: d.type || 'PDM record', provider: d.provider, date: d.date,
                url: '', reliability: '', assumptions: '', notes: `Imported from PDM (${d.owner}). Reliability to be rated by the assessor.`, metricIds: [...(d.metrics || [])],
                provenance: 'pdm', pdmDocId: d.id, createdBy: this.user && this.user.id, createdAt: U.nowIso()
            };
            this.upsertEvidence(rec, null);
        },

        /* ---------------- Evidence, risks, team ---------------- */
        upsertEvidence(rec, existing) {
            const a = this.a;
            if (existing) {
                const i = a.evidence.findIndex((e) => e.id === existing.id);
                a.evidence[i] = rec;
                this.log('Evidence edited', 'evidence', rec.id, { detail: rec.title });
            } else {
                a.evidence.push(rec);
                this.log('Evidence added', 'evidence', rec.id, { detail: rec.title });
            }
            Object.entries(a.metrics).forEach(([id, st]) => {
                const linked = st.evidenceIds.includes(rec.id);
                const should = rec.metricIds.includes(id);
                if (should && !linked) st.evidenceIds.push(rec.id);
                if (!should && linked) st.evidenceIds = st.evidenceIds.filter((x) => x !== rec.id);
            });
            this.save(true);
            this.render({ keepScroll: true });
            U.toast(existing ? 'Evidence updated.' : 'Evidence added and linked.', 'success');
        },

        async deleteEvidence(id) {
            const ok = await C.confirm('Delete evidence', 'Remove this evidence item and unlink it from all metrics?', 'Delete');
            if (!ok) return;
            const a = this.a;
            const ev = a.evidence.find((e) => e.id === id);
            a.evidence = a.evidence.filter((e) => e.id !== id);
            Object.values(a.metrics).forEach((st) => { st.evidenceIds = st.evidenceIds.filter((x) => x !== id); });
            this.log('Evidence deleted', 'evidence', id, { detail: ev ? ev.title : '' });
            this.save(true);
            this.render({ keepScroll: true });
        },

        linkEvidence(metricId, evId, link = true) {
            const a = this.a;
            const st = a.metrics[metricId];
            const ev = a.evidence.find((e) => e.id === evId);
            if (!st || !ev) return;
            if (link) {
                if (!st.evidenceIds.includes(evId)) st.evidenceIds.push(evId);
                if (!ev.metricIds.includes(metricId)) ev.metricIds.push(metricId);
            } else {
                st.evidenceIds = st.evidenceIds.filter((x) => x !== evId);
                ev.metricIds = ev.metricIds.filter((x) => x !== metricId);
            }
            W.touchMetric(a, this.user, metricId);
            this.log(link ? 'Evidence linked' : 'Evidence unlinked', 'metric', metricId, { detail: `${evId} ${ev.title}` });
            this.save(true);
            this.render({ keepScroll: true });
        },

        upsertRisk(rec, existing) {
            const a = this.a;
            if (existing) {
                const i = a.risks.findIndex((r) => r.id === existing.id);
                const changes = ['status', 'likelihood', 'impact', 'critical', 'owner'].filter((k) => existing[k] !== rec[k]).map((k) => `${k}: ${existing[k]} → ${rec[k]}`);
                a.risks[i] = rec;
                this.log('Risk edited', 'risk', rec.id, { detail: changes.join('; ') || rec.description });
            } else {
                a.risks.push(rec);
                this.log('Risk added', 'risk', rec.id, { detail: `${rec.critical ? '[critical] ' : ''}${rec.description}` });
            }
            this.save(true);
            this.render({ keepScroll: true });
        },

        async deleteRisk(id) {
            const ok = await C.confirm('Delete risk', 'Remove this risk from the register? Consider setting it to Closed instead to keep the history.', 'Delete');
            if (!ok) return;
            const r = this.a.risks.find((x) => x.id === id);
            this.a.risks = this.a.risks.filter((x) => x.id !== id);
            this.log('Risk deleted', 'risk', id, { detail: r ? r.description : '' });
            this.save(true);
            this.render({ keepScroll: true });
        },

        upsertMember(rec, existing) {
            const a = this.a;
            if (existing) {
                const i = a.team.findIndex((t) => t.id === existing.id);
                a.team[i] = rec;
                this.log('Team member edited', 'team', rec.id, { detail: `${rec.name} (${rec.role})` });
            } else {
                a.team.push(rec);
                if (!a.currentUserId) a.currentUserId = rec.id;
                this.log('Team member added', 'team', rec.id, { detail: `${rec.name} (${rec.role})` });
            }
            this.save(true);
            this.render({ keepScroll: true });
        },

        async removeMember(id) {
            const a = this.a;
            if (a.team.length < 2) { U.toast('The team needs at least one member.', 'error'); return; }
            const m = a.team.find((t) => t.id === id);
            const ok = await C.confirm('Remove team member', `Remove <strong>${U.esc(m.name)}</strong>? Their metric assignments will be cleared (audit history is kept).`, 'Remove');
            if (!ok) return;
            a.team = a.team.filter((t) => t.id !== id);
            Object.values(a.metrics).forEach((st) => { if (st.assessorId === id) st.assessorId = ''; if (st.reviewerId === id) st.reviewerId = ''; });
            if (a.currentUserId === id) a.currentUserId = a.team[0].id;
            this.log('Team member removed', 'team', id, { detail: m.name });
            this.save(true);
            this.render({ keepScroll: true });
        },

        async metricAction(metricId, action) {
            let comment = '';
            if (action === 'return' || action === 'reopen') {
                comment = await C.promptText(action === 'return' ? `Return ${metricId} to assessor` : `Reopen ${metricId}`, 'Comment for the assessor (required)', 'What needs to change?');
                if (comment === null) return;
            }
            const st = this.a.metrics[metricId];
            if (action === 'submit' && st.evidenceIds.length === 0) U.toast(`${metricId} is submitted without linked evidence — the reviewer will see this gap.`, 'warning', 4500);
            const res = W.transition(this.a, this.user, metricId, action, { comment });
            if (!res.ok) { U.toast(res.error, 'error', 4500); return; }
            this.save(true);
            this.render({ keepScroll: true });
            U.toast(`${metricId}: ${res.from} → ${res.to}`, 'success');
        },

        insertAiRationale(metricId, text) {
            const a = this.a;
            if (!W.canEditAssessorFields(a, this.user, metricId)) { U.toast(`You cannot edit ${metricId} in its current status or role.`, 'error'); return; }
            const st = a.metrics[metricId];
            const from = st.rationale;
            st.rationale = st.rationale ? `${st.rationale}\n\n${text}` : text;
            st.rationaleAiAssisted = true;
            W.touchMetric(a, this.user, metricId);
            this.log('AI draft inserted into rationale', 'metric', metricId, { field: 'rationale', from: from.slice(0, 120), to: '(AI-assisted draft — requires human edit)' });
            this.save(true);
            this.ui.openMetric = metricId; this.ui.metricFilter = 'all';
            this.setView('assessment', { dim: M.dimensionOfMetric(metricId).id, metric: metricId });
            U.toast('AI draft inserted. Review and edit it before submitting.', 'warning', 5000);
        }
    };

    RSA.App = App;
    RSA.Views = RSA.Views || {};
    RSA.VIEW_LIST = VIEWS;

    document.addEventListener('DOMContentLoaded', () => (RSA.Login ? RSA.Login.guard(() => App.init()) : App.init()));
})(window.RSA);
