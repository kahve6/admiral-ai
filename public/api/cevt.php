<?php
// ADMIRA — CEvT okuma API'si (ADMIRA UI'ı besler, oturum korumalı).
declare(strict_types=1);

session_set_cookie_params([
  'lifetime' => 60 * 60 * 24 * 30,
  'path' => '/',
  'httponly' => true,
  'samesite' => 'Lax',
]);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']);
    exit;
}

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$dataDir = __DIR__ . '/../../data';
$clientsDir = $dataDir . '/cevt/clients';
$indexFile = $dataDir . '/cevt/index.json';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($body)) { $body = []; }
$action = $body['action'] ?? '';

if ($action === 'list_clients') {
    $raw = file_exists($indexFile) ? file_get_contents($indexFile) : '{}';
    $index = json_decode($raw !== false && $raw !== '' ? $raw : '{}', true);
    if (!is_array($index)) { $index = []; }

    $clients = array_values($index);
    usort($clients, function ($a, $b) {
        return strcmp((string)($b['last_seen'] ?? ''), (string)($a['last_seen'] ?? ''));
    });

    respond(['ok' => true, 'clients' => $clients]);
}

if ($action === 'get_client') {
    $clientId = (string)($body['client_id'] ?? '');
    if (!preg_match('/^[a-f0-9-]{8,64}$/i', $clientId)) {
        respond(['ok' => false, 'error' => 'invalid_client_id'], 400);
    }
    $clientFile = $clientsDir . '/' . $clientId . '.json';
    if (!file_exists($clientFile)) {
        respond(['ok' => true, 'events' => []]);
    }
    $raw = file_get_contents($clientFile);
    $events = json_decode($raw !== false && $raw !== '' ? $raw : '[]', true);
    if (!is_array($events)) { $events = []; }

    usort($events, function ($a, $b) {
        return strcmp((string)($a['occurred_at'] ?? ''), (string)($b['occurred_at'] ?? ''));
    });

    respond(['ok' => true, 'events' => $events]);
}

respond(['ok' => false, 'error' => 'not_found'], 404);
