@echo off
echo ========================================
echo 启动贵金属交易系统 - 后端服务
echo ========================================
echo.
echo [INFO] WebSocket 实时推送已启用
echo [INFO] 行情数据将自动推送到前端
echo [INFO] 访问地址: http://localhost:3001
echo.
cd /d "%~dp0server"
npx tsx src/index.ts
pause
