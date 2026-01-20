# Katkıda Bulunma Rehberi (Contributing Guide)

Bu projeye katkıda bulunmak istediğiniz için teşekkürler! Projenin sürdürülebilirliği ve kod kalitesi için aşağıdaki kurallara uymanızı rica ederiz.

## 🛠️ Geliştirme Süreci

1. **Forklayın**: Bu repoyu kendi hesabınıza fork'layın.
2. **Branch Açın**: Yapacağınız değişiklik için özel bir branch oluşturun.
   ```bash
   git checkout -b feature/yeni-ozellik
   # veya
   git checkout -b fix/hata-duzeltmesi
   ```
3. **Atomik Commitler**: Yaptığınız değişiklikleri küçük, anlamlı ve atomik parçalar halinde commitleyin.

### Commit Mesajı Formatı
Commit mesajlarınızda [Conventional Commits](https://www.conventionalcommits.org/) yapısını kullanın:

- `feat:` Yeni bir özellik eklendiğinde.
- `fix:` Bir düzeltme yapıldığında.
- `docs:` Sadece dökümantasyon değişikliği.
- `style:` Kod formatı, noktalı virgül eksikliği vb. (kod çalışmasını etkilemeyen).
- `refactor:` Ne hata düzelten ne de özellik ekleyen kod değişikliği.

Örnek:
```
feat: add dynamic scoring preference to popup
fix: resolve navigation loop issue in content script
```

## 🧪 Test Süreci

**Navigation Engine** üzerinde değişiklik yapıyorsanız lütfen aşağıdaki senaryoları test edin:
1. Anket listesinde boş anket varken otomatik giriyor mu?
2. Anket doldurulduktan sonra "Kaydet"e basınca liste yenileniyor mu?
3. Tüm anketler bittiğinde sonsuz döngüye giriyor mu?

## 📝 Pull Request (PR) Gönderimi

- PR başlığınız net ve açıklayıcı olsun.
- Yaptığınız değişikliğin *neden* gerekli olduğunu açıklayın.
- Varsa ilgili Issue numarasını belirtin.

---

**System Hardening Protocol**
