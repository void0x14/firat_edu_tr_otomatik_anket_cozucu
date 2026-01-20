/**
 * OBS ANKET OTOMASYONU v3.0 - CSP BYPASS & NAVIGATION ENGINE
 * 
 * Mimari:
 * 1. Content Script (Isolated World) - Element tespiti ve UI
 * 2. Injected Script (Main World) - __doPostBack çağrıları
 * 3. postMessage Bridge - İki dünya arası iletişim
 */

(function () {
    'use strict';

    // ==================== CONFIG ====================
    const CONFIG = {
        defaultHighScoreValue: "5",
        autoFillDelay: 2000,
        navigationDelay: 1500,
        retryDelay: 5000,
        maxRetries: 3,
        unfilledAttr: 'data-anket-processed'
    };

    // ==================== DEBUG LOG SYSTEM ====================
    const DebugLog = {
        logs: [],

        add(level, message, data = null) {
            const entry = {
                timestamp: new Date().toISOString(),
                level: level.toUpperCase(),
                message: message,
                context: data,
                url: window.location.href.split('?')[0] // URL parametrelerini temizle (Gizlilik)
            };
            this.logs.push(entry);

            const prefix = `[OBS-${level.toUpperCase()}]`;
            const style = level === 'error' ? 'color: #ff4d4d; font-weight: bold;' :
                level === 'warn' ? 'color: #ffa500;' : 'color: #00ff00;';

            console.log(`%c${prefix} ${message}`, style, data || '');

            this.saveToStorage();
        },

        info(msg, data) { this.add('info', msg, data); },
        warn(msg, data) { this.add('warn', msg, data); },
        error(msg, data) { this.add('error', msg, data); },

        saveToStorage() {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ debug_logs: this.logs.slice(-500) }); // Son 500 log
            }
        }
    };

    // ==================== MAIN WORLD BRIDGE ====================
    let bridgeReady = false;

    function injectMainWorldScript() {
        return new Promise((resolve) => {
            // Bridge zaten hazırsa bekle
            if (bridgeReady) {
                resolve();
                return;
            }

            // Injected.js'i sayfaya ekle
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('injected.js');
            script.onload = function () {
                this.remove(); // Temizlik
            };
            (document.head || document.documentElement).appendChild(script);

            // Bridge hazır mesajını bekle
            const handler = (event) => {
                if (event.data && event.data.type === 'OBS_BRIDGE_READY') {
                    bridgeReady = true;
                    window.removeEventListener('message', handler);
                    DebugLog.info('Main World Bridge hazır');
                    resolve();
                }
            };
            window.addEventListener('message', handler);

            // 2 saniye timeout
            setTimeout(() => {
                if (!bridgeReady) {
                    DebugLog.warn('Bridge timeout, devam ediliyor');
                    resolve();
                }
            }, 2000);
        });
    }

    function triggerPostBack(eventTarget, eventArgument) {
        return new Promise((resolve, reject) => {
            DebugLog.info(`PostBack tetikleniyor: ${eventTarget}`);

            const handler = (event) => {
                if (event.data && event.data.type === 'OBS_POSTBACK_RESPONSE') {
                    window.removeEventListener('message', handler);
                    if (event.data.success) {
                        DebugLog.info(`PostBack başarılı (${event.data.method})`);
                        resolve(event.data);
                    } else {
                        DebugLog.error('PostBack başarısız', event.data.error);
                        reject(new Error(event.data.error));
                    }
                }
            };
            window.addEventListener('message', handler);

            // Main World'e mesaj gönder
            window.postMessage({
                type: 'OBS_POSTBACK_REQUEST',
                eventTarget,
                eventArgument
            }, '*');

            // 5 saniye timeout
            setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('PostBack timeout'));
            }, 5000);
        });
    }

    // ==================== LINK PARSER ====================
    function parsePostBackHref(href) {
        if (!href) return null;

        // javascript:__doPostBack('ctl00$ContentPlaceHolder1$gvDersler','Select$2')
        const match = href.match(/__doPostBack\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/);
        if (match) {
            return {
                eventTarget: match[1],
                eventArgument: match[2]
            };
        }
        return null;
    }

    // ==================== UI OVERLAY ====================
    function showOverlay(message, isError = false) {
        const id = 'anket-solver-overlay';
        let overlay = document.getElementById(id);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = id;
            overlay.style.cssText = `
                position: fixed; top: 20px; right: 20px; padding: 15px 25px;
                border-radius: 12px; font-weight: 600; z-index: 2147483647;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                font-family: system-ui, sans-serif; max-width: 400px;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.backgroundColor = isError ? '#dc3545' : '#28a745';
        overlay.style.color = 'white';
        overlay.innerHTML = `🚀 ${message}`;
        overlay.style.opacity = '1';
        setTimeout(() => { if (overlay) overlay.style.opacity = '0'; }, 5000);
    }

    // ==================== NAVIGATION ENGINE ====================
    const NavigationState = {
        UNKNOWN: 'UNKNOWN',
        MAIN_PAGE: 'MAIN_PAGE',
        GRADE_LIST: 'GRADE_LIST',
        SURVEY_FORM: 'SURVEY_FORM'
    };

    function detectCurrentState() {
        const url = window.location.href.toLowerCase();
        const bodyText = (document.body.innerText || '').toLowerCase();

        // Form tespiti - radio butonları veya select'ler varsa
        const hasRadios = document.querySelectorAll('input[type="radio"]').length > 0;
        const hasFormSelects = document.querySelectorAll('select').length > 3; // En az 3 select varsa form

        if (hasRadios || hasFormSelects) {
            // Anket soruları içeriyor mu kontrol et
            if (bodyText.includes('kesinlikle') || bodyText.includes('katılıyorum') ||
                bodyText.includes('dersin') || bodyText.includes('öğretim')) {
                DebugLog.info('State: SURVEY_FORM');
                return NavigationState.SURVEY_FORM;
            }
        }

        // Zorunlu anket linkleri varsa not listesindeyiz
        const zorunluLinks = findZorunluAnketLinks();
        if (zorunluLinks.length > 0) {
            DebugLog.info('State: GRADE_LIST', { linkCount: zorunluLinks.length });
            return NavigationState.GRADE_LIST;
        }

        // Not listesi sayfasında mıyız?
        if (url.includes('not_listesi') || bodyText.includes('not listesi')) {
            DebugLog.info('State: GRADE_LIST (URL based)');
            return NavigationState.GRADE_LIST;
        }

        // Ana sayfa veya duyuru sayfası
        if (url.includes('index.aspx') || url.includes('duyuru')) {
            DebugLog.info('State: MAIN_PAGE');
            return NavigationState.MAIN_PAGE;
        }

        DebugLog.info('State: UNKNOWN');
        return NavigationState.UNKNOWN;
    }

    // ==================== ZORUNLU ANKET DETECTION ====================
    function findZorunluAnketLinks() {
        const allLinks = document.querySelectorAll('a');
        const zorunluLinks = [];

        for (const link of allLinks) {
            const text = (link.innerText || link.textContent || '').trim().toLowerCase();
            const href = link.getAttribute('href') || '';

            if ((text.includes('zorunlu') && text.includes('anket')) || text === 'zorunlu anket') {
                if (link.offsetParent !== null && !link.hasAttribute(CONFIG.unfilledAttr)) {
                    zorunluLinks.push({
                        element: link,
                        text: link.innerText.trim(),
                        href: href,
                        postBackParams: parsePostBackHref(href)
                    });
                }
            }
        }

        return zorunluLinks;
    }

    // ==================== MENU NAVIGATION ====================
    async function navigateToGradeList() {
        DebugLog.info('Not Listesi sayfasına navigasyon başlıyor...');
        showOverlay('Not Listesi sayfasına gidiliyor...');

        // "Ders ve Dönem İşlemleri" veya "Not Listesi" linkini bul
        const allLinks = document.querySelectorAll('a, span[onclick], div[onclick]');

        for (const element of allLinks) {
            const text = (element.innerText || element.textContent || '').toLowerCase();
            const href = element.getAttribute('href') || '';
            const onclick = element.getAttribute('onclick') || '';

            // "Not Listesi" linkini ara
            if (text.includes('not listesi') || text.includes('not listem')) {
                DebugLog.info('Not Listesi linki bulundu', { text: element.innerText });

                const postBackParams = parsePostBackHref(href) || parsePostBackHref(onclick);

                if (postBackParams) {
                    try {
                        await triggerPostBack(postBackParams.eventTarget, postBackParams.eventArgument);
                        return true;
                    } catch (error) {
                        DebugLog.error('PostBack hatası', error.message);
                    }
                } else if (href && !href.startsWith('javascript:')) {
                    // Normal link - tıkla
                    element.click();
                    return true;
                } else {
                    // PostBack parse edilemedi ama tıklamayı dene
                    element.click();
                    return true;
                }
            }
        }

        // "Ders ve Dönem İşlemleri" menüsünü bul ve aç
        for (const element of allLinks) {
            const text = (element.innerText || element.textContent || '').toLowerCase();

            if (text.includes('ders') && text.includes('dönem')) {
                DebugLog.info('Ders ve Dönem İşlemleri menüsü bulundu');
                element.click();

                // Menü açılmasını bekle ve tekrar "Not Listesi" ara
                await new Promise(resolve => setTimeout(resolve, 1000));
                return navigateToGradeList(); // Recursive call
            }
        }

        DebugLog.warn('Navigasyon linki bulunamadı');
        showOverlay('Menü bulunamadı! Manuel olarak Not Listesi sayfasına gidin.', true);
        return false;
    }

    // ==================== ZORUNLU ANKET CLICK ====================
    async function clickFirstZorunluAnket() {
        const links = findZorunluAnketLinks();

        if (links.length === 0) {
            DebugLog.info('Zorunlu anket bulunamadı veya hepsi tamamlandı');
            showOverlay('Tüm zorunlu anketler tamamlandı! 🎉');
            return false;
        }

        const firstLink = links[0];
        DebugLog.info(`${links.length} zorunlu anket bulundu, ilki tıklanıyor`, { text: firstLink.text });
        showOverlay(`${links.length} zorunlu anket bulundu. İlki açılıyor...`);

        firstLink.element.setAttribute(CONFIG.unfilledAttr, 'clicked');

        if (firstLink.postBackParams) {
            // PostBack ile aç
            try {
                await triggerPostBack(firstLink.postBackParams.eventTarget, firstLink.postBackParams.eventArgument);
                return true;
            } catch (error) {
                DebugLog.error('Anket açma hatası', error.message);
                // Fallback: normal click
                firstLink.element.click();
                return true;
            }
        } else {
            // Normal click
            firstLink.element.click();
            return true;
        }
    }

    // ==================== FORM FILLING ====================
    function fillSurveyForm(scoreValue) {
        DebugLog.info(`Form doldurma başlıyor (puan: ${scoreValue})`);
        let filledCount = 0;

        // RADIO BUTTONS
        const radios = document.querySelectorAll(`input[type="radio"]:not([${CONFIG.unfilledAttr}])`);
        const groupedRadios = {};
        radios.forEach(r => {
            if (!groupedRadios[r.name]) groupedRadios[r.name] = [];
            groupedRadios[r.name].push(r);
        });

        DebugLog.info(`${Object.keys(groupedRadios).length} radio grubu bulundu`);

        Object.keys(groupedRadios).forEach(name => {
            const group = groupedRadios[name];

            DebugLog.info(`Radio grup [${name}] analiz ediliyor. Hedef: ${scoreValue}`);

            let targetRadio = null;

            // 1. ADIM: Label metni üzerinden kesin eşleşme ara
            // Puan map: Metinleri ve negatif kelimeleri içerir
            const scoreMap = {
                "5": { pos: ["kesinlikle katılıyorum", "çok iyi", "tamamen katılıyorum"], neg: ["katılmıyorum", "zayıf"] },
                "4": { pos: ["katılıyorum", "iyi"], neg: ["katılmıyorum", "zayıf", "kesinlikle"] },
                "3": { pos: ["kararsızım", "orta", "ne katılıyorum ne katılmıyorum"], neg: [] },
                "2": { pos: ["katılmıyorum", "zayıf"], neg: ["kesinlikle", "iyi", "çok"] },
                "1": { pos: ["kesinlikle katılmıyorum", "çok zayıf", "hiç katılmıyorum"], neg: [" katılıyorum", " iyi"] }
            };

            const config = scoreMap[scoreValue] || { pos: [scoreValue], neg: [] };

            for (const radio of group) {
                const label = document.querySelector(`label[for="${radio.id}"]`);
                if (label) {
                    const labelText = (label.innerText || label.textContent || "").trim().toLowerCase();

                    // Pozitif kelime içermeli VE negatif kelime içermemeli
                    const hasPos = config.pos.some(k => labelText.includes(k));
                    const hasNeg = config.neg.some(k => labelText.includes(k));

                    if (hasPos && !hasNeg) {
                        targetRadio = radio;
                        DebugLog.info(`  Label eşleşti: "${labelText}" -> Puan ${scoreValue}`);
                        break;
                    }
                }
            }

            // 2. ADIM: Value üzerinden tam eşleşme
            if (!targetRadio) {
                targetRadio = group.find(r => String(r.value) === String(scoreValue));
            }

            // 3. ADIM: Fallback - Sayısal yakınlık
            if (!targetRadio) {
                const numericScore = parseInt(scoreValue);
                const sorted = [...group].sort((a, b) => {
                    const aVal = parseInt(a.value.match(/\d+/)?.[0] || a.id.match(/\d+$/)?.[0]) || 0;
                    const bVal = parseInt(b.value.match(/\d+/)?.[0] || b.id.match(/\d+$/)?.[0]) || 0;
                    return Math.abs(aVal - numericScore) - Math.abs(bVal - numericScore);
                });
                targetRadio = sorted[0];
                DebugLog.info(`  Fallback (yakınlık): ${targetRadio?.value || targetRadio?.id}`);
            }

            if (targetRadio) {
                const label = document.querySelector(`label[for="${targetRadio.id}"]`);
                const clickEvent = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });

                if (label) {
                    label.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    label.dispatchEvent(clickEvent);
                }

                targetRadio.checked = true;
                targetRadio.dispatchEvent(clickEvent);
                targetRadio.dispatchEvent(new Event('input', { bubbles: true }));
                targetRadio.dispatchEvent(new Event('change', { bubbles: true }));

                filledCount++;
                group.forEach(r => r.setAttribute(CONFIG.unfilledAttr, 'true'));
                DebugLog.info(`✓ Radio işaretlendi [${name}]`);
            }
        });

        // SELECT DROPDOWNS
        const selects = document.querySelectorAll(`select:not([${CONFIG.unfilledAttr}])`);
        selects.forEach(s => {
            const options = Array.from(s.options);
            const scoreNum = parseInt(scoreValue);

            let targetOption = options.find(o => o.value === scoreValue);

            if (!targetOption) {
                const scoreMap = {
                    "5": ["kesinlikle katılıyorum", "çok iyi", "5"],
                    "4": ["katılıyorum", "iyi", "4"],
                    "3": ["kararsızım", "orta", "3"],
                    "2": ["katılmıyorum", "zayıf", "2"],
                    "1": ["kesinlikle katılmıyorum", "çok zayıf", "1"]
                };
                const keywords = scoreMap[scoreValue] || [];

                targetOption = options.find(o => {
                    const txt = o.text.toLowerCase();
                    if (scoreNum >= 4 && txt.includes("katılmıyorum")) return false;
                    return keywords.some(k => txt.includes(k));
                });
            }

            if (targetOption && s.value !== targetOption.value) {
                s.value = targetOption.value;
                s.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
                s.setAttribute(CONFIG.unfilledAttr, 'true');
                DebugLog.info(`✓ Select seçildi: ${targetOption.text}`);
            }
        });

        // TEXT INPUTS
        const textInputs = document.querySelectorAll(`input[type="text"]:not([${CONFIG.unfilledAttr}]), input[type="number"]:not([${CONFIG.unfilledAttr}])`);
        textInputs.forEach(input => {
            if (input.value.trim()) return;

            const row = input.closest('tr');
            if (row) {
                const cells = Array.from(row.cells || []);
                let leftValue = "";
                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i];
                    if (cell.contains(input)) break;
                    const numbers = (cell.innerText || "").match(/(\d+)/g);
                    if (numbers) leftValue = numbers[numbers.length - 1];
                }
                if (leftValue) input.value = leftValue;
                else input.value = scoreValue;
            } else {
                input.value = scoreValue;
            }

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.setAttribute(CONFIG.unfilledAttr, 'true');
            filledCount++;
        });

        // TEXTAREAS
        const textareas = document.querySelectorAll(`textarea:not([${CONFIG.unfilledAttr}])`);
        textareas.forEach(textarea => {
            if (textarea.value.trim()) return;
            textarea.value = "Başarılı.";
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            textarea.setAttribute(CONFIG.unfilledAttr, 'true');
            filledCount++;
        });

        if (filledCount > 0) {
            DebugLog.info(`${filledCount} alan dolduruldu`);
            showOverlay(`${filledCount} alan dolduruldu. KAYDET işlemi başlıyor...`);
            setTimeout(() => autoClickSaveButton(), 2000);
        } else {
            DebugLog.warn('Doldurulacak alan bulunamadı');
            showOverlay('Doldurulacak alan bulunamadı.', true);
        }
    }

    async function autoClickSaveButton() {
        const buttons = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button, a'))
            .filter(btn => {
                const txt = (btn.value || btn.innerText || '').toLowerCase();
                return txt.includes("kaydet") || txt.includes("save") || txt.includes("gönder") || txt.includes("onayla");
            })
            // Görünür butonları seç
            .filter(btn => btn.offsetParent !== null);

        const targetBtn = buttons[0];

        if (targetBtn) {
            DebugLog.info(`KAYDET butonu bulundu: ${targetBtn.value || targetBtn.innerText}`);
            showOverlay('KAYDET butonuna basılıyor...');

            // Butonu vurgula
            targetBtn.style.border = "4px solid #28a745";
            targetBtn.style.boxShadow = "0 0 15px rgba(40, 167, 69, 0.7)";

            await new Promise(r => setTimeout(r, 1000));

            // PostBack Kontrolü (Priority #1)
            const href = targetBtn.getAttribute('href');
            const onclick = targetBtn.getAttribute('onclick');

            // Hem href hem onclick parse et
            const postBackParams = parsePostBackHref(href) || parsePostBackHref(onclick);

            if (postBackParams) {
                DebugLog.info('KAYDET için PostBack bulundu, Bridge ile tetikleniyor...');
                try {
                    await triggerPostBack(postBackParams.eventTarget, postBackParams.eventArgument);
                    // Başarılı olduysa beklemeye gerek yok, sayfa yenilenecek
                    DebugLog.info('Save PostBack triggered successfully');
                } catch (e) {
                    DebugLog.error('Save PostBack hatası', e.message);
                    targetBtn.click(); // Fallback
                }
            } else {
                DebugLog.warn('PostBack bulunamadı, düz tıklanıyor...');
                targetBtn.click();
            }

            showOverlay('İşlem tamamlandı, sayfa yenileniyor...');
            setTimeout(() => window.location.reload(), 3000);
        } else {
            DebugLog.error('KAYDET butonu bulunamadı!');
            showOverlay('HATA: Kaydet butonu bulunamadı!', true);
        }
    }

    // ==================== STATE MACHINE ====================
    async function runStateMachine(userScore) {
        const state = detectCurrentState();

        switch (state) {
            case NavigationState.MAIN_PAGE:
                showOverlay('Ana sayfa tespit edildi, Not Listesine gidiliyor...');
                await new Promise(r => setTimeout(r, CONFIG.navigationDelay));
                await navigateToGradeList();
                break;

            case NavigationState.GRADE_LIST:
                showOverlay('Not listesi tespit edildi, zorunlu anketler aranıyor...');
                await new Promise(r => setTimeout(r, CONFIG.navigationDelay));
                await clickFirstZorunluAnket();
                break;

            case NavigationState.SURVEY_FORM:
                showOverlay('Anket formu tespit edildi, doldurma başlıyor...');
                await new Promise(r => setTimeout(r, CONFIG.autoFillDelay));
                fillSurveyForm(userScore);
                break;

            case NavigationState.UNKNOWN:
            default:
                showOverlay('Sayfa analiz ediliyor...');
                // 3 saniye sonra tekrar dene
                await new Promise(r => setTimeout(r, 3000));
                const retryState = detectCurrentState();
                if (retryState !== NavigationState.UNKNOWN) {
                    await runStateMachine(userScore);
                } else {
                    DebugLog.warn('Sayfa türü tespit edilemedi');
                    showOverlay('Sayfa türü tespit edilemedi. Manuel işlem gerekebilir.', true);
                }
        }
    }

    // ==================== INIT ====================
    async function init() {
        DebugLog.info(`Extension başlatıldı. URL: ${window.location.href}`);
        DebugLog.info(`Frame: ${window.self === window.top ? 'TOP' : 'IFRAME'}`);

        // Main World Bridge'i enjekte et
        await injectMainWorldScript();

        // Kullanıcı ayarlarını al - Promise API kullan
        const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

        if (isExtension) {
            try {
                // MV3 Promise-based API
                const result = await chrome.storage.local.get(['surveyScore']);
                const userScore = result.surveyScore || CONFIG.defaultHighScoreValue;
                DebugLog.info(`Kullanıcı puanı (storage'dan): ${userScore}`);

                // Sayfa yüklenmesini bekle ve state machine başlat
                setTimeout(() => runStateMachine(userScore), CONFIG.navigationDelay);
            } catch (error) {
                DebugLog.error('Storage okuma hatası', error.message);
                setTimeout(() => runStateMachine(CONFIG.defaultHighScoreValue), CONFIG.navigationDelay);
            }
        } else {
            DebugLog.warn('Extension context dışında çalışıyor');
            setTimeout(() => runStateMachine(CONFIG.defaultHighScoreValue), CONFIG.navigationDelay);
        }
    }

    // ==================== BOOTSTRAP ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
