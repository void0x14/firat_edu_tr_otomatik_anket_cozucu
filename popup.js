document.addEventListener('DOMContentLoaded', () => {
    const scoreSelect = document.getElementById('scoreSelect');
    const saveMsg = document.getElementById('saveMsg');
    const openObsBtn = document.getElementById('openObs');

    const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

    if (!isExtension) {
        console.warn("[System] Not running in extension context. Storage is disabled.");
        const warning = document.createElement('div');
        warning.style.cssText = "color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; margin-bottom: 10px; font-size: 12px; border-radius: 4px;";
        warning.innerHTML = "⚠️ <b>Hata:</b> Eklenti olarak yüklenmedi! Lütfen <code>chrome://extensions</code> üzerinden 'Paketlenmemiş öğe yükle' ile klasörü seçin.";
        document.body.prepend(warning);
    }

    // Load saved preference
    if (isExtension) {
        chrome.storage.local.get(['surveyScore'], (result) => {
            if (result.surveyScore) {
                scoreSelect.value = result.surveyScore;
            }
        });
    }

    // Save preference on change
    scoreSelect.addEventListener('change', () => {
        const val = scoreSelect.value;
        if (isExtension) {
            chrome.storage.local.set({ surveyScore: val }, () => {
                saveMsg.style.display = 'block';
                setTimeout(() => {
                    saveMsg.style.display = 'none';
                }, 2000);
            });
        } else {
            localStorage.setItem('surveyScore', val);
            saveMsg.innerText = "✓ Ayarlar (Yerel) kaydedildi.";
            saveMsg.style.display = 'block';
            setTimeout(() => {
                saveMsg.style.display = 'none';
            }, 2000);
        }
    });

    openObsBtn.addEventListener('click', () => {
        const url = 'https://obs.firat.edu.tr/oibs/std/';
        if (isExtension) {
            chrome.tabs.create({ url });
        } else {
            window.open(url, '_blank');
        }
    });
});
