<?php
// Admiral AI — API router. Single entrypoint: api/index.php?action=<name>
// Frontend and API share the origin, so no CORS needed.
require_once __DIR__ . '/lib.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {

  // Health check — used by the frontend to detect cloud vs solo mode.
  case 'ping':
    json_out(['ok' => true, 'service' => 'admiral-api', 'version' => '1.0']);

  // Create a new workspace; caller becomes owner.
  case 'create_workspace': {
    $in = input();
    $wsName = trim($in['name'] ?? '');
    $ownerName = trim($in['ownerName'] ?? '');
    if ($wsName === '' || $ownerName === '') fail('name and ownerName required');

    $wsId = gen_id('ws');
    $token = gen_token();

    update_json('workspaces', [], function ($all) use ($wsId, $wsName) {
      $all[$wsId] = ['id' => $wsId, 'name' => $wsName, 'createdAt' => date('c'), 'invites' => []];
      return $all;
    });
    $member = ['id' => gen_id('mbr'), 'token' => $token, 'wsId' => $wsId,
               'name' => $ownerName, 'role' => 'owner', 'joinedAt' => date('c')];
    update_json('members', [], function ($all) use ($token, $member) {
      $all[$token] = $member; return $all;
    });
    update_json('campaigns', [], function ($all) use ($wsId) {
      if (!isset($all[$wsId])) $all[$wsId] = [];
      return $all;
    });

    $ws = read_json('workspaces')[$wsId];
    json_out(['ok' => true, 'token' => $token,
              'workspace' => workspace_public($ws, 'owner'),
              'member' => public_member($member)]);
  }

  // Join an existing workspace with an invite code.
  case 'join': {
    $in = input();
    $code = strtoupper(trim($in['code'] ?? ''));
    $name = trim($in['name'] ?? '');
    if ($code === '' || $name === '') fail('code and name required');

    $workspaces = read_json('workspaces', []);
    $foundWs = null; $foundRole = null;
    foreach ($workspaces as $ws) {
      foreach (($ws['invites'] ?? []) as $c => $inv) {
        if (strtoupper($c) === $code && !empty($inv['active'])) {
          $foundWs = $ws; $foundRole = $inv['role']; break 2;
        }
      }
    }
    if (!$foundWs) fail('invalid or revoked code', 404);

    $token = gen_token();
    $member = ['id' => gen_id('mbr'), 'token' => $token, 'wsId' => $foundWs['id'],
               'name' => $name, 'role' => $foundRole, 'joinedAt' => date('c')];
    update_json('members', [], function ($all) use ($token, $member) {
      $all[$token] = $member; return $all;
    });
    json_out(['ok' => true, 'token' => $token,
              'workspace' => workspace_public($foundWs, $foundRole),
              'member' => public_member($member)]);
  }

  // Current session from token.
  case 'session': {
    $m = current_member();
    if (!$m) json_out(['ok' => true, 'authenticated' => false]);
    $workspaces = read_json('workspaces', []);
    $ws = $workspaces[$m['wsId']] ?? null;
    if (!$ws) json_out(['ok' => true, 'authenticated' => false]);
    json_out(['ok' => true, 'authenticated' => true,
              'workspace' => workspace_public($ws, $m['role']),
              'member' => public_member($m)]);
  }

  // Get campaigns for the member's workspace.
  case 'get_campaigns': {
    $m = require_member();
    $all = read_json('campaigns', []);
    json_out(['ok' => true, 'campaigns' => $all[$m['wsId']] ?? []]);
  }

  // Save campaigns (editor or owner).
  case 'save_campaigns': {
    $m = require_member();
    require_role($m, 'editor');
    $in = input();
    $camps = $in['campaigns'] ?? null;
    if (!is_array($camps)) fail('campaigns array required');
    update_json('campaigns', [], function ($all) use ($m, $camps) {
      $all[$m['wsId']] = $camps; return $all;
    });
    json_out(['ok' => true, 'saved' => count($camps)]);
  }

  // Create an invite code (owner only).
  case 'create_invite': {
    $m = require_member();
    require_role($m, 'owner');
    $in = input();
    $role = $in['role'] ?? 'viewer';
    if (!in_array($role, ['editor', 'viewer'], true)) fail('role must be editor or viewer');
    $code = gen_code();
    update_json('workspaces', [], function ($all) use ($m, $code, $role) {
      $all[$m['wsId']]['invites'][$code] = ['role' => $role, 'active' => true, 'createdAt' => date('c')];
      return $all;
    });
    json_out(['ok' => true, 'code' => $code, 'role' => $role]);
  }

  // List invite codes (owner only).
  case 'list_invites': {
    $m = require_member();
    require_role($m, 'owner');
    $ws = read_json('workspaces', [])[$m['wsId']] ?? ['invites' => []];
    $out = [];
    foreach (($ws['invites'] ?? []) as $code => $inv) {
      $out[] = ['code' => $code, 'role' => $inv['role'], 'active' => !empty($inv['active']), 'createdAt' => $inv['createdAt'] ?? null];
    }
    json_out(['ok' => true, 'invites' => $out]);
  }

  // Revoke an invite code (owner only).
  case 'revoke_invite': {
    $m = require_member();
    require_role($m, 'owner');
    $in = input();
    $code = $in['code'] ?? '';
    update_json('workspaces', [], function ($all) use ($m, $code) {
      if (isset($all[$m['wsId']]['invites'][$code])) $all[$m['wsId']]['invites'][$code]['active'] = false;
      return $all;
    });
    json_out(['ok' => true]);
  }

  // List members of the workspace (any member).
  case 'list_members': {
    $m = require_member();
    $members = read_json('members', []);
    $out = [];
    foreach ($members as $mem) {
      if ($mem['wsId'] === $m['wsId']) $out[] = public_member($mem);
    }
    json_out(['ok' => true, 'members' => $out, 'me' => $m['id']]);
  }

  default:
    fail('unknown action', 404);
}
