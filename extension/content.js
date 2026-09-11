// ADMIRA Scraper Content Script
//
// Bu dosya https://www.facebook.com/ads/library/... sayfasındaki reklamların
// bilgilerini DOM'dan çeker. İki modda çalışır:
//   1) Tekli reklam: bir ?id=... linkiyle açılan "Ad Details" modalı.
//   2) Toplu tarama: bir rakibin TÜM reklamlarının listelendiği sayfa
//      (ör. ?view_all_page_id=... ile açılan liste/grid görünümü) — sayfada
//      o an render edilmiş TÜM reklam kartları tek seferde toplanır.
// Aşağıdaki notlar, alanların Meta Ad Library sayfasında GERÇEKTE nerede/nasıl
// bulunduğunu açıklar (canlı sayfa incelenerek doğrulanmıştır) — ileride Meta
// arayüzü değişirse buradan devam edilebilir.

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "scrape_ads") {
    try {
      var ads = scrapeAllMetaAds();
      sendResponse({ ok: true, data: ads });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  }
  return true; // Asenkron yanıt kanalı için
});

function toArray(nodeList) {
  return Array.prototype.slice.call(nodeList);
}

function cardMatches(el) {
  var t = el.innerText || "";
  return (t.indexOf("Library ID") > -1 || t.indexOf("Kütüphane Kodu") > -1) && (t.indexOf("Sponsored") > -1 || t.indexOf("Sponsorlu") > -1);
}

// ---------------------------------------------------------------------
// KAPSAM (SCOPE) TESPİTİ — sayfadaki TÜM reklam kartlarının köklerini bulur
// ---------------------------------------------------------------------
// Bir ad library sayfasında AYNI ANDA birden fazla "reklam kartı" DOM'da
// bulunabilir:
//   - Doğrudan ?id=... linkiyle açılan sayfalarda önce küçük bir
//     "Link to ad" modalı, sonra "See ad details" tıklanınca daha büyük
//     "Ad Details" modalı (role="dialog") açılır. İkisi de aynı reklamı
//     gösterir ama "Ad Details" modalı daha eksiksizdir. Bu durumda SADECE
//     o tek reklamı işleriz.
//   - Bir rakibin tüm reklamlarının listelendiği sayfada (view_all_page_id
//     veya bir arama sonucu) onlarca kart yan yana durur — hepsini toplarız.
//
// document.body.innerText üzerinden arama yapmak YANLIŞ sonuç verir çünkü
// sayfanın üstündeki filtre çubuğunda her zaman "Active status: Active ads"
// gibi sabit metinler bulunur ve bunlar gerçek reklamın durumuyla karışır.
// Bu yüzden her zaman "tek bir reklamı" saran kapsayıcıları buluyoruz.
function findAdCardRoots() {
  // 1) Açık bir modal varsa (role="dialog") ve içinde kimlik etiketi geçiyorsa,
  //    en sonuncusunu (en son açılan / en detaylı olan "Ad Details" modalı)
  //    kullan — bu durumda tek bir reklam işleniyor demektir.
  // Not: "Library ID" etiketi TR arayüzde "Kütüphane Kodu" olarak geçiyor;
  // ikisini de arıyoruz, aksi halde TR arayüzde root tespiti tüm sayfaya
  // (document.body) düşer ve eski hatalar (filtre metinleriyle karışma) geri gelir.
  var dialogs = toArray(document.querySelectorAll('[role="dialog"]')).filter(function (d) {
    return /Library ID|Kütüphane Kodu/i.test(d.innerText || "");
  });
  if (dialogs.length > 0) {
    return [dialogs[dialogs.length - 1]];
  }

  // 2) Modal yoksa (liste/grid görünümü): kimlik etiketi + "Sponsored"
  //    (TR: "Sponsorlu") ikisini birden içeren TÜM div'leri bul, sonra
  //    sadece "yaprak" (leaf) olanları tut — yani içinde BAŞKA bir eşleşen
  //    kart barındırmayanları. Aksi halde birden çok kartı saran dış
  //    kapsayıcılar da eşleşip aynı kartları tekrar tekrar sayarız.
  var candidates = toArray(document.querySelectorAll("div")).filter(cardMatches);
  var cards = candidates.filter(function (el) {
    return !candidates.some(function (other) {
      return other !== el && el.contains(other);
    });
  });
  if (cards.length > 0) {
    return cards;
  }

  // 3) Son çare: tüm sayfa (tek, muhtemelen boş bir sonuç döner).
  return [document.body];
}

function scrapeAllMetaAds() {
  var roots = findAdCardRoots();
  return roots.map(extractAdFromRoot);
}

function extractAdFromRoot(root) {
  var rootText = root.innerText || "";

  // -----------------------------------------------------------------
  // 1. Kütüphane ID'si (Library ID)
  // -----------------------------------------------------------------
  // Her kartta "Library ID: 788665554241465" (TR arayüzde "Kütüphane Kodu:")
  // satırı vardır. Bulunamazsa (tekli mod) sayfa URL'sindeki ?id= parametresine
  // düşülür.
  var libraryId = "";
  var libIdMatch = rootText.match(/(?:Library ID|Kütüphane Kodu):?\s*([0-9]+)/i);
  if (libIdMatch) {
    libraryId = libIdMatch[1];
  } else {
    var urlIdMatch = window.location.href.match(/[?&]id=([0-9]+)/);
    if (urlIdMatch) libraryId = urlIdMatch[1];
  }

  // Her kartın kendi Meta Ad Library linki: liste görünümünde tüm kartlar
  // aynı sayfa URL'sini paylaşır, bu yüzden window.location.href yerine
  // Library ID'den TEKİL bir derin link kuruyoruz (ör. .../library/?id=123).
  var url = libraryId
    ? "https://www.facebook.com/ads/library/?id=" + libraryId
    : window.location.href;

  // -----------------------------------------------------------------
  // 2. Aktiflik Durumu (Active / Inactive)
  // -----------------------------------------------------------------
  // Kartın SOL ÜST köşesinde yeşil/gri bir rozet olarak "Active" ya da
  // "Inactive" (TR: "Aktif" / "Aktif değil") yazar. Bu rozet DOM'da KENDİ
  // BAŞINA bir metin düğümüdür (ör. sadece "Active" yazan bir <span>) —
  // bu yüzden regex ile büyük metin bloğu içinde aramak yerine, root
  // içindeki metin düğümlerini gezip TAM OLARAK bu kelimelerden birine eşit
  // olanı arıyoruz. (rootText üzerinde "^" ile başlangıç araması güvenilmez:
  // modal başlığı — "Ad Details", "Link to ad" — veya görünmez
  // karakterler rozetten önce gelebilir. document.body geneline bakmak da
  // yanlıştır çünkü filtre çubuğunda hep "Active status: Active ads" yazar.)
  var activeStatus = "Bilinmiyor";
  var statusWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var statusNode;
  while ((statusNode = statusWalker.nextNode())) {
    var statusText = (statusNode.textContent || "").trim();
    if (statusText === "Inactive" || statusText === "Aktif değil") {
      activeStatus = "Pasif";
      break;
    }
    if (statusText === "Active" || statusText === "Aktif") {
      activeStatus = "Aktif";
      break;
    }
  }

  // -----------------------------------------------------------------
  // 3. Başlangıç Tarihi (Start Date)
  // -----------------------------------------------------------------
  // Meta arayüz diline göre tarihi FARKLI SIRADA yazıyor:
  //   - İngilizce: "Started running on Jun 20, 2026"   (tarih CÜMLEDEN SONRA)
  //   - Türkçe:    "20 Haz 2026 tarihinde yayınlanmaya başladı" (tarih ÖNCE)
  // Bu yüzden iki yönü de deniyoruz.
  var startDate = "";
  var dateMatchAfter = rootText.match(/Started running on\s*:?\s*([^\n\r]+)/i);
  var dateMatchBefore = rootText.match(/([^\n\r]+?)\s*tarihinde yayınlanmaya başladı/i);
  if (dateMatchAfter && dateMatchAfter[1]) {
    startDate = dateMatchAfter[1].trim();
  } else if (dateMatchBefore && dateMatchBefore[1]) {
    startDate = dateMatchBefore[1].trim();
  }

  // -----------------------------------------------------------------
  // 4. Reklam Veren Adı (Advertiser Name)
  // -----------------------------------------------------------------
  // En güvenilir yol: kart içinde, gerçek Facebook sayfasına giden <a>
  // linkini bulmak (href örn. https://www.facebook.com/necosensesss/).
  // Bunu; "ads/library" (kendi kendine link), "l.facebook.com/l.php"
  // (dış siteye giden takip linki) ve yardım/politika linklerinden
  // ayırt ediyoruz.
  var advertiserName = "";
  var pageLink = toArray(root.querySelectorAll("a")).find(function (a) {
    var href = a.href || "";
    if (!/^https?:\/\/(www\.)?facebook\.com\//i.test(href)) return false;
    if (/\/ads\/library/i.test(href)) return false;
    if (/\/(policies|help|privacy|legal)\b/i.test(href)) return false;
    return a.textContent && a.textContent.trim().length > 0;
  });
  if (pageLink) {
    advertiserName = pageLink.textContent.trim();
  }

  // Alternatif: eski davranış (h2 / sayfa başlığı) — yedek olarak kalsın.
  if (!advertiserName) {
    var nameEl = root.querySelector("h2") || document.querySelector("h2");
    if (nameEl) {
      advertiserName = nameEl.innerText.trim();
    }
  }
  if (!advertiserName) {
    var docTitle = document.title || "";
    if (docTitle.indexOf(" - ") > -1) {
      advertiserName = docTitle.split(" - ")[1].trim();
    }
  }

  // -----------------------------------------------------------------
  // 5. Reklam Metni (Ad Copy)
  // -----------------------------------------------------------------
  // Meta, reklam metnini her zaman white-space: pre-wrap stiline sahip
  // bir elementte render ediyor. Kartta birden fazla pre-wrap element
  // olabilir (ör. web sitesi adı "www.necosenses.com" da pre-wrap'tir);
  // gerçek reklam metni bunların İÇİNDE EN UZUN olanıdır.
  var adCopy = "";
  var preWraps = toArray(root.querySelectorAll("*")).filter(function (el) {
    try {
      return window.getComputedStyle(el).whiteSpace === "pre-wrap" && el.innerText.trim().length > 0;
    } catch (e) {
      return false;
    }
  });

  if (preWraps.length > 0) {
    adCopy = preWraps
      .map(function (el) {
        return el.innerText.trim();
      })
      .sort(function (a, b) {
        return b.length - a.length;
      })[0];
  } else {
    var textContainers = toArray(root.querySelectorAll("div, span")).filter(function (el) {
      return el.children.length === 0 && el.innerText && el.innerText.trim().length > 20;
    });
    if (textContainers.length > 0) {
      adCopy = textContainers.sort(function (a, b) {
        return b.innerText.length - a.innerText.length;
      })[0].innerText.trim();
    }
  }

  // -----------------------------------------------------------------
  // 6. Medya (Görsel / Video) URL'si
  // -----------------------------------------------------------------
  // ÖNEMLİ: img[src*="fbcdn"] tek başına YANLIŞ sonuç verebilir çünkü
  // kartta reklam görselinden ÖNCE reklamverenin küçük profil fotoğrafı
  // da fbcdn üzerinden gelir (genelde 60x60 / 80x80 / 148x148 px).
  // Gerçek reklam görseli her zaman çok daha büyüktür (ör. 600x600).
  // Bu yüzden:
  //   - Önce <video> var mı bak (varsa reklam kesin videodur, öncelik ona).
  //   - Yoksa img'leri boyuta (naturalWidth*naturalHeight) göre sırala ve
  //     150px eşiğinin altındaki (profil fotoğrafı boyutundaki) görselleri ele.
  var mediaUrl = "";
  var mediaType = "";
  var video = root.querySelector("video");
  if (video) {
    mediaType = "video";
    mediaUrl = video.currentSrc || video.src || video.poster || "";
  } else {
    var imgs = toArray(root.querySelectorAll('img[src*="fbcdn"]')).filter(function (img) {
      return img.naturalWidth > 150 && img.naturalHeight > 150;
    });
    imgs.sort(function (a, b) {
      return b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight;
    });
    if (imgs.length > 0) {
      mediaType = "image";
      mediaUrl = imgs[0].src;
    }
  }

  // -----------------------------------------------------------------
  // 7. Hedef Site + Aksiyon (CTA) — kartın ALT kısmındaki bağlantı bloğu
  // -----------------------------------------------------------------
  // Her reklamın en altında bir "aksiyon bloğu" var: küçük büyük harfli bir
  // hedef etiketi (ör. "WWW.INSTAGRAM.COM", "PLAY.GOOGLE.COM") ve altında bir
  // CTA butonu (ör. "Mesaj gönder", "Şimdi Alışveriş Yap", "Install Now").
  // Bu blok DOM'da TEK BİR <a> etiketiyle sarılı ve İÇİNDE bir
  // role="button" elementi barındırıyor — bu kombinasyon sayfada BAŞKA
  // hiçbir yerde yok, bu yüzden en güvenilir hedef budur. (Sayfadaki
  // "ilk l.facebook.com linki" gibi genel bir arama yanlış linki
  // yakalayabiliyordu — ör. "Hakkında" veya politika linkleri de aynı
  // yönlendirme domaininden geçiyor.)
  var ctaText = "";
  var destinationLabel = "";
  var landingUrl = "";

  var ctaAnchor = toArray(root.querySelectorAll("a")).find(function (a) {
    return a.querySelector('[role="button"]') !== null;
  });

  if (ctaAnchor) {
    // Bu anchor İÇİNDE genelde birden fazla role="button" elementi var
    // (hedef etiketi, başlık, açıklama de ayrı ayrı "buton" olarak
    // işaretlenmiş olabiliyor). Gerçek CTA metni her zaman SONUNCU,
    // BOŞ OLMAYAN role="button" elementidir (ör. "Mesaj gönder", "Install Now").
    var ctaButtonCandidates = toArray(ctaAnchor.querySelectorAll('[role="button"]')).filter(function (b) {
      return b.textContent.trim().length > 0;
    });
    var ctaButtonEl = ctaButtonCandidates.length > 0 ? ctaButtonCandidates[ctaButtonCandidates.length - 1] : null;
    ctaText = ctaButtonEl ? ctaButtonEl.textContent.trim() : "";

    var ctaLines = ctaAnchor.innerText
      .split("\n")
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
    // Bloğun İLK satırı her zaman hedef etiketidir (ör. "WWW.INSTAGRAM.COM").
    destinationLabel = ctaLines.length > 0 ? ctaLines[0] : "";

    landingUrl = ctaAnchor.href || "";
    if (landingUrl.indexOf("u=") > -1) {
      try {
        var urlParams = new URLSearchParams(new URL(landingUrl).search);
        landingUrl = urlParams.get("u") || landingUrl;
      } catch (e) {
        // href ayrıştırılamazsa ham haliyle bırak
      }
    }
  } else {
    // Yedek: CTA bloğu bulunamazsa (nadir format), eski basit yönteme düş.
    var fallbackLinks = toArray(root.querySelectorAll("a")).filter(function (a) {
      return a.href && (a.href.indexOf("l.facebook.com") > -1 || (a.href.indexOf("http") > -1 && a.href.indexOf("facebook.com") === -1));
    });
    if (fallbackLinks.length > 0) {
      landingUrl = fallbackLinks[0].href;
      if (landingUrl.indexOf("u=") > -1) {
        var fallbackParams = new URLSearchParams(new URL(landingUrl).search);
        landingUrl = fallbackParams.get("u") || landingUrl;
      }
    }
  }

  return {
    url: url,
    libraryId: libraryId || "",
    advertiserName: advertiserName || "Bilinmeyen Reklamveren",
    adCopy: adCopy || "Reklam metni çekilemedi.",
    startDate: startDate || "Tespit edilemedi",
    activeStatus: activeStatus,
    mediaType: mediaType,
    mediaUrl: mediaUrl || "",
    ctaText: ctaText || "",
    destinationLabel: destinationLabel || "",
    landingUrl: landingUrl || ""
  };
}
