/* ADMIRA — Meta & TikTok kampanya hedefleri ve alan tanımları
 * Gerçek Kampanya (objektif) → Reklam Seti/Grubu (kitle, bütçe, teklif) → Reklam (kreatif) hiyerarşisini yansıtır.
 */

var ADMIRA_PLATFORMS = {
  meta: {
    id: 'meta',
    name: 'Meta',
    sub: 'Facebook & Instagram',
    adsetLabel: 'Reklam Seti',
    objectives: [
      { id: 'awareness', tr: 'Farkındalık', en: 'Awareness', desc: 'Markanızı mümkün olduğunca fazla kişiye hatırlatın.', kpi: 'Erişim / Hatırlanma' },
      { id: 'traffic', tr: 'Trafik', en: 'Traffic', desc: 'İnsanları web sitenize, uygulamanıza ya da Messenger\'a yönlendirin.', kpi: 'Bağlantı Tıklaması' },
      { id: 'engagement', tr: 'Etkileşim', en: 'Engagement', desc: 'Mesajlar, gönderi etkileşimi ve video izlenmelerini artırın.', kpi: 'Gönderi Etkileşimi' },
      { id: 'leads', tr: 'Potansiyel Müşteri', en: 'Leads', desc: 'Anlık form ile potansiyel müşteri adayı toplayın.', kpi: 'Form Gönderimi' },
      { id: 'app', tr: 'Uygulama Tanıtımı', en: 'App Promotion', desc: 'Uygulama yüklemelerini ve uygulama içi etkinlikleri artırın.', kpi: 'Yükleme' },
      { id: 'sales', tr: 'Satış', en: 'Sales', desc: 'Web sitesinde, uygulamada ya da mesajlarda satışları artırın.', kpi: 'Satın Alma' }
    ],
    placements: ['Facebook Haber Akışı', 'Instagram Feed', 'Instagram Reels', 'Facebook/Instagram Stories', 'Messenger', 'Audience Network'],
    formats: ['Tekil Görsel', 'Tekil Video', 'Karusel', 'Koleksiyon'],
    interestSuggestions: ['Moda', 'Teknoloji', 'Fitness & Wellness', 'Seyahat', 'Yemek & İçecek', 'Oyun', 'Güzellik', 'Ev & Bahçe', 'Eğitim', 'Finans', 'Otomobil', 'Anne & Bebek'],
    bidStrategies: ['En Düşük Maliyet (Otomatik Teklif)', 'Maliyet Sınırı (Cost Cap)', 'Teklif Sınırı (Bid Cap)'],
    ctaButtons: ['Şimdi Satın Al', 'Daha Fazla Bilgi', 'Şimdi Kaydol', 'İletişime Geç', 'Hemen İndir', 'Rezervasyon Yap', 'Başvur', 'Teklif Al', 'Mesaj Gönder', 'Video İzle'],
    optimizationGoals: {
      awareness: ['Erişim', 'Marka Bilinirliği Artışı', 'Reklam Hatırlama Artışı'],
      traffic: ['Bağlantı Tıklamaları', 'Açılış Sayfası Görüntülemeleri', 'Günlük Benzersiz Erişim'],
      engagement: ['Gönderi Etkileşimi', 'Video İzlenmeleri (ThruPlay)', 'Sayfa Beğenileri'],
      leads: ['Potansiyel Müşteri (Anlık Form)', 'Dönüşümler (Web Formu)', 'Arama'],
      app: ['Uygulama Yüklemeleri', 'Uygulama İçi Etkinlikler', 'Değer Optimizasyonu'],
      sales: ['Dönüşümler (Satın Alma)', 'Sepete Ekleme', 'Katalog Satışları']
    }
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    sub: 'TikTok Ads Manager',
    adsetLabel: 'Reklam Grubu',
    objectives: [
      { id: 'reach', tr: 'Erişim', en: 'Reach', desc: 'Reklamınızı mümkün olduğunca fazla benzersiz kullanıcıya gösterin.', kpi: 'Erişim' },
      { id: 'traffic', tr: 'Trafik', en: 'Traffic', desc: 'Web sitenize veya uygulamanıza tıklama alın.', kpi: 'Tıklama' },
      { id: 'videoviews', tr: 'Video İzlenmeleri', en: 'Video Views', desc: 'Videonuzun mümkün olduğunca çok izlenmesini sağlayın.', kpi: 'Video İzlenme' },
      { id: 'community', tr: 'Topluluk Etkileşimi', en: 'Community Interaction', desc: 'Takipçi, profil ziyareti ve etkileşimi artırın.', kpi: 'Takipçi / Etkileşim' },
      { id: 'leads', tr: 'Potansiyel Müşteri', en: 'Lead Generation', desc: 'Anlık form ile potansiyel müşteri toplayın.', kpi: 'Form Gönderimi' },
      { id: 'app', tr: 'Uygulama Tanıtımı', en: 'App Promotion', desc: 'Uygulama yüklemesi ve uygulama içi olayları artırın.', kpi: 'Yükleme' },
      { id: 'sales', tr: 'Web Sitesi Dönüşümleri', en: 'Website Conversions', desc: 'Web sitenizde satış ve dönüşümleri artırın.', kpi: 'Satın Alma' }
    ],
    placements: ['TikTok', 'Pangle', 'Haber Akışı Uygulamaları'],
    formats: ['Tekil Video', 'Spark Ads (Organik Gönderi Boost)', 'Görsel Koleksiyon'],
    interestSuggestions: ['Dans & Müzik', 'Komedi', 'Güzellik & Bakım', 'Oyun', 'Moda', 'Yemek', 'Spor', 'DIY & Yaşam Tarzı', 'Evcil Hayvan', 'Eğitim İçerikleri', 'Teknoloji İncelemeleri', 'Seyahat Vlogları'],
    bidStrategies: ['Maksimum Teslimat (Lowest Cost)', 'Maliyet Sınırı (Cost Cap)'],
    ctaButtons: ['Şimdi Al', 'Daha Fazla Bilgi Edinin', 'Hemen İndir', 'Kaydol', 'İletişime Geçin', 'Rezervasyon Yapın', 'Uygulamayı Yükle', 'Teklif Al'],
    optimizationGoals: {
      reach: ['Erişim', 'Gösterim (Impression)'],
      traffic: ['Tıklama (Click)', 'Açılış Sayfası Görüntüleme'],
      videoviews: ['Video İzlenme (6 sn+)', 'Video Tamamlama'],
      community: ['Takipçi Artışı', 'Profil Ziyareti', 'Etkileşim (Beğeni/Yorum/Paylaşım)'],
      leads: ['Anlık Form Gönderimi', 'Web Formu Dönüşümü'],
      app: ['Uygulama Yüklemesi', 'Uygulama İçi Etkinlik'],
      sales: ['Web Sitesi Dönüşümü', 'Ürün Satışı (Katalog)']
    }
  }
};

// objective id'lerine göre reklam (ad) düzeyindeki hedef/varış alanı
var ADMIRA_OBJECTIVE_EXTRA = {
  traffic: { key: 'url', label: 'Hedef URL', placeholder: 'https://siteniz.com' },
  sales: { key: 'url', label: 'Hedef URL / Ürün Kataloğu Linki', placeholder: 'https://siteniz.com/urun' },
  app: { key: 'appUrl', label: 'Uygulama Mağazası Linki', placeholder: 'https://play.google.com/store/apps/...' },
  leads: { key: 'leadNote', label: 'Form Soruları (virgülle ayırın)', placeholder: 'Ad Soyad, Telefon, E-posta' }
};

function admiraUid() {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
