# ติดตั้งเครื่องใหม่สำหรับพัฒนาต่อ (Windows PowerShell): powershell -ExecutionPolicy Bypass -File setup.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Need($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host '== ตรวจเครื่องมือ =='
if (-not (Need git))  { Write-Host 'ไม่พบ git — ติดตั้ง Git for Windows จาก https://git-scm.com แล้วรันใหม่'; exit 1 }
if (-not (Need node)) { Write-Host 'ไม่พบ Node.js — ติดตั้งรุ่น 20 ขึ้นไปจาก https://nodejs.org แล้วรันใหม่'; exit 1 }
Write-Host "git:  $(git --version)"
Write-Host "node: $(node --version)"

Write-Host '== ดึงโค้ดล่าสุดจาก GitHub =='
git fetch origin main
if (-not (git status --porcelain) -and (git branch --show-current) -eq 'main') {
  git pull --ff-only origin main
} else {
  Write-Host "มีงานค้างหรืออยู่ branch อื่น — ข้ามการ pull (ตามหลัง main $(git rev-list --count HEAD..origin/main) commit)"
}

Write-Host '== ติดตั้งตัวทดสอบ =='
npm install
npx playwright install chromium

Write-Host '== Claude Code =='
if (Need claude) {
  Write-Host "มีแล้ว: $(claude --version)"
} else {
  Write-Host 'กำลังติดตั้ง Claude Code'
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
}

Write-Host '== ทดสอบ =='
npm test

Write-Host ''
Write-Host "พร้อมแล้ว: รัน 'claude' ในโฟลเดอร์นี้เพื่อเริ่มทำงาน หรือ 'npm start' เพื่อเปิดเว็บที่ http://localhost:8080"
