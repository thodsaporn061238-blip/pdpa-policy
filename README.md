# pdpa-policy

- `index.html` — นโยบายคุ้มครองข้อมูลส่วนบุคคล ร้านเด็กกินเส้น
- `snp-transport/` — ระบบขนส่ง SNP

## ย้ายไปทำงานในเครื่องใหม่

ต้องมี [Git](https://git-scm.com) และ [Node.js](https://nodejs.org) รุ่น 20 ขึ้นไปก่อน แล้ว

```bash
git clone https://github.com/thodsaporn061238-blip/pdpa-policy
cd pdpa-policy
bash setup.sh            # macOS / Linux
```

Windows (PowerShell):

```powershell
git clone https://github.com/thodsaporn061238-blip/pdpa-policy
cd pdpa-policy
powershell -ExecutionPolicy Bypass -File setup.ps1
```

สคริปต์จะดึงโค้ดล่าสุด ติดตั้งตัวทดสอบ ติดตั้ง Claude Code (ถ้ายังไม่มี) และรันทดสอบให้

## คำสั่ง

| คำสั่ง | ทำอะไร |
| --- | --- |
| `claude` | เริ่ม Claude Code ในโฟลเดอร์นี้ (อ่าน `CLAUDE.md` และดึงโค้ดล่าสุดให้อัตโนมัติ) |
| `npm start` | เปิดเว็บในเครื่องที่ http://localhost:8080 |
| `npm test` | ทดสอบหน้าเว็บบนจอขนาดมือถือ |

## ข้อควรรู้

ข้อมูลการจองในระบบขนส่งตอนนี้เก็บในเบราว์เซอร์ของแต่ละเครื่อง (localStorage) **ไม่ย้ายตามโค้ด** ก่อนย้ายเครื่องให้กด "ส่งออก CSV" ในหน้ารายการงานเก็บไว้
