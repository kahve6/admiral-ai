# ADMIRA — Meta & TikTok Kampanya Planlayıcı

Meta (Facebook/Instagram) ve TikTok reklam kampanyalarınızın hedeflerini, hedef kitlesini ve bütçesini planlamanızı sağlayan, tamamen istemci taraflı (static) bir web uygulaması.

## Özellikler

- **Giriş / Kayıt** — `index.html`. Yerel demo kimlik doğrulama (veriler yalnızca tarayıcıda `localStorage` içinde tutulur, gerçek bir backend yoktur). Hızlı denemek için "Demo hesapla devam edin" seçeneği mevcuttur.
- **Kampanya Oluştur Sihirbazı** — `app.html` içindeki "+ Kampanya Oluştur" butonu 3 adımlı bir akış açar:
  1. **Platform seçimi** — Meta veya TikTok
  2. **Kampanya hedefi** — seçilen platformun gerçek reklam yöneticisindeki hedeflere (Awareness, Traffic, Engagement, Leads, App Promotion, Sales / Reach, Community Interaction, vb.) göre değişen liste
  3. **Kampanya detayları** — kampanya adı, bütçe & takvim, hedef kitle (yaş, cinsiyet, konum, dil, ilgi alanları), yerleşim ve reklam formatı
- **Kampanyalar Bölümü** — oluşturulan tüm kampanyalar satır kart (row card) olarak; platform rozeti, hedef, durum, hedef kitle özeti, bütçe ve oluşturma tarihi ile listelenir. Kampanyalar duraklatılabilir/aktif edilebilir veya silinebilir.

## Dosya yapısı

```
index.html          Giriş / kayıt sayfası
app.html             Kampanyalar paneli + oluşturma sihirbazı
assets/style.css     Ortak tasarım sistemi
assets/data.js       Meta & TikTok platform/hedef tanımları
assets/auth.js       Giriş sayfası mantığı
assets/app.js        Sihirbaz + kampanya listesi mantığı
```

## Çalıştırma

Herhangi bir build adımı gerekmez — statik dosyaları bir web sunucusundan servis etmeniz yeterli:

```
php -S localhost:8000
```

Sonrasında `http://localhost:8000` adresini açın.

## Yayınlama

`main` dalına yapılan her push, `.github/workflows/deploy.yml` üzerinden FTP ile hosting hesabına yayınlanır. Gerekli secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
