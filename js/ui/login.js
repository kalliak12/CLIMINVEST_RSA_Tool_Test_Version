/*
 * Simple sign-in screen for the test version (RSA.Edition.login).
 * Only one account: the username and the SHA-256 hash of the password are set in js/config/edition.js
 * (the password itself is not stored in the files). This keeps casual visitors out of a shared link;
 * it is not a server login — real accounts come later with the CLIMINVEST platform.
 * Signed-in state lasts until the browser tab is closed (sessionStorage).
 */
window.RSA = window.RSA || {};

(function (RSA) {
    'use strict';

    const KEY = 'climinvest-rsa-session';
    const cfg = () => (RSA.Edition && RSA.Edition.login) || null;
    const signedIn = () => { try { return sessionStorage.getItem(KEY) === (cfg() && cfg().hash); } catch (e) { return false; } };

    async function sha256(text) {
        if (!(window.crypto && crypto.subtle)) throw new Error('This browser cannot check the password here. Open the tool over https, from localhost or as a local file.');
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    function show(onSuccess) {
        const wrap = document.createElement('div');
        wrap.className = 'login-screen';
        wrap.innerHTML = `<form class="login-card" novalidate>
            <img src="images/climinvest-logo.png" alt="Climinvest" class="login-logo" />
            <h1>Replication Suitability Assessment</h1>
            <p class="muted small">Test version — please sign in.</p>
            <label>Username<input name="user" autocomplete="username" required /></label>
            <label>Password<input name="pass" type="password" autocomplete="current-password" required /></label>
            <p class="form-error" hidden></p>
            <button class="button primary" type="submit">Sign in</button>
          </form>`;
        document.body.appendChild(wrap);
        document.body.classList.add('locked');
        const form = wrap.querySelector('form'); const err = wrap.querySelector('.form-error');
        form.user.focus();
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            err.hidden = true;
            try {
                const okUser = form.user.value.trim() === cfg().user;
                const okPass = (await sha256(form.pass.value)) === cfg().hash;
                if (!okUser || !okPass) { err.textContent = 'Wrong username or password.'; err.hidden = false; form.pass.value = ''; form.pass.focus(); return; }
                try { sessionStorage.setItem(KEY, cfg().hash); } catch (x) { /* private mode: stays signed in until reload */ }
                wrap.remove(); document.body.classList.remove('locked');
                onSuccess();
            } catch (x) { err.textContent = x.message; err.hidden = false; }
        });
    }

    RSA.Login = {
        enabled: () => !!cfg(),
        /* Runs start() now if no login is needed or the user is signed in, otherwise after signing in. */
        guard(start) { if (!cfg() || signedIn()) { start(); return; } show(start); },
        signOut() { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } location.reload(); }
    };
})(window.RSA);
