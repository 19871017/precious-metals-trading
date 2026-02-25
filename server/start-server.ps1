# 后端服务启动脚本
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 启动数海API代理后端服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 设置工作目录
$serverDir = "C:\Users\WY\Desktop\precious-metals-trading\server"
Set-Location $serverDir
Write-Host "工作目录: $PWD" -ForegroundColor Yellow

# 检查依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "安装依赖..." -ForegroundColor Yellow
    npm install
}

# 启动服务
Write-Host "启动后端服务..." -ForegroundColor Green
npm run dev
