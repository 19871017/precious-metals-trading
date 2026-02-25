@echo off
chcp 65001 >nul
echo ========================================
echo  启动后端服务（数海API代理）
echo ========================================
echo.

cd /d "%~dp0"
echo 当前目录: %CD%
echo.

echo 正在启动后端服务器...
echo.

node --import tsx/esm src/index.ts

echo.
echo 后端服务已停止
pause
