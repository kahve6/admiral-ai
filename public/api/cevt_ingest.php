<?php
// ADMIRA — CEvT alım ucu: SF'nin client/server event'lerini karşılar.
// Oturum kullanmaz (SF cross-domain POST atar) — kimlik doğrulama paylaşılan
// sır ile HMAC-SHA256 imzasıdır (PayTR callback'indeki hash_equals deseniyle
// tutarlı). Fire-and-forget: SF yanıtı beklemez, burada patlayan hiçbir şey
// SF akışını etkilemez.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && preg_match('#^https://([a-z0-9-]+\.)*tiotr\.com$#i', $origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type, X-CEvT-Signature, X-CEvT-Client-Token, X-CEvT-Token-Expires');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$dataDir = __DIR__ . '/../../data';
$secretFile = $dataDir . '/.cevt_secret';
$clientsDir = $dataDir . '/cevt/clients';
$indexFile = $dataDir . '/cevt/index.json';

if (!is_dir($clientsDir)) { mkdir($clientsDir, 0755, true); }

if (!file_exists($secretFile)) {
    respond(['ok' => false, 'error' => 'secret_not_configured'], 500);
}
$secret = trim(file_get_contents($secretFile));

$rawBody = file_get_contents('php://input') ?: '';

$event = json_decode($rawBody, true);
if (!is_array($event)) {
    respond(['ok' => false, 'error' => 'invalid_json'], 400);
}

$clientId = (string)($event['client_id'] ?? '');
$eventName = (string)($event['event_name'] ?? '');
$eventId = (string)($event['event_id'] ?? '');
$occurredAt = (string)($event['occurred_at'] ?? '');
$source = (string)($event['source'] ?? '');

if (!preg_match('/^[a-f0-9-]{8,64}$/i', $clientId)) {
    respond(['ok' => false, 'error' => 'invalid_client_id'], 400);
}
if ($eventName === '' || $eventId === '' || $occurredAt === '' || !in_array($source, ['client', 'server'], true)) {
    respond(['ok' => false, 'error' => 'missing_fields'], 400);
}

// İki auth modu:
// 1) Tam-body HMAC (X-CEvT-Signature) — server-to-server relay (Purchase dahil
//    her event_name/source için geçerli, sınırsız güven).
// 2) Client-scoped token (X-CEvT-Client-Token + X-CEvT-Token-Expires) — TIOTR
//    PHP'sinin sayfa yüklemesinde ağ I/O'suna girmeden ürettiği, tek client_id +
//    süre penceresine bağlı token; tarayıcı event'i doğrudan buraya atar. Bilinçli
//    gevşeme: bu token'ı ele geçiren biri KENDİ client_id'sine sahte event
//    enjekte edebilir ama başkasınınkini taklit edemez (secret olmadan doğru
//    token üretilemez) — bu yüzden yalnızca source=client ve purchase DIŞINDAKİ
//    event'ler için kabul ediliyor; Purchase (client kopyası dahil) ve server
//    kaynaklı her şey mutlak olarak tam-body HMAC gerektirir.
$signature = $_SERVER['HTTP_X_CEVT_SIGNATURE'] ?? '';
$clientToken = $_SERVER['HTTP_X_CEVT_CLIENT_TOKEN'] ?? '';
$tokenExpires = $_SERVER['HTTP_X_CEVT_TOKEN_EXPIRES'] ?? '';

$authOk = false;

if ($signature !== '') {
    $expected = hash_hmac('sha256', $rawBody, $secret);
    $authOk = hash_equals($expected, $signature);
} elseif ($clientToken !== '' && $tokenExpires !== '') {
    $canUseToken = $source === 'client' && $eventName !== 'purchase';
    $expiresInt = ctype_digit($tokenExpires) ? (int)$tokenExpires : 0;
    $withinWindow = $expiresInt >= time() && $expiresInt <= time() + 7200; // max 2 saat
    if ($canUseToken && $withinWindow) {
        $expectedToken = hash_hmac('sha256', $clientId . '|' . $expiresInt, $secret);
        $authOk = hash_equals($expectedToken, $clientToken);
    }
}

if (!$authOk) {
    respond(['ok' => false, 'error' => 'invalid_signature'], 401);
}

$record = [
    'event_id' => $eventId,
    'event_name' => $eventName,
    'occurred_at' => $occurredAt,
    'source' => $source,
    'user_id' => $event['user_id'] ?? null,
    'page_url' => $event['page_url'] ?? null,
    'value' => $event['value'] ?? null,
    'received_at' => date('c'),
];

$clientFile = $clientsDir . '/' . $clientId . '.json';

// Client dosyasına kilitli ekleme + event_id dedup (Purchase'ın client+server
// çift gönderiminde aynı kaydın iki kez düşmemesi için).
$fp = fopen($clientFile, 'c+');
if (!$fp) { respond(['ok' => false, 'error' => 'storage_error'], 500); }
flock($fp, LOCK_EX);
$raw = stream_get_contents($fp);
$events = json_decode($raw !== false && $raw !== '' ? $raw : '[]', true);
if (!is_array($events)) { $events = []; }

$duplicate = false;
foreach ($events as $e) {
    if (($e['event_id'] ?? null) === $eventId) { $duplicate = true; break; }
}

$isNewClient = !file_exists($clientFile) || $raw === '';

if (!$duplicate) {
    $events[] = $record;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($events, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
}
flock($fp, LOCK_UN);
fclose($fp);

if ($duplicate) {
    respond(['ok' => true, 'duplicate' => true]);
}

// Index'i kilitli güncelle (dosyanın tamamı okunur, ilgili giriş güncellenir/
// eklenir, tamamı geri yazılır — diğer alanlara dokunulmaz).
$ifp = fopen($indexFile, 'c+');
if (!$ifp) { respond(['ok' => false, 'error' => 'storage_error'], 500); }
flock($ifp, LOCK_EX);
$rawIndex = stream_get_contents($ifp);
$index = json_decode($rawIndex !== false && $rawIndex !== '' ? $rawIndex : '{}', true);
if (!is_array($index)) { $index = []; }

$entry = $index[$clientId] ?? [
    'client_id' => $clientId,
    'user_id' => null,
    'first_seen' => $record['occurred_at'],
    'event_count' => 0,
];
$entry['user_id'] = $record['user_id'] ?? $entry['user_id'];
$entry['last_seen'] = $record['occurred_at'];
$entry['event_count'] = ($entry['event_count'] ?? 0) + 1;
$index[$clientId] = $entry;

ftruncate($ifp, 0);
rewind($ifp);
fwrite($ifp, json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
fflush($ifp);
flock($ifp, LOCK_UN);
fclose($ifp);

respond(['ok' => true, 'new_client' => $isNewClient]);
