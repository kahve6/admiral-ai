<?php
// Admiral AI — shared backend helpers: JSON storage (flock), auth, I/O.
require_once __DIR__ . '/config.php';

// --- JSON response ---
function json_out($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fail($msg, $code = 400) { json_out(['ok' => false, 'error' => $msg], $code); }

// --- request input (JSON body merged with query/post) ---
function input() {
  $raw = file_get_contents('php://input');
  $body = $raw ? json_decode($raw, true) : null;
  if (!is_array($body)) $body = [];
  return array_merge($_GET, $_POST, $body);
}

// --- storage path + locked read/update ---
function store_path($name) { return STORAGE_DIR . '/' . $name . '.json'; }

function read_json($name, $default = []) {
  $p = store_path($name);
  if (!is_file($p)) return $default;
  $fp = @fopen($p, 'r');
  if (!$fp) return $default;
  $data = $default;
  if (flock($fp, LOCK_SH)) {
    $raw = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    if ($raw !== '' && $raw !== false) {
      $dec = json_decode($raw, true);
      if (is_array($dec)) $data = $dec;
    }
  }
  fclose($fp);
  return $data;
}

// Atomic read-modify-write under an exclusive lock. $cb receives current data,
// returns new data. Returns whatever $cb returns.
function update_json($name, $default, $cb) {
  $p = store_path($name);
  $fp = fopen($p, 'c+');
  if (!$fp) fail('storage unavailable', 500);
  $result = null;
  if (flock($fp, LOCK_EX)) {
    $raw = stream_get_contents($fp);
    $data = $default;
    if ($raw !== '' && $raw !== false) {
      $dec = json_decode($raw, true);
      if (is_array($dec)) $data = $dec;
    }
    $new = $cb($data);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($new, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    $result = $new;
  }
  fclose($fp);
  return $result;
}

// --- ids / tokens ---
function gen_token() { return bin2hex(random_bytes(18)); }
function gen_id($prefix) { return $prefix . '_' . bin2hex(random_bytes(6)); }
function gen_code() {
  // human-friendly invite code, ambiguous chars removed
  $alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  $s = '';
  for ($i = 0; $i < 8; $i++) $s .= $alpha[random_int(0, strlen($alpha) - 1)];
  return substr($s, 0, 4) . '-' . substr($s, 4, 4);
}

// --- auth ---
function bearer_token() {
  $hdr = '';
  if (isset($_SERVER['HTTP_AUTHORIZATION'])) $hdr = $_SERVER['HTTP_AUTHORIZATION'];
  elseif (function_exists('apache_request_headers')) {
    $h = apache_request_headers();
    if (isset($h['Authorization'])) $hdr = $h['Authorization'];
  }
  if (stripos($hdr, 'Bearer ') === 0) return trim(substr($hdr, 7));
  $in = input();
  return isset($in['token']) ? $in['token'] : '';
}

// Returns member array or null.
function current_member() {
  $tok = bearer_token();
  if (!$tok) return null;
  $members = read_json('members', []);
  return isset($members[$tok]) ? $members[$tok] : null;
}

function require_member() {
  $m = current_member();
  if (!$m) fail('unauthorized', 401);
  return $m;
}

function require_role($member, $min) {
  // owner > editor > viewer
  $rank = ['viewer' => 0, 'editor' => 1, 'owner' => 2];
  if (($rank[$member['role']] ?? -1) < ($rank[$min] ?? 99)) fail('forbidden', 403);
}

function public_member($m) {
  return ['id' => $m['id'], 'name' => $m['name'], 'role' => $m['role'], 'joinedAt' => $m['joinedAt']];
}

function workspace_public($ws, $role) {
  return ['id' => $ws['id'], 'name' => $ws['name'], 'createdAt' => $ws['createdAt'], 'role' => $role];
}
