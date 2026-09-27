/**
 * 2Guide - Automated Security Verification: F12 Defense & Anti-Hack Shield
 */

const BASE_URL = 'http://localhost:4000';
const ADMIN_KEY = 'bql_sec_2026_x89a3f';
const EDITOR_KEY = 'editor_sec_2026_z91k4c';

async function runTests() {
  console.log('====================================================');
  console.log('BẮT ĐẦU KIỂM THỬ AN NINH F12 & BẢO VỆ DATABASE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} -> ${detail}`);
      failed++;
    }
  }

  // 1. KIỂM THỬ SHELL BẢO VỆ BQL (KHÔNG RÒ RỈ HTML MAP HOẶC SCRIPT CHO CLIENT KHI CHƯA NHẬP KEY)
  const resAdminShell = await fetch(`${BASE_URL}/quanly_bql_8869`);
  const textAdminShell = await resAdminShell.text();
  assert(resAdminShell.status === 200, 'GET /quanly_bql_8869 trả về 200 OK');
  assert(textAdminShell.includes('id="admin-auth-shell"'), 'Chứa màn hình khóa xác thực BQL');
  assert(!textAdminShell.includes('id="map"'), 'TUYỆT ĐỐI KHÔNG chứa thẻ <div id="map"> trong DOM ban đầu (F12 không thấy map)');
  assert(!textAdminShell.includes('id="admin-main-app"'), 'TUYỆT ĐỐI KHÔNG chứa <main id="admin-main-app"> trong DOM ban đầu');
  assert(!textAdminShell.includes('src="/js/admin.js"'), 'TUYỆT ĐỐI KHÔNG nạp script admin.js trong DOM ban đầu');
  assert(resAdminShell.headers.get('cache-control')?.includes('no-store'), 'Có header Cache-Control: no-store');

  // 2. KIỂM THỬ SHELL BẢO VỆ MAP STUDIO
  const resEditorShell = await fetch(`${BASE_URL}/editor_bql_7749`);
  const textEditorShell = await resEditorShell.text();
  assert(resEditorShell.status === 200, 'GET /editor_bql_7749 trả về 200 OK');
  assert(textEditorShell.includes('id="editor-auth-shell"'), 'Chứa màn hình khóa xác thực Editor');
  assert(!textEditorShell.includes('id="editor-map"'), 'TUYỆT ĐỐI KHÔNG chứa <div id="editor-map"> trong DOM ban đầu');
  assert(!textEditorShell.includes('id="editor-main-app"'), 'TUYỆT ĐỐI KHÔNG chứa <main id="editor-main-app"> trong DOM ban đầu');
  assert(!textEditorShell.includes('src="/js/editor.js"'), 'TUYỆT ĐỐI KHÔNG nạp script editor.js trong DOM ban đầu');

  // 3. KIỂM THỬ CHẶN ĐƯỜNG DẪN CŨ (404)
  const blockedPaths = ['/admin', '/quanly', '/index.html', '/editor', '/editor.html'];
  for (const p of blockedPaths) {
    const res = await fetch(`${BASE_URL}${p}`);
    assert(res.status === 404, `Chặn đường dẫn công khai ${p} với mã 404`);
  }

  // 4. KIỂM THỬ BẢO VỆ TẤT CẢ API DATABASE KHỎI HACKER DEVTOOLS
  const unauthorizedProbes = [
    { method: 'GET', url: '/api/hubs', desc: 'Đọc danh sách Hubs không key' },
    { method: 'GET', url: '/api/groups', desc: 'Đọc danh sách đoàn & QR token không key' },
    { method: 'POST', url: '/api/groups/create', body: { groupName: 'Hacker Group' }, desc: 'Tạo đoàn ma can thiệp database' },
    { method: 'POST', url: '/api/groups/grp_fake/end', desc: 'Hủy đoàn không có key' },
    { method: 'POST', url: '/api/editor/save', body: { pois: [] }, desc: 'Phá hoại ghi đè bản đồ không có key' },
    { method: 'POST', url: '/api/admin/broadcast', body: { message: 'Fake alert' }, desc: 'Chiếm sóng loa phát thanh không key' },
    { method: 'POST', url: '/api/hubs/shift-battery', body: { hubId: 'NEU001', batteryLevel: 1 }, desc: 'Sửa pin ca không có key' },
    { method: 'POST', url: '/api/admin/unlock-dashboard', body: { adminKey: 'wrong_password' }, desc: 'Thử bẻ khóa Dashboard BQL với pass sai' },
    { method: 'POST', url: '/api/editor/unlock-dashboard', body: { editorKey: 'wrong_password' }, desc: 'Thử bẻ khóa Map Studio với pass sai' }
  ];

  for (const probe of unauthorizedProbes) {
    const opts = {
      method: probe.method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (probe.body) opts.body = JSON.stringify(probe.body);

    const res = await fetch(`${BASE_URL}${probe.url}`, opts);
    assert(res.status === 401, `CHẶN 401: ${probe.desc} (${probe.method} ${probe.url})`);
  }

  // 5. KIỂM THỬ XÁC THỰC THÀNH CÔNG VỚI ĐÚNG SECRET KEY
  // BQL Unlock
  const resAdminUnlock = await fetch(`${BASE_URL}/api/admin/unlock-dashboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: ADMIN_KEY })
  });
  assert(resAdminUnlock.status === 200, 'POST /api/admin/unlock-dashboard trả về 200 khi đúng key');
  const jsonAdminUnlock = await resAdminUnlock.json();
  assert(jsonAdminUnlock.success === true, 'unlock-dashboard báo success: true');
  assert(jsonAdminUnlock.html.includes('id="map"') && jsonAdminUnlock.html.includes('id="admin-main-app"'), 'Server trả về đúng mã nguồn Dashboard & Map sau khi xác thực');

  // Đọc Hubs với Secret Key
  const resHubs = await fetch(`${BASE_URL}/api/hubs`, {
    headers: { 'X-Admin-Secret': ADMIN_KEY }
  });
  assert(resHubs.status === 200, 'GET /api/hubs trả về 200 khi có X-Admin-Secret');
  const jsonHubs = await resHubs.json();
  assert(Array.isArray(jsonHubs.data) && jsonHubs.data.length === 26, `Nạp đủ ${jsonHubs.data?.length} / 26 thiết bị Hub`);

  // Đọc Groups với Secret Key
  const resGroups = await fetch(`${BASE_URL}/api/groups`, {
    headers: { 'X-Admin-Secret': ADMIN_KEY }
  });
  assert(resGroups.status === 200, 'GET /api/groups trả về 200 khi có X-Admin-Secret');
  const jsonGroups = await resGroups.json();
  assert(Array.isArray(jsonGroups.data), 'Nạp danh sách đoàn khách thành công');

  // Map Studio Unlock
  const resEditorUnlock = await fetch(`${BASE_URL}/api/editor/unlock-dashboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editorKey: EDITOR_KEY })
  });
  assert(resEditorUnlock.status === 200, 'POST /api/editor/unlock-dashboard trả về 200 khi đúng key');
  const jsonEditorUnlock = await resEditorUnlock.json();
  assert(jsonEditorUnlock.success === true && jsonEditorUnlock.html.includes('id="editor-map"'), 'Server trả về đúng mã nguồn Studio Biên Tập sau khi xác thực');

  // 6. KIỂM THỬ CỔNG KHÁCH THAM QUAN
  const resUser = await fetch(`${BASE_URL}/user`);
  const textUser = await resUser.text();
  assert(resUser.status === 200, 'GET /user trả về 200 cho khách tham quan');
  assert(!textUser.includes(ADMIN_KEY), 'Cổng /user TUYỆT ĐỐI KHÔNG chứa mã bí mật Admin');
  assert(!textUser.includes(EDITOR_KEY), 'Cổng /user TUYỆT ĐỐI KHÔNG chứa mã bí mật Editor');

  console.log('\n====================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('>>> HOÀN TOÀN KHẮC PHỤC LỖ HỔNG F12: KẺ GIAN XÓA DOM KHÔNG THỂ THẤY MAP VÀ KHÔNG THỂ HACK DATABASE! <<<');
  }
}

runTests().catch(console.error);
