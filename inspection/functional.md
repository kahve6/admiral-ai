# Fonksiyonel İnspeksiyon — AdStellar (adstellar.ai)

## One-liner
"AI medya satın alıcı" — kullanıcı ürün/marka bilgisi verir, sistem hem **görsel/video reklam kreatifleri** üretir hem de **Meta reklam kampanyalarını kurar, varyant test eder, kazananları skorlar ve optimize eder.**

## Core action zinciri
1. Kullanıcı yeni kampanya açar → ürün URL'si / marka adı / hedef girer
2. Sistem brief'i AI ile genişletir (hedef kitle, açı, mesaj)
3. AI **N adet reklam varyantı** üretir (görsel + başlık + metin + CTA)
4. Her varyant bir **kazanma skoru** ile derecelendirilir (hook gücü, netlik, CTA, aciliyet)
5. Kullanıcı varyantları seçer → **mock Meta kampanyası** olarak "launch" eder
6. Dashboard'da kampanyalar canlanır: simüle edilmiş impressions / CTR / CPA / ROAS metrikleri
7. Sistem kazanan varyantı işaretler, yeni iterasyon önerir (optimize loop)

## Must-have feature listesi
1. **Kampanya oluşturucu** — ürün/marka/hedef input formu (URL veya manuel)
2. **AI kreatif üretici** — birden fazla reklam varyantı (görsel + copy + CTA + açı)
3. **Kazanma skoru** — her varyanta 0-100 skor + neden açıklaması
4. **Varyant kıyas grid'i** — yan yana görsel reklam kartları, skorla sıralı
5. **Mock kampanya launch** — seçili varyantları "yayına al", sandbox kampanya yarat
6. **Performans dashboard** — simüle edilmiş metrikler (impressions, CTR, CPA, ROAS, spend)
7. **Optimize loop** — kazananı bul, yeni varyant öner (iterasyon)
8. **Kreatif kopyalama / export** — varyant metnini panoya kopyala

## Veri kontratı
```ts
type Campaign = {
  id: string
  brand: string
  product: string
  objective: 'conversions' | 'traffic' | 'awareness' | 'leads'
  audience: string
  budgetDaily: number
  status: 'draft' | 'live' | 'paused' | 'winning'
  createdAt: string
  variants: Variant[]
  metrics?: CampaignMetrics
}

type Variant = {
  id: string
  angle: 'urgency' | 'social-proof' | 'benefit' | 'question' | 'story' | 'discount'
  headline: string
  primaryText: string
  cta: string
  imageSeed: string      // placeholder/stock görsel referansı
  score: number          // 0-100 kazanma skoru
  scoreBreakdown: { hook: number; clarity: number; cta: number; urgency: number; relevance: number }
  metrics?: VariantMetrics
}

type VariantMetrics = {
  impressions: number
  clicks: number
  ctr: number
  spend: number
  conversions: number
  cpa: number
  roas: number
}
```

## Anti-örnek (kopyalanmayacak)
- Gerçek Meta Marketing API bağlantısı (app review + bütçe riski) → sandbox/mock
- AdStellar marka adı/logosu → yeni marka "Admiral AI"
- Login-arkası özel akışlar (gerçek ödeme entegrasyonu) → sadece checkout iskeleti
- Gerçek AI görsel üretim API'si (key yok) → kategori-aware placeholder kreatifler
