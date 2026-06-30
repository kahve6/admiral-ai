/* Admiral AI — app UI mantığı
 * Görünümler: dashboard, new campaign, generation flow, results, campaign detail.
 * State localStorage'da kalıcı. Tüm kampanya verisi sandbox/simüle.
 */
(function () {
  'use strict';

  var lang = localStorage.getItem('admiral_lang') || 'tr';
  function t(key) { return I18N.get(lang, key); }

  // ---- state ----
  var STORE_KEY = 'admiral_campaigns_v1';
  var state = { campaigns: [], pendingResult: null, currentCampaignId: null };

  // ---- roller (solo modda herkes owner sayılır) ----
  function canEdit() { return !AdmiralStore.isCloud() || AdmiralStore.canEdit(); }
  function isOwner() { return !AdmiralStore.isCloud() || AdmiralStore.isOwner(); }
  function denyView() { toast(t('role_readonly')); }

  // ---- Meta Reklam Kütüphanesi verisi (data/winning-ads.json) ----
  // Statik app anahtarsız kalsın diye veri dosyadan okunur; dosya zamanlanmış
  // cron rutiniyle (scripts/refresh-winning-ads) güncel tutulur.
  var WINNING = null;
  function loadWinning() {
    return fetch('data/winning-ads.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { WINNING = j; })
      .catch(function () { WINNING = null; });
  }
  // bir sektör için kazanan reklam verisi (engine'e ve önerilere geçilir)
  function winningFor(sector) {
    if (!WINNING || !WINNING.sectors || !sector) return null;
    var s = WINNING.sectors[sector];
    if (!s) return null;
    return {
      source: WINNING.source || 'Meta Ad Library',
      updated: WINNING.updated || null,
      winners: s.winners || [],
      insights: s.insights || []
    };
  }

  // Veriyi yükle: cloud'da sunucudan, solo'da localStorage (yoksa demo seed).
  function bootData() {
    return AdmiralStore.getCampaigns().then(function (camps) {
      if (camps === null) seedDemo();        // solo, ilk açılış
      else state.campaigns = camps;          // cloud veya kayıtlı solo
    }).catch(function () { state.campaigns = []; });
  }
  function save() {
    if (AdmiralStore.isCloud() && !canEdit()) return;
    AdmiralStore.saveCampaigns(state.campaigns).catch(function () { toast(t('err_save')); });
  }

  function seedDemo() {
    var demos = [
      { brand: 'Moda Nova', sector: 'fashion', product: lang === 'en' ? 'Winter cashmere sweater collection' : 'Kışlık kaşmir kazak koleksiyonu',
        objective: 'conversions', audience: '', budgetDaily: 750, status: 'winning', daysRunning: 9 },
      { brand: 'FitKit', sector: 'fitness', product: lang === 'en' ? 'Home workout resistance band set' : 'Evde antrenman direnç bandı seti',
        objective: 'traffic', audience: '', budgetDaily: 400, status: 'live', daysRunning: 5 }
    ];
    state.campaigns = demos.map(function (d, i) {
      var winData = winningFor(d.sector);
      var res = AdmiralEngine.generateVariants({ brand: d.brand, product: d.product, objective: d.objective, lang: lang, count: 6, sector: d.sector, winningAds: winData });
      var brief = AdmiralEngine.expandBrief({ product: d.product, lang: lang, sector: d.sector });
      var recs = AdmiralEngine.recommend({ brand: d.brand, product: d.product, lang: lang, sector: d.sector, winningAds: winData });
      var chosen = res.variants.slice(0, 3); // ilk 3 yayında
      chosen.forEach(function (v) { v.metrics = AdmiralEngine.simulateMetrics(v, d.budgetDaily, d.daysRunning); });
      return {
        id: 'cmp_seed_' + i, brand: d.brand, product: d.product, objective: d.objective,
        audience: brief.suggestedAudience || d.audience, budgetDaily: d.budgetDaily,
        category: res.category, sector: d.sector, sectorLabel: res.sectorLabel,
        status: d.status, daysRunning: d.daysRunning,
        createdAt: new Date(Date.now() - d.daysRunning * 864e5).toISOString(),
        variants: chosen, allVariants: res.variants, recs: recs, winSource: winData
      };
    });
    save();
  }

  // ---- helpers ----
  var el = function (sel) { return document.querySelector(sel); };
  var main = function () { return document.getElementById('main'); };
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function fmtNum(n) { return (n || 0).toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'); }
  function fmtMoney(n) { return (lang === 'en' ? '$' : '₺') + fmtNum(Math.round(n || 0)); }
  function markColor(seed) { var c = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4']; var h = 0; for (var i = 0; i < seed.length; i++) h += seed.charCodeAt(i); return c[h % c.length]; }
  function initials(s) { return (s || '?').trim().slice(0, 2).toUpperCase(); }

  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function statusPill(status) {
    var map = { live: ['status-live', t('live')], winning: ['status-winning', t('winning_status')], draft: ['status-draft', t('draft')], paused: ['status-paused', t('paused')] };
    var m = map[status] || map.draft;
    return '<span class="status-pill ' + m[0] + '">' + m[1] + '</span>';
  }

  // aggregate metrics across all live/winning variants
  function aggregate() {
    var spend = 0, conv = 0, roasSum = 0, roasN = 0, active = 0;
    state.campaigns.forEach(function (c) {
      if (c.status === 'live' || c.status === 'winning') active++;
      (c.variants || []).forEach(function (v) {
        if (v.metrics) { spend += v.metrics.spend; conv += v.metrics.conversions; roasSum += v.metrics.roas; roasN++; }
      });
    });
    return { spend: spend, conv: conv, roas: roasN ? (roasSum / roasN) : 0, active: active };
  }

  // ===========================================================
  // VIEWS
  // ===========================================================
  function setActiveNav(view) {
    document.querySelectorAll('.nav-item').forEach(function (n) {
      n.classList.toggle('active', n.getAttribute('data-view') === view);
    });
  }

  function renderDashboard() {
    setActiveNav('dashboard');
    var agg = aggregate();
    var html = '' +
      '<div class="page-head"><div><h1>' + t('dash_title') + '</h1><p>' + t('dash_sub') + '</p></div>' +
      (canEdit() ? '<button class="btn btn-primary" id="goNew">＋ ' + t('nav_new') + '</button>' : '') + '</div>' +
      '<div class="kpi-strip">' +
        kpi(t('kpi_spend'), fmtMoney(agg.spend), '+12.4%', 'up') +
        kpi(t('kpi_roas'), (agg.roas).toFixed(2) + '×', '+0.3', 'up') +
        kpi(t('kpi_conv'), fmtNum(agg.conv), '+8.1%', 'up') +
        kpi(t('kpi_active'), String(agg.active), '', '') +
      '</div>';

    if (!state.campaigns.length) {
      html += emptyState();
    } else {
      html += '<h2 style="font-size:18px;margin:8px 0 16px">' + t('nav_campaigns') + '</h2>';
      html += state.campaigns.map(campaignRow).join('');
    }
    main().innerHTML = html;
    bindDashboard();
  }

  function kpi(label, value, delta, dir) {
    return '<div class="kpi-card"><div class="label">' + label + '</div><div class="value">' + value + '</div>' +
      (delta ? '<div class="delta ' + dir + '">' + delta + '</div>' : '') + '</div>';
  }

  function emptyState() {
    return '<div class="empty-state"><div class="ico">🚀</div><h3>' + t('empty_title') + '</h3>' +
      '<p>' + t('empty_sub') + '</p>' +
      (canEdit() ? '<button class="btn btn-primary" id="goNewEmpty">＋ ' + t('empty_cta') + '</button>' : '') + '</div>';
  }

  function campaignRow(c) {
    var agg = (c.variants || []).reduce(function (a, v) {
      if (v.metrics) { a.spend += v.metrics.spend; a.roas = Math.max(a.roas, v.metrics.roas); a.conv += v.metrics.conversions; }
      return a;
    }, { spend: 0, roas: 0, conv: 0 });
    var mark = c.productImage
      ? '<div class="c-mark c-mark-img" style="background-image:url(' + c.productImage + ')"></div>'
      : '<div class="c-mark" style="background:' + markColor(c.brand) + '">' + esc(initials(c.brand)) + '</div>';
    return '<div class="campaign-row" data-cid="' + c.id + '">' +
      mark +
      '<div class="c-info"><h4>' + esc(c.brand) + ' &nbsp;' + statusPill(c.status) + '</h4>' +
      '<p>' + esc(c.product) + '</p></div>' +
      '<div class="c-metrics">' +
        cm(fmtMoney(agg.spend), t('metric_spend')) +
        cm(agg.roas.toFixed(2) + '×', t('metric_roas')) +
        cm(fmtNum(agg.conv), t('metric_conv')) +
        cm((c.variants || []).length, t('res_title')) +
      '</div>' +
      (canEdit() ? '<button class="c-delete" data-del="' + c.id + '" title="' + t('delete') + '">🗑</button>' : '') +
      '</div>';
  }
  function cm(v, l) { return '<div class="c-metric"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; }

  function bindDashboard() {
    var n1 = el('#goNew'), n2 = el('#goNewEmpty');
    if (n1) n1.onclick = renderNew;
    if (n2) n2.onclick = renderNew;
    document.querySelectorAll('.campaign-row').forEach(function (r) {
      r.onclick = function () { renderDetail(r.getAttribute('data-cid')); };
    });
    document.querySelectorAll('.c-delete').forEach(function (b) {
      b.onclick = function (e) { deleteCampaign(b.getAttribute('data-del'), e); };
    });
  }

  // ---- new campaign ----
  function renderNew() {
    setActiveNav('new');
    if (!canEdit()) {
      main().innerHTML = '<div class="page-head"><div><h1>' + t('new_title') + '</h1></div></div>' +
        '<div class="panel-block"><p class="panel-sub">' + t('role_readonly') + '</p></div>';
      return;
    }
    var objOpts = ['conversions', 'traffic', 'awareness', 'leads'].map(function (o) {
      return '<option value="' + o + '">' + t('obj_' + o) + '</option>';
    }).join('');
    var sectorOpts = '<option value="auto">' + t('sector_auto') + '</option>' +
      AdmiralEngine.sectorList(lang).map(function (s) {
        return '<option value="' + s.key + '">' + esc(s.label) + '</option>';
      }).join('');
    main().innerHTML = '' +
      '<div class="page-head"><div><h1>' + t('new_title') + '</h1><p>' + t('new_sub') + '</p></div></div>' +
      '<div class="form-card">' +
        '<div class="form-row"><label>' + t('f_brand') + '</label><input id="f_brand" placeholder="' + t('f_brand_ph') + '" /></div>' +
        '<div class="form-row"><label>' + t('f_sector') + '</label><select id="f_sector">' + sectorOpts + '</select>' +
          '<small class="field-hint">' + t('f_sector_hint') + '</small></div>' +
        '<div class="form-row"><label>' + t('f_product') + '</label><input id="f_product" placeholder="' + t('f_product_ph') + '" /></div>' +
        '<div class="form-row"><label>' + t('f_image') + '</label>' +
          '<div class="image-upload" id="imgDrop">' +
            '<input type="file" id="f_image" accept="image/*" hidden />' +
            '<div class="image-upload-empty" id="imgEmpty"><span class="ico">🖼️</span><span>' + t('choose_image') + '</span><small>' + t('f_image_hint') + '</small></div>' +
            '<div class="image-upload-preview hidden" id="imgPreviewWrap"><img id="imgPreview" alt="" /><button type="button" class="img-remove" id="imgRemove">✕ ' + t('remove_image') + '</button></div>' +
          '</div></div>' +
        '<div class="form-row"><label>' + t('f_audience') + '</label><textarea id="f_audience" placeholder="' + t('f_audience_ph') + '"></textarea></div>' +
        '<div class="form-row two">' +
          '<div><label>' + t('f_objective') + '</label><select id="f_objective">' + objOpts + '</select></div>' +
          '<div><label>' + t('f_budget') + '</label><input id="f_budget" type="number" value="500" min="50" /></div>' +
        '</div>' +
        '<div class="form-row"><label>' + t('f_count') + '</label><select id="f_count"><option value="4">4</option><option value="6" selected>6</option><option value="8">8</option></select></div>' +
        '<button class="btn btn-primary" id="genBtn" style="width:100%">✨ ' + t('generate_cta') + '</button>' +
      '</div>';
    el('#genBtn').onclick = startGeneration;
    bindImageUpload();
  }

  // ürün görseli yükleme (dataURL olarak tutulur)
  var pendingImage = null;
  function bindImageUpload() {
    pendingImage = null;
    var input = el('#f_image'), drop = el('#imgDrop'), empty = el('#imgEmpty');
    var wrap = el('#imgPreviewWrap'), img = el('#imgPreview'), rm = el('#imgRemove');
    if (!input) return;
    empty.onclick = function () { input.click(); };
    function loadFile(file) {
      if (!file || file.type.indexOf('image/') !== 0) return;
      if (file.size > 4 * 1024 * 1024) { toast(lang === 'en' ? 'Image too large (max 4MB)' : 'Görsel çok büyük (maks 4MB)'); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        pendingImage = e.target.result;
        img.src = pendingImage;
        empty.classList.add('hidden'); wrap.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
    input.onchange = function () { loadFile(input.files[0]); };
    rm.onclick = function (e) { e.stopPropagation(); pendingImage = null; input.value = ''; wrap.classList.add('hidden'); empty.classList.remove('hidden'); };
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('dragover'); };
    drop.ondragleave = function () { drop.classList.remove('dragover'); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('dragover'); loadFile(e.dataTransfer.files[0]); };
  }

  // ---- generation flow (AI wow) ----
  function startGeneration() {
    if (!canEdit()) { denyView(); return; }
    var brand = (el('#f_brand').value || '').trim();
    var product = (el('#f_product').value || '').trim();
    if (!brand || !product) { toast(lang === 'en' ? 'Please fill brand and product' : 'Marka ve ürün gerekli'); return; }
    var objective = el('#f_objective').value;
    var sector = el('#f_sector') ? el('#f_sector').value : 'auto';
    var budgetDaily = Math.max(50, parseInt(el('#f_budget').value, 10) || 500);
    var count = parseInt(el('#f_count').value, 10) || 6;
    var audienceInput = (el('#f_audience').value || '').trim();

    var resolved = AdmiralEngine.resolveSector({ sector: sector, product: product });
    var winData = winningFor(resolved);
    var brief = AdmiralEngine.expandBrief({ product: product, lang: lang, sector: sector });
    var res = AdmiralEngine.generateVariants({ brand: brand, product: product, objective: objective, lang: lang, count: count, sector: sector, winningAds: winData });
    var recs = AdmiralEngine.recommend({ brand: brand, product: product, lang: lang, sector: sector, winningAds: winData });

    state.pendingResult = {
      brand: brand, product: product, objective: objective, budgetDaily: budgetDaily,
      audience: audienceInput || brief.suggestedAudience, category: res.category, sector: sector,
      sectorLabel: res.sectorLabel, productImage: pendingImage || null, variants: res.variants,
      recs: recs, winners: winData ? winData.winners : [], winSource: winData ? winData : null
    };

    runGenOverlay(function () { renderResults(); });
  }

  function runGenOverlay(done) {
    var overlay = document.getElementById('genOverlay');
    var stepsWrap = document.getElementById('genSteps');
    document.getElementById('genTitle').textContent = lang === 'en' ? 'Admiral AI is working…' : 'Admiral AI çalışıyor…';
    var stepKeys = ['gen_step1', 'gen_step2', 'gen_step3', 'gen_step4', 'gen_step5'];
    stepsWrap.innerHTML = stepKeys.map(function (k, i) {
      return '<div class="gen-step" id="gs' + i + '"><span class="dot"></span><span>' + t(k) + '</span></div>';
    }).join('');
    overlay.classList.add('show');

    var i = 0;
    function tick() {
      if (i > 0) { var prev = document.getElementById('gs' + (i - 1)); prev.classList.remove('active'); prev.classList.add('done'); prev.querySelector('.dot').textContent = '✓'; }
      if (i >= stepKeys.length) {
        setTimeout(function () { overlay.classList.remove('show'); done(); }, 350);
        return;
      }
      document.getElementById('gs' + i).classList.add('active');
      i++;
      setTimeout(tick, 480 + Math.random() * 360);
    }
    tick();
  }

  // ---- öneri paneli (marketing-consultant çerçeveleri + Meta içgörüleri) ----
  function recsHtml(recObj) {
    if (!recObj || !recObj.recommendations || !recObj.recommendations.length) return '';
    var cards = recObj.recommendations.map(function (r) {
      var src = r.source ? '<div class="rec-src">' + esc(r.source) + (r.updated ? ' · ' + esc(r.updated) : '') + '</div>' : '';
      return '<div class="rec-card rec-' + r.type + '"><div class="rec-ico">' + r.icon + '</div>' +
        '<div class="rec-body"><div class="rec-title">' + esc(r.title) + '</div>' +
        '<div class="rec-text">' + esc(r.body) + '</div>' + src + '</div></div>';
    }).join('');
    return '<div class="panel-block"><h2 class="panel-h">💡 ' + t('recs_title') + '</h2>' +
      '<p class="panel-sub">' + t('recs_sub') + '</p>' +
      '<div class="rec-grid">' + cards + '</div></div>';
  }

  // ---- Meta Reklam Kütüphanesi: bu sektörde kazananlar ----
  function winnersHtml(winData, sectorLabel) {
    if (!winData || !winData.winners || !winData.winners.length) return '';
    var rows = winData.winners.map(function (w) {
      var hook = (lang === 'en' ? w.hook_en : w.hook_tr) || w.hook || '';
      var why = w.why ? (w.why[lang] || w.why.tr || w.why.en || '') : '';
      var trigs = (w.triggers || []).map(function (k) {
        var T = AdmiralEngine.TRIGGERS[k]; return '<span class="chip chip-trig">' + esc(T ? T[lang] : k) + '</span>';
      }).join('');
      var offs = (w.offerComponents || []).map(function (k) {
        var O = AdmiralEngine.OFFER_COMPONENTS[k]; return '<span class="chip chip-off">' + esc(O ? O[lang] : k) + '</span>';
      }).join('');
      return '<div class="winner-row">' +
        '<div class="winner-top"><span class="winner-adv">' + esc(w.advertiser || '—') + '</span>' +
          (w.structure ? '<span class="chip chip-struct">' + esc(w.structure) + '</span>' : '') + '</div>' +
        (hook ? '<div class="winner-hook">“' + esc(hook) + '”</div>' : '') +
        (why ? '<div class="winner-why">' + esc(why) + '</div>' : '') +
        '<div class="winner-chips">' + trigs + offs + '</div></div>';
    }).join('');
    var prov = '<div class="prov">📚 ' + esc(winData.source || 'Meta Ad Library') +
      (winData.updated ? ' · ' + t('updated') + ': ' + esc(winData.updated) : '') + '</div>';
    return '<div class="panel-block"><h2 class="panel-h">🏆 ' + t('winners_title') +
      (sectorLabel ? ' · ' + esc(sectorLabel) : '') + '</h2>' +
      '<p class="panel-sub">' + t('winners_sub') + '</p>' + prov +
      '<div class="winner-list">' + rows + '</div></div>';
  }

  // ---- results ----
  function renderResults() {
    setActiveNav('new');
    var r = state.pendingResult;
    var cards = r.variants.map(function (v, idx) { return variantCard(v, idx, true); }).join('');
    main().innerHTML = '' +
      '<div class="page-head"><div><h1>' + t('res_title') + '</h1><p>' + t('res_sub') + '</p>' +
      '<p style="margin-top:8px;color:var(--accent)">🎯 ' + esc(r.audience) + (r.sectorLabel ? ' · 🏷️ ' + esc(r.sectorLabel) : '') + '</p></div>' +
      '<button class="btn btn-ghost" id="regenBtn">↻ ' + t('regen') + '</button></div>' +
      '<div class="variant-grid" id="vGrid">' + cards + '</div>' +
      '<div class="results-bar"><div class="info"><span id="selCount">0</span> ' + t('launch_n') + '</div>' +
      '<div class="acts"><button class="btn btn-ghost" id="selAll">' + t('select_all') + '</button>' +
      '<button class="btn btn-primary" id="launchBtn" disabled>🚀 ' + t('launch_cta') + '</button></div></div>' +
      recsHtml(r.recs) +
      winnersHtml(r.winSource, r.sectorLabel);
    bindResults();
  }

  function variantCard(v, idx, selectable) {
    var bd = v.scoreBreakdown;
    var bars = [['hook', 'breakdown_hook'], ['clarity', 'breakdown_clarity'], ['cta', 'breakdown_cta'], ['urgency', 'breakdown_urgency'], ['relevance', 'breakdown_relevance']]
      .map(function (p) {
        return '<div class="v-bar-row"><span class="bl">' + t(p[1]) + '</span>' +
          '<span class="v-bar-track"><span class="v-bar-fill" style="width:' + bd[p[0]] + '%"></span></span>' +
          '<span class="bv">' + bd[p[0]] + '</span></div>';
      }).join('');
    var metricsHtml = '';
    if (v.metrics) {
      metricsHtml = '<div style="display:flex;gap:14px;margin-bottom:12px;font-size:12px;color:var(--fg-soft)">' +
        '<span><b style="color:var(--fg)">' + v.metrics.ctr + '%</b> CTR</span>' +
        '<span><b style="color:var(--fg)">' + v.metrics.roas + '×</b> ROAS</span>' +
        '<span><b style="color:var(--fg)">' + fmtMoney(v.metrics.spend) + '</b></span></div>';
    }
    var img = state.pendingResult ? state.pendingResult.productImage : (currentCampaign() ? currentCampaign().productImage : null);
    var brand = state.pendingResult ? state.pendingResult.brand : (currentCampaign() ? currentCampaign().brand : '');
    return '<div class="variant-card ' + (v.isWinner ? 'winner-card' : '') + '" data-vid="' + v.id + '" data-idx="' + idx + '">' +
      '<div class="v-creative" style="' + creativeStyle(v, img) + '">' +
        '<span class="v-angle-tag">' + esc(v.angleTag) + '</span>' +
        (v.isWinner ? '<span class="v-winner-badge">🏆 ' + t('winner') + '</span>' : '') +
        '<span class="v-prod">' + esc(brand) + '</span>' +
        '<span class="v-score-ring" style="color:' + scoreColor(v.score) + '">' + v.score + '</span>' +
      '</div>' +
      '<div class="v-body">' +
        '<div class="v-headline">' + esc(v.headline) + '</div>' +
        '<div class="v-text">' + esc(v.primaryText) + '</div>' +
        '<button class="v-cta preview-btn" data-vid="' + v.id + '">' + esc(v.cta) + ' →</button>' +
        metricsHtml +
        '<div class="v-breakdown">' + bars + '</div>' +
        '<div class="v-actions">' +
          '<button class="btn btn-ghost btn-sm copy-btn" data-vid="' + v.id + '">⧉ ' + t('copy') + '</button>' +
          (selectable ? '<button class="btn btn-ghost btn-sm sel-btn" data-vid="' + v.id + '">＋</button>' : '') +
        '</div>' +
      '</div></div>';
  }

  function scoreColor(s) { return s >= 80 ? 'var(--success)' : s >= 65 ? 'var(--warning)' : 'var(--danger)'; }

  // kreatif arka planı: ürün görseli varsa onu kullan (gradient overlay ile), yoksa gradient
  function creativeStyle(v, image) {
    if (image) {
      return 'background-image:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.55)),url(' + image + ');background-size:cover;background-position:center';
    }
    return 'background:linear-gradient(135deg,' + v.gradient[0] + ',' + v.gradient[1] + ')';
  }

  var selected = {};
  function bindResults() {
    selected = {};
    var grid = el('#vGrid');
    grid.querySelectorAll('.copy-btn').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); copyVariant(b.getAttribute('data-vid')); };
    });
    grid.querySelectorAll('.preview-btn').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openPreview(b.getAttribute('data-vid')); };
    });
    grid.querySelectorAll('.sel-btn').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); toggleSelect(b.getAttribute('data-vid')); };
    });
    grid.querySelectorAll('.variant-card').forEach(function (card) {
      card.onclick = function () { toggleSelect(card.getAttribute('data-vid')); };
    });
    el('#selAll').onclick = function () {
      var all = state.pendingResult.variants.every(function (v) { return selected[v.id]; });
      state.pendingResult.variants.forEach(function (v) { selected[v.id] = !all; });
      refreshSelection();
    };
    el('#launchBtn').onclick = launchCampaign;
    el('#regenBtn').onclick = function () {
      var p = state.pendingResult;
      p.variants = AdmiralEngine.generateVariants({
        brand: p.brand, product: p.product, objective: p.objective, lang: lang,
        sector: p.sector, winningAds: p.winSource,
        count: p.variants.length, salt: String(Math.random())
      }).variants;
      renderResults();
    };
    refreshSelection();
  }

  function toggleSelect(vid) { selected[vid] = !selected[vid]; refreshSelection(); }
  function refreshSelection() {
    var n = 0;
    document.querySelectorAll('.variant-card').forEach(function (card) {
      var vid = card.getAttribute('data-vid');
      var on = !!selected[vid];
      card.classList.toggle('selected', on);
      var sb = card.querySelector('.sel-btn'); if (sb) sb.textContent = on ? '✓' : '＋';
      if (on) n++;
    });
    el('#selCount').textContent = n;
    el('#launchBtn').disabled = n === 0;
  }

  function copyVariant(vid) {
    var v = findVariant(vid);
    if (!v) return;
    var text = v.headline + '\n\n' + v.primaryText + '\n\n[' + v.cta + ']';
    navigator.clipboard && navigator.clipboard.writeText(text);
    toast(t('copied'));
  }
  function findVariant(vid) {
    if (state.pendingResult) { var f = state.pendingResult.variants.filter(function (v) { return v.id === vid; })[0]; if (f) return f; }
    var c = currentCampaign();
    if (c) { var all = (c.allVariants || c.variants); return all.filter(function (v) { return v.id === vid; })[0]; }
    return null;
  }

  // ---- reklam önizleme modalı (CTA / "Keşfet" tıklanınca) ----
  function openPreview(vid) {
    var v = findVariant(vid);
    if (!v) return;
    var img = state.pendingResult ? state.pendingResult.productImage : (currentCampaign() ? currentCampaign().productImage : null);
    var brand = state.pendingResult ? state.pendingResult.brand : (currentCampaign() ? currentCampaign().brand : '');
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML =
      '<div class="ad-preview-modal">' +
        '<div class="modal-head"><h3>' + t('ad_preview') + ' · ' + esc(v.angleTag) + '</h3>' +
          '<button class="modal-x" id="mClose">✕</button></div>' +
        '<div class="fb-ad">' +
          '<div class="fb-ad-top"><div class="fb-avatar">' + esc(initials(brand)) + '</div>' +
            '<div><div class="fb-brand">' + esc(brand) + '</div><div class="fb-sponsored">Sponsorlu · 🌐</div></div></div>' +
          '<div class="fb-ad-text">' + esc(v.primaryText) + '</div>' +
          '<div class="fb-ad-creative" style="' + creativeStyle(v, img) + '"></div>' +
          '<div class="fb-ad-foot"><div class="fb-headline">' + esc(v.headline) + '</div>' +
            '<button class="fb-cta">' + esc(v.cta) + '</button></div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<span class="score-chip" style="color:' + scoreColor(v.score) + '">' + t('score') + ': ' + v.score + '/100</span>' +
          '<button class="btn btn-ghost btn-sm copy-btn" data-vid="' + v.id + '">⧉ ' + t('copy') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.querySelector('#mClose').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    overlay.querySelector('.copy-btn').onclick = function () { copyVariant(v.id); };
  }

  // ---- kampanya silme ----
  function deleteCampaign(cid, ev) {
    if (ev) ev.stopPropagation();
    if (!canEdit()) { denyView(); return; }
    var c = state.campaigns.filter(function (x) { return x.id === cid; })[0];
    if (!c) return;
    confirmModal(t('delete_confirm'), function () {
      state.campaigns = state.campaigns.filter(function (x) { return x.id !== cid; });
      save();
      toast(t('deleted_toast'));
      if (state.currentCampaignId === cid) { state.currentCampaignId = null; renderDashboard(); }
      else renderCurrentList();
    });
  }

  function deleteAll() {
    if (!canEdit()) { denyView(); return; }
    if (!state.campaigns.length) return;
    confirmModal(t('delete_all_confirm'), function () {
      state.campaigns = [];
      save();
      toast(t('deleted_toast'));
      renderDashboard();
    });
  }

  function confirmModal(msg, onYes) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML =
      '<div class="confirm-modal">' +
        '<p>' + esc(msg) + '</p>' +
        '<div class="confirm-actions">' +
          '<button class="btn btn-ghost btn-sm" id="cNo">' + t('cancel') + '</button>' +
          '<button class="btn btn-danger btn-sm" id="cYes">' + t('delete') + '</button>' +
        '</div></div>';
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.querySelector('#cNo').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    overlay.querySelector('#cYes').onclick = function () { close(); onYes(); };
  }

  // hangi liste görünümündeyiz, onu yenile
  function renderCurrentList() {
    var active = document.querySelector('.nav-item.active');
    var v = active ? active.getAttribute('data-view') : 'dashboard';
    if (v === 'campaigns') renderCampaigns(); else renderDashboard();
  }

  // ---- launch ----
  function launchCampaign() {
    if (!canEdit()) { denyView(); return; }
    var r = state.pendingResult;
    var chosen = r.variants.filter(function (v) { return selected[v.id]; });
    chosen.forEach(function (v) { v.metrics = AdmiralEngine.simulateMetrics(v, r.budgetDaily, 1); });
    var hasWinner = chosen.some(function (v) { return v.isWinner; });
    var c = {
      id: 'cmp_' + Date.now(), brand: r.brand, product: r.product, objective: r.objective,
      audience: r.audience, budgetDaily: r.budgetDaily, category: r.category,
      sector: r.sector || 'auto', sectorLabel: r.sectorLabel || '',
      productImage: r.productImage || null,
      status: 'live', daysRunning: 1, createdAt: new Date().toISOString(),
      variants: chosen, allVariants: r.variants,
      recs: r.recs || null, winSource: r.winSource || null
    };
    state.campaigns.unshift(c);
    save();
    state.pendingResult = null;
    toast(t('launched_toast'));
    renderDetail(c.id);
  }

  // ---- campaign detail ----
  function currentCampaign() { return state.campaigns.filter(function (c) { return c.id === state.currentCampaignId; })[0]; }

  function renderDetail(cid) {
    state.currentCampaignId = cid;
    setActiveNav('campaigns');
    var c = currentCampaign();
    if (!c) { renderDashboard(); return; }

    // aggregate
    var agg = c.variants.reduce(function (a, v) {
      var m = v.metrics || {};
      a.impressions += m.impressions || 0; a.clicks += m.clicks || 0; a.spend += m.spend || 0;
      a.conv += m.conversions || 0; a.rev += m.revenue || 0;
      return a;
    }, { impressions: 0, clicks: 0, spend: 0, conv: 0, rev: 0 });
    var ctr = agg.clicks && agg.impressions ? (agg.clicks / agg.impressions * 100).toFixed(2) : '0';
    var cpa = agg.conv ? (agg.spend / agg.conv).toFixed(2) : '0';
    var roas = agg.spend ? (agg.rev / agg.spend).toFixed(2) : '0';

    var metricsGrid = '<div class="metric-grid">' +
      mb(t('metric_impr'), fmtNum(agg.impressions)) +
      mb(t('metric_clicks'), fmtNum(agg.clicks)) +
      mb(t('metric_ctr'), ctr + '%') +
      mb(t('metric_spend'), fmtMoney(agg.spend)) +
      mb(t('metric_conv'), fmtNum(agg.conv)) +
      mb(t('metric_cpa'), fmtMoney(cpa)) +
      mb(t('metric_roas'), roas + '×') +
      mb(t('metric_rev'), fmtMoney(agg.rev)) +
      '</div>';

    // restore pendingResult-free rendering for cards: temporarily expose brand via closure
    var cards = c.variants.map(function (v, idx) { return detailVariantCard(v, idx, c); }).join('');

    main().innerHTML = '' +
      '<div class="page-head"><div>' +
        '<button class="btn btn-ghost btn-sm" id="backBtn" style="margin-bottom:12px">← ' + t('back') + '</button>' +
        '<h1>' + esc(c.brand) + ' &nbsp;' + statusPill(c.status) + '</h1>' +
        '<p>' + esc(c.product) + '</p>' +
        '<p style="margin-top:6px;color:var(--dim);font-size:13px">🎯 ' + esc(c.audience) + ' · 💰 ' + fmtMoney(c.budgetDaily) + '/' + t('day') + ' · ' + c.daysRunning + ' ' + t('days_running') + '</p>' +
      '</div>' +
      '<div style="display:flex;gap:10px"><button class="btn btn-ghost" id="deleteBtn">🗑 ' + t('delete') + '</button>' +
      '<button class="btn btn-primary" id="optimizeBtn">🔁 ' + t('optimize_cta') + '</button></div></div>' +
      metricsGrid +
      '<h2 style="font-size:18px;margin:24px 0 16px">' + t('res_title') + '</h2>' +
      '<div class="variant-grid">' + cards + '</div>' +
      recsHtml(c.recs || AdmiralEngine.recommend({ brand: c.brand, product: c.product, lang: lang, sector: c.sector, winningAds: c.winSource || winningFor(c.sector || c.category) })) +
      winnersHtml(c.winSource || winningFor(c.sector || c.category), c.sectorLabel);

    el('#backBtn').onclick = renderDashboard;
    el('#optimizeBtn').onclick = function () { optimize(c); };
    el('#deleteBtn').onclick = function () { deleteCampaign(c.id); };
    document.querySelectorAll('.copy-btn').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); copyVariant(b.getAttribute('data-vid')); };
    });
    document.querySelectorAll('.preview-btn').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openPreview(b.getAttribute('data-vid')); };
    });
  }
  function mb(l, v) { return '<div class="metric-box"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>'; }

  function detailVariantCard(v, idx, c) {
    var bd = v.scoreBreakdown;
    var bars = [['hook', 'breakdown_hook'], ['clarity', 'breakdown_clarity'], ['cta', 'breakdown_cta'], ['urgency', 'breakdown_urgency'], ['relevance', 'breakdown_relevance']]
      .map(function (p) {
        return '<div class="v-bar-row"><span class="bl">' + t(p[1]) + '</span>' +
          '<span class="v-bar-track"><span class="v-bar-fill" style="width:' + bd[p[0]] + '%"></span></span>' +
          '<span class="bv">' + bd[p[0]] + '</span></div>';
      }).join('');
    var m = v.metrics || {};
    var metricsHtml = '<div style="display:flex;gap:14px;margin-bottom:12px;font-size:12px;color:var(--fg-soft);flex-wrap:wrap">' +
      '<span><b style="color:var(--fg)">' + fmtNum(m.impressions) + '</b> ' + t('metric_impr') + '</span>' +
      '<span><b style="color:var(--fg)">' + (m.ctr || 0) + '%</b> CTR</span>' +
      '<span><b style="color:var(--fg)">' + (m.roas || 0) + '×</b> ROAS</span>' +
      '<span><b style="color:var(--fg)">' + fmtMoney(m.cpa) + '</b> CPA</span></div>';
    return '<div class="variant-card ' + (v.isWinner ? 'winner-card' : '') + '">' +
      '<div class="v-creative" style="' + creativeStyle(v, c.productImage) + '">' +
        '<span class="v-angle-tag">' + esc(v.angleTag) + '</span>' +
        (v.isWinner ? '<span class="v-winner-badge">🏆 ' + t('winner') + '</span>' : '') +
        '<span class="v-prod">' + esc(c.brand) + '</span>' +
        '<span class="v-score-ring" style="color:' + scoreColor(v.score) + '">' + v.score + '</span>' +
      '</div>' +
      '<div class="v-body">' +
        '<div class="v-headline">' + esc(v.headline) + '</div>' +
        '<div class="v-text">' + esc(v.primaryText) + '</div>' +
        '<button class="v-cta preview-btn" data-vid="' + v.id + '">' + esc(v.cta) + ' →</button>' +
        metricsHtml +
        '<div class="v-breakdown">' + bars + '</div>' +
        '<div class="v-actions"><button class="btn btn-ghost btn-sm copy-btn" data-vid="' + v.id + '">⧉ ' + t('copy') + '</button></div>' +
      '</div></div>';
  }

  // ---- optimize loop ----
  function optimize(c) {
    if (!canEdit()) { denyView(); return; }
    // kazananı bul, etrafında yeni varyantlar üret, en iyiyi ekle
    var fresh = AdmiralEngine.generateVariants({
      brand: c.brand, product: c.product, objective: c.objective, lang: lang, count: 6,
      sector: c.sector || c.category, winningAds: c.winSource || winningFor(c.sector || c.category),
      salt: 'opt' + Date.now()
    });
    // en yüksek skorlu 2 yeni varyantı al, metrik üret, kampanyaya ekle
    var newcomers = fresh.variants.slice(0, 2).map(function (v) {
      v.metrics = AdmiralEngine.simulateMetrics(v, c.budgetDaily, 1);
      return v;
    });
    c.variants = c.variants.concat(newcomers);
    // genel kazananı yeniden işaretle
    c.variants.forEach(function (v) { v.isWinner = false; });
    c.variants.sort(function (a, b) { return b.score - a.score; });
    c.variants[0].isWinner = true;
    c.status = 'winning';
    save();
    toast(t('optimized_toast'));
    renderDetail(c.id);
  }

  function renderCampaigns() {
    setActiveNav('campaigns');
    if (!state.campaigns.length) { main().innerHTML = '<div class="page-head"><h1>' + t('nav_campaigns') + '</h1></div>' + emptyState(); bindDashboard(); return; }
    main().innerHTML = '<div class="page-head"><div><h1>' + t('nav_campaigns') + '</h1></div>' +
      (canEdit() ? '<div style="display:flex;gap:10px"><button class="btn btn-ghost" id="delAllBtn">🗑 ' + t('delete_all') + '</button>' +
      '<button class="btn btn-primary" id="goNew">＋ ' + t('nav_new') + '</button></div>' : '') + '</div>' +
      state.campaigns.map(campaignRow).join('');
    bindDashboard();
    var da = el('#delAllBtn'); if (da) da.onclick = deleteAll;
  }

  // ===========================================================
  // INIT
  // ===========================================================
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i')); });
    document.getElementById('langToggle').textContent = t('lang_label');
  }

  function bindNav() {
    document.querySelectorAll('.nav-item').forEach(function (n) {
      n.onclick = function () {
        var v = n.getAttribute('data-view');
        if (v === 'dashboard') renderDashboard();
        else if (v === 'new') renderNew();
        else if (v === 'campaigns') renderCampaigns();
        else if (v === 'team') renderTeam();
      };
    });
    document.getElementById('langToggle').onclick = function () {
      lang = lang === 'tr' ? 'en' : 'tr';
      localStorage.setItem('admiral_lang', lang);
      applyLang();
      renderWsBadge();
      if (document.body.classList.contains('pre-auth')) renderAuth();
      else renderDashboard();
    };
  }

  // ===========================================================
  // AUTH GATE (şifresiz: workspace oluştur ya da davet koduyla katıl)
  // ===========================================================
  function renderAuth(tab) {
    tab = tab || 'create';
    document.body.classList.add('pre-auth');
    setActiveNav('');
    main().innerHTML =
      '<div class="auth-wrap"><div class="auth-card">' +
        '<div class="auth-logo"><span class="logo-mark">A</span> Admiral AI</div>' +
        '<p class="auth-sub">' + t('auth_sub') + '</p>' +
        '<div class="auth-tabs">' +
          '<button class="auth-tab' + (tab === 'create' ? ' active' : '') + '" data-tab="create">' + t('auth_create_tab') + '</button>' +
          '<button class="auth-tab' + (tab === 'join' ? ' active' : '') + '" data-tab="join">' + t('auth_join_tab') + '</button>' +
        '</div>' +
        (tab === 'create'
          ? '<div class="auth-form">' +
              '<label>' + t('auth_ws_name') + '</label><input id="a_ws" placeholder="' + t('auth_ws_ph') + '" />' +
              '<label>' + t('auth_your_name') + '</label><input id="a_owner" placeholder="' + t('auth_name_ph') + '" />' +
              '<button class="btn btn-primary" id="a_create">' + t('auth_create_btn') + '</button>' +
            '</div>'
          : '<div class="auth-form">' +
              '<label>' + t('auth_code') + '</label><input id="a_code" placeholder="XXXX-XXXX" style="text-transform:uppercase" />' +
              '<label>' + t('auth_your_name') + '</label><input id="a_jname" placeholder="' + t('auth_name_ph') + '" />' +
              '<button class="btn btn-primary" id="a_join">' + t('auth_join_btn') + '</button>' +
            '</div>') +
        '<p class="auth-foot">' + t('auth_foot') + '</p>' +
      '</div></div>';

    document.querySelectorAll('.auth-tab').forEach(function (b) {
      b.onclick = function () { renderAuth(b.getAttribute('data-tab')); };
    });
    var cb = el('#a_create');
    if (cb) cb.onclick = function () {
      var ws = (el('#a_ws').value || '').trim(), on = (el('#a_owner').value || '').trim();
      if (!ws || !on) { toast(t('auth_fill')); return; }
      cb.disabled = true;
      AdmiralStore.createWorkspace(ws, on).then(afterAuth).catch(function () { cb.disabled = false; toast(t('auth_err')); });
    };
    var jb = el('#a_join');
    if (jb) jb.onclick = function () {
      var code = (el('#a_code').value || '').trim().toUpperCase(), nm = (el('#a_jname').value || '').trim();
      if (!code || !nm) { toast(t('auth_fill')); return; }
      jb.disabled = true;
      AdmiralStore.join(code, nm).then(afterAuth).catch(function (e) {
        jb.disabled = false; toast(e && e.status === 404 ? t('auth_bad_code') : t('auth_err'));
      });
    };
  }

  function afterAuth() {
    document.body.classList.remove('pre-auth');
    renderWsBadge();
    bootData().then(function () { renderDashboard(); });
  }

  // Çalışma alanı rozeti + çıkış (sadece cloud modda).
  function renderWsBadge() {
    var foot = document.getElementById('wsBadge');
    if (!foot) return;
    if (!AdmiralStore.isCloud() || !AdmiralStore.workspace()) { foot.innerHTML = ''; return; }
    var ws = AdmiralStore.workspace(), me = AdmiralStore.me();
    foot.innerHTML =
      '<div class="ws-name" title="' + esc(ws.name) + '">🏢 ' + esc(ws.name) + '</div>' +
      '<div class="ws-meta">' + esc(me.name) + ' · <span class="role-tag role-' + ws.role + '">' + t('role_' + ws.role) + '</span></div>' +
      '<button class="ws-logout" id="wsLogout">' + t('logout') + '</button>';
    var lo = el('#wsLogout');
    if (lo) lo.onclick = function () { AdmiralStore.logout(); state.campaigns = []; renderAuth(); };
  }

  // ===========================================================
  // TEAM (davet kodları + üyeler)
  // ===========================================================
  function renderTeam() {
    setActiveNav('team');
    if (!AdmiralStore.isCloud()) {
      main().innerHTML = '<div class="page-head"><div><h1>' + t('team_title') + '</h1><p>' + t('team_sub') + '</p></div></div>' +
        '<div class="panel-block"><p class="panel-sub">' + t('team_solo_note') + '</p></div>';
      return;
    }
    main().innerHTML = '<div class="page-head"><div><h1>' + t('team_title') + '</h1><p>' + t('team_sub') + '</p></div></div>' +
      '<div id="teamBody"><div class="panel-block"><p class="panel-sub">…</p></div></div>';
    var body = el('#teamBody');

    var jobs = [AdmiralStore.listMembers()];
    if (isOwner()) jobs.push(AdmiralStore.listInvites());
    Promise.all(jobs).then(function (res) {
      var members = res[0].members || [], meId = res[0].me;
      var invites = res[1] || null;
      var html = '';

      if (isOwner()) {
        html += '<div class="panel-block"><h2 class="panel-h">🔑 ' + t('team_invites') + '</h2>' +
          '<p class="panel-sub">' + t('team_invites_sub') + '</p>' +
          '<div class="invite-new">' +
            '<select id="inviteRole"><option value="viewer">' + t('role_viewer') + '</option><option value="editor">' + t('role_editor') + '</option></select>' +
            '<button class="btn btn-primary btn-sm" id="genInvite">＋ ' + t('team_gen_code') + '</button>' +
          '</div>' +
          '<div class="invite-list">' + inviteRows(invites) + '</div></div>';
      }

      html += '<div class="panel-block"><h2 class="panel-h">👥 ' + t('team_members') + '</h2>' +
        '<div class="member-list">' + members.map(function (m) {
          return '<div class="member-row"><div class="m-mark" style="background:' + markColor(m.name) + '">' + esc(initials(m.name)) + '</div>' +
            '<div class="m-info"><div class="m-name">' + esc(m.name) + (m.id === meId ? ' <span class="m-you">' + t('team_you') + '</span>' : '') + '</div></div>' +
            '<span class="role-tag role-' + m.role + '">' + t('role_' + m.role) + '</span></div>';
        }).join('') + '</div></div>';

      body.innerHTML = html;

      var gi = el('#genInvite');
      if (gi) gi.onclick = function () {
        gi.disabled = true;
        AdmiralStore.createInvite(el('#inviteRole').value).then(function () { renderTeam(); }).catch(function () { gi.disabled = false; toast(t('auth_err')); });
      };
      bindInviteActions();
    }).catch(function () { body.innerHTML = '<div class="panel-block"><p class="panel-sub">' + t('auth_err') + '</p></div>'; });
  }

  function inviteRows(invites) {
    if (!invites || !invites.length) return '<p class="panel-sub">' + t('team_no_codes') + '</p>';
    return invites.map(function (iv) {
      return '<div class="invite-row' + (iv.active ? '' : ' revoked') + '">' +
        '<code class="invite-code">' + esc(iv.code) + '</code>' +
        '<span class="role-tag role-' + iv.role + '">' + t('role_' + iv.role) + '</span>' +
        (iv.active
          ? '<button class="link-btn" data-copy="' + esc(iv.code) + '">' + t('team_copy_link') + '</button>' +
            '<button class="link-btn danger" data-revoke="' + esc(iv.code) + '">' + t('team_revoke') + '</button>'
          : '<span class="revoked-tag">' + t('team_revoked') + '</span>') +
        '</div>';
    }).join('');
  }

  function bindInviteActions() {
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      b.onclick = function () {
        var code = b.getAttribute('data-copy');
        var link = location.origin + location.pathname.replace(/[^/]*$/, 'app.html') + '#invite=' + code;
        navigator.clipboard.writeText(link).then(function () { toast(t('team_link_copied')); }, function () { toast(link); });
      };
    });
    document.querySelectorAll('[data-revoke]').forEach(function (b) {
      b.onclick = function () {
        AdmiralStore.revokeInvite(b.getAttribute('data-revoke')).then(function () { renderTeam(); });
      };
    });
  }

  // URL'de #invite=CODE varsa join sekmesini kodla aç.
  function prefillInvite() {
    var m = (location.hash || '').match(/invite=([A-Za-z0-9-]+)/);
    if (!m) return false;
    renderAuth('join');
    var f = el('#a_code'); if (f) f.value = m[1].toUpperCase();
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  }

  // Meta verisini yükle + backend modunu belirle, sonra app'i başlat.
  Promise.all([loadWinning(), AdmiralStore.init()]).then(function (res) {
    var s = res[1];
    applyLang();
    bindNav();
    renderWsBadge();
    if (AdmiralStore.isCloud() && (!s || !s.authenticated)) {
      if (!prefillInvite()) renderAuth();
      return;
    }
    bootData().then(function () { renderDashboard(); });
  });
})();
