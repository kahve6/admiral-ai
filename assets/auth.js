/* ADMIRA — giriş / kayıt (yerel demo kimlik doğrulama) */
(function () {
  var USERS_KEY = 'admira_users';
  var SESSION_KEY = 'admira_session';

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
  function setSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email })); }

  function toast(msg) {
    var elx = document.getElementById('toast');
    elx.textContent = msg; elx.classList.add('show');
    clearTimeout(elx._t); elx._t = setTimeout(function () { elx.classList.remove('show'); }, 2600);
  }

  function goApp() { location.href = 'app.html'; }

  // zaten oturum açıksa doğrudan app'e geç
  if (localStorage.getItem(SESSION_KEY)) { goApp(); return; }

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
    var name = document.getElementById('su_name').value.trim();
    var email = document.getElementById('su_email').value.trim().toLowerCase();
    var pass = document.getElementById('su_pass').value;
    if (!name || !email || !pass) { toast('Lütfen tüm alanları doldurun.'); return; }
    if (pass.length < 4) { toast('Şifre en az 4 karakter olmalı.'); return; }
    var users = getUsers();
    if (users.some(function (u) { return u.email === email; })) {
      toast('Bu e-posta ile zaten bir hesap var. Giriş yapın.');
      showTab('login');
      return;
    }
    users.push({ name: name, email: email, pass: btoa(pass) });
    saveUsers(users);
    setSession({ name: name, email: email });
    goApp();
  };

  document.getElementById('btnLogin').onclick = function () {
    var email = document.getElementById('li_email').value.trim().toLowerCase();
    var pass = document.getElementById('li_pass').value;
    if (!email || !pass) { toast('Lütfen tüm alanları doldurun.'); return; }
    var users = getUsers();
    var match = users.find(function (u) { return u.email === email && u.pass === btoa(pass); });
    if (!match) { toast('E-posta veya şifre hatalı.'); return; }
    setSession(match);
    goApp();
  };

  document.getElementById('btnDemo').onclick = function () {
    var demo = { name: 'Demo Kullanıcı', email: 'demo@admira.app' };
    var users = getUsers();
    if (!users.some(function (u) { return u.email === demo.email; })) {
      users.push({ name: demo.name, email: demo.email, pass: btoa('demo') });
      saveUsers(users);
    }
    setSession(demo);
    goApp();
  };
})();
