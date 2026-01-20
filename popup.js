document.addEventListener('DOMContentLoaded', async () => {
    const scoreSelect = document.getElementById('scoreSelect');
    const saveMsg = document.getElementById('saveMsg');
    const openObsBtn = document.getElementById('openObs');
    const downloadLogsBtn = document.getElementById('downloadLogs');
    const clearLogsBtn = document.getElementById('clearLogs');
    const logCountEl = document.getElementById('logCount');

    const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

    if (!isExtension) {
        console.warn("[System] Not running in extension context. Storage is disabled.");
        const warning = document.createElement('div');
        warning.style.cssText = "color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; margin-bottom: 10px; font-size: 12px; border-radius: 4px;";
        warning.innerHTML = "⚠️ <b>Hata:</b> Eklenti olarak yüklenmedi! Lütfen <code>chrome://extensions</code> üzerinden 'Paketlenmemiş öğe yükle' ile klasörü seçin.";
        document.body.prepend(warning);
        return;
    }

    // Load saved preference - Promise API (MV3)
    try {
        const result = await chrome.storage.local.get(['surveyScore']);
        if (result.surveyScore) {
            scoreSelect.value = result.surveyScore;
            console.log('[Popup] Loaded score from storage:', result.surveyScore);
        } else {
            console.log('[Popup] No saved score, using default: 5');
        }
    } catch (error) {
        console.error('[Popup] Error loading score:', error);
    }

    // Update log count
    updateLogCount();

    // Save preference on change - Promise API (MV3)
    scoreSelect.addEventListener('change', async () => {
        const val = scoreSelect.value;
        try {
            await chrome.storage.local.set({ surveyScore: val });
            console.log('[Popup] Saved score to storage:', val);

            saveMsg.style.display = 'block';
            saveMsg.textContent = `✓ Puan ${val} olarak kaydedildi.`;
            setTimeout(() => {
                saveMsg.style.display = 'none';
            }, 2000);
        } catch (error) {
            console.error('[Popup] Error saving score:', error);
            saveMsg.style.display = 'block';
            saveMsg.textContent = '❌ Kaydetme hatası!';
            saveMsg.style.color = '#dc3545';
        }
    });

    // Open OBS
    openObsBtn.addEventListener('click', () => {
        const checkUrl = 'https://obs.firat.edu.tr/oibs/std/';
        chrome.tabs.create({ url: checkUrl }, (tab) => {
            setTimeout(() => {
                chrome.tabs.get(tab.id, (updatedTab) => {
                    if (updatedTab && (updatedTab.url.includes('login') || updatedTab.url.includes('giris'))) {
                        chrome.tabs.update(tab.id, {
                            url: 'https://obs.firat.edu.tr/oibs/ogrenci/login.aspx'
                        });
                    }
                });
            }, 2000);
        });
    });

    // Download debug logs
    downloadLogsBtn.addEventListener('click', async () => {
        try {
            const result = await chrome.storage.local.get(['debug_logs']);
            const logs = result.debug_logs || [];

            if (logs.length === 0) {
                alert('Henüz log kaydı yok.');
                return;
            }

            // Log'ları okunabilir formata çevir
            const logText = logs.map(log => {
                const data = log.data ? ` | Data: ${JSON.stringify(log.data)}` : '';
                return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${data} | URL: ${log.url}`;
            }).join('\n');

            // Dosya olarak indir
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `obs_debug_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[Popup] Error downloading logs:', error);
            alert('Log indirme hatası: ' + error.message);
        }
    });

    // Clear logs
    clearLogsBtn.addEventListener('click', async () => {
        if (confirm('Tüm debug loglarını silmek istediğinize emin misiniz?')) {
            try {
                await chrome.storage.local.set({ debug_logs: [] });
                updateLogCount();
                alert('Loglar temizlendi.');
            } catch (error) {
                console.error('[Popup] Error clearing logs:', error);
            }
        }
    });

    // Update log count display
    async function updateLogCount() {
        try {
            const result = await chrome.storage.local.get(['debug_logs']);
            const logs = result.debug_logs || [];
            logCountEl.textContent = `📊 ${logs.length} log kaydı mevcut`;
        } catch (error) {
            logCountEl.textContent = '📊 Log sayısı alınamadı';
        }
    }
});
