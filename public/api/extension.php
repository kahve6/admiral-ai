<?php
// ADMIRA — Chrome Eklentisi API Uç Noktası
declare(strict_types=1);

session_set_cookie_params([
  'lifetime' => 60 * 60 * 24 * 30,
  'path' => '/',
  'httponly' => true,
  'samesite' => 'Lax',
]);
session_start();
header('Content-Type: application/json; charset=utf-8');

// CORS Ayarları (Chrome Eklentisinin istek atabilmesi için)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (strpos($origin, 'chrome-extension://') === 0) {
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Headers: Content-Type");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Credentials: true");
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if (empty($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']);
    exit;
}

$user = $_SESSION['user'];
$email = $user['email'];

$dataDir = __DIR__ . '/../../data';
$adsFile = $dataDir . '/ads_' . md5($email) . '.json';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

function getExistingAds(string $file): array {
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    return json_decode($raw ?: '[]', true) ?: [];
}

function saveAdsList(string $file, array $list): void {
    file_put_contents($file, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function buildAdRecord(array $adData): array {
    return [
        'id' => 'ad_' . Date('U') . '_' . bin2hex(random_bytes(3)),
        'url' => $adData['url'],
        'libraryId' => $adData['libraryId'] ?? null,
        'competitor' => $adData['advertiserName'] ?? null,
        'notes' => $adData['adCopy'] ?? null,
        'mediaUrl' => $adData['mediaUrl'] ?? null,
        'mediaType' => $adData['mediaType'] ?? null,
        'ctaText' => $adData['ctaText'] ?? null,
        'destinationLabel' => $adData['destinationLabel'] ?? null,
        'landingUrl' => $adData['landingUrl'] ?? null,
        'activeStatus' => $adData['activeStatus'] ?? null,
        'startDate' => $adData['startDate'] ?? null,
        'createdAt' => date('c')
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($body)) { $body = []; }
    $action = $body['action'] ?? '';

    if ($action === 'get_ads') {
        echo json_encode(['ok' => true, 'ads' => getExistingAds($adsFile)]);
        exit;
    }

    if ($action === 'save_scraped_ad') {
        $adData = $body['adData'] ?? null;
        if (!$adData || empty($adData['url'])) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'missing_ad_data']);
            exit;
        }

        $existingAds = getExistingAds($adsFile);
        $newAd = buildAdRecord($adData);
        $existingAds[] = $newAd;
        saveAdsList($adsFile, $existingAds);

        echo json_encode(['ok' => true, 'ad' => $newAd]);
        exit;
    }

    if ($action === 'save_scraped_ads') {
        $adsData = $body['adsData'] ?? null;
        if (!is_array($adsData) || count($adsData) === 0) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'missing_ads_data']);
            exit;
        }

        $existingAds = getExistingAds($adsFile);

        // Aynı reklamı (Library ID) tekrar tekrar eklememek için mevcut
        // kayıtlardaki libraryId'leri topluyoruz. Bir rakibin tüm reklam
        // listesi taranırken kullanıcı sayfayı birkaç kez tarayabilir —
        // bu durumda zaten kayıtlı olanlar atlanır.
        $knownLibraryIds = [];
        foreach ($existingAds as $ad) {
            if (!empty($ad['libraryId'])) {
                $knownLibraryIds[$ad['libraryId']] = true;
            }
        }

        $savedAds = [];
        $skipped = 0;
        foreach ($adsData as $adData) {
            if (!is_array($adData) || empty($adData['url'])) {
                continue;
            }
            $libraryId = $adData['libraryId'] ?? null;
            if (!empty($libraryId) && isset($knownLibraryIds[$libraryId])) {
                $skipped++;
                continue;
            }
            $newAd = buildAdRecord($adData);
            $existingAds[] = $newAd;
            $savedAds[] = $newAd;
            if (!empty($libraryId)) {
                $knownLibraryIds[$libraryId] = true;
            }
        }

        if (count($savedAds) > 0) {
            saveAdsList($adsFile, $existingAds);
        }

        echo json_encode(['ok' => true, 'saved' => count($savedAds), 'skipped' => $skipped, 'ads' => $savedAds]);
        exit;
    }

    if ($action === 'add_manual_ad') {
        $url = trim((string)($body['url'] ?? ''));
        $competitor = trim((string)($body['competitor'] ?? ''));
        $notes = trim((string)($body['notes'] ?? ''));

        if ($url === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'missing_url']);
            exit;
        }

        $existingAds = getExistingAds($adsFile);
        $newAd = [
            'id' => 'ad_' . Date('U') . '_' . bin2hex(random_bytes(3)),
            'url' => $url,
            'competitor' => $competitor !== '' ? $competitor : null,
            'notes' => $notes !== '' ? $notes : null,
            'mediaUrl' => '',
            'activeStatus' => 'Bilinmiyor',
            'startDate' => 'Bilinmiyor',
            'createdAt' => date('c')
        ];
        $existingAds[] = $newAd;
        saveAdsList($adsFile, $existingAds);

        echo json_encode(['ok' => true, 'ad' => $newAd]);
        exit;
    }

    if ($action === 'delete_ad') {
        $id = $body['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'missing_id']);
            exit;
        }

        $existingAds = getExistingAds($adsFile);
        $filtered = [];
        $found = false;
        foreach ($existingAds as $ad) {
            if ($ad['id'] === $id) {
                $found = true;
            } else {
                $filtered[] = $ad;
            }
        }

        if ($found) {
            saveAdsList($adsFile, $filtered);
            echo json_encode(['ok' => true]);
        } else {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'ad_not_found']);
        }
        exit;
    }
}

http_response_code(404);
echo json_encode(['ok' => false, 'error' => 'not_found']);
