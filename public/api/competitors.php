<?php
// ADMIRA — Competitor API (Server-side storage)
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

$user = $_SESSION['user'];
$email = $user['email'];

$dataDir = __DIR__ . '/../../data';
$compFile = $dataDir . '/competitors_' . md5($email) . '.json';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

function getCompetitorsList(string $file): array {
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    return json_decode($raw ?: '[]', true) ?: [];
}

function saveCompetitorsList(string $file, array $list): void {
    file_put_contents($file, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($body)) { $body = []; }
    $action = $body['action'] ?? '';

    if ($action === 'get') {
        echo json_encode(['ok' => true, 'competitors' => getCompetitorsList($compFile)]);
        exit;
    }

    if ($action === 'save') {
        $competitors = $body['competitors'] ?? null;
        if (!is_array($competitors)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_data']);
            exit;
        }

        saveCompetitorsList($compFile, $competitors);
        echo json_encode(['ok' => true]);
        exit;
    }
}

http_response_code(404);
echo json_encode(['ok' => false, 'error' => 'not_found']);
