# Admiral AI

AdStellar (adstellar.ai) işlevinin **çalışan klonu** — app-maker skill'i ile üretildi. Kazanan reklamları üreten "AI medya satın alıcı": marka tarif et, AI skorlu reklam varyantları üretsin, kazananı yayına almadan önce gör, mock kampanya olarak başlat ve simüle metrikleri izle.

> Marka ve tüm kod orijinaldir. AdStellar'ın hiçbir varlığı (görsel/metin/logo) kopyalanmamıştır — yalnızca **işlev** klonlanmıştır.

## Ne yapıyor (input → process → output)

1. **Input** — marka, ürün/hizmet, hedef (objective), günlük bütçe, (ops.) hedef kitle
2. **Process** — `AdmiralEngine`:
   - üründen **kategori tespiti** (moda, fitness, kozmetik, tech, gıda, ev, eğitim, finans)
   - 6 reklam **açısı** (aciliyet / sosyal kanıt / fayda / soru / hikaye / indirim)
   - her varyant için **kazanma skoru** 0-100 + breakdown (hook, netlik, CTA, aciliyet, alaka)
   - launch sonrası **sandbox metrik simülasyonu** (impressions, CTR, CPA, ROAS, harcama, gelir)
3. **Output** — skorlu varyant grid'i → seç & launch → canlı dashboard → optimize döngüsü (kazananı çoğalt)

## Çalıştırma

Saf statik site, build gerektirmez. Herhangi bir static server yeter:

```bash
cd admiral-ai
python -m http.server 8731
# → http://localhost:8731/index.html   (landing)
# → http://localhost:8731/app.html     (uygulama)
```

> Not: `file://` ile de açılır ama `localStorage` ve clipboard için `http://` önerilir.

## Yapı

```
admiral-ai/
├── index.html          landing (bilingual TR/EN, hero canlı önizleme)
├── app.html            uygulama kabuğu (sidebar + view container)
├── assets/
│   ├── engine.js       kreatif üretim motoru — varyant + skor + metrik simülasyonu
│   ├── app.js          tüm app mantığı (dashboard, new, results, detail, optimize)
│   ├── i18n.js         TR/EN sözlük
│   └── style.css       tema (koyu, gradient accent #6366f1→#8b5cf6)
├── data/
│   └── seed-campaigns.json   demo kampanya tohumları
└── inspection/         orijinal app analizi (functional/styles/flow/pricing/audience)
```

## Özellikler

- **Bilingual TR/EN** — sağ üstteki toggle, tercih `localStorage`'da kalıcı
- **Çalışan üretim akışı** — gerçek motor, staggered "analyzing" animasyonu (mock değil, gerçek çıktı)
- **Kazanma skoru + breakdown** — her varyantta 5 boyutlu skor barları
- **Mock kampanya & dashboard** — seçili varyantları yayına al, simüle metrikleri izle
- **Optimize döngüsü** — kazananı çoğalt, yeni iterasyon üret
- **Kalıcı state** — kampanyalar `localStorage`'da saklanır
- **Kopyala** — varyant metnini panoya kopyala

## Sınırlamalar

- **Gerçek Meta API yok** — tüm kampanya/metrik verisi **sandbox/simülasyon** (kullanıcı tercihiyle). Gerçek bağlantı için `app.js` içindeki `launchCampaign`/`simulateMetrics` Meta Marketing API ile değiştirilebilir.
- **Gerçek AI görsel/LLM yok** — kreatifler kategori-aware şablon motoruyla üretilir (kullanıcı tercihiyle). Gerçek üretim için `engine.generateVariants` bir LLM/görsel API proxy'sine bağlanabilir (`/api/*.js` üzerinden — key asla frontend'de değil).

## Genişletmek için

- Yeni reklam açısı: `engine.js` → `ANGLES` ve `ANGLE_KEYS`
- Yeni kategori: `engine.js` → `CATEGORY_KEYWORDS` + `CATEGORY_GRADIENTS`
- Gerçek AI metin: `generateVariants` içine `/api/generate.js` proxy çağrısı ekle
- Gerçek metrik: `simulateMetrics` yerine Meta Insights API
- Demo veriyi sıfırla: tarayıcı konsolunda `localStorage.removeItem('admiral_campaigns_v1')`

## Fiyatlandırma (niş uyarlaması)

| Plan | TR | EN | Hedef |
|------|----|----|-------|
| Free | ₺0 | $0 | 3 kampanya, 12 varyant/ay |
| Pro | ₺899/ay | $29/ay | Sınırsız + optimize döngüsü |
| Studio | ₺2.900/ay | $95/ay | Çoklu marka + ekip + export |
