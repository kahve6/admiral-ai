<?php
// ADMIRA — dosya tabanlı kullanıcı kimlik doğrulama (data/users.json)
declare(strict_types=1);

session_set_cookie_params([
  'lifetime' => 60 * 60 * 24 * 30,
  'path' => '/',
  'httponly' => true,
  'samesite' => 'Lax',
]);
session_start();
header('Content-Type: application/json; charset=utf-8');
// CDN/proxy katmanlarının bu oturuma özel yanıtı önbelleğe almasını engelle.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Vary: Cookie');

$dataDir = __DIR__ . '/../data';
$usersFile = $dataDir . '/users.json';

function readUsers(string $file): array {
  if (!file_exists($file)) return [];
  $raw = file_get_contents($file);
  $data = json_decode($raw !== false && $raw !== '' ? $raw : '[]', true);
  return is_array($data) ? $data : [];
}

function writeUsers(string $file, array $users): void {
  $fp = fopen($file, 'c+');
  if (!$fp) { throw new RuntimeException('users.json yazılamadı'); }
  flock($fp, LOCK_EX);
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
}

function respond($data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function publicUser(array $u): array {
  return ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email']];
}

if (!is_dir($dataDir)) { mkdir($dataDir, 0755, true); }

$method = $_SERVER['REQUEST_METHOD'];

// Oturum kontrolü kasıtlı olarak POST üzerinden yapılır: CDN/edge katmanları
// GET isteklerini (sorgu dizesine göre) önbelleğe alabilir ve farklı
// kullanıcılara birbirlerinin oturum durumunu göstererek yanlış
// index.html <-> app.html yönlendirme döngüsüne yol açabilir.
if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input') ?: '{}', true);
  if (!is_array($body)) { $body = []; }
  $action = $body['action'] ?? null;

  if ($action === 'me') {
    if (!empty($_SESSION['user'])) { respond(['ok' => true, 'user' => $_SESSION['user']]); }
    respond(['ok' => false]);
  }

  if ($action === 'register') {
    $name = trim((string)($body['name'] ?? ''));
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');
    if ($name === '' || $email === '' || strlen($password) < 4) {
      respond(['ok' => false, 'error' => 'invalid_input'], 400);
    }
    $users = readUsers($usersFile);
    foreach ($users as $u) {
      if (strtolower($u['email']) === $email) { respond(['ok' => false, 'error' => 'email_taken'], 409); }
    }
    $user = [
      'id' => bin2hex(random_bytes(8)),
      'name' => $name,
      'email' => $email,
      'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
      'createdAt' => date('c'),
    ];
    $users[] = $user;
    writeUsers($usersFile, $users);
    $_SESSION['user'] = publicUser($user);
    respond(['ok' => true, 'user' => $_SESSION['user']]);
  }

  if ($action === 'login') {
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');
    $users = readUsers($usersFile);
    foreach ($users as $u) {
      if (strtolower($u['email']) === $email && password_verify($password, $u['passwordHash'])) {
        $_SESSION['user'] = publicUser($u);
        respond(['ok' => true, 'user' => $_SESSION['user']]);
      }
    }
    respond(['ok' => false, 'error' => 'invalid_credentials'], 401);
  }

  if ($action === 'demo') {
    $email = 'demo@admira.app';
    $users = readUsers($usersFile);
    $existing = null;
    foreach ($users as $u) { if (strtolower($u['email']) === $email) { $existing = $u; break; } }
    if (!$existing) {
      $existing = [
        'id' => bin2hex(random_bytes(8)),
        'name' => 'Demo Kullanıcı',
        'email' => $email,
        'passwordHash' => password_hash('demo1234', PASSWORD_DEFAULT),
        'createdAt' => date('c'),
      ];
      $users[] = $existing;
      writeUsers($usersFile, $users);
    }
    $_SESSION['user'] = publicUser($existing);
    respond(['ok' => true, 'user' => $_SESSION['user']]);
  }

  if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true]);
  }
}

respond(['ok' => false, 'error' => 'not_found'], 404);
