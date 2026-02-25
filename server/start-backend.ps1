# 后端服务启动脚本
$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting Shuhai API Proxy Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$serverDir = "C:\Users\WY\Desktop\precious-metals-trading\server"
Set-Location $serverDir
Write-Host "Working directory: $PWD" -ForegroundColor Yellow

Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Green
Write-Host ""

node --import tsx/esm src/index.ts
