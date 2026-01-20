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

    // Hazırız mesajı
    setTimeout(() => {
        window.postMessage({ type: 'OBS_BRIDGE_READY' }, '*');
        console.log('[OBS-Bridge] Bridge aktif ve dinliyor.');
    }, 500);
})();
