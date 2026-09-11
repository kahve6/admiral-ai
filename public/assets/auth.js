/* ADMIRA — giriş / kayıt (data/users.json destekli sunucu oturumu) */
(function () {
  function el(sel) { return document.querySelector(sel); }
  function toast(msg) {
    var elx = el('#toast');
    elx.textContent = msg; elx.classList.add('show');
    clearTimeout(elx._t); elx._t = setTimeout(function () { elx.classList.remove('show'); }, 2600);
  }
  function goApp() { location.href = 'landing.html'; }

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

  document.getElementById('btnLogin').onclick = function () {
    var btn = this;
    var email = document.getElementById('li_email').value.trim().toLowerCase();
    var pass = document.getElementById('li_pass').value;
    if (!email || !pass) { toast('Lütfen tüm alanları doldurun.'); return; }
    btn.disabled = true;
    api('login', { email: email, password: pass }).then(function (res) {
      btn.disabled = false;
      if (res.data.ok) { goApp(); return; }
      toast('Kullanıcı adı veya şifre hatalı.');
    }).catch(function () { btn.disabled = false; toast('Sunucuya ulaşılamadı.'); });
  };
})();
