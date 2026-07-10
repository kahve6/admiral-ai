/* ADMIRA — kampanya oluşturma sihirbazı + kampanya listesi */
(function () {
  var SESSION_KEY = 'admira_session';
  var CAMPAIGNS_KEY = 'admira_campaigns';

  var session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { session = null; }
  if (!session) { location.href = 'index.html'; return; }

  function el(sel) { return document.querySelector(sel); }
  function toast(msg) {
    var elx = el('#toast');
    elx.textContent = msg; elx.classList.add('show');
    clearTimeout(elx._t); elx._t = setTimeout(function () { elx.classList.remove('show'); }, 2600);
  }
  function fmtMoney(n) { return '₺' + Number(n || 0).toLocaleString('tr-TR'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- kullanıcı ----------
  el('#userName').textContent = session.name;
  el('#userEmail').textContent = session.email;
  el('#userAvatar').textContent = (session.name || '?').trim().charAt(0).toUpperCase();
  el('#btnLogout').onclick = function () { localStorage.removeItem(SESSION_KEY); location.href = 'index.html'; };

  // ---------- kampanya verisi ----------
  function getCampaigns() {
    try { return JSON.parse(localStorage.getItem(CAMPAIGNS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCampaigns(list) { localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list)); }

  function renderStats(list) {
    el('#statTotal').textContent = list.length;
    el('#statActive').textContent = list.filter(function (c) { return c.status === 'active'; }).length;
    var totalBudget = list.reduce(function (sum, c) {
      return sum + (c.budgetType === 'daily' ? Number(c.budgetAmount || 0) : 0);
    }, 0);
    el('#statBudget').textContent = fmtMoney(totalBudget);
  }

  function audienceSummary(c) {
    var parts = [];
    parts.push((c.audience.ageMin || 13) + '-' + (c.audience.ageMax || 65) + ' yaş');
    parts.push(c.audience.gender === 'all' ? 'Tümü' : (c.audience.gender === 'female' ? 'Kadın' : 'Erkek'));
    if (c.audience.locations && c.audience.locations.length) parts.push(c.audience.locations.slice(0, 2).join(', ') + (c.audience.locations.length > 2 ? ' +' + (c.audience.locations.length - 2) : ''));
    return parts.join(' · ');
  }

  function renderList() {
    var list = getCampaigns().sort(function (a, b) { return b.createdAt - a.createdAt; });
    renderStats(list);
    var wrap = el('#campaignList');
    if (!list.length) {
      wrap.innerHTML =
        '<div class="empty-state">' +
          '<div class="emoji">📣</div>' +
          '<h3>Henüz kampanya oluşturmadınız</h3>' +
          '<p>Meta veya TikTok için ilk kampanya hedefinizi oluşturarak başlayın.</p>' +
          '<button class="btn btn-primary" style="width:auto" id="emptyCreateBtn">+ Kampanya Oluştur</button>' +
        '</div>';
      el('#emptyCreateBtn').onclick = openWizard;
      return;
    }
    wrap.innerHTML = list.map(function (c) {
      var pf = ADMIRA_PLATFORMS[c.platform];
      var obj = pf.objectives.find(function (o) { return o.id === c.objectiveId; });
      return (
        '<div class="campaign-row" data-id="' + c.id + '">' +
          '<div class="platform-badge ' + c.platform + '">' + (c.platform === 'meta' ? 'M' : 'T') + '</div>' +
          '<div class="campaign-main">' +
            '<div class="campaign-name-row">' +
              '<span class="campaign-name">' + esc(c.name) + '</span>' +
              '<span class="badge badge-' + c.platform + '">' + pf.name + '</span>' +
              '<span class="badge" style="background:#f3f4f6;color:#374151">' + esc(obj ? obj.tr : '') + '</span>' +
              '<span class="badge badge-status-' + c.status + '">' + (c.status === 'active' ? 'Aktif' : 'Duraklatıldı') + '</span>' +
            '</div>' +
            '<div class="campaign-sub">' +
              '<span>👥 ' + audienceSummary(c) + '</span>' +
              '<span>📌 ' + (c.placements === 'auto' ? 'Otomatik Yerleşim' : c.placements.length + ' yerleşim') + '</span>' +
              '<span>🎞 ' + esc(c.format) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="campaign-metrics">' +
            '<div class="metric"><div class="metric-label">Bütçe</div><div class="metric-value">' + fmtMoney(c.budgetAmount) + (c.budgetType === 'daily' ? '/gün' : ' toplam') + '</div></div>' +
            '<div class="metric"><div class="metric-label">Oluşturma</div><div class="metric-value">' + new Date(c.createdAt).toLocaleDateString('tr-TR') + '</div></div>' +
          '</div>' +
          '<div class="campaign-actions">' +
            '<button class="icon-btn" data-action="toggle" title="Durumu değiştir">' + (c.status === 'active' ? '⏸' : '▶') + '</button>' +
            '<button class="icon-btn danger" data-action="delete" title="Sil">🗑</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    wrap.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.onclick = function () {
        var row = btn.closest('.campaign-row');
        var id = row.getAttribute('data-id');
        var list = getCampaigns();
        var idx = list.findIndex(function (c) { return c.id === id; });
        if (idx < 0) return;
        if (btn.getAttribute('data-action') === 'toggle') {
          list[idx].status = list[idx].status === 'active' ? 'paused' : 'active';
          saveCampaigns(list);
          renderList();
        } else if (btn.getAttribute('data-action') === 'delete') {
          if (confirm('"' + list[idx].name + '" kampanyasını silmek istediğinize emin misiniz?')) {
            list.splice(idx, 1);
            saveCampaigns(list);
            renderList();
            toast('Kampanya silindi.');
          }
        }
      };
    });
  }

  // ================= SİHİRBAZ =================
  var wizard = { step: 1, platform: null, objectiveId: null, audience: { locations: [], languages: [], interests: [] } };

  var overlay = el('#modalOverlay'), body = el('#modalBody');
  var btnBack = el('#btnBack'), btnNext = el('#btnNext'), btnClose = el('#modalClose');

  function resetWizard() {
    wizard = { step: 1, platform: null, objectiveId: null, audience: { locations: [], languages: [], interests: [] } };
  }

  function openWizard() {
    resetWizard();
    overlay.classList.add('open');
    renderStep();
  }
  function closeWizard() { overlay.classList.remove('open'); }

  el('#btnNewCampaign').onclick = openWizard;
  btnClose.onclick = closeWizard;
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeWizard(); });

  function updateDots() {
    document.querySelectorAll('.step-dot').forEach(function (d) {
      var n = Number(d.getAttribute('data-dot'));
      d.classList.toggle('active', n === wizard.step);
      d.classList.toggle('done', n < wizard.step);
    });
  }

  // ---------- chip input yardımcı ----------
  function setupChipInput(wrapId, inputId, arrRef, suggestions, suggestionRowId) {
    var wrap = el(wrapId), input = el(inputId);

    function render() {
      wrap.querySelectorAll('.chip').forEach(function (c) { c.remove(); });
      arrRef.forEach(function (val, i) {
        var chip = document.createElement('span');
        chip.className = 'chip';
        chip.innerHTML = esc(val) + ' <button type="button">✕</button>';
        chip.querySelector('button').onclick = function () { arrRef.splice(i, 1); render(); };
        wrap.insertBefore(chip, input);
      });
    }
    function add(val) {
      val = (val || '').trim();
      if (!val || arrRef.indexOf(val) !== -1) return;
      arrRef.push(val);
      render();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        add(input.value);
        input.value = '';
      } else if (e.key === 'Backspace' && !input.value && arrRef.length) {
        arrRef.pop(); render();
      }
    });
    input.addEventListener('blur', function () { if (input.value) { add(input.value); input.value = ''; } });
    if (suggestionRowId && suggestions) {
      var row = el(suggestionRowId);
      row.innerHTML = suggestions.map(function (s) { return '<span class="suggestion-chip">' + esc(s) + '</span>'; }).join('');
      row.querySelectorAll('.suggestion-chip').forEach(function (s, i) {
        s.onclick = function () { add(suggestions[i]); };
      });
    }
    render();
  }

  // ---------- adım render ----------
  function renderStep() {
    updateDots();
    btnBack.style.display = wizard.step === 1 ? 'none' : 'inline-flex';
    btnNext.textContent = wizard.step === 3 ? '✓ Kampanyayı Oluştur' : 'İleri →';

    if (wizard.step === 1) renderStep1();
    else if (wizard.step === 2) renderStep2();
    else renderStep3();
  }

  function renderStep1() {
    body.innerHTML =
      '<div class="step-label">Adım 1 / 3</div>' +
      '<h4 class="step-heading">Platform seçin</h4>' +
      '<p class="step-sub">Kampanyanızı hangi reklam platformunda yayınlamak istiyorsunuz?</p>' +
      '<div class="platform-grid">' +
        platformCard('meta', 'M', 'Meta', 'Facebook & Instagram') +
        platformCard('tiktok', 'T', 'TikTok', 'TikTok Ads Manager') +
      '</div>';

    document.querySelectorAll('.platform-pick').forEach(function (p) {
      p.onclick = function () {
        wizard.platform = p.getAttribute('data-platform');
        wizard.objectiveId = null;
        renderStep1();
      };
    });
  }
  function platformCard(id, letter, name, sub) {
    var sel = wizard.platform === id ? ' selected' : '';
    return (
      '<div class="platform-pick' + sel + '" data-platform="' + id + '">' +
        '<div class="pf-icon ' + id + '">' + letter + '</div>' +
        '<h4>' + name + '</h4><p>' + sub + '</p>' +
      '</div>'
    );
  }

  function renderStep2() {
    var pf = ADMIRA_PLATFORMS[wizard.platform];
    body.innerHTML =
      '<div class="step-label">Adım 2 / 3</div>' +
      '<h4 class="step-heading">Kampanya hedefi</h4>' +
      '<p class="step-sub">' + pf.name + ' için kampanya hedefinizi seçin.</p>' +
      '<div class="objective-grid">' +
        pf.objectives.map(function (o) {
          var sel = wizard.objectiveId === o.id ? ' selected' : '';
          return (
            '<div class="objective-pick' + sel + '" data-obj="' + o.id + '">' +
              '<div class="obj-title">' + o.tr + ' <span style="color:var(--dim);font-weight:500">(' + o.en + ')</span></div>' +
              '<div class="obj-desc">' + o.desc + '</div>' +
              '<span class="obj-kpi">' + o.kpi + '</span>' +
            '</div>'
          );
        }).join('') +
      '</div>';
    document.querySelectorAll('.objective-pick').forEach(function (p) {
      p.onclick = function () { wizard.objectiveId = p.getAttribute('data-obj'); renderStep2(); };
    });
  }

  function renderStep3() {
    var pf = ADMIRA_PLATFORMS[wizard.platform];
    var obj = pf.objectives.find(function (o) { return o.id === wizard.objectiveId; });
    var extra = ADMIRA_OBJECTIVE_EXTRA[wizard.objectiveId];

    body.innerHTML =
      '<div class="step-label">Adım 3 / 3</div>' +
      '<h4 class="step-heading">Kampanya detayları</h4>' +
      '<p class="step-sub">' + pf.name + ' · ' + obj.tr + ' hedefi için hedef kitle ve bütçe bilgilerini girin.</p>' +

      '<div class="fieldset">' +
        '<legend>Genel</legend>' +
        '<div class="field"><label>Kampanya Adı</label><input id="f_name" placeholder="Örn: Yaz Koleksiyonu Lansmanı" /></div>' +
        (extra ? '<div class="field"><label>' + extra.label + '</label><input id="f_extra" placeholder="' + extra.placeholder + '" /></div>' : '') +
      '</div>' +

      '<div class="fieldset">' +
        '<legend>Bütçe & Takvim</legend>' +
        '<div class="field"><label>Bütçe Tipi</label>' +
          '<div class="radio-row">' +
            '<div class="radio-opt selected" data-budget="daily">Günlük Bütçe</div>' +
            '<div class="radio-opt" data-budget="lifetime">Toplam Bütçe</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Bütçe Tutarı (₺)</label><input type="number" min="0" id="f_budget" placeholder="500" /></div>' +
          '<div class="field"><label>Başlangıç Tarihi</label><input type="date" id="f_start" /></div>' +
          '<div class="field full"><label>Bitiş Tarihi (opsiyonel)</label><input type="date" id="f_end" /></div>' +
        '</div>' +
      '</div>' +

      '<div class="fieldset">' +
        '<legend>Hedef Kitle</legend>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Min Yaş</label><select id="f_agemin">' + ageOptions(13, 18) + '</select></div>' +
          '<div class="field"><label>Max Yaş</label><select id="f_agemax">' + ageOptions(65, 64) + '</select></div>' +
        '</div>' +
        '<div class="field"><label>Cinsiyet</label>' +
          '<div class="radio-row">' +
            '<div class="radio-opt selected" data-gender="all">Tümü</div>' +
            '<div class="radio-opt" data-gender="female">Kadın</div>' +
            '<div class="radio-opt" data-gender="male">Erkek</div>' +
          '</div>' +
        '</div>' +
        '<div class="field"><label>Konumlar</label>' +
          '<div class="chip-input-wrap" id="wrapLocations"><input id="inputLocations" placeholder="Şehir/ülke yazın, Enter\'a basın" /></div>' +
        '</div>' +
        '<div class="field"><label>Diller</label>' +
          '<div class="chip-input-wrap" id="wrapLanguages"><input id="inputLanguages" placeholder="Örn: Türkçe, İngilizce" /></div>' +
        '</div>' +
        '<div class="field"><label>İlgi Alanları / Davranışlar</label>' +
          '<div class="chip-input-wrap" id="wrapInterests"><input id="inputInterests" placeholder="Yazın veya öneriden seçin" /></div>' +
          '<div class="suggestion-row" id="interestSuggestions"></div>' +
        '</div>' +
      '</div>' +

      '<div class="fieldset">' +
        '<legend>Yerleşim & Format</legend>' +
        '<div class="field"><label>Yerleşim</label>' +
          '<div class="checkbox-row">' +
            '<label class="checkbox-opt"><input type="checkbox" id="f_autoplacement" checked /> Otomatik Yerleşim (önerilir)</label>' +
          '</div>' +
          '<div id="manualPlacements" style="display:none;margin-top:8px" class="checkbox-row">' +
            pf.placements.map(function (p, i) { return '<label class="checkbox-opt"><input type="checkbox" class="manual-placement" value="' + esc(p) + '" /> ' + esc(p) + '</label>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="field"><label>Reklam Formatı</label><select id="f_format">' +
          pf.formats.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + '</option>'; }).join('') +
        '</select></div>' +
      '</div>';

    // radio seçimleri
    body.querySelectorAll('[data-budget]').forEach(function (opt) {
      opt.onclick = function () {
        body.querySelectorAll('[data-budget]').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
      };
    });
    body.querySelectorAll('[data-gender]').forEach(function (opt) {
      opt.onclick = function () {
        body.querySelectorAll('[data-gender]').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
      };
    });
    el('#f_autoplacement').onchange = function (e) {
      el('#manualPlacements').style.display = e.target.checked ? 'none' : 'flex';
    };

    setupChipInput('#wrapLocations', '#inputLocations', wizard.audience.locations, null, null);
    setupChipInput('#wrapLanguages', '#inputLanguages', wizard.audience.languages, null, null);
    setupChipInput('#wrapInterests', '#inputInterests', wizard.audience.interests, pf.interestSuggestions, '#interestSuggestions');
  }
  function ageOptions(defaultVal, minAllowed) {
    var out = '';
    for (var a = 13; a <= 65; a++) {
      out += '<option value="' + a + '"' + (a === defaultVal ? ' selected' : '') + '>' + (a === 65 ? '65+' : a) + '</option>';
    }
    return out;
  }

  function collectStep3() {
    var name = el('#f_name').value.trim();
    if (!name) { toast('Kampanya adı zorunludur.'); return null; }
    var budget = Number(el('#f_budget').value);
    if (!budget || budget <= 0) { toast('Geçerli bir bütçe tutarı girin.'); return null; }
    var budgetType = body.querySelector('[data-budget].selected').getAttribute('data-budget');
    var gender = body.querySelector('[data-gender].selected').getAttribute('data-gender');
    var autoPlacement = el('#f_autoplacement').checked;
    var manualPlacements = Array.from(body.querySelectorAll('.manual-placement:checked')).map(function (c) { return c.value; });
    var extra = ADMIRA_OBJECTIVE_EXTRA[wizard.objectiveId];
    var extraVal = extra ? el('#f_extra').value.trim() : null;

    return {
      name: name,
      budgetType: budgetType,
      budgetAmount: budget,
      startDate: el('#f_start').value || null,
      endDate: el('#f_end').value || null,
      audience: {
        ageMin: Number(el('#f_agemin').value),
        ageMax: Number(el('#f_agemax').value),
        gender: gender,
        locations: wizard.audience.locations.slice(),
        languages: wizard.audience.languages.slice(),
        interests: wizard.audience.interests.slice()
      },
      placements: autoPlacement ? 'auto' : manualPlacements,
      format: el('#f_format').value,
      extra: extra ? (function () { var o = {}; o[extra.key] = extraVal; return o; })() : {}
    };
  }

  btnBack.onclick = function () {
    if (wizard.step > 1) { wizard.step--; renderStep(); }
  };
  btnNext.onclick = function () {
    if (wizard.step === 1) {
      if (!wizard.platform) { toast('Lütfen bir platform seçin.'); return; }
      wizard.step = 2; renderStep(); return;
    }
    if (wizard.step === 2) {
      if (!wizard.objectiveId) { toast('Lütfen bir kampanya hedefi seçin.'); return; }
      wizard.step = 3; renderStep(); return;
    }
    // step 3 -> oluştur
    var details = collectStep3();
    if (!details) return;
    var pf = ADMIRA_PLATFORMS[wizard.platform];
    var obj = pf.objectives.find(function (o) { return o.id === wizard.objectiveId; });
    var campaign = Object.assign({
      id: admiraUid(),
      platform: wizard.platform,
      objectiveId: wizard.objectiveId,
      objectiveLabel: obj.tr,
      status: 'active',
      createdAt: Date.now()
    }, details);

    var list = getCampaigns();
    list.push(campaign);
    saveCampaigns(list);
    closeWizard();
    renderList();
    toast('"' + campaign.name + '" kampanyası oluşturuldu.');
  };

  renderList();
})();
