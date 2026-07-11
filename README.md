# ADMIRA — Meta & TikTok Kampanya Planlayıcı

Meta (Facebook/Instagram) ve TikTok reklam kampanyalarınızın hedeflerini, hedef kitlesini ve bütçesini planlamanızı sağlayan bir web uygulaması. Kullanıcı hesapları `data/users.json` üzerinden küçük bir PHP backend ile, kampanya verisi ise tarayıcıda (`localStorage`, kullanıcıya özel) tutulur.

## Özellikler

- **Giriş / Kayıt** — `index.html`. `api/auth.php` üzerinden dosya tabanlı kimlik doğrulama (`data/users.json`, bcrypt ile hashlenmiş şifreler, PHP session çerezi). Hızlı denemek için "Demo hesapla devam edin" seçeneği mevcuttur.
- **Kampanya Oluştur Sihirbazı** — `app.html` içindeki "+ Kampanya Oluştur" butonu, gerçek reklam yöneticilerindeki Kampanya → Reklam Seti/Grubu → Reklam hiyerarşisini yansıtan 4 adımlı bir akış açar:
  1. **Platform** — Meta veya TikTok
  2. **Kampanya** — hedef (Awareness, Traffic, Engagement, Leads, App Promotion, Sales / Reach, Traffic, Video Views, Community Interaction, Leads, App Promotion, Website Conversions) ve kampanya adı
  3. **Reklam Seti / Reklam Grubu** — bütçe & takvim, teklif stratejisi, optimizasyon hedefi, hedef kitle (yaş, cinsiyet, konum, dil, ilgi alanları), yerleşim
  4. **Reklam** — format, ana metin, başlık, CTA butonu, hedef URL/mağaza linki
- **Kampanyalar Bölümü** — oluşturulan tüm kampanyalar satır kart (row card) olarak listelenir. Yeni kampanyalar **Taslak** olarak başlar; "▶ Yayınla" ile **Aktif** moda alınır, ardından duraklatılıp devam ettirilebilir veya silinebilir.
- **Reklam İpuçları** — `tips.html`, hedef kitle, bütçe/teklif, kreatif, test/optimizasyon ve platforma özel kısa pratik ipuçları içerir.

## Dosya yapısı

```
index.html           Giriş / kayıt sayfası
app.html              Kampanyalar paneli + oluşturma sihirbazı
tips.html             Reklam verme ipuçları
api/auth.php          Kullanıcı kayıt/giriş/çıkış (data/users.json)
data/.htaccess        data/ klasörüne doğrudan erişimi engeller
data/users.json       Kullanıcı verisi (git'e dahil değil, sunucuda oluşur)
assets/style.css      Ortak tasarım sistemi
assets/data.js        Meta & TikTok platform/hedef/optimizasyon tanımları
assets/auth.js        Giriş sayfası mantığı (api/auth.php istemcisi)
assets/app.js         Sihirbaz + kampanya listesi mantığı
```

## Çalıştırma

PHP gerektirir (kullanıcı girişi için):

```
php -S localhost:8000
```

Sonrasında `http://localhost:8000` adresini açın.

## Yayınlama

Hosting hesabı Git deposunu doğrudan çekiyor (Hostinger otomatik Git dağıtımı). `data/users.json` `.gitignore` ile depodan hariç tutulur, böylece her dağıtımda canlı kullanıcı verisi korunur. `.github/workflows/deploy.yml` üzerindeki FTP workflow'u alternatif/yedek bir dağıtım yoludur; gerekli secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
