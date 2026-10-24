// ทดสอบหน้าเว็บบนมือถือ (390px): npm test
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve.mjs';

const server = await startServer(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers' ? { executablePath: '/opt/pw-browsers/chromium' } : {},
);
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'}  ${msg}`); if (!ok) failed++; };

// ใช้ context เดียวกันทุกหน้า เพื่อให้หน้าลูกค้าเห็นข้อมูลที่หน้าพนักงานบันทึกไว้
const context = await browser.newContext({ viewport: { width: 390, height: 900 } });

async function openPage(path) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + path);
  return { page, errors };
}

try {
  {
    const { page, errors } = await openPage('/');
    check(await page.title() !== '', 'หน้านโยบาย PDPA เปิดได้');
    check(await page.evaluate(() => document.documentElement.scrollWidth) <= 390, 'หน้านโยบายไม่เลื่อนแนวนอน');
    check(errors.length === 0, `หน้านโยบายไม่มี error ${errors.join(' ')}`);
  }
  {
    const { page, errors } = await openPage('/snp-transport/');
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
    const tno = await page.textContent('#doneTno');
    check(/^SNP\d{10}$/.test(tno), `จองสำเร็จ ได้เลขติดตาม ${tno}`);
    await page.click('#viewTno');
    check(await page.textContent('#trackResult .badge') === 'รับงานแล้ว', 'ค้นหาเลขติดตามเจอ');
    await page.click('[data-tab=jobs]');
    await page.click('[data-act=next]');
    check(await page.textContent('#jobList .badge') === 'เข้ารับของแล้ว', 'เลื่อนสถานะงานได้');
    check(await page.evaluate(() => document.documentElement.scrollWidth) <= 390, 'ระบบขนส่งไม่เลื่อนแนวนอน');
    check(errors.length === 0, `ระบบขนส่งไม่มี error ${errors.join(' ')}`);
  }
  let customerUrl;
  {
    const { page, errors } = await openPage('/snp-transport/');
    page.on('dialog', d => d.accept());
    // เพิ่มลูกค้า แล้วปิดไม่ให้เห็นค่าส่ง
    await page.click('[data-tab=customers]');
    await page.fill('[name=cname]', 'บริษัท ทดสอบ');
    await page.click('#custForm button');
    await page.uncheck('[data-show=price]');
    customerUrl = await page.getAttribute('#custList a', 'href');
    check(/\?customer=[A-Z0-9]{8}$/.test(customerUrl), 'สร้างลิงก์ลูกค้าได้');
    // จองงานของลูกค้า พร้อมรถ ตู้ และแท็ก
    await page.click('[data-tab=book]');
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
    // ค้นหาด้วยเลขแท็ก
    await page.click('[data-tab=track]');
    await page.fill('#trackInput', 'tag002');
    await page.click('#trackForm button');
    const hit = await page.textContent('#trackResult');
    check(hit.includes('ABCU1234567') && hit.includes('70-1234') && hit.includes('รับงานแล้ว'), 'ค้นเลขแท็กเจอตู้ รถ และสถานะ');
    // แก้แท็กหลังจอง
    await page.click('[data-tab=jobs]');
    await page.click('[data-act=edit]');
    await page.fill('#editForm [data-ctags]', 'TAG001 TAG002 TAG003 TAG999');
    await page.click('#editForm button[value=save]');
    await page.click('[data-tab=track]');
    await page.fill('#trackInput', 'TAG999');
    await page.click('#trackForm button');
    check((await page.textContent('#trackResult')).includes('ABCU1234567'), 'แก้เลขแท็กหลังจองแล้วค้นเจอ');
    check(errors.length === 0, `หน้าพนักงานไม่มี error ${errors.join(' ')}`);
  }
  {
    const { page, errors } = await openPage(new URL(customerUrl).pathname + new URL(customerUrl).search);
    check(await page.isHidden('#adminNav'), 'หน้าลูกค้าไม่เห็นเมนูพนักงาน');
    await page.fill('#custSearch', 'TAG003');
    await page.click('#custSearchForm button');
    const r = await page.textContent('#custResult');
    check(r.includes('ABCU1234567') && r.includes('70-1234'), 'ลูกค้าค้นเลขแท็กเจอตู้และรถ');
    check(!(await page.textContent('#customerView')).includes('ค่าส่ง'), 'ลูกค้าไม่เห็นค่าส่งเมื่อปิดไว้');
    check(await page.locator('#custJobs .list-item').count() === 1, 'ลูกค้าเห็นเฉพาะงานของตัวเอง');
    check(await page.evaluate(() => document.documentElement.scrollWidth) <= 390, 'หน้าลูกค้าไม่เลื่อนแนวนอน');
    check(errors.length === 0, `หน้าลูกค้าไม่มี error ${errors.join(' ')}`);
  }
  {
    const { page } = await openPage('/snp-transport/');
    await page.click('[data-tab=customers]');
    await page.uncheck('[data-cfg=enabled]');
    const { page: cp } = await openPage(new URL(customerUrl).pathname + new URL(customerUrl).search);
    check(await cp.textContent('#pageTitle') === 'ลิงก์นี้ใช้ไม่ได้', 'ปิดลิงก์ลูกค้าแล้วเปิดไม่ได้');
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\nไม่ผ่าน ${failed} ข้อ` : '\nผ่านทั้งหมด');
process.exit(failed ? 1 : 0);
