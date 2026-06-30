<?php
// Admiral AI — backend config.
// Storage lives OUTSIDE the web-served assets in ./storage (denied via .htaccess).
// No DB: data is kept in flock-guarded JSON files. Migrate to MySQL later
// without touching the frontend (the API contract stays the same).

define('STORAGE_DIR', __DIR__ . '/../storage');

// Roles, highest privilege first.
define('ROLES', ['owner', 'editor', 'viewer']);

// Ensure storage dir exists (created on first write at the host).
if (!is_dir(STORAGE_DIR)) {
  @mkdir(STORAGE_DIR, 0775, true);
}
