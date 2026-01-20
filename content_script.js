/**
 * ARCHITECTURE: NAVIGATION & FLOW ENGINE (HARDENED)
 * 1. Detects if we are in the "Survey List" or "Survey Form".
 * 2. If List: Finds first unfilled survey and enters.
 * 3. If Form: Fills values and monitors for "Save" completion.
 * 4. Post-Save: Triggers parent menu to refresh the list (Exit-Reenter logic).
 */

(function () {
    'use strict';

    const INTERNALS = {}; // Export container for testing
    const CONFIG = {
        defaultHighScoreValue: "5",
        autoFillDelay: 1500,
        unfilledAttr: 'data-anket-processed',
        refreshInterval: 2000,
        modalCheckInterval: 500
    };
    INTERNALS.CONFIG = CONFIG;

    /**
     * MODAL KILLER: Automatically closes blocking overlays
     */
    function killModal() {
        // Option 1: SweetAlert Overlays (Common in OBS)
        const selectors = [
            '.swal2-container', 
            '.sweet-overlay', 
            '.modal-backdrop', 
            '.modal.show', 
            '.ui-widget-overlay',
            '[id*="pop-up"]',
            '.alert'
        ];
        
        const overlays = document.querySelectorAll(selectors.join(', '));
        const confirmBtns = Array.from(document.querySelectorAll('.swal2-confirm, .btn-primary, button, input[type="button"]'))
            .filter(btn => {
                const txt = (btn.textContent || btn.value || "").toLowerCase();
                return txt.includes("tamam") || txt.includes("ok") || txt.includes("kapat") || txt.includes("close");
            });

        // Also check parent context if we are in iframe
        let parentOverlays = [];
        let parentBtns = [];
        try {
            if (window.top !== window) {
                parentOverlays = Array.from(window.top.document.querySelectorAll(selectors.join(', ')));
                parentBtns = Array.from(window.top.document.querySelectorAll('.swal2-confirm, .btn-primary'))
                    .filter(btn => {
                        const txt = (btn.textContent || "").toLowerCase();
                        return txt.includes("tamam") || txt.includes("ok");
                    });
            }
        } catch (e) {
            // Cross-origin protection might block this
        }

        const allOverlays = [...overlays, ...parentOverlays];
        const allBtns = [...confirmBtns, ...parentBtns];

        if (allOverlays.length > 0) {
            console.log("[System] Blocking UI element detected. Attempting removal...");
            
            // Remove overlays directly if buttons don't work
            allOverlays.forEach(el => {
                if (el && el.style) {
                    el.style.display = 'none';
                    el.style.opacity = '0';
                    el.style.pointerEvents = 'none';
                }
            });

            allBtns.forEach(btn => {
                if (btn && btn.offsetParent !== null) { // Check if visible
                    btn.click();
                    console.log("[System] Clicked confirmation button.");
                }
            });
            
            // Fix body scroll if locked by modal
            document.body.classList.remove('modal-open', 'swal2-shown');
            document.body.style.overflow = 'auto';
        }
    }
    INTERNALS.killModal = killModal;

    /**
     * Notification Overlay
     */
    function showOverlay(message, isError = false) {
        const id = 'anket-solver-overlay';
        let overlay = document.getElementById(id);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = id;
            overlay.style.cssText = `
                position: fixed; top: 20px; right: 20px; padding: 15px 25px;
                border-radius: 12px; font-weight: 600; z-index: 2147483647;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1);
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.backgroundColor = isError ? 'rgba(220, 53, 69, 0.95)' : 'rgba(40, 167, 69, 0.95)';
        overlay.style.color = 'white';
        overlay.innerHTML = `🚀 ${message}`;
        overlay.style.opacity = '1';
        overlay.style.transform = 'translateY(0)';

        setTimeout(() => {
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.transform = 'translateY(-20px)';
            }
        }, 4000);
    }

    /**
     * Refreshes the Survey List via Parent Window (The "Exit-Reenter" Logic)
     */
    function triggerListRefresh() {
        console.log("[System] Triggering list refresh via parent...");
        try {
            // Find the "Anketler" menu item in the top frame
            const menuLinks = window.top.document.querySelectorAll('a[onclick*="Anketler"], .nav-link p');
            let target = null;
            menuLinks.forEach(link => {
                if (link.innerText.includes("Anketler")) {
                    target = link.closest('a') || link;
                }
            });

            if (target) {
                showOverlay("Anket kaydedildi. Liste yenileniyor...");
                target.click(); // Trigger the menu click
            } else {
                // Fallback: Just reload the frame if menu link not found
                window.location.reload();
            }
        } catch (e) {
            console.error("[System] Parent access failed:", e);
            window.location.reload();
        }
    }

    /**
     * Detects the Survey List and auto-activates an unfilled survey
     */
    function handleSurveyList() {
        console.log("[System] Scanning for unfilled surveys...");
        // Look for buttons like "Anket Doldur" or descriptive links
        const unfilledButtons = Array.from(document.querySelectorAll('a, button, input[type="button"]'))
            .filter(el => {
                const txt = (el.innerText || el.value || "").toLowerCase();
                return txt.includes("anket doldur") || 
                       (el.className && el.className.includes("btn-primary") && !el.hasAttribute('onclick'));
            });

        if (unfilledButtons.length > 0) {
            console.log(`[System] Found ${unfilledButtons.length} potential surveys. Clicking first...`);
            showOverlay("Sıradaki anket açılıyor...");
            unfilledButtons[0].click();
        } else {
            console.log("[System] No unfilled surveys detected on this page.");
        }
    }

    /**
     * Main Init
     */
    function init() {
        console.log("[System] Content Script Active. URL:", window.location.href);

        const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

        const startLogic = (userScore) => {
            console.log(`[System] Preferred Score: ${userScore}`);

            // Start the Modal Killer Loop
            setInterval(killModal, CONFIG.modalCheckInterval);

            // Determine page state - Check for radios, selects, or text inputs in tables
            const isForm = !!document.querySelector('input[type="radio"], select, table tr td input[type="text"]');
            const isList = !!document.querySelector('a[onclick*="Anket"], button[id*="Anket"], .btn-primary, [class*="Anket"]');

            console.log(`[System] Detection - isForm: ${isForm}, isList: ${isList}`);

            if (isForm) {
                console.log("[System] Form detected. Filling...");
                setTimeout(() => fillSurveyFormWithScore(userScore), CONFIG.autoFillDelay);
            } else if (isList) {
                console.log("[System] List detected. Scanning for surveys...");
                setTimeout(handleSurveyList, CONFIG.autoFillDelay);
            }

            // Watch for dynamic content changes (ASP.NET UpdatePanels)
            const observer = new MutationObserver((mutations) => {
                killModal();
                const currentIsForm = !!document.querySelector('input[type="radio"], select, table tr td input[type="text"]');
                const currentIsList = !!document.querySelector('a[onclick*="Anket"], button[id*="Anket"], .btn-primary');
                
                if (currentIsForm) {
                    fillSurveyFormWithScore(userScore);
                } else if (currentIsList) {
                    handleSurveyList();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        };

        if (isExtension) {
            chrome.storage.local.get(['surveyScore'], (result) => {
                const userScore = result.surveyScore || CONFIG.defaultHighScoreValue;
                startLogic(userScore);
            });
        } else {
            console.warn("[System] Not in extension context. Using default score.");
            startLogic(CONFIG.defaultHighScoreValue);
        }
    }

    /**
     * Updated fill logic with dynamic score
     */
    function fillSurveyFormWithScore(scoreValue) {
        console.log(`[System] Executing fill logic with target score: ${scoreValue}`);
        let filledCount = 0;

        // Radios - Fırat OBS often uses tables where radio buttons are in specific columns
        // Standard Survey Pattern: 1-5 Scale. Usually 5th column or value="5"
        const radios = document.querySelectorAll(`input[type="radio"]:not([${CONFIG.unfilledAttr}])`);
        
        // Group radios by name to handle rows
        const groupedRadios = {};
        radios.forEach(r => {
            if (!groupedRadios[r.name]) groupedRadios[r.name] = [];
            groupedRadios[r.name].push(r);
        });

        Object.keys(groupedRadios).forEach(name => {
            const group = groupedRadios[name];
            let targetRadio = group.find(r => r.value === scoreValue);
            
            // Fallback: If no exact value match, take the one at index (score - 1) 
            // Most surveys are 1 2 3 4 5. If we want 5, it's index 4.
            if (!targetRadio && group.length >= 5) {
                const idx = parseInt(scoreValue) - 1;
                if (group[idx]) targetRadio = group[idx];
            }

            if (targetRadio && !targetRadio.checked) {
                targetRadio.checked = true;
                targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
                targetRadio.dispatchEvent(new Event('click', { bubbles: true }));
                filledCount++;
                group.forEach(r => r.setAttribute(CONFIG.unfilledAttr, 'true'));
                console.log(`[System] Selected radio [${name}] with value/index: ${scoreValue}`);
            }
        });

        // Selects - Some questions are dropdowns
        const selects = document.querySelectorAll(`select:not([${CONFIG.unfilledAttr}])`);
        selects.forEach(s => {
            let targetValue = null;
            const targetOption = Array.from(s.options).find(o => 
                o.value === scoreValue || 
                o.text.startsWith(scoreValue) || 
                o.text.toLowerCase().includes("kesinlikle katılıyorum")
            );

            if (targetOption) targetValue = targetOption.value;
            else if (s.options.length > 1) {
                targetValue = s.options[s.options.length - 1].value;
            }

            if (targetValue && s.value !== targetValue) {
                s.value = targetValue;
                s.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
                s.setAttribute(CONFIG.unfilledAttr, 'true');
                console.log(`[System] Selected option for select [${s.id || s.name}]`);
            }
        });

        // AKTS / Workload Logic (Text inputs that need numbers)
        document.querySelectorAll('tr').forEach(row => {
            if (row.hasAttribute(CONFIG.unfilledAttr)) return;
            const cells = row.cells;
            if (cells && cells.length >= 2) {
                const text = cells[0].innerText || "";
                const isWorkload = /İş Yükü|Saat|Dakika|AKTS|Kredi/i.test(text);
                const input = row.querySelector('input[type="text"], input[type="number"]');
                
                if (isWorkload && input && !input.value) {
                    const suggested = text.match(/(\d+)/);
                    input.value = suggested ? suggested[1] : "5";
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    row.setAttribute(CONFIG.unfilledAttr, 'true');
                    filledCount++;
                    console.log(`[System] Filled workload input: ${input.value}`);
                }
            }
        });

        if (filledCount > 0) {
            console.log(`[System] Batch complete. Filled ${filledCount} elements.`);
            showOverlay(`${filledCount} alan otomatik dolduruldu.`);
            hookSaveButton();
        }
    }
    INTERNALS.fillSurveyFormWithScore = fillSurveyFormWithScore;

    function hookSaveButton() {
        const saveBtn = document.querySelector('input[type="submit"][value*="Kaydet"], button[id*="btnKaydet"]');
        if (saveBtn && !saveBtn.hasAttribute('data-hooked')) {
            saveBtn.addEventListener('click', () => {
                setTimeout(triggerListRefresh, 2000);
            });
            saveBtn.setAttribute('data-hooked', 'true');
        }
    }

    // Safety Delay and Entry Point
    function bootstrap() {
        if (document.body) {
            init();
        } else {
            const observer = new MutationObserver((mutations, obs) => {
                if (document.body) {
                    obs.disconnect();
                    init();
                }
            });
            observer.observe(document.documentElement, { childList: true });
        }
    }

    bootstrap();

    // Export if in Node.js environment (for TestSprite/Jest)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = INTERNALS;
    }

})();
