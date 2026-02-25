@echo off
echo ========================================
echo Starting Backend Server...
echo ========================================
cd /d %~dp0server
npx tsx src/index-simple.ts
