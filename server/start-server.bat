@echo off
chcp 65001 >nul
echo ========================================
echo  启动数海API代理后端服务
echo ========================================
echo.

cd /d "%~dp0"
echo 工作目录: %CD%
echo.

echo 启动后端服务...
npm run dev

pause
