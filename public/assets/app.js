/* ADMIRA — Rakip Analizleri Yönetim Paneli (Sunucu Tabanlı) */
(function () {
  function el(sel) { return document.querySelector(sel); }
  function toast(msg) {
    var elx = el('#toast');
    elx.textContent = msg; elx.classList.add('show');
    clearTimeout(elx._t); elx._t = setTimeout(function () { elx.classList.remove('show'); }, 2600);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Oturum kontrolü
  fetch('api/auth.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'me' })
  }).then(function (r) { return r.json(); }).then(function (res) {
    if (!res || !res.ok) { location.href = 'index.html'; return; }
    initApp(res.user);
  }).catch(function () { location.href = 'index.html'; });

  function initApp(user) {
    var COMPETITORS_KEY = 'admira_competitors_' + user.email;

    el('#userName').textContent = user.name;
    el('#userEmail').textContent = user.email;
    el('#userAvatar').textContent = (user.name || '?').trim().charAt(0).toUpperCase();
    
    el('#btnLogout').onclick = function () {
      fetch('api/auth.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      }).then(function () { location.href = 'index.html'; }).catch(function () { location.href = 'index.html'; });
    };

    // ---------- API İstekleri ----------
    function fetchCompetitors(callback) {
      fetch('api/competitors.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get' })
      })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) { callback(res.competitors || []); }
        else { callback([]); }
      })
      .catch(function () { callback([]); });
    }

    function saveCompetitors(list, callback) {
      fetch('api/competitors.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', competitors: list })
      })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) { if (callback) callback(true); }
        else { if (callback) callback(false); }
      })
      .catch(function () { if (callback) callback(false); });
    }

    // ---------- Senkronizasyon (Merge) Mantığı ----------
    function syncAndInit() {
      fetchCompetitors(function (serverList) {
        var localRaw = localStorage.getItem(COMPETITORS_KEY);
        var localList = [];
        try { localList = JSON.parse(localRaw) || []; } catch(e) { localList = []; }

        if (localList.length > 0) {
          // Yerel verileri sunucu verileriyle birleştir
          var mergedList = serverList.slice();
          
          localList.forEach(function (localItem) {
            // Aynı ID'ye sahip eleman sunucuda yoksa ekle
            var exists = mergedList.some(function (srvItem) { return srvItem.id === localItem.id; });
            if (!exists) {
              mergedList.push(localItem);
            }
          });

          // Sunucuya kaydet ve yerel depolamayı temizle
          saveCompetitors(mergedList, function (success) {
            if (success) {
              localStorage.removeItem(COMPETITORS_KEY);
              renderList();
              toast('Yerel verileriniz sunucu ile başarıyla birleştirildi.');
            } else {
              renderList();
            }
          });
        } else {
          renderList();
        }
      });
    }

    function renderStats(list) {
      var totalHooks = 0;
      var totalExploits = 0;
      list.forEach(function (c) {
        totalHooks += (c.promotionalHooks || []).length;
        totalExploits += (c.weaknessesToExploit || []).length;
      });
      el('#statTotal').textContent = list.length;
      el('#statHooks').textContent = totalHooks;
      el('#statExploits').textContent = totalExploits;
    }

    function renderList() {
      fetchCompetitors(function (list) {
        var sortedList = list.sort(function (a, b) { return b.createdAt - a.createdAt; });
        renderStats(sortedList);
        var wrap = el('#competitorList');
        
        if (!sortedList.length) {
          wrap.innerHTML =
            '<div class="empty-state" style="grid-column: 1 / -1; text-align:center; padding: 48px 24px; background:#fff; border-radius:var(--radius-lg); border:1px dashed var(--border); margin-top:20px;">' +
              '<div class="emoji" style="font-size:48px; margin-bottom:16px;">🔍</div>' +
              '<h3 style="margin:0 0 8px; font-size:18px; font-weight:700;">Henüz rakip analizi eklemediniz</h3>' +
              '<p style="color:var(--dim); font-size:14px; margin:0 0 20px;">AI ajanınızdan aldığınız reklam odaklı JSON analiz çıktısını yapıştırarak başlayın.</p>' +
              '<button class="btn btn-primary" style="width:auto; margin:0 auto;" id="emptyCreateBtn">+ İlk Analizi Ekle</button>' +
            '</div>';
          el('#emptyCreateBtn').onclick = openModal;
          return;
        }

        wrap.innerHTML = sortedList.map(function (c) {
          var creativeStyles = (c.adCreativeStyle || []).map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('');
          var hooks = (c.promotionalHooks || []).map(function(h) { return '<li>' + esc(h) + '</li>'; }).join('');
          var exploits = (c.weaknessesToExploit || []).map(function(e) { return '<li>' + esc(e) + '</li>'; }).join('');
          
          var websiteLink = '';
          if (c.website) {
            var cleanLink = c.website;
            if (!/^https?:\/\//i.test(cleanLink)) { cleanLink = 'https://' + cleanLink; }
            websiteLink = '<a href="' + esc(cleanLink) + '" class="competitor-website" target="_blank">' + esc(c.website) + ' ↗</a>';
          } else {
            websiteLink = '<span class="competitor-website" style="text-decoration:none; color:var(--dim);">Web sitesi belirtilmedi</span>';
          }

          var notesHTML = '';
          if (c.notes) {
            notesHTML = '<div class="analysis-section grid-col-span-2"><div class="notes-box"><strong>💡 Genel Notlar:</strong><br>' + esc(c.notes) + '</div></div>';
          } else {
            notesHTML = '<div class="analysis-section grid-col-span-2"><div class="notes-box" style="background:#f1f5f9; border-color:#e2e8f0; color:var(--dim);">Not eklenmemiş.</div></div>';
          }

          var trafficSourceHTML = '';
          if (c.primaryTrafficSource) {
            trafficSourceHTML = '<div class="traffic-source-badge">🚦 ' + esc(c.primaryTrafficSource) + '</div>';
          } else {
            trafficSourceHTML = '<div class="traffic-source-badge" style="opacity: 0.6;">🚦 Belirtilmedi</div>';
          }

          return (
            '<div class="competitor-card" data-id="' + c.id + '">' +
              '<div class="competitor-header">' +
                '<div class="competitor-title-group">' +
                  '<span class="competitor-name">' + esc(c.competitorName) + '</span>' +
                  websiteLink +
                  trafficSourceHTML +
                '</div>' +
                '<div class="competitor-meta-badges">' +
                  '<span style="font-size:12px; color:var(--dim); font-weight:600;">🪝 ' + (c.promotionalHooks || []).length + ' Kanca</span>' +
                  '<span style="font-size:12px; color:var(--dim); font-weight:600; margin-left:8px;">🎯 ' + (c.weaknessesToExploit || []).length + ' Zafiyet</span>' +
                  '<div style="display:flex; gap:6px; margin-left:16px;">' +
                    '<button class="btn btn-ghost btn-sm" data-action="copy" title="JSON Kopyala" style="padding: 4px 8px; font-size:11px;">📋 Kopyala</button>' +
                    '<button class="btn btn-danger-ghost btn-sm" data-action="delete" title="Sil" style="padding: 4px 8px; font-size:11px;">🗑 Sil</button>' +
                  '</div>' +
                  '<span class="competitor-chevron">▼</span>' +
                '</div>' +
              '</div>' +
              '<div class="competitor-content">' +
                '<div class="competitor-expanded-grid">' +
                  '<!-- Satır 1 -->' +
                  '<div class="analysis-section">' +
                    '<h4>🎨 KREATİF TARZLARI</h4>' +
                    '<ul>' + (creativeStyles || '<li>Belirtilmedi.</li>') + '</ul>' +
                  '</div>' +
                  '<div class="analysis-section">' +
                    '<h4>🪝 REKLAM KANCALARI (HOOKS)</h4>' +
                    '<ul>' + (hooks || '<li>Belirtilmedi.</li>') + '</ul>' +
                  '</div>' +
                  '<div class="analysis-section">' +
                    '<h4>📱 META REKLAM STRATEJİSİ</h4>' +
                    '<div class="strategy-box">' + esc(c.metaStrategy || 'Belirtilmedi.') + '</div>' +
                  '</div>' +
                  '<div class="analysis-section">' +
                    '<h4>🔍 GOOGLE REKLAM STRATEJİSİ</h4>' +
                    '<div class="strategy-box">' + esc(c.googleStrategy || 'Belirtilmedi.') + '</div>' +
                  '</div>' +
                  '<!-- Satır 2 -->' +
                  '<div class="analysis-section grid-col-span-2">' +
                    '<h4>🎯 HEDEFLENECEK ZAFİYETLER (WEAKNESSES TO EXPLOIT)</h4>' +
                    '<div class="exploit-box">' +
                      '<ul>' + (exploits || '<li>Zafiyet belirtilmedi.</li>') + '</ul>' +
                    '</div>' +
                  '</div>' +
                  notesHTML +
                '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('');

        // Akordiyon açma/kapatma olayını bağla
        wrap.querySelectorAll('.competitor-header').forEach(function (header) {
          header.onclick = function (e) {
            if (e.target.closest('button') || e.target.closest('a')) {
              return;
            }
            var card = header.closest('.competitor-card');
            card.classList.toggle('active');
          };
        });

        wrap.querySelectorAll('[data-action]').forEach(function (btn) {
          btn.onclick = function (e) {
            e.stopPropagation();
            var card = btn.closest('.competitor-card');
            var id = card.getAttribute('data-id');
            
            fetchCompetitors(function (currentList) {
              var idx = currentList.findIndex(function (item) { return item.id === id; });
              if (idx < 0) return;
              
              var action = btn.getAttribute('data-action');
              if (action === 'delete') {
                if (confirm('"' + currentList[idx].competitorName + '" analizini silmek istediğinize emin misiniz?')) {
                  currentList.splice(idx, 1);
                  saveCompetitors(currentList, function (success) {
                    if (success) {
                      renderList();
                      toast('Analiz silindi.');
                    } else {
                      toast('Silme işlemi sunucuda başarısız oldu.');
                    }
                  });
                }
              } else if (action === 'copy') {
                var rawObj = Object.assign({}, currentList[idx]);
                delete rawObj.id;
                delete rawObj.createdAt;
                var textToCopy = JSON.stringify(rawObj, null, 2);
                navigator.clipboard.writeText(textToCopy).then(function() {
                  toast('JSON veri panoya kopyalandı!');
                }).catch(function() {
                  toast('Panoya kopyalama başarısız oldu.');
                });
              }
            });
          };
        });
      });
    }

    // ---------- Modal İşlemleri ----------
    var overlay = el('#modalOverlay');
    var btnNewAnalysis = el('#btnNewAnalysis');
    var btnClose = el('#modalClose');
    var btnCancel = el('#btnCancel');
    var btnSaveAnalysis = el('#btnSaveAnalysis');
    var jsonInput = el('#jsonInput');

    function openModal() {
      jsonInput.value = '';
      overlay.classList.add('open');
      jsonInput.focus();
    }
    function closeModal() {
      overlay.classList.remove('open');
    }

    if (btnNewAnalysis) btnNewAnalysis.onclick = openModal;
    if (btnClose) btnClose.onclick = closeModal;
    if (btnCancel) btnCancel.onclick = closeModal;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    btnSaveAnalysis.onclick = function () {
      var rawVal = jsonInput.value.trim();
      if (!rawVal) {
        toast('Lütfen JSON verisi girin.');
        return;
      }

      var parsed = null;
      try {
        parsed = JSON.parse(rawVal);
      } catch (e) {
        toast('Geçersiz JSON formatı. Lütfen sözdizimini kontrol edin.');
        return;
      }

      var name = parsed.competitorName || parsed.name;
      if (!name) {
        toast('Hata: JSON verisi içinde rakip ismi ("competitorName" veya "name") bulunmalıdır.');
        return;
      }

      var makeArray = function (val) {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string' && val.trim() !== '') return [val.trim()];
        return [];
      };

      var adCreativeStyle = makeArray(parsed.adCreativeStyle || parsed.ad_creative_style);
      var promotionalHooks = makeArray(parsed.promotionalHooks || parsed.promotional_hooks);
      var weaknessesToExploit = makeArray(parsed.weaknessesToExploit || parsed.weaknesses_to_exploit || parsed.weaknesses);
      
      var primaryTrafficSource = parsed.primaryTrafficSource || parsed.primary_traffic_source || '';
      var metaStrategy = parsed.metaStrategy || parsed.meta_strategy || '';
      var googleStrategy = parsed.googleStrategy || parsed.google_strategy || '';
      var website = parsed.website || '';
      var notes = parsed.notes || '';

      var newCompetitor = {
        id: 'comp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        competitorName: name,
        website: website,
        primaryTrafficSource: primaryTrafficSource,
        adCreativeStyle: adCreativeStyle,
        promotionalHooks: promotionalHooks,
        metaStrategy: metaStrategy,
        googleStrategy: googleStrategy,
        weaknessesToExploit: weaknessesToExploit,
        notes: notes,
        createdAt: Date.now()
      };

      fetchCompetitors(function (currentList) {
        currentList.push(newCompetitor);
        saveCompetitors(currentList, function (success) {
          if (success) {
            closeModal();
            renderList();
            toast('"' + newCompetitor.competitorName + '" analizi başarıyla eklendi.');
          } else {
            toast('Kaydetme hatası: Sunucuya ulaşılamadı.');
          }
        });
      });
    };

    // İlk yükleme ve Senkronizasyon
    syncAndInit();
  }
})();
