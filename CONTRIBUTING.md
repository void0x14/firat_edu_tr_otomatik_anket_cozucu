# Katkıda Bulunma Rehberi

Fırat OBS Otomatik Anket Çözücü projesine katkıda bulunmak istediğiniz için teşekkür ederiz! Bu proje toplum yararına ve açık kaynak vizyonuyla geliştirilmektedir.

## 🤝 Nasıl Katkı Sağlarsınız?

### 1. Hata Bildirimi (Issue)
Karşılaştığınız sorunları eklenti içinden aldığınız **Debug Logları** ile birlikte "Issues" sekmesinden bildirebilirsiniz. Lütfen OBS versiyonunu veya sayfa yapısındaki değişiklikleri belirtmeyi unutmayın.

### 2. Kod Geliştirme (Pull Request)
Projeyi geliştirmek için:
1. Repoyu fork edin.
2. Anlamlı bir isimle yeni bir branch oluşturun (`git checkout -b fix/radio-logic`).
3. Değişikliklerinizi yapın ve **Conventional Commits** standartlarına uygun commit mesajları atın.
   - `feat:` Yeni özellik
   - `fix:` Hata düzeltme
   - `docs:` Dökümantasyon
4. PR gönderirken yaptığınız değişikliğin teknik detaylarını ve test sonuçlarını açıklayın.

## 🏗️ Mimari Standartlar

- **Vanilla JS**: Harici kütüphane kullanımından kaçınmaya çalışıyoruz (Hız ve güvenlik için).
- **Asenkron Yapı**: Tüm işlemler `async/await` mimarisiyle yönetilmelidir.
- **CSP Uyumluluğu**: Web sayfası dünyasına doğrudan müdahale gerektiren işler `injected.js` üzerinden köprü kurularak yapılmalıdır.

## 🧹 Temizlik ve Düzen

- Yerel geliştirme dosyalarınızı (`.vscode`, `.env` vb.) repoya pushlamayın.
- `.gitignore` dosyasındaki kurallara sadık kalın.
- Yeni eklenen fonksiyonlar için mutlaka JSDoc açıklaması veya detaylı yorum satırı ekleyin.

---