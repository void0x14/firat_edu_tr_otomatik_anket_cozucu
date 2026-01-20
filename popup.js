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
        // Önce giriş yapılıp yapılmadığını kontrol et
        const checkUrl = 'https://obs.firat.edu.tr/oibs/std/';
        
        if (isExtension) {
            // Yeni sekme aç ve kontrol et
            chrome.tabs.create({ url: checkUrl }, (tab) => {
                // Sekme yüklendikten sonra kontrol et
                setTimeout(() => {
                    chrome.tabs.get(tab.id, (updatedTab) => {
                        if (updatedTab.url.includes('login') || updatedTab.url.includes('giris')) {
                            // Giriş sayfasına yönlendirildi, öğrenci girişine git
                            chrome.tabs.update(tab.id, { 
                                url: 'https://obs.firat.edu.tr/oibs/ogrenci/login.aspx' 
                            });
                        }
                        // Eğer zaten giriş yapılmışsa, mevcut URL'de kalır
                    });
                }, 2000);
            });
        } else {
            // Eklenti değilse direkt aç
            window.open(checkUrl, '_blank');
        }
    });
});
