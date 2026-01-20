/**
 * OBS ANKET OTOMASYONU v3.2.1 - DYNAMIC NAVIGATION FIX
 * 
 * Mimari:
 * 1. Content Script (Isolated World) - Element tespiti ve UI
 * 2. Injected Script (Main World) - __doPostBack ve Click işlemleri
 * 3. postMessage Bridge - İki dünya arası iletişim
 */

(function () {
    'use strict';

    // ==================== CONFIG ====================
    const CONFIG = {
        defaultHighScoreValue: "5",
        autoFillDelay: 1500,
        navigationDelay: 1000,
        retryDelay: 3000,
        maxRetries: 3,
        unfilledAttr: 'data-anket-processed',
        bridgeAttr: 'data-obs-bridge-id'
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
                url: window.location.href.split('?')[0]
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
                chrome.storage.local.set({ debug_logs: this.logs.slice(-500) });
            }
        }
    };

    // ==================== MAIN WORLD BRIDGE ====================
    let bridgeReady = false;

    function injectMainWorldScript() {
        return new Promise((resolve) => {
            if (bridgeReady) { resolve(); return; }
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('injected.js');
            script.onload = function () { this.remove(); };
            (document.head || document.documentElement).appendChild(script);

            const handler = (event) => {
                if (event.data && event.data.type === 'OBS_BRIDGE_READY') {
                    bridgeReady = true;
                    window.removeEventListener('message', handler);
                    DebugLog.info('Main World Bridge hazır');
                    resolve();
                }
            };
            window.addEventListener('message', handler);
            setTimeout(() => { if (!bridgeReady) resolve(); }, 2000);
        });
    }

    function triggerPostBack(eventTarget, eventArgument) {
        return new Promise((resolve, reject) => {
            const handler = (event) => {
                if (event.data && event.data.type === 'OBS_POSTBACK_RESPONSE') {
                    window.removeEventListener('message', handler);
                    if (event.data.success) resolve(event.data);
                    else reject(new Error(event.data.error));
                }
            };
            window.addEventListener('message', handler);
            window.postMessage({ type: 'OBS_POSTBACK_REQUEST', eventTarget, eventArgument }, '*');
            setTimeout(() => { window.removeEventListener('message', handler); reject(new Error('Timeout')); }, 5000);
        });
    }

    async function clickElementSafely(element) {
        if (!element) return;
        const bridgeId = 'obs-' + Math.random().toString(36).substr(2, 9);
        element.setAttribute(CONFIG.bridgeAttr, bridgeId);
        window.postMessage({ type: 'OBS_CLICK_REQUEST', selector: `[${CONFIG.bridgeAttr}="${bridgeId}"]` }, '*');
        setTimeout(() => element.removeAttribute(CONFIG.bridgeAttr), 3000);
    }

    // ==================== UI OVERLAY ====================
    function showOverlay(message, isError = false) {
        const id = 'anket-solver-overlay';
        let overlay = document.getElementById(id);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = id;
            overlay.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 12px; font-weight: 600; z-index: 2147483647; box-shadow: 0 8px 32px rgba(0,0,0,0.4); font-family: system-ui, sans-serif; transition: opacity 0.3s;`;
            document.body.appendChild(overlay);
        }
        overlay.style.backgroundColor = isError ? '#dc3545' : '#28a745';
        overlay.style.color = 'white';
        overlay.innerHTML = `🚀 ${message}`;
        overlay.style.opacity = '1';
        setTimeout(() => { if (overlay) overlay.style.opacity = '0'; }, 3000);
    }

    // ==================== NAVIGATION ENGINE ====================
    const NavigationState = {
        UNKNOWN: 'UNKNOWN',
        MAIN_PAGE: 'MAIN_PAGE',
        GRADE_LIST: 'GRADE_LIST',
        SURVEY_FORM: 'SURVEY_FORM',
        SUCCESS: 'SUCCESS'
    };

    function detectCurrentState() {
        const url = window.location.href.toLowerCase();
        const bodyText = (document.body.innerText || '').toLowerCase();

        if (bodyText.includes('başarıyla kaydedildi') || bodyText.includes('işlem başarılı') || bodyText.includes('tamamlanmıştır')) {
            return NavigationState.SUCCESS;
        }

        const hasRadios = document.querySelectorAll('input[type="radio"]').length > 0;
        const hasFormSelects = document.querySelectorAll('select').length > 3;

        if (hasRadios || hasFormSelects) {
            if (bodyText.includes('kesinlikle') || bodyText.includes('katılıyorum') || bodyText.includes('dersin') || bodyText.includes('öğretim')) {
                return NavigationState.SURVEY_FORM;
            }
        }

        const zorunluLinks = findZorunluAnketLinks();
        if (zorunluLinks.length > 0 || url.includes('not_listesi')) {
            return NavigationState.GRADE_LIST;
        }

        if (url.includes('index.aspx') || url.includes('duyuru')) {
            return NavigationState.MAIN_PAGE;
        }

        return NavigationState.UNKNOWN;
    }

    function findZorunluAnketLinks() {
        return Array.from(document.querySelectorAll('a')).filter(link => {
            const text = (link.innerText || '').trim().toLowerCase();
            return (text.includes('zorunlu') && text.includes('anket')) || text === 'zorunlu anket';
        }).filter(link => link.offsetParent !== null && !link.hasAttribute(CONFIG.unfilledAttr));
    }

    async function navigateToGradeList() {
        DebugLog.info('Not Listesi sayfasına gidiliyor...');
        showOverlay('Not Listesi sayfasına gidiliyor...');

        // DYNAMICALY FIND THE MENU ITEM
        const allElements = Array.from(document.querySelectorAll('a, span, div, li, [onclick]'));

        // 1. Doğrudan "Not Listesi" linkini ara
        const target = allElements.find(el => {
            const txt = (el.innerText || el.textContent || '').toLowerCase();
            return txt.includes('not listesi') || txt.includes('not listem') || txt === 'not listesi';
        });

        if (target) {
            DebugLog.info('Not Listesi hedefi bulundu, tıklanıyor.');
            await clickElementSafely(target);
            return true;
        }

        // 2. Eğer bulunamadıysa "Ders ve Dönem İşlemleri" menüsünü bulmayı dene
        const menuDers = allElements.find(el => {
            const txt = (el.innerText || el.textContent || '').toLowerCase();
            return txt.includes('ders') && txt.includes('dönem');
        });

        if (menuDers) {
            DebugLog.info('Menü açılıyor (Ders ve Dönem)');
            await clickElementSafely(menuDers);
            setTimeout(navigateToGradeList, 1000);
            return true;
        }

        DebugLog.warn('Navigasyon hedefi bulunamadı, ana sayfaya dönülüyor.');
        window.location.href = 'index.aspx';
        return false;
    }

    async function clickFirstZorunluAnket() {
        const links = findZorunluAnketLinks();
        if (links.length === 0) {
            showOverlay('Tüm anketler tamamlandı! 🎉');
            return false;
        }
        const firstLink = links[0];
        firstLink.setAttribute(CONFIG.unfilledAttr, 'clicked');
        await clickElementSafely(firstLink);
        return true;
    }

    // ==================== FORM FILLING ====================
    function fillSurveyForm(scoreValue) {
        DebugLog.info(`Filling form with score: ${scoreValue}`);
        let filledCount = 0;

        // Radios
        const radios = document.querySelectorAll(`input[type="radio"]:not([${CONFIG.unfilledAttr}])`);
        const names = new Set(Array.from(radios).map(r => r.name));

        names.forEach(name => {
            const group = Array.from(document.querySelectorAll(`input[name="${name}"]`));
            const scoreMap = {
                "5": { pos: ["kesinlikle katılıyorum", "çok iyi", "tamamen"], neg: ["katılmıyorum", "zayıf"] },
                "4": { pos: ["katılıyorum", "iyi"], neg: ["katılmıyorum", "zayıf", "kesinlikle"] },
                "3": { pos: ["kararsızım", "orta"], neg: [] },
                "2": { pos: ["katılmıyorum", "zayıf"], neg: ["kesinlikle", "iyi", "çok"] },
                "1": { pos: ["kesinlikle katılmıyorum", "çok zayıf"], neg: [" katılıyorum", " iyi"] }
            };
            const config = scoreMap[scoreValue] || { pos: [scoreValue], neg: [] };

            let target = group.find(radio => {
                const label = document.querySelector(`label[for="${radio.id}"]`);
                if (!label) return false;
                const txt = label.innerText.toLowerCase();
                return config.pos.some(k => txt.includes(k)) && !config.neg.some(k => txt.includes(k));
            });

            if (!target) target = group.find(r => r.value === scoreValue);
            if (!target) target = group[group.length - (6 - parseInt(scoreValue))] || group[0];

            if (target) {
                const label = document.querySelector(`label[for="${target.id}"]`);
                if (label) label.click();
                target.checked = true;
                target.dispatchEvent(new Event('change', { bubbles: true }));
                group.forEach(r => r.setAttribute(CONFIG.unfilledAttr, 'true'));
                filledCount++;
            }
        });

        // Selects
        document.querySelectorAll(`select:not([${CONFIG.unfilledAttr}])`).forEach(s => {
            const opts = Array.from(s.options);
            const target = opts.find(o => o.value === scoreValue) || opts[opts.length - 1];
            if (target) {
                s.value = target.value;
                s.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
            }
            s.setAttribute(CONFIG.unfilledAttr, 'true');
        });

        // Textareas & Inputs (Comment/Workload)
        const inputs = document.querySelectorAll(`textarea:not([${CONFIG.unfilledAttr}]), input[type="text"]:not([${CONFIG.unfilledAttr}]), input[type="number"]:not([${CONFIG.unfilledAttr}])`);
        inputs.forEach(input => {
            if (input.offsetParent === null) return;
            let val = scoreValue;
            const row = input.closest('tr');
            if (row) {
                const numbers = (row.innerText || "").match(/(\d+)/g);
                if (numbers) val = numbers[numbers.length - 1];
            }
            if (input.tagName === 'TEXTAREA') val = "Ders içeriği ve işleyişi oldukça verimliydi. Teşekkürler.";

            input.focus();
            input.value = val;
            ['input', 'change', 'blur'].forEach(evt => input.dispatchEvent(new Event(evt, { bubbles: true })));
            input.setAttribute(CONFIG.unfilledAttr, 'true');
            filledCount++;
        });

        if (filledCount > 0) {
            showOverlay(`${filledCount} alan dolduruldu. Kaydediliyor...`);
            setTimeout(autoClickSaveButton, 2000);
        } else {
            setTimeout(navigateToGradeList, 1500);
        }
    }

    async function autoClickSaveButton() {
        const btn = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button, a'))
            .find(b => {
                const txt = (b.value || b.innerText || '').toLowerCase();
                return (txt.includes("kaydet") || txt.includes("gönder") || txt.includes("onayla")) && b.offsetParent !== null;
            });

        if (btn) {
            await clickElementSafely(btn);
            showOverlay('Kaydediliyor...');
            // Fallback
            setTimeout(() => navigateToGradeList(), 6000);
        } else {
            navigateToGradeList();
        }
    }

    async function handleSuccessAction() {
        showOverlay('İşlem başarılı! Geri dönülüyor...');
        setTimeout(() => navigateToGradeList(), 1500);
    }

    // ==================== RUNNER ====================
    async function runStateMachine(userScore) {
        const state = detectCurrentState();
        switch (state) {
            case NavigationState.SUCCESS: await handleSuccessAction(); break;
            case NavigationState.MAIN_PAGE: await navigateToGradeList(); break;
            case NavigationState.GRADE_LIST: await clickFirstZorunluAnket(); break;
            case NavigationState.SURVEY_FORM: fillSurveyForm(userScore); break;
            default: setTimeout(() => runStateMachine(userScore), 3000);
        }
    }

    async function init() {
        try {
            await injectMainWorldScript();
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'OBS_SUCCESS_EVENT') handleSuccessAction();
            });

            let score = CONFIG.defaultHighScoreValue;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const res = await chrome.storage.local.get(['surveyScore']);
                score = res?.surveyScore || CONFIG.defaultHighScoreValue;
            }
            setTimeout(() => runStateMachine(score), CONFIG.navigationDelay);
        } catch (e) { DebugLog.error('Init Error:', e.message); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
