/* Admiral AI — Kreatif üretim motoru (v2: marketing-consultant çerçevesi)
 * marketing-consultant skill mantalitesi koda gömülüdür:
 *   - 8 TEKLİF bileşeni (Sonuç Sat / Fiyat / Hız / Şartlar / Servis / Deneyim / Garanti / Kolay Giriş)
 *     KURAL: her metin EN AZ 2 teklif bileşeni taşır.
 *   - 20 psikolojik TETİKLEYİCİ (Trigger) — her açı bir tetikleyiciye dayanır.
 *   - "Özellik değil SONUÇ sat" çekirdek ilkesi.
 *   - Sektör seçimi metni sürükler (havuzlar sektöre göre).
 * Hiçbir external API çağrısı yok — deterministik + pseudo-random simülasyon.
 * Meta Reklam Kütüphanesi verisi data/winning-ads.json üzerinden enjekte edilir.
 */
(function (global) {
  'use strict';

  // ---- pseudo-random (seed'li, tekrar üretilebilir) ----
  function seededRandom(seedStr) {
    seedStr = String(seedStr);
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function pickN(rnd, arr, n) {
    var copy = arr.slice(), out = [];
    for (var i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
    return out;
  }
  function range(rnd, min, max) { return min + rnd() * (max - min); }
  function intRange(rnd, min, max) { return Math.floor(range(rnd, min, max + 1)); }
  function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

  // ============================================================
  // marketing-consultant SÖZLÜĞÜ (UI'da göstermek için bilingual)
  // ============================================================

  // 8 TEKLİF bileşeni (Marketing 101 → "Teklif / Offer")
  var OFFER_COMPONENTS = {
    sonuc:  { tr: 'Sonuç Sat',  en: 'Sell the Result' },
    fiyat:  { tr: 'Fiyat',      en: 'Price' },
    hiz:    { tr: 'Hız',        en: 'Speed' },
    sartlar:{ tr: 'Şartlar',    en: 'Easy Terms' },
    servis: { tr: 'Servis',     en: 'Service' },
    deneyim:{ tr: 'Deneyim',    en: 'Experience' },
    garanti:{ tr: 'Garanti',    en: 'Guarantee' },
    giris:  { tr: 'Kolay Giriş',en: 'Easy Entry' }
  };

  // 20 TETİKLEYİCİ (Marketing 101 → "Trigger'lar")
  var TRIGGERS = {
    novelty:     { tr: 'Yenilik Faktörü', en: 'Novelty' },
    socialproof: { tr: 'Sosyal Kanıt', en: 'Social Proof' },
    reciprocity: { tr: 'Karşılıklılık', en: 'Reciprocity' },
    smaller:     { tr: 'Daha Küçük Sat', en: 'Sell Something Smaller' },
    trust:       { tr: 'Güven', en: 'Trust' },
    conformity:  { tr: 'Uygunluk Fenomeni', en: 'Conformity' },
    dissonance:  { tr: 'Bilişsel Uyumsuzluk', en: 'Cognitive Dissonance' },
    scarcity:    { tr: 'Kıtlık', en: 'Scarcity' },
    faketail:    { tr: 'Yapay Kuyruk', en: 'Fake Tail' },
    authority:   { tr: 'Otorite', en: 'Authority' },
    liking:      { tr: 'Beğenme', en: 'Liking' },
    clustering:  { tr: 'Kümeleme', en: 'Clustering' },
    lossaversion:{ tr: 'Kayıptan Kaçınma', en: 'Loss Aversion' },
    decoy:       { tr: 'Tuzak Etkisi', en: 'Decoy Effect' },
    benefits:    { tr: 'Kâr Sat Özellik Değil', en: 'Sell Benefits Not Features' },
    storytelling:{ tr: 'Hikâye Anlatımı', en: 'Storytelling' },
    community:   { tr: 'Topluluk', en: 'Build a Community' },
    curiosity:   { tr: 'Merak', en: 'Curiosity' },
    reliability: { tr: 'Güvenilirlik', en: 'Reliability' },
    strongimg:   { tr: 'Güçlü Görseller', en: 'Strong Images' }
  };

  // ============================================================
  // SEKTÖR HAVUZLARI — seçilen sektör metni sürükler.
  // Her sektörde: sonuç (SONUÇ SAT) cümleleri, acılar (problem),
  // kanıtlar (DENEYİM/SOSYAL KANIT) ve 7 teklif bileşeni snippet'i.
  // ============================================================
  var SECTORS = {
    fashion: {
      label: { tr: 'Moda & Giyim', en: 'Fashion & Apparel' },
      gradient: ['#f472b6', '#a855f7'],
      audience: { tr: '25-45 yaş, stil & moda ilgili, online alışveriş yapan kadınlar', en: 'Women 25-45, style & fashion interested, online shoppers' },
      results: {
        tr: ['her kombinde fark yarat', 'gardırobunu tek dokunuşla yenile', 'aynaya her baktığında kendini güçlü hisset'],
        en: ['stand out in every outfit', 'refresh your wardrobe in one move', 'feel powerful every time you look in the mirror']
      },
      pains: {
        tr: ['Dolabın dolu ama giyecek bir şey mi yok?', 'Aynı parçayı herkeste mi görüyorsun?'],
        en: ['Closet full but nothing to wear?', 'Seeing the same piece on everyone?']
      },
      proofs: {
        tr: ['40.000+ kombin paylaşıldı', '4.8/5 — 9.200 değerlendirme', '%93 "yine alırım" diyor'],
        en: ['40,000+ looks shared', '4.8/5 — 9,200 reviews', '93% would buy again']
      },
      offer: {
        sonuc:  { tr: 'Ürün değil, her gün aldığın iltifatı satın al', en: 'Buy the compliments, not just the product' },
        fiyat:  { tr: 'Atölye fiyatına butik kalite', en: 'Boutique quality at workshop prices' },
        hiz:    { tr: '24 saatte kargoda', en: 'Ships within 24 hours' },
        sartlar:{ tr: '30 gün ücretsiz iade & değişim', en: '30-day free returns & exchange' },
        servis: { tr: 'Ücretsiz stil danışmanlığı', en: 'Free styling advice' },
        deneyim:{ tr: '12 yıldır gardıroplara dokunuyoruz', en: '12 years dressing wardrobes' },
        garanti:{ tr: 'Beğenmezsen tam iade', en: 'Don\'t love it? Full refund' },
        giris:  { tr: 'İlk siparişte %15 indirim kuponu', en: '15% off coupon on first order' }
      }
    },
    fitness: {
      label: { tr: 'Fitness & Spor', en: 'Fitness & Sports' },
      gradient: ['#22c55e', '#0ea5e9'],
      audience: { tr: '20-40 yaş, sağlık & fitness odaklı, ev/salon egzersizi yapanlar', en: 'Ages 20-40, health & fitness focused, home/gym exercisers' },
      results: {
        tr: ['12 haftada formuna kavuş', 'enerjini ikiye katla', 'aynada görmek istediğin bedene ulaş'],
        en: ['get in shape in 12 weeks', 'double your energy', 'reach the body you want to see']
      },
      pains: {
        tr: ['Spora başlıyorsun, 2 hafta sonra bırakıyor musun?', 'Çalışıyorsun ama sonuç gelmiyor mu?'],
        en: ['Start training, quit after 2 weeks?', 'Working out but no results?']
      },
      proofs: {
        tr: ['18.000+ kişi dönüşümünü tamamladı', '4.9/5 koç puanı', 'ortalama 8 haftada ilk sonuç'],
        en: ['18,000+ completed their transformation', '4.9/5 coach rating', 'first results in ~8 weeks']
      },
      offer: {
        sonuc:  { tr: 'Program değil, aynadaki sonucu satın al', en: 'Buy the result in the mirror, not a program' },
        fiyat:  { tr: 'Bir kahve fiyatına günlük antrenman', en: 'Daily training for the price of a coffee' },
        hiz:    { tr: 'Bugün başla, ilk antrenman hazır', en: 'Start today, first workout ready' },
        sartlar:{ tr: 'İstediğin an iptal, taahhüt yok', en: 'Cancel anytime, no commitment' },
        servis: { tr: '7/24 koç desteği', en: '24/7 coach support' },
        deneyim:{ tr: '18.000+ dönüşüm tecrübesi', en: '18,000+ transformations of experience' },
        garanti:{ tr: '30 günde sonuç yoksa para iade', en: 'No result in 30 days? Money back' },
        giris:  { tr: '7 gün ücretsiz deneme', en: '7-day free trial' }
      }
    },
    beauty: {
      label: { tr: 'Kozmetik & Bakım', en: 'Beauty & Skincare' },
      gradient: ['#fb7185', '#f59e0b'],
      audience: { tr: '18-45 yaş, cilt bakımı & kozmetik ilgili', en: 'Ages 18-45, skincare & cosmetics interested' },
      results: {
        tr: ['cildini 14 günde aydınlat', 'makyajsız da güvenle çık', 'yaşını değil ışığını göster'],
        en: ['brighten your skin in 14 days', 'go out confident without makeup', 'show your glow, not your age']
      },
      pains: {
        tr: ['Onlarca ürün denedin, sonuç yok mu?', 'Cildin matlaştı, ne yapacağını mı bilmiyorsun?'],
        en: ['Tried dozens of products, no result?', 'Skin gone dull and you\'re lost?']
      },
      proofs: {
        tr: ['dermatolog onaylı', '%91 14 günde fark gördü', '25.000+ memnun cilt'],
        en: ['dermatologist approved', '91% saw a difference in 14 days', '25,000+ happy skins']
      },
      offer: {
        sonuc:  { tr: 'Krem değil, aynadaki ışıltıyı satın al', en: 'Buy the glow in the mirror, not a cream' },
        fiyat:  { tr: 'Klinik bakım etkisi, ev fiyatına', en: 'Clinic-grade effect at home prices' },
        hiz:    { tr: '14 günde gözle görülür fark', en: 'Visible difference in 14 days' },
        sartlar:{ tr: 'Cilt tipine uygun değilse ücretsiz değişim', en: 'Free swap if it doesn\'t suit your skin' },
        servis: { tr: 'Ücretsiz cilt analizi', en: 'Free skin analysis' },
        deneyim:{ tr: 'dermatolog ekibiyle geliştirildi', en: 'developed with dermatologists' },
        garanti:{ tr: 'Memnun kalmazsan iade', en: 'Not satisfied? Refund' },
        giris:  { tr: 'Mini deneme seti ile başla', en: 'Start with a mini trial set' }
      }
    },
    tech: {
      label: { tr: 'Teknoloji & SaaS', en: 'Tech & SaaS' },
      gradient: ['#6366f1', '#06b6d4'],
      audience: { tr: '22-45 yaş, teknoloji meraklısı, erken benimseyen', en: 'Ages 22-45, tech enthusiasts, early adopters' },
      results: {
        tr: ['işini yarı sürede bitir', 'ekibini tek ekrandan yönet', 'manuel işe veda et'],
        en: ['finish work in half the time', 'run your team from one screen', 'say goodbye to manual work']
      },
      pains: {
        tr: ['Hâlâ 5 farklı araç arasında mı koşuyorsun?', 'Tablolar elinde mi patlıyor?'],
        en: ['Still juggling 5 different tools?', 'Drowning in spreadsheets?']
      },
      proofs: {
        tr: ['12.000+ ekip kullanıyor', '4.8/5 — G2 onaylı', 'kurulum 5 dakika'],
        en: ['12,000+ teams use it', '4.8/5 — G2 verified', '5-minute setup']
      },
      offer: {
        sonuc:  { tr: 'Yazılım değil, kazandığın saatleri satın al', en: 'Buy back your hours, not software' },
        fiyat:  { tr: 'Bir çalışanın maliyetinin yüzde biri', en: 'A fraction of one employee\'s cost' },
        hiz:    { tr: '5 dakikada kurulum, kod yok', en: '5-minute setup, no code' },
        sartlar:{ tr: 'Kredi kartı yok, istediğinde iptal', en: 'No credit card, cancel anytime' },
        servis: { tr: 'Türkçe canlı destek', en: 'Live human support' },
        deneyim:{ tr: '12.000+ ekibin güvendiği altyapı', en: 'trusted by 12,000+ teams' },
        garanti:{ tr: '14 gün koşulsuz iade', en: '14-day no-questions refund' },
        giris:  { tr: 'Ücretsiz plan ile başla', en: 'Start on the free plan' }
      }
    },
    food: {
      label: { tr: 'Gıda & Takviye', en: 'Food & Supplements' },
      gradient: ['#f59e0b', '#ef4444'],
      audience: { tr: '25-50 yaş, sağlıklı yaşam & gurme ilgili', en: 'Ages 25-50, healthy living & gourmet interested' },
      results: {
        tr: ['her sabah daha zinde uyan', 'lezzetten ödün vermeden sağlıklı ye', 'enerjini gün boyu koru'],
        en: ['wake up fresher every morning', 'eat healthy without losing flavor', 'keep your energy all day']
      },
      pains: {
        tr: ['Sağlıklı yemek pahalı ve zor mu sanıyorsun?', 'Öğlen 3\'te enerjin mi bitiyor?'],
        en: ['Think eating healthy is pricey and hard?', 'Energy crashing at 3pm?']
      },
      proofs: {
        tr: ['30.000+ kutu gönderildi', '%96 tadını sevdi', 'laboratuvar test raporlu'],
        en: ['30,000+ boxes shipped', '96% loved the taste', 'lab-tested & certified']
      },
      offer: {
        sonuc:  { tr: 'Ürün değil, gün boyu enerjini satın al', en: 'Buy all-day energy, not a product' },
        fiyat:  { tr: 'Dışarıda yemekten ucuz', en: 'Cheaper than eating out' },
        hiz:    { tr: 'Ertesi gün kapında', en: 'At your door next day' },
        sartlar:{ tr: 'Aboneliği istediğin an dondur', en: 'Pause your subscription anytime' },
        servis: { tr: 'Ücretsiz beslenme rehberi', en: 'Free nutrition guide' },
        deneyim:{ tr: 'gıda mühendisleriyle geliştirildi', en: 'developed with food scientists' },
        garanti:{ tr: 'Beğenmezsen ilk kutu bizden', en: 'First box on us if you don\'t love it' },
        giris:  { tr: 'Deneme kutusu ile başla', en: 'Start with a trial box' }
      }
    },
    home: {
      label: { tr: 'Ev & Yaşam', en: 'Home & Living' },
      gradient: ['#14b8a6', '#6366f1'],
      audience: { tr: '28-55 yaş, ev & yaşam, yeni taşınanlar', en: 'Ages 28-55, home & living, recently moved' },
      results: {
        tr: ['evini misafirlerin konuşacağı hale getir', 'her odaya huzur kat', 'günlük işini yarıya indir'],
        en: ['make your home the talk of guests', 'bring calm to every room', 'halve your daily chores']
      },
      pains: {
        tr: ['Evin dağınık ve sıkışık mı hissettiriyor?', 'Her şey güzel ama bir şey mi eksik?'],
        en: ['Home feels cluttered and cramped?', 'Everything\'s nice but something\'s missing?']
      },
      proofs: {
        tr: ['50.000+ eve girdi', '4.7/5 — 11.000 yorum', '%89 "evim değişti" diyor'],
        en: ['in 50,000+ homes', '4.7/5 — 11,000 reviews', '89% say "my home changed"']
      },
      offer: {
        sonuc:  { tr: 'Eşya değil, eve girince hissettiğin huzuru satın al', en: 'Buy the calm you feel at home, not an object' },
        fiyat:  { tr: 'Mağaza fiyatının altında', en: 'Below store prices' },
        hiz:    { tr: '2-3 günde kurulu teslim', en: 'Assembled delivery in 2-3 days' },
        sartlar:{ tr: '14 gün koşulsuz iade', en: '14-day no-questions returns' },
        servis: { tr: 'Ücretsiz kurulum', en: 'Free assembly' },
        deneyim:{ tr: '50.000+ evin tercihi', en: 'chosen by 50,000+ homes' },
        garanti:{ tr: '2 yıl garanti', en: '2-year warranty' },
        giris:  { tr: 'Önce ölç, sonra al — ücretsiz keşif', en: 'Measure first — free survey' }
      }
    },
    education: {
      label: { tr: 'Eğitim & Kurs', en: 'Education & Courses' },
      gradient: ['#3b82f6', '#8b5cf6'],
      audience: { tr: '20-40 yaş, kariyer gelişimi & öğrenme ilgili', en: 'Ages 20-40, career growth & learning interested' },
      results: {
        tr: ['8 haftada yeni bir beceri kazan', 'maaşını konuşulur hale getir', 'sıfırdan ilk işini al'],
        en: ['gain a new skill in 8 weeks', 'make your salary worth talking about', 'land your first job from zero']
      },
      pains: {
        tr: ['Onlarca video izledin ama uygulayamadın mı?', 'Nereden başlayacağını mı bilmiyorsun?'],
        en: ['Watched dozens of videos but never applied them?', 'Don\'t know where to start?']
      },
      proofs: {
        tr: ['14.000+ mezun', '%87 ilk 3 ayda iş buldu', '4.9/5 eğitmen puanı'],
        en: ['14,000+ graduates', '87% hired within 3 months', '4.9/5 instructor rating']
      },
      offer: {
        sonuc:  { tr: 'Kurs değil, kazanacağın kariyeri satın al', en: 'Buy the career you\'ll earn, not a course' },
        fiyat:  { tr: 'Tek maaşının altında, ömür boyu erişim', en: 'Less than one salary, lifetime access' },
        hiz:    { tr: 'İlk derste ilk sonucunu al', en: 'Get your first result in lesson one' },
        sartlar:{ tr: 'Kendi hızında öğren', en: 'Learn at your own pace' },
        servis: { tr: 'Birebir mentor desteği', en: '1-on-1 mentor support' },
        deneyim:{ tr: '14.000+ öğrenciyi mezun ettik', en: 'graduated 14,000+ students' },
        garanti:{ tr: '14 gün koşulsuz iade', en: '14-day no-questions refund' },
        giris:  { tr: 'Ücretsiz ilk modülle başla', en: 'Start with a free first module' }
      }
    },
    finance: {
      label: { tr: 'Finans & Yatırım', en: 'Finance & Investing' },
      gradient: ['#10b981', '#0f766e'],
      audience: { tr: '25-50 yaş, yatırım & tasarruf ilgili', en: 'Ages 25-50, investing & saving interested' },
      results: {
        tr: ['paranı çalıştır, sen rahat et', 'tasarrufunu gözle görülür büyüt', 'finansal stresten kurtul'],
        en: ['put your money to work', 'grow your savings visibly', 'escape financial stress']
      },
      pains: {
        tr: ['Paran enflasyonda mı eriyor?', 'Yatırıma başlamak gözünü mü korkutuyor?'],
        en: ['Money melting to inflation?', 'Scared to start investing?']
      },
      proofs: {
        tr: ['220.000+ kullanıcı', 'lisanslı & denetlenen', 'verilerin banka düzeyinde şifreli'],
        en: ['220,000+ users', 'licensed & audited', 'bank-grade encryption']
      },
      offer: {
        sonuc:  { tr: 'Uygulama değil, içini rahatlatan geleceği satın al', en: 'Buy peace of mind, not an app' },
        fiyat:  { tr: 'Komisyon yok, gizli ücret yok', en: 'No commission, no hidden fees' },
        hiz:    { tr: '3 dakikada hesap aç', en: 'Open an account in 3 minutes' },
        sartlar:{ tr: 'İstediğin an çek', en: 'Withdraw anytime' },
        servis: { tr: 'Uzman finans desteği', en: 'Expert financial support' },
        deneyim:{ tr: '220.000+ kullanıcının güveni', en: 'trusted by 220,000+ users' },
        garanti:{ tr: 'lisanslı & denetlenen güvenlik', en: 'licensed & audited security' },
        giris:  { tr: 'Küçük başla, 100 TL ile dene', en: 'Start small, try with ₺100' }
      }
    },
    generic: {
      label: { tr: 'Genel', en: 'General' },
      gradient: ['#6366f1', '#8b5cf6'],
      audience: { tr: '22-50 yaş, ürünle ilgili genel kitle', en: 'Ages 22-50, broad interest matching the product' },
      results: {
        tr: ['hayatını kolaylaştır', 'aradığın sonuca ulaş', 'farkı ilk günden hisset'],
        en: ['make life easier', 'reach the result you want', 'feel the difference from day one']
      },
      pains: {
        tr: ['Hâlâ zor yoldan mı yapıyorsun?', 'Doğru olanı seçmekte mi zorlanıyorsun?'],
        en: ['Still doing it the hard way?', 'Struggling to pick the right one?']
      },
      proofs: {
        tr: ['binlerce mutlu müşteri', '4.8/5 ortalama puan', '%90+ memnuniyet'],
        en: ['thousands of happy customers', '4.8/5 average rating', '90%+ satisfaction']
      },
      offer: {
        sonuc:  { tr: 'Ürün değil, istediğin sonucu satın al', en: 'Buy the result you want, not a product' },
        fiyat:  { tr: 'Rakiplerinden uygun, kaliteden ödün yok', en: 'Better price, no quality compromise' },
        hiz:    { tr: 'Hızlı teslim', en: 'Fast delivery' },
        sartlar:{ tr: 'Kolay iade & değişim', en: 'Easy returns & exchange' },
        servis: { tr: '7/24 destek', en: '24/7 support' },
        deneyim:{ tr: 'binlerce müşterinin tercihi', en: 'chosen by thousands' },
        garanti:{ tr: 'Memnun kalmazsan iade', en: 'Not happy? Refund' },
        giris:  { tr: 'Risksiz dene', en: 'Try risk-free' }
      }
    }
  };

  var SECTOR_KEYS = ['fashion', 'fitness', 'beauty', 'tech', 'food', 'home', 'education', 'finance'];

  // kategori tespiti (sektör seçilmediyse üründen tahmin)
  var CATEGORY_KEYWORDS = {
    fashion: ['moda', 'giyim', 'kazak', 'elbise', 'ayakkabı', 'çanta', 'koleksiyon', 'fashion', 'clothing', 'dress', 'shoes', 'kıyafet', 'tişört', 'pantolon'],
    fitness: ['fitness', 'antrenman', 'spor', 'egzersiz', 'kas', 'protein', 'workout', 'gym', 'direnç', 'kilo', 'diyet'],
    beauty: ['kozmetik', 'cilt', 'bakım', 'serum', 'krem', 'makyaj', 'beauty', 'skincare', 'cream', 'parfüm', 'şampuan'],
    tech: ['teknoloji', 'yazılım', 'uygulama', 'app', 'saas', 'software', 'cihaz', 'kulaklık', 'telefon', 'gadget', 'akıllı'],
    food: ['gıda', 'yemek', 'kahve', 'çay', 'atıştırmalık', 'food', 'coffee', 'snack', 'organik', 'vitamin', 'takviye'],
    home: ['ev', 'mobilya', 'dekor', 'mutfak', 'home', 'furniture', 'decor', 'aydınlatma', 'yatak', 'temizlik'],
    education: ['eğitim', 'kurs', 'online', 'ders', 'sertifika', 'course', 'education', 'öğren', 'koçluk', 'mentor'],
    finance: ['finans', 'yatırım', 'kredi', 'sigorta', 'finance', 'banka', 'borsa', 'kripto', 'tasarruf']
  };

  function detectCategory(product) {
    var p = (product || '').toLowerCase();
    var best = 'generic', bestScore = 0;
    for (var cat in CATEGORY_KEYWORDS) {
      var s = 0;
      CATEGORY_KEYWORDS[cat].forEach(function (kw) { if (p.indexOf(kw) !== -1) s++; });
      if (s > bestScore) { bestScore = s; best = cat; }
    }
    return best;
  }

  function resolveSector(opts) {
    var s = opts && opts.sector;
    if (s && s !== 'auto' && SECTORS[s]) return s;
    return detectCategory(opts && opts.product);
  }

  // ============================================================
  // AÇI ŞABLONLARI — her açı bir TETİKLEYİCİ + teklif vurgusu taşır.
  // Body, sektör havuzundan {result}/{o1}/{o2}/{proof}/{pain} slotlarıyla örülür.
  // Böylece her metin EN AZ 2 teklif bileşeni içerir (KURAL).
  // ============================================================
  var ANGLES = {
    urgency: {
      trigger: 'scarcity', offer: ['giris', 'hiz'],
      tag: { tr: 'Aciliyet', en: 'Urgency' },
      headline: {
        tr: ['Son 24 saat — {product}', 'Stoklar tükeniyor: {brand}', 'Bugün biten fırsat: {product}'],
        en: ['Last 24 hours — {product}', 'Almost gone: {brand}', 'Ends today: {product}']
      },
      body: {
        tr: ['{brand} ile {result}. {o1}. {o2}. Sınırlı stok — kaçıranlar sonraki sezonu bekliyor.',
             'Sayaç işliyor: {product} kampanyası bu gece bitiyor. {o1}, {o2}. Şimdi yerini ayırt.'],
        en: ['With {brand} you {result}. {o1}. {o2}. Limited stock — those who miss it wait for next season.',
             'The clock is ticking: the {product} offer ends tonight. {o1}, {o2}. Claim yours now.']
      },
      cta: { tr: 'Şimdi Al', en: 'Buy Now' }
    },
    'social-proof': {
      trigger: 'socialproof', offer: ['deneyim', 'garanti'],
      tag: { tr: 'Sosyal Kanıt', en: 'Social Proof' },
      headline: {
        tr: ['{proof} — {brand}', 'Neden herkes {product} diyor?', 'Kalabalığın tercihi: {brand}'],
        en: ['{proof} — {brand}', 'Why everyone says {product}', 'The crowd favorite: {brand}']
      },
      body: {
        tr: ['{proof}. {brand} ile {result}. {o1}, {o2}. Sen de aralarına katıl.',
             '"Beklediğimden iyi" — {brand} {product} için en sık duyduğumuz cümle. {o1}. {o2}.'],
        en: ['{proof}. With {brand} you {result}. {o1}, {o2}. Join them today.',
             '"Better than I expected" — the most common line about {brand} {product}. {o1}. {o2}.']
      },
      cta: { tr: 'Sen de Dene', en: 'Try It Too' }
    },
    benefit: {
      trigger: 'benefits', offer: ['servis', 'giris'],
      tag: { tr: 'Fayda', en: 'Benefit' },
      headline: {
        tr: ['{brand} ile {result}', 'Daha az çaba, daha çok sonuç', '3 adımda {product} farkı'],
        en: ['With {brand}, {result}', 'Less effort, more results', 'The {product} difference in 3 steps']
      },
      body: {
        tr: ['{sonuc}.\n\n✓ {o1}\n✓ {o2}\n✓ {result}\n\n{brand} {product} ile farkı bugün gör.',
             '{sonuc}. {o1}, {o2}. Net fayda, gizli ücret yok — {brand} {product}.'],
        en: ['{sonuc}.\n\n✓ {o1}\n✓ {o2}\n✓ {result}\n\nSee the {brand} {product} difference today.',
             '{sonuc}. {o1}, {o2}. Clear benefit, no hidden fees — {brand} {product}.']
      },
      cta: { tr: 'Keşfet', en: 'Discover' }
    },
    question: {
      trigger: 'curiosity', offer: ['giris', 'garanti'],
      tag: { tr: 'Soru Hook', en: 'Question Hook' },
      headline: {
        tr: ['{pain}', '{product} almadan önce bunu bil', 'Hâlâ eski yöntemle mi?'],
        en: ['{pain}', 'Know this before buying {product}', 'Still doing it the old way?']
      },
      body: {
        tr: ['{pain} {brand} ile {result}. {o1}, {o2}. 30 saniyede gör.',
             'Ya doğru {product} bu kadar kolaysa? {o1}. {o2}. Risksiz dene, farkı kendin gör.'],
        en: ['{pain} With {brand} you {result}. {o1}, {o2}. See it in 30 seconds.',
             'What if the right {product} is this easy? {o1}. {o2}. Try risk-free, see for yourself.']
      },
      cta: { tr: 'Cevabı Gör', en: 'See the Answer' }
    },
    story: {
      trigger: 'storytelling', offer: ['deneyim', 'sartlar'],
      tag: { tr: 'Hikâye', en: 'Story' },
      headline: {
        tr: ['6 ay önce her şey farklıydı...', 'Bir kullanıcının {product} yolculuğu', '{brand} nasıl başladı?'],
        en: ['Six months ago everything was different...', 'One user\'s {product} journey', 'How {brand} began']
      },
      body: {
        tr: ['Ayşe çaresizdi. {brand} {product} ile {result}. {o1}, {o2}. Bugün sonuçlarını paylaşıyor — sıradaki sen ol.',
             'Küçük bir fikir {brand} oldu. {sonuc}. {o1}, {o2}. Binlerce hayata dokundu, seninkine de dokunabilir.'],
        en: ['Ayse felt stuck. With {brand} {product} she {result}. {o1}, {o2}. Today she shares her results — you could be next.',
             'A small idea became {brand}. {sonuc}. {o1}, {o2}. It touched thousands of lives, it can touch yours.']
      },
      cta: { tr: 'Hikâyeyi Oku', en: 'Read the Story' }
    },
    discount: {
      trigger: 'lossaversion', offer: ['fiyat', 'hiz'],
      tag: { tr: 'İndirim', en: 'Discount' },
      headline: {
        tr: ['%40 indirim: {product}', '{brand} sezon fırsatı', 'Sadece bugün: {product} -%50'],
        en: ['40% off: {product}', '{brand} season deal', 'Today only: {product} -50%']
      },
      body: {
        tr: ['{product} şimdi %40 indirimli. {o1}, {o2}. {result} — kupon otomatik, kargo bedava. Fırsat sınırlı.',
             'Sezonun en büyük indirimi {brand}\'da. {o1}. {o2}. Sepete ekle, kazan.'],
        en: ['{product} is now 40% off. {o1}, {o2}. {result} — coupon auto-applied, free shipping. Limited.',
             'The biggest sale of the season at {brand}. {o1}. {o2}. Add to cart and save.']
      },
      cta: { tr: 'İndirimi Kap', en: 'Grab the Deal' }
    },
    authority: {
      trigger: 'authority', offer: ['deneyim', 'garanti'],
      tag: { tr: 'Otorite', en: 'Authority' },
      headline: {
        tr: ['Uzmanların seçtiği: {brand}', '{proof}', 'İşi bilenler {product} kullanıyor'],
        en: ['Experts choose {brand}', '{proof}', 'People who know use {product}']
      },
      body: {
        tr: ['{sonuc}. {proof}. {brand} ile {result}. {o1}, {o2}.',
             'Tesadüf değil: {proof}. {o1}. {o2}. {brand} {product} ile {result}.'],
        en: ['{sonuc}. {proof}. With {brand} you {result}. {o1}, {o2}.',
             'No accident: {proof}. {o1}. {o2}. With {brand} {product} you {result}.']
      },
      cta: { tr: 'İncele', en: 'Learn More' }
    },
    guarantee: {
      trigger: 'trust', offer: ['garanti', 'sartlar'],
      tag: { tr: 'Garanti', en: 'Guarantee' },
      headline: {
        tr: ['Risk sende değil, bizde: {brand}', 'Beğenmezsen para iade', '{product} — kaybetme ihtimalin yok'],
        en: ['The risk is on us: {brand}', 'Don\'t love it? Money back', '{product} — nothing to lose']
      },
      body: {
        tr: ['{o1}, {o2}. {brand} ile {result} — beğenmezsen tam iade. Denemek için tek sebebin yok, hiç sebebin yok.',
             'Para ödeme stresini hazza çeviriyoruz: {o1}. {o2}. {result}. Risk tamamen bizde.'],
        en: ['{o1}, {o2}. With {brand} you {result} — full refund if you don\'t love it. Zero reason not to try.',
             'We turn payment stress into delight: {o1}. {o2}. {result}. The risk is entirely ours.']
      },
      cta: { tr: 'Risksiz Dene', en: 'Try Risk-Free' }
    }
  };

  var ANGLE_KEYS = ['urgency', 'social-proof', 'benefit', 'question', 'discount', 'story', 'authority', 'guarantee'];

  function interp(str, map) {
    return str.replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; });
  }
  function cap(s) { return s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : s; }
  function lcFirst(s) { return s ? s.charAt(0).toLocaleLowerCase('tr') + s.slice(1) : s; }
  // cümle başlarını ve liste/satır başlarını büyük harfe çevir (clause'lar lowercase tutulur)
  function sentenceCase(s) {
    return s.replace(/(^|[.!?]\s+|\n[✓•\-]?\s*)([\wçğıöşüâ])/g, function (m, p, c) {
      return p + c.toLocaleUpperCase('tr');
    });
  }

  // ---- skor hesaplama (tetikleyici + teklif sayısına duyarlı) ----
  var ANGLE_BASE = {
    urgency:        { hook: 82, clarity: 74, cta: 86, urgency: 95, relevance: 70 },
    'social-proof': { hook: 78, clarity: 80, cta: 72, urgency: 55, relevance: 86 },
    benefit:        { hook: 72, clarity: 90, cta: 76, urgency: 58, relevance: 88 },
    question:       { hook: 90, clarity: 68, cta: 70, urgency: 64, relevance: 78 },
    story:          { hook: 86, clarity: 64, cta: 60, urgency: 50, relevance: 74 },
    discount:       { hook: 80, clarity: 82, cta: 88, urgency: 84, relevance: 78 },
    authority:      { hook: 76, clarity: 80, cta: 70, urgency: 52, relevance: 88 },
    guarantee:      { hook: 74, clarity: 84, cta: 82, urgency: 60, relevance: 84 }
  };

  function scoreVariant(rnd, angle, headline, text, offerCount) {
    var base = ANGLE_BASE[angle] || ANGLE_BASE.benefit;
    var b = {
      hook: clamp(base.hook + intRange(rnd, -7, 7)),
      clarity: clamp(base.clarity + intRange(rnd, -7, 7)),
      cta: clamp(base.cta + intRange(rnd, -7, 7)),
      urgency: clamp(base.urgency + intRange(rnd, -7, 7)),
      relevance: clamp(base.relevance + intRange(rnd, -7, 7))
    };
    if (/\d/.test(text)) b.relevance = clamp(b.relevance + 4);        // somutluk
    if (text.indexOf('✓') !== -1) b.clarity = clamp(b.clarity + 6);   // liste
    if (/\?/.test(headline)) b.hook = clamp(b.hook + 5);              // soru hook
    if (offerCount >= 2) b.relevance = clamp(b.relevance + 5);        // KURAL: 2+ teklif bileşeni
    if (offerCount >= 3) b.cta = clamp(b.cta + 3);
    if (text.length > 260) b.clarity = clamp(b.clarity - 8);

    var overall = Math.round(b.hook * 0.28 + b.clarity * 0.22 + b.cta * 0.20 + b.urgency * 0.12 + b.relevance * 0.18);
    return { overall: clamp(overall), breakdown: b };
  }

  // body'yi temizle: çift nokta, fazla boşluk, satır içi boşluklar
  function cleanBody(s) {
    return s.replace(/\.\s*\./g, '.').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }

  // ---- bir açıdan tek varyant kur ----
  function buildVariant(rnd, idx, angleKey, brand, product, lang, S) {
    var A = ANGLES[angleKey];
    var off = S.offer;
    // teklif bileşeni snippet'leri (sektörden) — clause olarak lowercase tut
    var map = {
      brand: brand, product: product,
      result: lcFirst(pick(rnd, S.results[lang])),
      proof: lcFirst(pick(rnd, S.proofs[lang])),
      pain: pick(rnd, S.pains[lang]),
      sonuc: lcFirst(off.sonuc ? off.sonuc[lang] : ''),
      o1: lcFirst(off[A.offer[0]] ? off[A.offer[0]][lang] : ''),
      o2: lcFirst(off[A.offer[1]] ? off[A.offer[1]][lang] : '')
    };
    var headTpl = pick(rnd, A.headline[lang]);
    var bodyTpl = pick(rnd, A.body[lang]);
    var headline = sentenceCase(cap(interp(headTpl, map)));
    var body = sentenceCase(cleanBody(interp(bodyTpl, map)));
    // gerçekten kullanılan teklif bileşenleri (KURAL: 2+)
    var offerComps = A.offer.slice();
    if (bodyTpl.indexOf('{sonuc}') !== -1) offerComps.unshift('sonuc');
    var sc = scoreVariant(rnd, angleKey, headline, body, offerComps.length);
    return {
      id: 'var_' + idx + '_' + Math.floor(rnd() * 1e6),
      angle: angleKey,
      angleTag: A.tag[lang],
      trigger: A.trigger,
      triggerLabel: TRIGGERS[A.trigger] ? TRIGGERS[A.trigger][lang] : A.trigger,
      offerComponents: offerComps,
      offerLabels: offerComps.map(function (k) { return OFFER_COMPONENTS[k] ? OFFER_COMPONENTS[k][lang] : k; }),
      headline: headline,
      primaryText: body,
      cta: A.cta[lang],
      category: S.key,
      gradient: S.gradient,
      score: sc.overall,
      scoreBreakdown: sc.breakdown,
      source: 'engine',
      sourceRef: null,
      sourceNote: null
    };
  }

  // ---- Meta Reklam Kütüphanesi kazananını markaya uyarla ----
  function buildFromWinner(rnd, idx, w, brand, product, lang, S) {
    var tpl = (lang === 'en' ? w.template_en : w.template_tr) || w.template_tr || w.template_en;
    if (!tpl) return null;
    var off = S.offer;
    var comps = (w.offerComponents && w.offerComponents.length) ? w.offerComponents : ['sonuc', 'garanti'];
    var map = {
      brand: brand, product: product,
      result: lcFirst(pick(rnd, S.results[lang])),
      proof: lcFirst(pick(rnd, S.proofs[lang])),
      pain: pick(rnd, S.pains[lang]),
      sonuc: lcFirst(off.sonuc ? off.sonuc[lang] : ''),
      o1: lcFirst(off[comps[0]] ? off[comps[0]][lang] : ''),
      o2: lcFirst(off[comps[1]] ? off[comps[1]][lang] : '')
    };
    var body = sentenceCase(cleanBody(interp(tpl, map)));
    var headline = sentenceCase(cap(interp(w['hook_' + lang] || w.hook || pick(rnd, S.results[lang]), map)));
    var trig = (w.triggers && w.triggers[0]) || 'socialproof';
    var sc = scoreVariant(rnd, 'social-proof', headline, body, comps.length);
    sc.overall = clamp(sc.overall + 4); // gerçek kazanan yapı → küçük güven primi
    return {
      id: 'win_' + idx + '_' + Math.floor(rnd() * 1e6),
      angle: 'meta-winner',
      angleTag: lang === 'en' ? 'Meta Library Winner' : 'Meta Kütüphane Kazananı',
      trigger: trig,
      triggerLabel: TRIGGERS[trig] ? TRIGGERS[trig][lang] : trig,
      offerComponents: comps,
      offerLabels: comps.map(function (k) { return OFFER_COMPONENTS[k] ? OFFER_COMPONENTS[k][lang] : k; }),
      headline: headline,
      primaryText: body,
      cta: A_CTA(lang),
      category: S.key,
      gradient: S.gradient,
      score: sc.overall,
      scoreBreakdown: sc.breakdown,
      source: 'meta-library',
      sourceRef: w.advertiser || null,
      sourceNote: w.why ? (w.why[lang] || w.why) : null
    };
  }
  function A_CTA(lang) { return lang === 'en' ? 'Shop Now' : 'Hemen İncele'; }

  // ============================================================
  // ANA VARYANT ÜRETİCİ
  // ============================================================
  function generateVariants(opts) {
    opts = opts || {};
    var brand = opts.brand || 'Marka';
    var product = opts.product || 'ürün';
    var lang = opts.lang === 'en' ? 'en' : 'tr';
    var count = opts.count || 6;
    var sectorKey = resolveSector(opts);
    var S = Object.assign({ key: sectorKey }, SECTORS[sectorKey] || SECTORS.generic);
    S.key = sectorKey;
    var rnd = seededRandom(brand + '|' + product + '|' + (opts.objective || '') + '|' + sectorKey + '|' + (opts.salt || ''));

    var variants = [];
    var i = 0;

    // 1) Meta Reklam Kütüphanesi kazananı (veri verildiyse) — markaya uyarlanmış
    var winners = opts.winningAds && opts.winningAds.winners ? opts.winningAds.winners : [];
    if (winners.length) {
      var w = pick(rnd, winners);
      var wv = buildFromWinner(rnd, i, w, brand, product, lang, S);
      if (wv) { variants.push(wv); i++; }
    }

    // 2) açı tabanlı varyantlar
    for (; i < count; i++) {
      var angle = ANGLE_KEYS[i % ANGLE_KEYS.length];
      variants.push(buildVariant(rnd, i, angle, brand, product, lang, S));
    }

    variants.sort(function (a, b) { return b.score - a.score; });
    if (variants.length) variants[0].isWinner = true;
    return { category: sectorKey, sectorLabel: (SECTORS[sectorKey] || SECTORS.generic).label[lang], variants: variants };
  }

  // ============================================================
  // sandbox METRİK simülasyonu
  // ============================================================
  function simulateMetrics(variant, budgetDaily, daysRunning) {
    var rnd = seededRandom(variant.id + '|metrics');
    var days = daysRunning || 1;
    var spend = Math.round(budgetDaily * days * range(rnd, 0.85, 1.0));
    var scoreFactor = variant.score / 100;
    var baseCpm = range(rnd, 45, 90);
    var impressions = Math.round((spend / baseCpm) * 1000);
    var ctr = +(range(rnd, 0.6, 1.4) * (0.8 + scoreFactor)).toFixed(2);
    var clicks = Math.round(impressions * ctr / 100);
    var convRate = range(rnd, 1.5, 4.5) * (0.7 + scoreFactor * 0.6);
    var conversions = Math.max(1, Math.round(clicks * convRate / 100));
    var cpa = +(spend / conversions).toFixed(2);
    var avgOrder = range(rnd, 180, 650);
    var revenue = Math.round(conversions * avgOrder);
    var roas = +(revenue / Math.max(1, spend)).toFixed(2);
    return { impressions: impressions, clicks: clicks, ctr: ctr, spend: spend, conversions: conversions, cpa: cpa, revenue: revenue, roas: roas };
  }

  // ============================================================
  // AI BRIEF genişletme
  // ============================================================
  function expandBrief(opts) {
    opts = opts || {};
    var lang = opts.lang === 'en' ? 'en' : 'tr';
    var sectorKey = resolveSector(opts);
    var S = SECTORS[sectorKey] || SECTORS.generic;
    return { category: sectorKey, suggestedAudience: S.audience[lang], angles: ANGLE_KEYS.slice() };
  }

  // ============================================================
  // ÖNERİLER — marketing-consultant çerçeveleri + Meta Kütüphane içgörüleri
  // ============================================================
  function recommend(opts) {
    opts = opts || {};
    var lang = opts.lang === 'en' ? 'en' : 'tr';
    var sectorKey = resolveSector(opts);
    var S = SECTORS[sectorKey] || SECTORS.generic;
    var rnd = seededRandom((opts.brand || '') + '|' + (opts.product || '') + '|rec|' + sectorKey);
    var recs = [];

    // 1) Teklif gücü (her teklifte en az 2 bileşen kuralı)
    var picks = pickN(rnd, ['hiz', 'garanti', 'sartlar', 'fiyat', 'servis', 'deneyim'], 2);
    recs.push({
      type: 'offer',
      icon: '🎯',
      title: lang === 'en' ? 'Strengthen the offer (use 2+ components)' : 'Teklifi güçlendir (2+ bileşen kullan)',
      body: lang === 'en'
        ? 'Every winning ad carries at least two offer components. For ' + S.label.en + ', lead with: ' + S.offer[picks[0]].en + ' + ' + S.offer[picks[1]].en + '.'
        : 'Her kazanan reklam en az iki teklif bileşeni taşır. ' + S.label.tr + ' için öne çıkar: ' + S.offer[picks[0]].tr + ' + ' + S.offer[picks[1]].tr + '.'
    });

    // 2) Tetikleyici testi
    var trigPick = pickN(rnd, Object.keys(TRIGGERS), 3);
    recs.push({
      type: 'trigger',
      icon: '🧠',
      title: lang === 'en' ? 'Test these psychological triggers' : 'Bu tetikleyicileri test et',
      body: (lang === 'en' ? 'A/B test 3 triggers head-to-head: ' : '3 tetikleyiciyi karşı karşıya test et: ')
        + trigPick.map(function (k) { return TRIGGERS[k][lang]; }).join(', ') + '.'
    });

    // 3) Sonuç sat
    recs.push({
      type: 'result',
      icon: '💡',
      title: lang === 'en' ? 'Sell the result, not the feature' : 'Özellik değil sonuç sat',
      body: (lang === 'en' ? 'Don\'t sell the product — sell: ' : 'Ürünü değil, şunu sat: ') + cap(pick(rnd, S.results[lang])) + '.'
    });

    // 4) Kitle
    recs.push({
      type: 'audience',
      icon: '👥',
      title: lang === 'en' ? 'Suggested audience' : 'Önerilen hedef kitle',
      body: S.audience[lang]
    });

    // 5) Meta Kütüphane içgörüleri (veri varsa)
    var insights = opts.winningAds && opts.winningAds.insights ? opts.winningAds.insights : null;
    if (insights && insights.length) {
      insights.slice(0, 3).forEach(function (ins) {
        recs.push({
          type: 'meta',
          icon: '📚',
          title: lang === 'en' ? 'Meta Ad Library insight' : 'Meta Reklam Kütüphanesi içgörüsü',
          body: (typeof ins === 'string') ? ins : (ins[lang] || ins.tr || ins.en),
          source: opts.winningAds.source || 'Meta Ad Library',
          updated: opts.winningAds.updated || null
        });
      });
    }
    return { sector: sectorKey, sectorLabel: S.label[lang], recommendations: recs };
  }

  // sektör listesi (UI dropdown için)
  function sectorList(lang) {
    lang = lang === 'en' ? 'en' : 'tr';
    return SECTOR_KEYS.map(function (k) { return { key: k, label: SECTORS[k].label[lang] }; });
  }

  global.AdmiralEngine = {
    detectCategory: detectCategory,
    resolveSector: resolveSector,
    generateVariants: generateVariants,
    simulateMetrics: simulateMetrics,
    expandBrief: expandBrief,
    recommend: recommend,
    sectorList: sectorList,
    OFFER_COMPONENTS: OFFER_COMPONENTS,
    TRIGGERS: TRIGGERS,
    SECTOR_KEYS: SECTOR_KEYS
  };
})(typeof window !== 'undefined' ? window : this);
