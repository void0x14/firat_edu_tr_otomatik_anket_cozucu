# Active Context

## Current Situation (v3.0 - 2026-01-20)
Extension tamamen yeniden yazıldı. CSP bypass, state machine navigasyon ve TAM OTOMASYON eklendi.

## v3.0 Değişiklikleri ✅
✅ **Main World Bridge**: `injected.js` ile CSP bypass - `__doPostBack` çağrıları artık çalışıyor
✅ **State Machine Navigation**: MAIN_PAGE -> GRADE_LIST -> SURVEY_FORM otomatik geçiş
✅ **TAM OTOMASYON**: KAYDET butonuna da OTOMATİK basılıyor
✅ **Debug Log Sistemi**: `chrome.storage.local` ile log toplama, popup'tan indirme
✅ **PostBack Parser**: `javascript:__doPostBack(...)` linkleri parse edilip Main World'de çalıştırılıyor

## Dosya Yapısı
```
/
├── manifest.json (v3.0 - scripting permission, web_accessible_resources)
├── content_script.js (State machine, CSP bypass bridge, auto-fill, AUTO-SAVE)
├── injected.js (Main World script - __doPostBack çağrıları)
├── popup.html/js (Debug log download/clear butonları)
└── .gitignore (*.log patterns)
```

## Otomasyon Akışı
1. Extension OBS sayfasında aktif olur
2. State tespit edilir (MAIN_PAGE, GRADE_LIST, SURVEY_FORM)
3. MAIN_PAGE ise -> "Not Listesi"ne navigasyon
4. GRADE_LIST ise -> "Zorunlu Anket" linklerini bul ve ilkine tıkla
5. SURVEY_FORM ise -> Formu doldur
6. **KAYDET butonuna OTOMATİK bas**
7. Sayfa yenile ve tekrar 4-6 adımlarını tekrarla
8. Tüm anketler bitene kadar devam et

## Test Adımları
1. `chrome://extensions` -> Reload
2. OBS'e giriş yap
3. Extension otomatik olarak:
   - Not Listesi'ne gidecek
   - Zorunlu Anket'e tıklayacak
   - Formu dolduracak
   - KAYDET'e basacak
   - Sonraki ankete geçecek
4. Tüm anketler bitene kadar devam edecek

## Bilinen Sınırlamalar
- OBS JavaScript navigasyonu karmaşık, bazı sayfalar farklı davranabilir
- Cross-origin iframe kısıtlamaları hala geçerli