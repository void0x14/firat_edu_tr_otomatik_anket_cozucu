document.addEventListener('DOMContentLoaded', () => {
    const scoreSelect = document.getElementById('scoreSelect');
    const saveMsg = document.getElementById('saveMsg');
    const openObsBtn = document.getElementById('openObs');

    // Load saved preference
    chrome.storage.local.get(['surveyScore'], (result) => {
        if (result.surveyScore) {
            scoreSelect.value = result.surveyScore;
        }
    });

    // Save preference on change
    scoreSelect.addEventListener('change', () => {
        const val = scoreSelect.value;
        chrome.storage.local.set({ surveyScore: val }, () => {
            saveMsg.style.display = 'block';
            setTimeout(() => {
                saveMsg.style.display = 'none';
            }, 2000);
        });
    });

    openObsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://obs.firat.edu.tr/oibs/std/' });
    });
});
