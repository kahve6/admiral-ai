/* ADMIRA — giriş / kayıt (data/users.json destekli sunucu oturumu) */
(function () {
  function el(sel) { return document.querySelector(sel); }
  function toast(msg) {
    var elx = el('#toast');
    elx.textContent = msg; elx.classList.add('show');
    clearTimeout(elx._t); elx._t = setTimeout(function () { elx.classList.remove('show'); }, 2600);
  }
  function goApp() { location.href = 'app.html'; }

  function api(action, payload) {
    return fetch('api/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    }).then(function (r) { return r.json().then(function (data) { return { status: r.status, data: data }; }); });
  }

  // zaten oturum açıksa doğrudan app'e geç
  api('me', {}).then(function (res) {
    if (res.data && res.data.ok) goApp();
  }).catch(function () {});

  var tabLogin = document.getElementById('tabLogin');
  var tabSignup = document.getElementById('tabSignup');
  var formLogin = document.getElementById('formLogin');
  var formSignup = document.getElementById('formSignup');

  function showTab(tab) {
    var isLogin = tab === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabSignup.classList.toggle('active', !isLogin);
    formLogin.style.display = isLogin ? 'block' : 'none';
    formSignup.style.display = isLogin ? 'none' : 'block';
  }
  tabLogin.onclick = function () { showTab('login'); };
  tabSignup.onclick = function () { showTab('signup'); };

  document.getElementById('btnSignup').onclick = function () {
    var btn = this;
    var name = document.getElementById('su_name').value.trim();
    var email = document.getElementById('su_email').value.trim().toLowerCase();
    var pass = document.getElementById('su_pass').value;
    if (!name || !email || !pass) { toast('Lütfen tüm alanları doldurun.'); return; }
    if (pass.length < 4) { toast('Şifre en az 4 karakter olmalı.'); return; }
    btn.disabled = true;
    api('register', { name: name, email: email, password: pass }).then(function (res) {
      btn.disabled = false;
      if (res.data.ok) { goApp(); return; }
      if (res.data.error === 'email_taken') { toast('Bu e-posta ile zaten bir hesap var. Giriş yapın.'); showTab('login'); }
      else toast('Kayıt başarısız, tekrar deneyin.');
    }).catch(function () { btn.disabled = false; toast('Sunucuya ulaşılamadı.'); });
  };

  document.getElementById('btnLogin').onclick = function () {
    var btn = this;
    var email = document.getElementById('li_email').value.trim().toLowerCase();
    var pass = document.getElementById('li_pass').value;
    if (!email || !pass) { toast('Lütfen tüm alanları doldurun.'); return; }
    btn.disabled = true;
    api('login', { email: email, password: pass }).then(function (res) {
      btn.disabled = false;
      if (res.data.ok) { goApp(); return; }
      toast('E-posta veya şifre hatalı.');
    }).catch(function () { btn.disabled = false; toast('Sunucuya ulaşılamadı.'); });
  };

  document.getElementById('btnDemo').onclick = function (e) {
    e.preventDefault();
    api('demo', {}).then(function (res) {
      if (res.data.ok) goApp(); else toast('Demo hesabı başlatılamadı.');
    }).catch(function () { toast('Sunucuya ulaşılamadı.'); });
  };
})();
