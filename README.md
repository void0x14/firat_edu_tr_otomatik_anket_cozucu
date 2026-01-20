# Fırat OBS Otomatik Anket Çözücü v3.2.0 🚀

Fırat Üniversitesi Öğrenci Bilgi Sistemi (OBS) üzerindeki zorunlu anketleri saniyeler içinde, tam otomatik bir akışla dolduran Manifest V3 tabanlı, modern bir tarayıcı eklentisidir.

## ✨ Öne Çıkan Özellikler

- **Tam Otomasyon**: Sayfalar arası geçiş yapar, anketleri doldurur ve kaydeder. Kullanıcı müdahalesi gerektirmez.
- **Akıllı Algılayıcı**: "Katılıyorum" ve "Katılmıyorum" gibi karmaşık Likert ölçeklerini etiket metni analizi ile hatasız ayırt eder.
- **CSP Bypass**: Modern tarayıcı güvenlik duvarlarını (Content Security Policy) aşarak sistemle doğrudan etkileşime girer.
- **Debug Log Sistemi**: Olası hataları takip edebilmeniz için eklenti içinde yerel log tutar ve indirmenize olanak tanır.

## 🏗️ Çalışma Prensibi

Proje, OBS'nin karmaşık iframe yapısı ve ASP.NET'in state yönetimi (Postback) dikkate alınarak tasarlanmıştır.

1.  **Navigation Engine**: Ana sayfadan Not Listesine otomatik yönlenir.
2.  **State Machine**: Sayfa tipini (Ana Sayfa, Not Listesi, Anket Formu) anlık tespit eder.
3.  **Bridge Architecture**: Eklentinin izole dünyası ile web sayfasının ana dünyası arasında bir köprü (`injected.js`) kurarak Postback çağrılarını simüle eder.

---

## 🛠️ Kurulum Rehberi

Eklentiyi kullanmaya başlamak için şu adımları takip edin:

1.  Repoyu bilgisayarınıza indirin (ZIP olarak indirip klasöre çıkartın).
2.  Tarayıcınızda (Chrome/Edge/Brave) `chrome://extensions/` adresine gidin.
3.  Sağ üstteki **Geliştirici Modu**'nu (Developer Mode) aktif hale getirin.
4.  **Paketlenmemiş öğe yükle** (Load unpacked) butonuna basın.
5.  İndirdiğiniz klasörü seçin.

---

## ⚡ Kullanım

1.  OBS sistemine giriş yapın.
2.  Eklenti ikonuna tıklayıp anket puanınızı (1-5) seçin.
3.  Eklenti otomatik olarak Not Listesine gidecek ve bekleyen tüm anketleri sırayla bitirecektir.
4.  **Not**: İşlem bittiğinde eklenti size bildirim gösterecektir.

---

## 🔧 Geliştiriciler İçin

Geliştirme yaparken lütfen `.gitignore` dosyasındaki kurallara uyun. Proje `.vscode`, `.orchids` veya `.kiro` gibi IDE özel dosyalarını içermez.

### Hata Bildirimi
Eğer bir anket doldurulamıyorsa, eklenti içindeki "Debug Loglarını İndir" butonuna basarak logları bize iletebilirsiniz.

---

> [!IMPORTANT]
> **Yasal Uyarı**: Bu araç sadece otomasyon kolaylığı sağlamak amacıyla geliştirilmiştir. Kullanım ve sonuçları ile ilgili tüm sorumluluk son kullanıcıya aittir.
