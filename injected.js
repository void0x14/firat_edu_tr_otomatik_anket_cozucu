// OBS ANKET OTOMASYONU - Main World Script
// Bu script doğrudan sayfanın bağlamında çalışır ve __doPostBack'i çağırır.

(function () {
    // Sadece content_script'ten gelen güvenli mesajları dinle
    window.addEventListener('message', function (event) {
        if (!event.data || event.data.type !== 'OBS_POSTBACK_REQUEST') return;

        const { eventTarget, eventArgument } = event.data;
        console.log(`[OBS-Bridge] PostBack: ${eventTarget} (Arg: ${eventArgument})`);

        try {
            // Yöntem 1: Standart ASP.NET __doPostBack
            if (typeof window.__doPostBack === 'function') {
                window.__doPostBack(eventTarget, eventArgument);
            }
            // Yöntem 2: Form submit (Fallback)
            else {
                const form = document.querySelector('form');
                const targetField = document.querySelector('#__EVENTTARGET');
                const argField = document.querySelector('#__EVENTARGUMENT');

                if (form && targetField) {
                    targetField.value = eventTarget;
                    if (argField) argField.value = eventArgument || '';
                    form.submit();
                } else {
                    throw new Error('PostBack mekanizması bulunamadı');
                }
            }

            // Content script'e başarı mesajı dön
            window.postMessage({
                type: 'OBS_POSTBACK_RESPONSE',
                success: true
            }, '*',);

        } catch (e) {
            console.error('[OBS-Bridge] Hata:', e);
            window.postMessage({
                type: 'OBS_POSTBACK_RESPONSE',
                success: false,
                error: e.message
            }, '*');
        }
    });

    // ==================== AUTO MODAL CLOSER (MutationObserver) ====================
    // Sayfada beliren "Başarıyla kaydedildi" pencerelerini bridge beklemeden anında yakalar ve kapatır.
    const modalObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                const bodyText = document.body.innerText || '';
                if (bodyText.includes('başarıyla kaydedildi') || bodyText.includes('işlem başarılı')) {
                    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a'))
                        .filter(b => {
                            const txt = (b.innerText || b.value || '').toLowerCase();
                            return txt.includes('tamam') || txt.includes('kapat') || txt === 'ok';
                        })
                        .filter(b => b.offsetParent !== null);

                    if (buttons.length > 0) {
                        console.log('[OBS-Bridge] Success modal detected, clicking "Tamam" button.');
                        buttons[0].click();

                        // Başarıyı content script'e bildir
                        window.postMessage({ type: 'OBS_SUCCESS_EVENT' }, '*');
                    }
                }
            }
        }
    });

    modalObserver.observe(document.body, { childList: true, subtree: true });

    // Hazırız mesajı
    setTimeout(() => {
        window.postMessage({ type: 'OBS_BRIDGE_READY' }, '*');
        console.log('[OBS-Bridge] Bridge aktif ve dinliyor (MutationObserver aktif).');
    }, 500);
})();
