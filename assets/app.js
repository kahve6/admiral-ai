/* ADMIRA — kampanya oluşturma sihirbazı + kampanya listesi */
(function () {
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

  fetch('api/auth.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'me' })
  }).then(function (r) { return r.json(); }).then(function (res) {
    if (!res || !res.ok) { location.href = 'index.html'; return; }
    initApp(res.user);
  }).catch(function () { location.href = 'index.html'; });

  function initApp(user) {
    var CAMPAIGNS_KEY = 'admira_campaigns_' + user.email;

    el('#userName').textContent = user.name;
    el('#userEmail').textContent = user.email;
    el('#userAvatar').textContent = (user.name || '?').trim().charAt(0).toUpperCase();
    el('#btnLogout').onclick = function () {
      fetch('api/auth.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      }).then(function () { location.href = 'index.html'; }).catch(function () { location.href = 'index.html'; });
    };

    // ---------- kampanya verisi ----------
    function getCampaigns() {
      try { return JSON.parse(localStorage.getItem(CAMPAIGNS_KEY)) || []; }
      catch (e) { return []; }
    }
    function saveCampaigns(list) { localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list)); }

    var STATUS_LABEL = { draft: 'Taslak', active: 'Aktif', paused: 'Duraklatıldı' };

    function renderStats(list) {
      el('#statTotal').textContent = list.length;
      el('#statActive').textContent = list.filter(function (c) { return c.status === 'active'; }).length;
      var totalBudget = list.reduce(function (sum, c) {
        return sum + (c.status !== 'draft' && c.budgetType === 'daily' ? Number(c.budgetAmount || 0) : 0);
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

    function statusActionButton(c) {
      if (c.status === 'draft') return '<button class="icon-btn" data-action="publish" title="Yayınla">▶</button>';
      if (c.status === 'active') return '<button class="icon-btn" data-action="pause" title="Duraklat">⏸</button>';
      return '<button class="icon-btn" data-action="resume" title="Devam Et">▶</button>';
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
                '<span class="badge badge-status-' + c.status + '">' + STATUS_LABEL[c.status] + '</span>' +
              '</div>' +
              '<div class="campaign-sub">' +
                '<span>👥 ' + audienceSummary(c) + '</span>' +
                '<span>📌 ' + (c.placements === 'auto' ? 'Otomatik Yerleşim' : c.placements.length + ' yerleşim') + '</span>' +
                '<span>🎞 ' + esc(c.format) + '</span>' +
                '<span>🎯 ' + esc(c.cta || '') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="campaign-metrics">' +
              '<div class="metric"><div class="metric-label">Bütçe</div><div class="metric-value">' + fmtMoney(c.budgetAmount) + (c.budgetType === 'daily' ? '/gün' : ' toplam') + '</div></div>' +
              '<div class="metric"><div class="metric-label">Oluşturma</div><div class="metric-value">' + new Date(c.createdAt).toLocaleDateString('tr-TR') + '</div></div>' +
            '</div>' +
            '<div class="campaign-actions">' +
              statusActionButton(c) +
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
          var action = btn.getAttribute('data-action');
          if (action === 'publish') {
            list[idx].status = 'active';
            saveCampaigns(list); renderList();
            toast('"' + list[idx].name + '" yayına alındı.');
          } else if (action === 'pause') {
            list[idx].status = 'paused';
            saveCampaigns(list); renderList();
          } else if (action === 'resume') {
            list[idx].status = 'active';
            saveCampaigns(list); renderList();
          } else if (action === 'delete') {
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

    // ================= SİHİRBAZ (Kampanya → Reklam Seti/Grubu → Reklam) =================
    var STEP_COUNT = 4;
    var wizard = null;
    function freshWizard() {
      return {
        step: 1,
        platform: null,
        objectiveId: null,
        campaign: { name: '' },
        adset: { budgetType: 'daily', budgetAmount: '', startDate: '', endDate: '', bidStrategy: '', optimizationGoal: '', gender: 'all', ageMin: 18, ageMax: 65, autoPlacement: true, manualPlacements: [] },
        audience: { locations: [], languages: [], interests: [] },
        ad: { format: '', primaryText: '', headline: '', cta: '', extra: '' }
      };
    }

    var overlay = el('#modalOverlay'), body = el('#modalBody');
    var btnBack = el('#btnBack'), btnNext = el('#btnNext'), btnClose = el('#modalClose');

    function openWizard() {
      wizard = freshWizard();
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
          e.preventDefault(); add(input.value); input.value = '';
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

    function ageOptions(selected) {
      var out = '';
      for (var a = 13; a <= 65; a++) out += '<option value="' + a + '"' + (a === selected ? ' selected' : '') + '>' + (a === 65 ? '65+' : a) + '</option>';
      return out;
    }
    function optionList(values, selected) {
      return values.map(function (v) { return '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
    }

    // ---------- adım render ----------
    function renderStep() {
      updateDots();
      btnBack.style.display = wizard.step === 1 ? 'none' : 'inline-flex';
      btnNext.textContent = wizard.step === STEP_COUNT ? '✓ Kampanyayı Oluştur' : 'İleri →';
      if (wizard.step === 1) renderStep1();
      else if (wizard.step === 2) renderStep2();
      else if (wizard.step === 3) renderStep3();
      else renderStep4();
    }

    function renderStep1() {
      body.innerHTML =
        '<div class="step-label">Adım 1 / ' + STEP_COUNT + '</div>' +
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
        '<div class="step-label">Adım 2 / ' + STEP_COUNT + ' · Kampanya Düzeyi</div>' +
        '<h4 class="step-heading">Kampanya hedefi</h4>' +
        '<p class="step-sub">' + pf.name + ' için kampanya hedefinizi seçin. Bütçe ve teklif optimizasyonu bu seçime göre şekillenir.</p>' +
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
        '</div>' +
        '<div class="field" style="margin-top:18px"><label>Kampanya Adı</label><input id="f_campname" placeholder="Örn: Yaz Koleksiyonu Lansmanı" value="' + esc(wizard.campaign.name) + '" /></div>';
      document.querySelectorAll('.objective-pick').forEach(function (p) {
        p.onclick = function () { wizard.objectiveId = p.getAttribute('data-obj'); renderStep2(); };
      });
    }

    function renderStep3() {
      var pf = ADMIRA_PLATFORMS[wizard.platform];
      var a = wizard.adset;
      body.innerHTML =
        '<div class="step-label">Adım 3 / ' + STEP_COUNT + ' · ' + pf.adsetLabel + ' Düzeyi</div>' +
        '<h4 class="step-heading">Bütçe, teklif ve hedef kitle</h4>' +
        '<p class="step-sub">Hedef kitle, yerleşim, bütçe ve teklif ayarları ' + pf.adsetLabel.toLowerCase() + ' düzeyinde belirlenir.</p>' +

        '<div class="fieldset"><legend>Bütçe & Takvim</legend>' +
          '<div class="field"><label>Bütçe Tipi</label>' +
            '<div class="radio-row">' +
              '<div class="radio-opt' + (a.budgetType === 'daily' ? ' selected' : '') + '" data-budget="daily">Günlük Bütçe</div>' +
              '<div class="radio-opt' + (a.budgetType === 'lifetime' ? ' selected' : '') + '" data-budget="lifetime">Toplam Bütçe</div>' +
            '</div>' +
          '</div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Bütçe Tutarı (₺)</label><input type="number" min="0" id="f_budget" placeholder="500" value="' + esc(a.budgetAmount) + '" /></div>' +
            '<div class="field"><label>Başlangıç Tarihi</label><input type="date" id="f_start" value="' + esc(a.startDate) + '" /></div>' +
            '<div class="field full"><label>Bitiş Tarihi (opsiyonel)</label><input type="date" id="f_end" value="' + esc(a.endDate) + '" /></div>' +
          '</div>' +
        '</div>' +

        '<div class="fieldset"><legend>Teklif & Optimizasyon</legend>' +
          '<div class="field"><label>Teklif Stratejisi</label><select id="f_bid">' + optionList(pf.bidStrategies, a.bidStrategy || pf.bidStrategies[0]) + '</select></div>' +
          '<div class="field"><label>Optimizasyon Hedefi</label><select id="f_optgoal">' + optionList(pf.optimizationGoals[wizard.objectiveId] || [], a.optimizationGoal) + '</select></div>' +
        '</div>' +

        '<div class="fieldset"><legend>Hedef Kitle</legend>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Min Yaş</label><select id="f_agemin">' + ageOptions(a.ageMin) + '</select></div>' +
            '<div class="field"><label>Max Yaş</label><select id="f_agemax">' + ageOptions(a.ageMax) + '</select></div>' +
          '</div>' +
          '<div class="field"><label>Cinsiyet</label>' +
            '<div class="radio-row">' +
              '<div class="radio-opt' + (a.gender === 'all' ? ' selected' : '') + '" data-gender="all">Tümü</div>' +
              '<div class="radio-opt' + (a.gender === 'female' ? ' selected' : '') + '" data-gender="female">Kadın</div>' +
              '<div class="radio-opt' + (a.gender === 'male' ? ' selected' : '') + '" data-gender="male">Erkek</div>' +
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

        '<div class="fieldset"><legend>Yerleşim</legend>' +
          '<div class="checkbox-row">' +
            '<label class="checkbox-opt"><input type="checkbox" id="f_autoplacement"' + (a.autoPlacement ? ' checked' : '') + ' /> Otomatik Yerleşim (önerilir)</label>' +
          '</div>' +
          '<div id="manualPlacements" style="display:' + (a.autoPlacement ? 'none' : 'flex') + ';margin-top:8px" class="checkbox-row">' +
            pf.placements.map(function (p) { return '<label class="checkbox-opt"><input type="checkbox" class="manual-placement" value="' + esc(p) + '"' + (a.manualPlacements.indexOf(p) !== -1 ? ' checked' : '') + ' /> ' + esc(p) + '</label>'; }).join('') +
          '</div>' +
        '</div>';

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

    function collectStep3() {
      var a = wizard.adset;
      var budget = Number(el('#f_budget').value);
      if (!budget || budget <= 0) { toast('Geçerli bir bütçe tutarı girin.'); return false; }
      a.budgetType = body.querySelector('[data-budget].selected').getAttribute('data-budget');
      a.budgetAmount = budget;
      a.startDate = el('#f_start').value || '';
      a.endDate = el('#f_end').value || '';
      a.bidStrategy = el('#f_bid').value;
      a.optimizationGoal = el('#f_optgoal').value;
      a.gender = body.querySelector('[data-gender].selected').getAttribute('data-gender');
      a.ageMin = Number(el('#f_agemin').value);
      a.ageMax = Number(el('#f_agemax').value);
      a.autoPlacement = el('#f_autoplacement').checked;
      a.manualPlacements = Array.from(body.querySelectorAll('.manual-placement:checked')).map(function (c) { return c.value; });
      return true;
    }

    function renderStep4() {
      var pf = ADMIRA_PLATFORMS[wizard.platform];
      var obj = pf.objectives.find(function (o) { return o.id === wizard.objectiveId; });
      var extraDef = ADMIRA_OBJECTIVE_EXTRA[wizard.objectiveId];
      var d = wizard.ad;

      body.innerHTML =
        '<div class="step-label">Adım 4 / ' + STEP_COUNT + ' · Reklam Düzeyi</div>' +
        '<h4 class="step-heading">Kreatif & reklam metni</h4>' +
        '<p class="step-sub">' + pf.name + ' · ' + obj.tr + ' hedefi için reklam kreatifini ve çağrı metnini belirleyin.</p>' +

        '<div class="fieldset"><legend>Kreatif</legend>' +
          '<div class="field"><label>Reklam Formatı</label><select id="f_format">' + optionList(pf.formats, d.format || pf.formats[0]) + '</select></div>' +
          '<div class="field"><label>Ana Metin (Primary Text)</label><textarea id="f_primary" rows="3" maxlength="300" placeholder="Ürününüzü / teklifinizi kısaca anlatın (125 karakter altı önerilir)" style="width:100%;padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);resize:vertical">' + esc(d.primaryText) + '</textarea></div>' +
          '<div class="field"><label>Başlık (Headline)</label><input id="f_headline" maxlength="60" placeholder="Kısa ve çarpıcı bir başlık (40 karakter altı önerilir)" value="' + esc(d.headline) + '" /></div>' +
          '<div class="field"><label>Harekete Geçirici Mesaj (CTA)</label><select id="f_cta">' + optionList(pf.ctaButtons, d.cta || pf.ctaButtons[0]) + '</select></div>' +
          (extraDef ? '<div class="field"><label>' + extraDef.label + '</label><input id="f_extra" placeholder="' + extraDef.placeholder + '" value="' + esc(d.extra) + '" /></div>' : '') +
        '</div>' +

        '<div class="review-block">' +
          '<div class="review-row"><span class="k">Platform</span><span class="v">' + pf.name + '</span></div>' +
          '<div class="review-row"><span class="k">Kampanya</span><span class="v">' + esc(wizard.campaign.name || '—') + '</span></div>' +
          '<div class="review-row"><span class="k">Hedef</span><span class="v">' + obj.tr + '</span></div>' +
          '<div class="review-row"><span class="k">Bütçe</span><span class="v">' + fmtMoney(wizard.adset.budgetAmount) + (wizard.adset.budgetType === 'daily' ? '/gün' : ' toplam') + '</span></div>' +
          '<div class="review-row"><span class="k">Durum</span><span class="v">Taslak olarak kaydedilecek</span></div>' +
        '</div>';
    }

    function collectStep4() {
      var d = wizard.ad;
      var extraDef = ADMIRA_OBJECTIVE_EXTRA[wizard.objectiveId];
      d.format = el('#f_format').value;
      d.primaryText = el('#f_primary').value.trim();
      d.headline = el('#f_headline').value.trim();
      d.cta = el('#f_cta').value;
      d.extra = extraDef ? el('#f_extra').value.trim() : '';
      return true;
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
        var name = el('#f_campname').value.trim();
        if (!name) { toast('Kampanya adı zorunludur.'); return; }
        wizard.campaign.name = name;
        wizard.step = 3; renderStep(); return;
      }
      if (wizard.step === 3) {
        if (!collectStep3()) return;
        wizard.step = 4; renderStep(); return;
      }
      // step 4 -> oluştur (taslak)
      if (!collectStep4()) return;
      var pf = ADMIRA_PLATFORMS[wizard.platform];
      var obj = pf.objectives.find(function (o) { return o.id === wizard.objectiveId; });
      var campaign = {
        id: admiraUid(),
        platform: wizard.platform,
        objectiveId: wizard.objectiveId,
        objectiveLabel: obj.tr,
        name: wizard.campaign.name,
        status: 'draft',
        budgetType: wizard.adset.budgetType,
        budgetAmount: wizard.adset.budgetAmount,
        startDate: wizard.adset.startDate || null,
        endDate: wizard.adset.endDate || null,
        bidStrategy: wizard.adset.bidStrategy,
        optimizationGoal: wizard.adset.optimizationGoal,
        audience: {
          ageMin: wizard.adset.ageMin,
          ageMax: wizard.adset.ageMax,
          gender: wizard.adset.gender,
          locations: wizard.audience.locations.slice(),
          languages: wizard.audience.languages.slice(),
          interests: wizard.audience.interests.slice()
        },
        placements: wizard.adset.autoPlacement ? 'auto' : wizard.adset.manualPlacements.slice(),
        format: wizard.ad.format,
        primaryText: wizard.ad.primaryText,
        headline: wizard.ad.headline,
        cta: wizard.ad.cta,
        extra: wizard.ad.extra,
        createdAt: Date.now()
      };

      var list = getCampaigns();
      list.push(campaign);
      saveCampaigns(list);
      closeWizard();
      renderList();
      toast('"' + campaign.name + '" taslak olarak oluşturuldu. Yayınlamak için ▶ butonunu kullanın.');
    };

    renderList();
  }
})();
