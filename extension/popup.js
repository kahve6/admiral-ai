document.addEventListener('DOMContentLoaded', function () {
  var statusMessage = document.getElementById('statusMessage');
  var btnSave = document.getElementById('btnSave');
  var scannedAds = [];

  // Denenecek sıra: önce yerel geliştirme adresleri (Patron lokal çalışırken
  // oradaki test verisini kirletmeyelim diye önce onlar denenir), son adım
  // her zaman canlı sunucu — hiçbiri yanıt vermezse en son onda karar kılınır.
  var ENDPOINTS = [
    'http://localhost:8000/api/extension.php',
    'http://localhost/TIOTR-ADS/public/api/extension.php',
    'https://admira.tiotr.com/api/extension.php'
  ];

  function postToServer(payload, onSuccess, onFail) {
    function tryEndpoint(index) {
      var url = ENDPOINTS[index];
      var isLastAttempt = index === ENDPOINTS.length - 1;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
        .then(function (r) {
          if (r.status === 401) {
            throw new Error('ADMIRA oturumu açık değil (' + url.replace(/^https?:\/\//, '').split('/')[0] + '). Lütfen önce ilgili adreste uygulamaya giriş yapın.');
          }
          if (!r.ok) {
            throw new Error('Sunucu hatası (Status: ' + r.status + ')');
          }
          return r.json();
        })
        .then(function (res) {
          if (res && res.ok) {
            onSuccess(res, url);
          } else {
            onFail('Sunucu hatası: ' + (res ? res.error : 'Bilinmeyen hata'));
          }
        })
        .catch(function (err) {
          if (err.message.indexOf('oturumu açık değil') > -1) {
            onFail(err.message, true);
            return;
          }
          if (isLastAttempt) {
            onFail('Hiçbir sunucuya bağlanılamadı (ne yerel XAMPP ne admira.tiotr.com). Bağlantını ve giriş durumunu kontrol et.');
          } else {
            tryEndpoint(index + 1);
          }
        });
    }
    tryEndpoint(0);
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url) {
      statusMessage.textContent = 'Sayfa bilgisi alınamadı.';
      return;
    }

    if (tab.url.indexOf('facebook.com/ads/library') === -1) {
      statusMessage.textContent = 'Lütfen Meta Reklam Kütüphanesi (Ad Library) sayfasını açın.';
      return;
    }

    // Sayfa açılır açılmaz otomatik tara: kaç reklam bulunduğunu göster.
    // Tek bir reklam detay sayfası olabileceği gibi, bir rakibin TÜM
    // reklamlarının listelendiği bir sayfa da olabilir — ikisi de
    // scrape_ads ile aynı şekilde işlenir.
    chrome.tabs.sendMessage(tab.id, { action: 'scrape_ads' }, function (response) {
      if (chrome.runtime.lastError || !response || !response.ok) {
        statusMessage.textContent = 'Hata: Sayfa taranamadı. Lütfen sayfayı yenileyip tekrar deneyin.';
        return;
      }

      scannedAds = response.data || [];

      if (scannedAds.length === 0) {
        statusMessage.textContent = 'Bu sayfada reklam bulunamadı. Bir reklam detay sayfası ya da bir rakibin reklam listesi sayfası açık olduğundan emin olun.';
        return;
      }

      var countLabel = scannedAds.length === 1 ? '1 reklam' : scannedAds.length + ' reklam';
      statusMessage.innerHTML = 'Bu sayfada <strong>' + countLabel + '</strong> bulundu.' +
        (scannedAds.length > 1 ? '<br><span style="color:#94a3b8;">Not: Sayfa sadece o an yüklenmiş reklamları görebilir. Daha fazlası için aşağı kaydırıp tekrar açın.</span>' : '');
      btnSave.textContent = countLabel.charAt(0).toUpperCase() + countLabel.slice(1) + ' ADMIRA\'ya Kaydet';
      btnSave.removeAttribute('disabled');
    });

    btnSave.addEventListener('click', function () {
      if (!scannedAds.length) return;
      statusMessage.textContent = 'ADMIRA\'ya gönderiliyor...';
      btnSave.setAttribute('disabled', 'true');

      postToServer(
        { action: 'save_scraped_ads', adsData: scannedAds },
        function (res) {
          var parts = [];
          if (res.saved) parts.push(res.saved + ' yeni reklam kaydedildi');
          if (res.skipped) parts.push(res.skipped + ' tanesi zaten kayıtlıydı (atlandı)');
          var summary = parts.length ? parts.join(', ') + '.' : 'İşlendi.';
          statusMessage.innerHTML = '<span style="color:#16a34a; font-weight:bold;">✓ Tamamlandı!</span><br>' + summary;
        },
        function (message, isAuthError) {
          var color = isAuthError ? '#dc2626' : '#dc2626';
          statusMessage.innerHTML = '<span style="color:' + color + '; font-weight:bold;">Hata!</span><br>' + message;
          btnSave.removeAttribute('disabled');
        }
      );
    });
  });
});
