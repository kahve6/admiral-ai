# App Akışı — Admiral AI

## Ana çalışma akışı (app içi, landing değil)

```
1. Yeni Kampanya
   └→ Marka adı + ürün + hedef (objective) + günlük bütçe + kitle notu
        ↓
2. AI Brief genişletme (2-3 sn "analiz" animasyonu)
   └→ Hedef kitle çıkarımı + 6 reklam açısı (urgency/social-proof/benefit/question/story/discount)
        ↓
3. Kreatif Üretimi (staggered animasyon, varyant kartları tek tek belirir)
   └→ Her varyant: görsel + başlık + metin + CTA + kazanma skoru (0-100)
        ↓
4. Varyant Grid (skora göre sıralı, kazanan rozetli)
   └→ Skor breakdown (hook/clarity/cta/urgency/relevance)
   └→ Kopyala / seç
        ↓
5. Launch (seçili varyantları yayına al)
   └→ Mock Meta kampanyası yaratılır → status: live
        ↓
6. Dashboard
   └→ Canlı simüle metrikler: impressions, CTR, CPA, ROAS, spend
   └→ Kampanya listesi + per-variant performans
        ↓
7. Optimize
   └→ Kazanan varyant işaretlenir → "Kazananı çoğalt" → yeni iterasyon
```

## Klonda aynen kalan akış
- ✓ Input → AI üretim → skorlama → launch → dashboard döngüsü
- ✓ Staggered "analyzing" animasyonu (wow moment)
- ✓ Kazanma skoru ve breakdown

## Niş için değişen
- ✗ Dil: bilingual TR/EN toggle
- ✗ Gerçek Meta API yerine sandbox simülasyon
- ✗ TR pazarına uygun fiyatlandırma
