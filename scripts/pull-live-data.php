<?php
/**
 * ADMIRA — canlı veriyi lokale çek (TEK YÖNLÜ: sadece indirir, asla yüklemez).
 *
 * git repo'da data/*.json hiç tutulmuyor (.gitignore), o yüzden "git pull"
 * canlıdaki gerçek rakip/reklam verisini hiç getirmez. Lokalde geliştirmeye
 * başlamadan önce bu script'i çalıştırıp canlıdaki güncel veriyle çalışmak,
 * mockup veriyle uğraşmaktan daha isabetli sonuç verir.
 *
 * Kullanım:  php scripts/pull-live-data.php
 * Ayarlar:   repo kökündeki .ftp-sync.json'dan okunur (git'e dahil değil —
 *            şablon için .ftp-sync.example.json'a bak).
 */
declare(strict_types=1);

$root = dirname(__DIR__);
$configPath = $root . '/.ftp-sync.json';

if (!file_exists($configPath)) {
    fwrite(STDERR, "Hata: .ftp-sync.json bulunamadı. Örnek için .ftp-sync.example.json'a bak.\n");
    exit(1);
}

$config = json_decode((string)file_get_contents($configPath), true);
if (!is_array($config) || empty($config['host']) || empty($config['user']) || !isset($config['pass'])) {
    fwrite(STDERR, "Hata: .ftp-sync.json eksik/bozuk (host/user/pass gerekli).\n");
    exit(1);
}

if (!function_exists('ftp_connect')) {
    fwrite(STDERR, "Hata: PHP'nin ftp eklentisi (php_ftp) etkin değil.\n");
    exit(1);
}

$remoteDir = trim((string)($config['remoteDataDir'] ?? 'data'), '/');
$localDataDir = $root . '/data';
if (!is_dir($localDataDir)) {
    mkdir($localDataDir, 0755, true);
}

echo "→ {$config['host']} adresine bağlanılıyor...\n";
$conn = ftp_connect($config['host'], 21, 10);
if (!$conn) {
    fwrite(STDERR, "Hata: FTP sunucusuna bağlanılamadı.\n");
    exit(1);
}

if (!@ftp_login($conn, $config['user'], $config['pass'])) {
    fwrite(STDERR, "Hata: FTP girişi başarısız (kullanıcı adı/şifre kontrol et).\n");
    exit(1);
}

ftp_pasv($conn, true);

// FTP hesabı zaten .../admira/ köküne chroot'lu — uzak dizin bu yüzden
// sadece "data" (mutlak değil, hesabın kendi kökünden göreli).
if (!@ftp_chdir($conn, $remoteDir)) {
    echo "Not: Canlıda '{$remoteDir}' dizini henüz yok (ilk deploy yapılmamış olabilir). Çekilecek veri yok, çıkılıyor.\n";
    ftp_close($conn);
    exit(0);
}

$entries = ftp_nlist($conn, '.');
if ($entries === false) {
    fwrite(STDERR, "Hata: Uzak dizin listelenemedi.\n");
    ftp_close($conn);
    exit(1);
}

// Sadece gerçek iş verisini (rakip/reklam) çekiyoruz — users.json'u kasıtlı
// atlıyoruz: lokal test hesaplarının üzerine canlı şifre hash'lerini yazmak
// istemeyiz, o dosya lokalde kendi haline bırakılır.
$wanted = [];
foreach ($entries as $entry) {
    $name = basename($entry);
    if (preg_match('/^(ads_|competitors_).*\.json$/', $name)) {
        $wanted[] = $name;
    }
}

if (!$wanted) {
    echo "Canlıda henüz rakip/reklam verisi yok (data/ boş). Çekilecek bir şey bulunamadı.\n";
    ftp_close($conn);
    exit(0);
}

$pulled = 0;
foreach ($wanted as $name) {
    $localPath = $localDataDir . '/' . $name;
    if (@ftp_get($conn, $localPath, $name, FTP_BINARY)) {
        $size = filesize($localPath);
        echo "  ✓ {$name} (" . number_format((float)$size / 1024, 1) . " KB)\n";
        $pulled++;
    } else {
        fwrite(STDERR, "  ✗ {$name} indirilemedi\n");
    }
}

ftp_close($conn);

echo "\n{$pulled} dosya lokale çekildi (data/). users.json kasıtlı olarak atlandı.\n";
echo "Hatırlatma: bu script tek yönlü — hiçbir şeyi canlıya GERİ GÖNDERMEZ.\n";
