/* Admiral AI — backend client.
 * Detects whether a PHP backend is reachable:
 *   - cloud mode: api/index.php answers -> multi-user (workspaces, invite codes)
 *   - solo  mode: no backend (e.g. python http.server, or before deploy)
 *                 -> falls back to localStorage, single user, like the demo.
 * Identity is token-based (no passwords): create a workspace or join with a code.
 */
(function (global) {
  'use strict';

  var API = 'api/index.php';
  var TOKEN_KEY = 'admiral_token';
  var SOLO_KEY = 'admiral_campaigns_v1';

  var Store = { mode: 'solo', session: null };

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function call(action, body) {
    var opts = { method: body ? 'POST' : 'GET', headers: {}, cache: 'no-store' };
    var tk = token();
    if (tk) opts.headers['Authorization'] = 'Bearer ' + tk;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(API + '?action=' + action, opts).then(function (r) {
      return r.text().then(function (txt) {
        var j;
        try { j = JSON.parse(txt); } catch (e) { var x = new Error('backend-unreachable'); x.code = 'NOJSON'; throw x; }
        if (!r.ok || j.ok === false) { var err = new Error((j && j.error) || ('http ' + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  Store._call = call;

  // Decide mode, then resolve current session (if any token).
  Store.init = function () {
    return call('ping').then(function () {
      Store.mode = 'cloud';
      if (!token()) return { authenticated: false };
      return call('session').then(function (s) {
        if (s.authenticated) Store.session = s; else setToken(null);
        return s;
      }).catch(function () { setToken(null); return { authenticated: false }; });
    }).catch(function () {
      Store.mode = 'solo';
      return { authenticated: false, solo: true };
    });
  };

  Store.isCloud = function () { return Store.mode === 'cloud'; };
  Store.role = function () { return Store.session && Store.session.member ? Store.session.member.role : 'owner'; };
  Store.canEdit = function () { return Store.role() !== 'viewer'; };
  Store.isOwner = function () { return Store.role() === 'owner'; };
  Store.workspace = function () { return Store.session ? Store.session.workspace : null; };
  Store.me = function () { return Store.session ? Store.session.member : null; };

  Store.createWorkspace = function (name, ownerName) {
    return call('create_workspace', { name: name, ownerName: ownerName }).then(function (r) {
      setToken(r.token);
      Store.session = { authenticated: true, workspace: r.workspace, member: r.member };
      return r;
    });
  };
  Store.join = function (code, name) {
    return call('join', { code: code, name: name }).then(function (r) {
      setToken(r.token);
      Store.session = { authenticated: true, workspace: r.workspace, member: r.member };
      return r;
    });
  };
  Store.logout = function () { setToken(null); Store.session = null; };

  // Campaigns. Cloud: server. Solo: localStorage (null => caller seeds demo).
  Store.getCampaigns = function () {
    if (Store.mode === 'cloud') return call('get_campaigns').then(function (r) { return r.campaigns || []; });
    try { var raw = localStorage.getItem(SOLO_KEY); if (raw) return Promise.resolve(JSON.parse(raw)); } catch (e) {}
    return Promise.resolve(null);
  };
  Store.saveCampaigns = function (camps) {
    if (Store.mode === 'cloud') return call('save_campaigns', { campaigns: camps });
    localStorage.setItem(SOLO_KEY, JSON.stringify(camps));
    return Promise.resolve();
  };

  // Team (owner-managed invite codes + members).
  Store.listInvites = function () { return call('list_invites').then(function (r) { return r.invites; }); };
  Store.createInvite = function (role) { return call('create_invite', { role: role }); };
  Store.revokeInvite = function (code) { return call('revoke_invite', { code: code }); };
  Store.listMembers = function () { return call('list_members'); };

  global.AdmiralStore = Store;
})(typeof window !== 'undefined' ? window : this);
