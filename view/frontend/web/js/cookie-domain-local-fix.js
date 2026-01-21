/**
 * Force host-only cookies for local hosts and ensure form_key cookie is set.
 */
(function () {
    function applyCookieConfigDomain() {
        if (typeof window.COOKIE_CONFIG === 'object') {
            window.COOKIE_CONFIG.domain = null;
        }
    }

    function setFormKeyCookieFromDom() {
        var input = document.querySelector('input[name="form_key"]');
        if (!input || !input.value) {
            return;
        }
        // Host-only, session lifetime, Lax same-site.
        document.cookie = 'form_key=' + encodeURIComponent(input.value) + '; path=/; samesite=lax';
    }

    // Run immediately in case COOKIE_CONFIG is already present.
    applyCookieConfigDomain();

    // Ensure we run after DOM is ready so the hidden form_key input exists.
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setFormKeyCookieFromDom();
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            applyCookieConfigDomain();
            setFormKeyCookieFromDom();
        }, {once: true});
    }
})();
