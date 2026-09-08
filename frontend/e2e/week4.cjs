// Run only against an isolated test environment: this scenario creates and deletes sample data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const base = process.env.WEEK4_E2E_URL || 'http://127.0.0.1:5184';
  const api = process.env.WEEK4_E2E_API || 'http://127.0.0.1:18084';
  const loginId = process.env.WEEK4_E2E_LOGIN_ID;
  const password = process.env.WEEK4_E2E_PASSWORD;
  assert(loginId && password, 'Set WEEK4_E2E_LOGIN_ID and WEEK4_E2E_PASSWORD for a disposable test account');
  const artifactDir = process.env.WEEK4_E2E_OUTPUT || '/tmp/week4-browser';
  await fs.mkdir(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = [];
  const failedResponses = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(api + '/api/') && r.status() >= 400) failedResponses.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  const checks = [];
  const check = label => { checks.push(label); console.log('PASS: ' + label); };
  try {
    await page.goto(base + '/login');
    await page.getByLabel('아이디', { exact: true }).fill(loginId);
    await page.getByLabel('비밀번호', { exact: true }).fill(password);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL(base + '/');
    await page.getByRole('region', { name: '만료 임박 키 목록' }).waitFor();
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const request = async (endpoint, method = 'GET', body) => {
      const response = await page.request.fetch(api + endpoint, { method, headers: { Authorization: 'Bearer ' + token }, ...(body ? { data: body } : {}) });
      assert.equal(response.status(), 200, endpoint + ': ' + await response.text());
      return (await response.json()).data;
    };
    const stamp = Date.now();
    const expires = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const key = await request('/api/keys', 'POST', { keyName: 'week4-browser-' + stamp, algorithm: 'AES', mode: 'GCM', keySize: 256, purpose: 'ENCRYPT', expireAt: expires });
    await request(`/api/keys/${key.keyUid}/status`, 'PATCH', { toStatus: 'ACTIVE', reason: '브라우저 수용 테스트' });
    await request(`/api/keys/${key.keyUid}/test/encrypt`, 'POST', { plaintext: 'week4 browser fixture' });
    check('실제 로그인 및 대시보드 진입');

    const title = '4주차 브라우저 공지 ' + stamp;
    const original = Buffer.from('암호화 첨부 원본 ' + stamp);
    await page.goto(base + '/notices/new');
    await page.getByLabel('제목', { exact: true }).fill(title);
    await page.getByLabel('본문', { exact: true }).fill('게시판과 대시보드 실제 서버 통합 검증');
    await page.getByRole('combobox', { name: '카테고리' }).click();
    await page.getByRole('option', { name: '공지사항', exact: true }).click();
    await page.locator('#notice-files').setInputFiles([
      { name: '검증.txt', mimeType: 'text/plain', buffer: original },
      { name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('second fixture') },
    ]);
    await page.getByTestId('notice-save-button').click();
    await page.waitForURL(/\/notices\/[0-9a-f-]{36}$/);
    const noticeUid = page.url().split('/').pop();
    await page.getByText('검증.txt', { exact: true }).waitFor();
    check('공지 작성 및 다중 첨부 업로드');
    const firstView = await request('/api/notices/' + noticeUid);
    await page.reload();
    await page.getByText('검증.txt', { exact: true }).waitFor();
    const secondView = await request('/api/notices/' + noticeUid);
    assert(secondView.viewCount > firstView.viewCount);
    const pendingDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '검증.txt 다운로드', exact: true }).click();
    const download = await pendingDownload;
    assert.equal(download.suggestedFilename(), '검증.txt');
    assert.deepEqual(await fs.readFile(await download.path()), original);
    check('조회수 증가 및 브라우저 다운로드 바이트 일치');
    await page.screenshot({ path: path.join(artifactDir, 'notice.png'), fullPage: true });

    await page.getByRole('button', { name: '수정', exact: true }).click();
    await page.getByLabel('제목', { exact: true }).fill(title + ' 수정');
    await page.getByTestId('notice-save-button').click();
    await page.getByText(title + ' 수정', { exact: true }).waitFor();
    const fileRow = page.getByRole('listitem').filter({ hasText: 'second.txt' });
    await fileRow.getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByText('second.txt', { exact: true }).waitFor({ state: 'detached' });
    check('공지 수정 및 첨부 개별 삭제');

    await page.goto(base + '/notices');
    await page.getByLabel('제목 검색').fill(title);
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await page.getByText(title + ' 수정', { exact: true }).waitFor();
    check('게시판 제목 검색');
    await page.goto(base + '/');
    await page.getByRole('region', { name: '만료 임박 키 목록' }).getByRole('button', { name: new RegExp(key.keyName) }).waitFor();
    const summary = await request('/api/dashboard/summary');
    const labels = [['전체 관리 키', summary.totalKeys], ['서비스 사용자', summary.totalUsers], ['전체 게시글', summary.totalNotices], ['무결성 위반', summary.integrityViolations]];
    for (const [label, value] of labels) {
      const card = page.locator('.dashboard-summary-card').filter({ hasText: label });
      assert.equal(await card.count(), 1);
      assert((await card.innerText()).split('\n').includes(String(value)), label + ' DB count');
    }
    const trend = await request('/api/dashboard/usage-trend');
    assert.equal(trend.points.length, 30);
    assert(trend.points.some(p => p.encryptions > 0));
    await page.getByRole('button', { name: '월', exact: true }).click();
    await page.getByRole('button', { name: '일', exact: true }).click();
    await page.getByRole('button', { name: title + ' 수정', exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifactDir, 'dashboard.png'), fullPage: true });
    check('4개 요약 카드 DB 일치·만료 임박 목록·사용 추이·최근 게시글');
    await page.getByRole('button', { name: title + ' 수정', exact: true }).click();
    await page.getByText('검증.txt', { exact: true }).waitFor();
    await page.getByRole('button', { name: '삭제', exact: true }).first().click();
    await page.waitForURL(base + '/notices');
    assert.equal((await request('/api/notices?title=' + encodeURIComponent(title))).totalElements, 0);
    check('대시보드에서 상세 이동·게시글 및 첨부 삭제');
    assert.equal((await request('/api/audit-logs/verify')).valid, true);
    assert.deepEqual(errors, []);
    assert.deepEqual(failedResponses, []);
    check('감사 체인 정상·브라우저 예외 및 API 오류 없음');
    await fs.writeFile(path.join(artifactDir, 'result.json'), JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
