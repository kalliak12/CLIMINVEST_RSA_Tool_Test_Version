/*
 * "Send feedback": a short form whose text goes out by email (the tester's own mail program opens with the
 * message filled in), or is copied / saved as a file to send another way. Nothing is sent automatically.
 * The address is set in js/config/edition.js: RSA.Edition.feedback = { email: '...' }.
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const U = RSA.U; const C = RSA.C;
    const TYPES = ['Something does not work', 'Something is unclear', 'Idea / suggestion', 'Question', 'Other'];
    const pageName = (app) => { const t = document.getElementById('pageTitle'); return (t && t.textContent.trim()) || app.view || ''; };
    const address = () => (RSA.Edition && RSA.Edition.feedback && RSA.Edition.feedback.email) || '';

    function compose(app, fd) {
        const a = app.a;
        const view = pageName(app);
        const lines = [
            `Type: ${fd.get('type')}`,
            `Where in the tool: ${fd.get('where') || view}`,
            `From: ${fd.get('name') || '(not given)'}`,
            '',
            String(fd.get('message') || '').trim(),
            '',
            '--',
            `Assessment: ${a ? a.title : '-'}`,
            `Page: ${view} · ${RSA.Edition && RSA.Edition.test ? 'test version' : 'full version'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
            ...(fd.get('tech') ? [`Browser: ${navigator.userAgent}`] : [])
        ];
        return { subject: `RSA tool feedback: ${fd.get('type')}`, text: lines.join('\n') };
    }

    function saveFile(msg) {
        const blob = new Blob([`${msg.subject}\n\n${msg.text}\n`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob); const link = document.createElement('a');
        link.href = url; link.download = `rsa-feedback-${new Date().toISOString().slice(0, 10)}.txt`; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    RSA.Feedback = {
        open(app) {
            const to = address();
            const view = pageName(app);
            C.modal.open({
                title: 'Send feedback', submitLabel: to ? 'Open in my email' : 'Save as a file',
                body: `<p class="small">Tell us what worked, what did not, or what was unclear. ${to ? `Your email program opens with the message ready to send to <strong>${U.esc(to)}</strong>; you can read it before sending.` : 'The message is saved as a small text file that you can send to the RSA team.'} The page and assessment name are added so we can find the problem. Nothing is sent automatically.</p>
                  <div class="form-grid two">
                    <label>Type<select name="type">${TYPES.map((t) => `<option>${U.esc(t)}</option>`).join('')}</select></label>
                    <label>Where in the tool<input name="where" value="${U.esc(view)}" /></label>
                    <label class="span-2">Your feedback<textarea name="message" rows="6" required data-label="Your feedback" placeholder="What did you do, what happened, what did you expect?"></textarea></label>
                    <label class="span-2">Your name (optional)<input name="name" value="${U.esc(app.user ? app.user.name : '')}" /></label>
                    <label class="check span-2"><input type="checkbox" name="tech" value="1" checked /> Include technical details (browser, version and operating system) to help us reproduce problems</label>
                  </div>
                  <div class="button-row"><button type="button" class="button secondary small" data-fb="copy">Copy the text</button>${to ? '<button type="button" class="button secondary small" data-fb="file">Save as a file instead</button>' : ''}</div>`,
                onOpen(dlg) {
                    dlg.addEventListener('click', async (e) => {
                        const b = e.target.closest('[data-fb]'); if (!b) return;
                        const fd = new FormData(dlg.querySelector('form'));
                        if (!String(fd.get('message') || '').trim()) { U.toast('Write your feedback first.', 'error'); return; }
                        const msg = compose(app, fd);
                        if (b.dataset.fb === 'file') { saveFile(msg); U.toast('Feedback saved as a file. Send it to the RSA team.', 'success', 5000); return; }
                        try { await navigator.clipboard.writeText(`${msg.subject}\n\n${msg.text}`); U.toast('Copied. Paste it into an email or chat to the RSA team.', 'success', 5000); } catch (err) { U.toast('Could not copy - use "Save as a file".', 'error'); }
                    });
                },
                onSubmit(form, fd) {
                    if (!String(fd.get('message') || '').trim()) return 'Write your feedback first.';
                    const msg = compose(app, fd);
                    if (to) {
                        const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.text)}`;
                        window.location.href = href.length > 1900 ? href.slice(0, 1900) : href;
                        U.toast('Your email program should open now. If nothing happens, use "Copy the text".', 'info', 6000);
                    } else { saveFile(msg); U.toast('Feedback saved as a file. Send it to the RSA team.', 'success', 5000); }
                    return true;
                }
            });
        }
    };
})(window.RSA);
