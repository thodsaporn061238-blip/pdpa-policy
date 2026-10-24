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

async function openPage(path) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
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
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\nไม่ผ่าน ${failed} ข้อ` : '\nผ่านทั้งหมด');
process.exit(failed ? 1 : 0);
