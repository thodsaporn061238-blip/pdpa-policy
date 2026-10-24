// ทดสอบหน้าเว็บบนมือถือ (390px) กับ Firebase emulator: npm test
// (npm test เปิด emulator ของ database และ auth ให้ก่อน แล้วค่อยรันไฟล์นี้)
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { startServer } from '../scripts/serve.mjs';

const OWNER = { email: 'thodsaporn061238@gmail.com', password: 'test-owner-pass' };
const STRANGER = { email: 'stranger@example.com', password: 'test-stranger-pass' };
const DB = 'http://127.0.0.1:9000';
const NS = '?ns=send-an-invoice-to-snp-default-rtdb';

const server = await startServer(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers' ? { executablePath: '/opt/pw-browsers/chromium' } : {},
);
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'}  ${msg}`); if (!ok) failed++; };

// ล้างข้อมูลใน emulator และสร้างบัญชีทดสอบ
await fetch(`${DB}/.json${NS}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
await fetch('http://127.0.0.1:9099/emulator/v1/projects/send-an-invoice-to-snp/accounts', { method: 'DELETE' });
for (const u of [OWNER, STRANGER]) {
  await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...u, returnSecureToken: true }),
  });
}

// แต่ละ context = ผู้ใช้คนละเครื่อง; Firebase SDK โหลดจาก node_modules แทน gstatic
async function newUser() {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.addInitScript(() => { window.SNP_EMULATOR = { db: 9000, auth: 9099 }; });
  await context.route('https://www.gstatic.com/firebasejs/12.2.1/*', async route => {
    const file = new URL(route.request().url()).pathname.split('/').pop();
    route.fulfill({ contentType: 'text/javascript', body: await readFile(`node_modules/firebase/${file}`) });
  });
  return context;
}
async function openPage(context, path) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(base + path);
  return { page, errors };
}
async function login(page, u) {
  await page.fill('#loginForm [name=user]', u.email);
  await page.fill('#loginForm [name=pass]', u.password);
  await page.click('#loginForm button');
}
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= 390);

try {
  {
    const ctx = await newUser();
    const { page, errors } = await openPage(ctx, '/');
    check(await page.title() !== '', 'หน้านโยบาย PDPA เปิดได้');
    check(await noHScroll(page), 'หน้านโยบายไม่เลื่อนแนวนอน');
    check(errors.length === 0, `หน้านโยบายไม่มี error ${errors.join(' ')}`);
  }

  // ---- พนักงาน ----
  const staff = await newUser();
  const { page, errors } = await openPage(staff, '/snp-transport/');
  await page.waitForSelector('#loginView:not([hidden])');
  check(await page.isHidden('#adminNav'), 'ยังไม่ล็อกอินไม่เห็นเมนูพนักงาน');
  await login(page, STRANGER);
  await page.waitForFunction(() => document.querySelector('#loginError').textContent.includes('ยังไม่มีสิทธิ์'));
  check(await page.isHidden('#adminNav'), 'บัญชีที่ไม่มีสิทธิ์เข้าระบบไม่ได้');
  await login(page, OWNER);
  await page.waitForSelector('#adminNav:not([hidden])');
  check(true, 'เจ้าของระบบล็อกอินได้');

  await page.fill('[name=sName]', 'ผู้ส่งทดสอบ');
  await page.fill('[name=sPhone]', '0812345678');
  await page.fill('[name=sAddr]', 'ที่อยู่รับ');
  await page.fill('[name=rName]', 'ผู้รับทดสอบ');
  await page.fill('[name=rPhone]', '0898765432');
  await page.fill('[name=rAddr]', 'ที่อยู่ส่ง');
  await page.fill('[name=km]', '12');
  await page.check('[name=fragile]');
  check(await page.textContent('#quoteAmt') === '฿166', 'คำนวณค่าส่ง มอเตอร์ไซค์ 12 กม. + ของแตกง่าย = ฿166');
  await page.check('[name=consent]');
  await page.click('#bookForm button[type=submit]');
  await page.waitForSelector('#bookDone:not([hidden])');
  const tno = await page.textContent('#doneTno');
  check(/^SNP\d{10}$/.test(tno), `จองสำเร็จ ได้เลขติดตาม ${tno}`);
  const saved = await (await fetch(`${DB}/snpTransport/jobs/${tno}.json${NS}`, { headers: { Authorization: 'Bearer owner' } })).json();
  check(saved?.sender?.name === 'ผู้ส่งทดสอบ', 'งานถูกบันทึกลงฐานข้อมูลออนไลน์');
  await page.click('#viewTno');
  check(await page.textContent('#trackResult .badge') === 'รับงานแล้ว', 'ค้นหาเลขติดตามเจอ');
  await page.click('[data-tab=jobs]');
  await page.click('[data-act=next]');
  await page.waitForFunction(() => document.querySelector('#jobList .badge')?.textContent === 'เข้ารับของแล้ว');
  check(true, 'เลื่อนสถานะงานได้');

  // ลูกค้า + งานที่มีรถ ตู้ แท็ก
  await page.click('[data-tab=customers]');
  await page.fill('[name=cname]', 'บริษัท ทดสอบ');
  await page.click('#custForm button');
  await page.waitForSelector('#custList [data-show=price]');
  await page.uncheck('[data-show=price]');
  await page.waitForFunction(() => !document.querySelector('#custList [data-show=price]').checked);
  const customerUrl = await page.getAttribute('#custList a', 'href');
  check(/\?customer=[A-Z0-9]{12}$/.test(customerUrl), 'สร้างลิงก์ลูกค้าได้');
  await page.click('[data-tab=book]');
  await page.click('#newBooking');
  await page.selectOption('#bookForm [name=customerId]', { label: 'บริษัท ทดสอบ' });
  await page.fill('[name=sName]', 'ผู้ส่ง'); await page.fill('[name=sPhone]', '0811111111'); await page.fill('[name=sAddr]', 'ก');
  await page.fill('[name=rName]', 'ผู้รับ'); await page.fill('[name=rPhone]', '0822222222'); await page.fill('[name=rAddr]', 'ข');
  await page.check('#bookForm [name=vehicle][value=truck6]');
  await page.fill('#bookForm [name=plate]', '70-1234');
  await page.fill('#bookForm [name=driver]', 'สมศักดิ์');
  await page.fill('#bookForm [data-cno]', 'abcu1234567');
  await page.fill('#bookForm [data-ctags]', 'TAG001, TAG002\nTAG003');
  await page.check('[name=consent]');
  await page.click('#bookForm button[type=submit]');
  await page.waitForSelector('#bookDone:not([hidden])');
  const tno2 = await page.textContent('#doneTno');
  await page.click('[data-tab=track]');
  await page.fill('#trackInput', 'tag002');
  await page.click('#trackForm button');
  const hit = await page.textContent('#trackResult');
  check(hit.includes('ABCU1234567') && hit.includes('70-1234') && hit.includes('รับงานแล้ว'), 'ค้นเลขแท็กเจอตู้ รถ และสถานะ');
  await page.click('[data-tab=jobs]');
  await page.click(`[data-act=edit][data-tno=${tno2}]`);
  await page.fill('#editForm [data-ctags]', 'TAG001 TAG002 TAG003 TAG999');
  await page.click('#editForm button[value=save]');
  await page.waitForFunction(() => document.querySelector('#jobList').textContent.includes('4 แท็ก'));
  await page.click('[data-tab=track]');
  await page.fill('#trackInput', 'TAG999');
  await page.click('#trackForm button');
  check((await page.textContent('#trackResult')).includes('ABCU1234567'), 'แก้เลขแท็กหลังจองแล้วค้นเจอ');
  check(await noHScroll(page), 'หน้าพนักงานไม่เลื่อนแนวนอน');

  // ---- ลูกค้า (อีกเครื่อง ไม่ได้ล็อกอิน) ----
  const cust = await newUser();
  const path = new URL(customerUrl).pathname + new URL(customerUrl).search;
  const { page: cp, errors: cErrors } = await openPage(cust, path);
  await cp.waitForSelector('#customerView:not([hidden])');
  check(await cp.isHidden('#adminNav'), 'หน้าลูกค้าไม่เห็นเมนูพนักงาน');
  await cp.fill('#custSearch', 'TAG999');
  await cp.click('#custSearchForm button');
  const r = await cp.textContent('#custResult');
  check(r.includes('ABCU1234567') && r.includes('70-1234'), 'ลูกค้าอีกเครื่องค้นเลขแท็กเจอตู้และรถ');
  check(!(await cp.textContent('#customerView')).includes('ค่าส่ง'), 'ลูกค้าไม่เห็นค่าส่งเมื่อปิดไว้');
  check(await cp.locator('#custJobs .list-item').count() === 1, 'ลูกค้าเห็นเฉพาะงานของตัวเอง');
  check(await noHScroll(cp), 'หน้าลูกค้าไม่เลื่อนแนวนอน');
  const code = new URL(customerUrl).searchParams.get('customer');
  const portal = await (await fetch(`${DB}/snpTransport/portal/${code}.json${NS}`)).json();
  const pj = Object.values(portal.jobs)[0];
  check(!('price' in pj) && !('cod' in pj) && pj.containers?.length === 1, 'ข้อมูลที่ปิดไว้ไม่ถูกส่งไปถึงลูกค้าเลย (ไม่ใช่แค่ซ่อนบนจอ)');
  const anon = await fetch(`${DB}/snpTransport/jobs.json${NS}`);
  check(anon.status === 401, `คนนอกอ่านข้อมูลงานทั้งหมดตรง ๆ ไม่ได้ (HTTP ${anon.status})`);
  const anonList = await fetch(`${DB}/snpTransport/portal.json${NS}`);
  check(anonList.status === 401, `คนนอกดูรายชื่อลิงก์ลูกค้าทั้งหมดไม่ได้ (HTTP ${anonList.status})`);

  // พนักงานเปลี่ยนสถานะ → ลูกค้าเห็นทันทีโดยไม่ต้องรีเฟรช
  await page.click('[data-tab=jobs]');
  await page.click(`[data-act=next][data-tno=${tno2}]`);
  await cp.waitForFunction(() => document.querySelector('#custJobs .badge')?.textContent === 'เข้ารับของแล้ว', null, { timeout: 10000 });
  check(true, 'พนักงานเปลี่ยนสถานะแล้วลูกค้าเห็นทันที');

  // ปิดลิงก์ → ลูกค้าเปิดไม่ได้
  await page.click('[data-tab=customers]');
  await page.uncheck('[data-cfg=enabled]');
  await cp.waitForFunction(() => document.querySelector('#pageTitle').textContent === 'ลิงก์นี้ใช้ไม่ได้', null, { timeout: 10000 });
  check(true, 'ปิดลิงก์ลูกค้าแล้วเปิดไม่ได้');
  check(errors.length === 0, `หน้าพนักงานไม่มี error ${errors.join(' ')}`);
  check(cErrors.length === 0, `หน้าลูกค้าไม่มี error ${cErrors.join(' ')}`);

  // ---- ย้ายข้อมูลเก่าจากเบราว์เซอร์ขึ้นระบบ ----
  const legacy = await newUser();
  await legacy.addInitScript(() => {
    if (localStorage.getItem('snp-legacy-seeded')) return;
    localStorage.setItem('snp-legacy-seeded', '1');
    localStorage.setItem('snp-transport-jobs', JSON.stringify([{
      tno: 'SNP2601010001', createdAt: '2026-01-01T00:00:00.000Z', customerId: '',
      sender: { name: 'งานเก่า', phone: '0800000000', addr: 'ก' }, receiver: { name: 'ผู้รับเก่า', phone: '0800000001', addr: 'ข' },
      vehicle: 'bike', km: 5, kg: 1, fragile: false, containers: [], cod: 0, date: '2026-01-01', slot: '08:00–12:00',
      note: '', price: 60, status: 'booked', history: [{ status: 'booked', at: '2026-01-01T00:00:00.000Z' }],
    }]));
  });
  const { page: lp } = await openPage(legacy, '/snp-transport/');
  await lp.waitForSelector('#loginView:not([hidden])');
  await login(lp, OWNER);
  await lp.waitForSelector('#migrateCard:not([hidden])');
  await lp.click('#migrateBtn');
  await lp.waitForSelector('#migrateCard[hidden]', { state: 'attached' });
  await lp.click('[data-tab=jobs]');
  check((await lp.textContent('#jobList')).includes('SNP2601010001'), 'ย้ายงานเก่าจากเบราว์เซอร์ขึ้นระบบได้');
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\nไม่ผ่าน ${failed} ข้อ` : '\nผ่านทั้งหมด');
process.exit(failed ? 1 : 0);
