/* ADMIRA — Meta & TikTok kampanya hedefleri ve alan tanımları */

var ADMIRA_PLATFORMS = {
  meta: {
    id: 'meta',
    name: 'Meta',
    sub: 'Facebook & Instagram',
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
    interestSuggestions: ['Moda', 'Teknoloji', 'Fitness & Wellness', 'Seyahat', 'Yemek & İçecek', 'Oyun', 'Güzellik', 'Ev & Bahçe', 'Eğitim', 'Finans', 'Otomobil', 'Anne & Bebek']
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    sub: 'TikTok Ads Manager',
    objectives: [
      { id: 'reach', tr: 'Erişim', en: 'Reach', desc: 'Reklamınızı mümkün olduğunca fazla kişiye gösterin.', kpi: 'Erişim' },
      { id: 'traffic', tr: 'Trafik', en: 'Traffic', desc: 'Web sitenize veya uygulamanıza tıklama alın.', kpi: 'Tıklama' },
      { id: 'community', tr: 'Topluluk Etkileşimi', en: 'Community Interaction', desc: 'Takipçi, video izlenmesi ve profil ziyaretlerini artırın.', kpi: 'Video İzlenme' },
      { id: 'app', tr: 'Uygulama Tanıtımı', en: 'App Promotion', desc: 'Uygulama yüklemesi ve uygulama içi olayları artırın.', kpi: 'Yükleme' },
      { id: 'leads', tr: 'Potansiyel Müşteri', en: 'Lead Generation', desc: 'Anlık form ile potansiyel müşteri toplayın.', kpi: 'Form Gönderimi' },
      { id: 'sales', tr: 'Web Sitesi Dönüşümleri', en: 'Website Conversions', desc: 'Web sitenizde satış ve dönüşümleri artırın.', kpi: 'Satın Alma' }
    ],
    placements: ['TikTok', 'Pangle', 'Haber Akışı Uygulamaları'],
    formats: ['Tekil Video', 'Spark Ads (Organik Gönderi Boost)', 'Görsel Koleksiyon'],
    interestSuggestions: ['Dans & Müzik', 'Komedi', 'Güzellik & Bakım', 'Oyun', 'Moda', 'Yemek', 'Spor', 'DIY & Yaşam Tarzı', 'Evcil Hayvan', 'Eğitim İçerikleri', 'Teknoloji İncelemeleri', 'Seyahat Vlogları']
  }
};

// objective id'lerine göre ekstra alan tipi (hedefe özel form alanı)
var ADMIRA_OBJECTIVE_EXTRA = {
  traffic: { key: 'url', label: 'Hedef URL', placeholder: 'https://siteniz.com' },
  sales: { key: 'url', label: 'Hedef URL / Ürün Kataloğu Linki', placeholder: 'https://siteniz.com/urun' },
  app: { key: 'appUrl', label: 'Uygulama Mağazası Linki', placeholder: 'https://play.google.com/store/apps/...' },
  leads: { key: 'leadNote', label: 'Form Soruları (virgülle ayırın)', placeholder: 'Ad Soyad, Telefon, E-posta' }
};

function admiraUid() {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
