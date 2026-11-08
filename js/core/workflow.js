/*
 * Review workflow, permissions and audit trail.
 * Draft → Submitted → Reviewed → Approved, with four-eyes rule: the assessor of a metric cannot review or approve it.
 * Permissions are role-based on the acting team member (prototype stand-in for real authentication).
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U;
    const M = RSA.Methodology;
    const isSet = (v) => v !== '' && v !== null && v !== undefined;

    const W = {
        currentUser(a) { return (a.team || []).find((t) => t.id === a.currentUserId) || null; },
        member(a, id) { return (a.team || []).find((t) => t.id === id) || null; },
        memberName(a, id) { const m = W.member(a, id); return m ? m.name : '—'; },
        roleOf(user) { return user ? M.roles[user.role] || M.roles.assessor : null; },

        canEditAssessorFields(a, user, metricId) {
            const st = a.metrics[metricId];
            if (!user || !st) return false;
            if (!['Not started', 'Draft'].includes(st.status)) return false;
            return st.assessorId === user.id || W.roleOf(user).canEditAll;
        },
        canEditReviewerFields(a, user, metricId) {
            const st = a.metrics[metricId];
            if (!user || !st || st.status !== 'Submitted') return false;
            if (st.assessorId === user.id) return false;
            return st.reviewerId === user.id || W.roleOf(user).canReview;
        },
        canManageTeam(user) { return !!user && user.role === 'lead'; },
        canFinalise(user) { return !!user && W.roleOf(user).canFinalise; },

        actionsFor(a, user, metricId) {
            const st = a.metrics[metricId];
            if (!user || !st) return [];
            const role = W.roleOf(user);
            const isAssessor = st.assessorId === user.id;
            const out = [];
            if (['Not started', 'Draft'].includes(st.status) && isAssessor) out.push({ id: 'submit', label: 'Submit for review', cls: 'primary' }); // only the assigned assessor submits
            if (st.status === 'Submitted' && !isAssessor && (st.reviewerId === user.id || role.canReview)) {
                out.push({ id: 'review', label: 'Mark reviewed', cls: 'primary' });
                out.push({ id: 'return', label: 'Return to assessor', cls: 'secondary' });
            }
            if (st.status === 'Reviewed' && !isAssessor && role.canApprove) {
                out.push({ id: 'approve', label: 'Approve', cls: 'primary' });
                out.push({ id: 'return', label: 'Return to assessor', cls: 'secondary' });
            }
            if (st.status === 'Approved' && user.role === 'lead' && !a.decision.finalised) out.push({ id: 'reopen', label: 'Reopen', cls: 'secondary' });
            return out;
        },

        transition(a, user, metricId, action, opts = {}) {
            const st = a.metrics[metricId];
            const allowed = W.actionsFor(a, user, metricId).some((x) => x.id === action);
            if (!allowed) return { ok: false, error: 'You are not permitted to perform this action in the current status.' };
            const from = st.status;
            const now = U.nowIso();
            if (action === 'submit') {
                const missing = [];
                if (!isSet(st.score)) missing.push('score');
                if (!isSet(st.confidence)) missing.push('confidence');
                if (!st.rationale || !st.rationale.trim()) missing.push('rationale');
                if (!st.assessorId) missing.push('assigned assessor');
                if (missing.length) return { ok: false, error: `Complete the ${missing.join(', ')} before submitting.` };
                st.status = 'Submitted'; st.submittedAt = now;
            } else if (action === 'review') {
                if (!isSet(st.finalScore)) st.finalScore = st.score;
                st.status = 'Reviewed'; st.reviewedAt = now; st.reviewedBy = user.id;
            } else if (action === 'approve') {
                st.status = 'Approved'; st.approvedAt = now; st.approvedBy = user.id;
            } else if (action === 'return' || action === 'reopen') {
                if (!opts.comment || !opts.comment.trim()) return { ok: false, error: 'A comment is required when returning or reopening a metric.' };
                st.reviewerComment = [st.reviewerComment, `[${U.fmtDate(now)} ${user.name}] ${opts.comment.trim()}`].filter(Boolean).join('\n');
                st.status = 'Draft'; st.approvedAt = null; st.approvedBy = null;
            }
            st.updatedAt = now; st.updatedBy = user.id;
            W.log(a, user, `Status ${action}`, 'metric', metricId, { field: 'status', from, to: st.status, comment: opts.comment || '' });
            return { ok: true, from, to: st.status };
        },

        /* Mark a metric as Draft when an assessor first edits it. */
        touchMetric(a, user, metricId) {
            const st = a.metrics[metricId];
            if (!st) return;
            if (st.status === 'Not started') {
                st.status = 'Draft';
                W.log(a, user, 'Status draft', 'metric', metricId, { field: 'status', from: 'Not started', to: 'Draft' });
            }
            st.updatedAt = U.nowIso();
            st.updatedBy = user ? user.id : null;
        },

        log(a, user, action, entity, entityId, extra = {}) {
            a.audit.unshift({
                id: U.uid('AU'), at: U.nowIso(), userId: user ? user.id : null, userName: user ? user.name : 'System',
                action, entity, entityId, field: extra.field || '', from: extra.from === undefined ? '' : extra.from, to: extra.to === undefined ? '' : extra.to,
                detail: extra.detail || extra.comment || ''
            });
            if (a.audit.length > 2000) a.audit.length = 2000;
        },

        /* Derived overall assessment status. */
        assessmentStatus(a, calc) {
            if (a.decision.finalised) return { label: 'Finalised', cls: 'success' };
            if (calc.approved === calc.total) return { label: 'Approved — awaiting decision', cls: 'info' };
            if (calc.submitted > 0) return { label: 'Under review', cls: 'info' };
            if (calc.scored > 0 || calc.screening.answered > 0) return { label: 'In progress', cls: 'warning' };
            return { label: 'Not started', cls: 'neutral' };
        }
    };

    RSA.Workflow = W;
})(window.RSA);
