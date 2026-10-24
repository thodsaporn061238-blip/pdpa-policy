# pdpa-policy

- `index.html` — นโยบายคุ้มครองข้อมูลส่วนบุคคล ร้านเด็กกินเส้น
- `snp-transport/` — ระบบขนส่ง SNP

## ย้ายไปทำงานในเครื่องใหม่

ต้องมี [Git](https://git-scm.com), [Node.js](https://nodejs.org) รุ่น 20 ขึ้นไป และ [Java](https://adoptium.net) รุ่น 11 ขึ้นไป (ใช้รัน Firebase emulator ตอนทดสอบ) ก่อน แล้ว

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
| `npm test` | ทดสอบหน้าเว็บบนจอขนาดมือถือ กับ Firebase emulator (ไม่แตะข้อมูลจริง) |

## ข้อมูลและ Firebase

- ระบบขนส่งเก็บข้อมูลใน Firebase Realtime Database โปรเจกต์ `send-an-invoice-to-snp` (โปรเจกต์เดียวกับระบบวางบิล) ใต้ `snpTransport/`
  - `jobs/` และ `customers/` อ่าน/เขียนได้เฉพาะเจ้าของระบบและพนักงานที่เปิดสิทธิ์ (`active`) ในระบบวางบิล
  - `portal/{รหัส}` คือข้อมูลที่เผยแพร่ให้ลูกค้าแต่ละราย มีเฉพาะหัวข้อที่เปิดไว้ ใครมีลิงก์ก็อ่านได้ แต่ดูรายชื่อลิงก์ทั้งหมดไม่ได้
- กฎความปลอดภัยตัวจริงอยู่ใน repo `snp-billing` ไฟล์ `firebase-database-rules.json` (`tests/database.rules.json` ในนี้เป็นสำเนาสำหรับทดสอบ ต้องแก้ให้ตรงกันเสมอ)
- พนักงานล็อกอินด้วยบัญชีเดียวกับระบบวางบิล (อีเมล หรือเบอร์โทร + รหัสผ่าน)
- ถ้าเคยใช้ก่อนต่อ Firebase ข้อมูลยังอยู่ในเบราว์เซอร์เครื่องเดิม ล็อกอินที่เครื่องนั้นแล้วกด "ย้ายขึ้นระบบออนไลน์"
