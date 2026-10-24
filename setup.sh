#!/usr/bin/env bash
# ติดตั้งเครื่องใหม่สำหรับพัฒนาต่อ (macOS / Linux): bash setup.sh
set -e
cd "$(dirname "$0")"

need() { command -v "$1" >/dev/null 2>&1; }

echo "== ตรวจเครื่องมือ =="
need git  || { echo "ไม่พบ git — ติดตั้งจาก https://git-scm.com แล้วรันใหม่"; exit 1; }
need node || { echo "ไม่พบ Node.js — ติดตั้งรุ่น 20 ขึ้นไปจาก https://nodejs.org แล้วรันใหม่"; exit 1; }
echo "git:  $(git --version)"
echo "node: $(node --version)"

echo "== ดึงโค้ดล่าสุดจาก GitHub =="
git fetch origin main
if [ -z "$(git status --porcelain)" ] && [ "$(git branch --show-current)" = "main" ]; then
  git pull --ff-only origin main
else
  echo "มีงานค้างหรืออยู่ branch อื่น — ข้ามการ pull (ตามหลัง main $(git rev-list --count HEAD..origin/main) commit)"
fi

echo "== ติดตั้งตัวทดสอบ =="
npm install
if [ -z "$PLAYWRIGHT_BROWSERS_PATH" ]; then
  npx playwright install chromium
fi

echo "== Claude Code =="
if need claude; then
  echo "มีแล้ว: $(claude --version)"
else
  echo "กำลังติดตั้ง Claude Code"
  curl -fsSL https://claude.ai/install.sh | bash
fi

echo "== ทดสอบ =="
npm test

echo
echo "พร้อมแล้ว: รัน 'claude' ในโฟลเดอร์นี้เพื่อเริ่มทำงาน หรือ 'npm start' เพื่อเปิดเว็บที่ http://localhost:8080"
