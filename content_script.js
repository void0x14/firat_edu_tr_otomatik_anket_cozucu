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
        const overlays = document.querySelectorAll('.swal2-container, .sweet-overlay, .modal-backdrop');
        const confirmBtns = Array.from(document.querySelectorAll('.swal2-confirm, .btn-primary, button'))
            .filter(btn => btn.textContent && (btn.textContent.includes("Tamam") || btn.textContent.includes("OK")));

        // Also check parent context if we are in iframe
        let parentOverlays = [];
        let parentBtns = [];
        try {
            if (window.top !== window) {
                parentOverlays = window.top.document.querySelectorAll('.swal2-container');
                parentBtns = window.top.document.querySelectorAll('.swal2-confirm');
            }
        } catch (e) {
            // Cross-origin protection might block this, but OBS usually same-origin
        }

        const allOverlays = [...overlays, ...parentOverlays];
        const allBtns = [...confirmBtns, ...parentBtns];

        if (allOverlays.length > 0) {
            console.log("[System] Blocking Modal Detected! Attempting to close...");
            allBtns.forEach(btn => {
                if (btn && btn.offsetParent !== null) { // Check if visible
                    btn.click();
                    console.log("[System] Clicked confirmation button.");
                }
            });
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
        // Look for buttons like "Anket Doldur" or descriptive links
        const unfilledButtons = Array.from(document.querySelectorAll('a, button, input[type="button"]'))
            .filter(el => (el.innerText || el.value || "").toLowerCase().includes("anket doldur") ||
                (el.className && el.className.includes("btn-primary")));

        if (unfilledButtons.length > 0) {
            showOverlay("Sıradaki anket açılıyor...");
            unfilledButtons[0].click();
        }
    }

    /**
     * Main Init
     */
    function init() {
        console.log("[System] Content Script Active. URL:", window.location.href);

        // Get user preference for score (default to 5)
        chrome.storage.local.get(['surveyScore'], (result) => {
            const userScore = result.surveyScore || CONFIG.defaultHighScoreValue;
            console.log(`[System] Preferred Score: ${userScore}`);

            // Start the Modal Killer Loop
            setInterval(killModal, CONFIG.modalCheckInterval);

            // Determine page state - Check for radios, selects, or text inputs in tables
            const isForm = !!document.querySelector('input[type="radio"], select, table tr td input[type="text"]');
            const isList = !!document.querySelector('a[onclick*="Anket"], button[id*="Anket"], .btn-primary');

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
                if (currentIsForm) fillSurveyFormWithScore(userScore);
                else handleSurveyList();
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    /**
     * Updated fill logic with dynamic score
     */
    function fillSurveyFormWithScore(scoreValue) {
        let filledCount = 0;

        // Radios - Fırat OBS often uses tables where radio buttons are in specific columns
        // We try to find the radio with the value matching scoreValue
        const radios = document.querySelectorAll(`input[type="radio"]:not([${CONFIG.unfilledAttr}])`);
        radios.forEach(r => {
            // OBS Radio logic: Usually 1-5. 
            // Some surveys might have reversed logic or different labels, but value is generally the score.
            if (r.value === scoreValue && !r.checked) {
                r.checked = true;
                r.dispatchEvent(new Event('change', { bubbles: true }));
                r.dispatchEvent(new Event('click', { bubbles: true })); // Some scripts listen for click
                filledCount++;
                r.setAttribute(CONFIG.unfilledAttr, 'true');
            } else if (r.checked) {
                r.setAttribute(CONFIG.unfilledAttr, 'true');
            }
        });

        // Selects - Some questions are dropdowns
        const selects = document.querySelectorAll(`select:not([${CONFIG.unfilledAttr}])`);
        selects.forEach(s => {
            let targetValue = null;
            // Try to find exact value match
            const targetOption = Array.from(s.options).find(o => o.value === scoreValue || o.text.startsWith(scoreValue));

            if (targetOption) targetValue = targetOption.value;
            else if (s.options.length > 1) {
                // If 5 is not found, take the last one (usually the highest/most positive)
                targetValue = s.options[s.options.length - 1].value;
            }

            if (targetValue && s.value !== targetValue) {
                s.value = targetValue;
                s.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
                s.setAttribute(CONFIG.unfilledAttr, 'true');
            } else if (s.value === targetValue) {
                s.setAttribute(CONFIG.unfilledAttr, 'true');
            }
        });

        // AKTS / Workload Logic (Text inputs that need numbers)
        // OBS sometimes asks for "Hours spent". We look for labels and fill the input.
        document.querySelectorAll('tr').forEach(row => {
            if (row.hasAttribute(CONFIG.unfilledAttr)) return;
            const cells = row.cells;
            if (cells && cells.length >= 2) {
                const text = cells[0].innerText || "";
                // Match "Mevcut İş Yükü (Saat)" or similar patterns
                const hoursMatch = text.match(/İş Yükü/i) || text.match(/Saat/i);
                const input = cells[cells.length - 1].querySelector('input[type="text"], input[type="number"]');
                
                if (hoursMatch && input && !input.value) {
                    // Try to extract a suggested number from text or default to 5
                    const suggested = text.match(/(\d+)/);
                    input.value = suggested ? suggested[1] : "5";
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    row.setAttribute(CONFIG.unfilledAttr, 'true');
                    filledCount++;
                }
            }
        });

        if (filledCount > 0) {
            console.log(`[System] Filled ${filledCount} elements.`);
            showOverlay(`${filledCount} alan dolduruldu.`);
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

    // Safety Delay
    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);

    // Export if in Node.js environment (for TestSprite/Jest)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = INTERNALS;
    }

})();
