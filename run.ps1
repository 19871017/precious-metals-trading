# 贵金属交易项目启动脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  贵金属期货交易平台" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
$projectPath = "C:\Users\WY\Desktop\precious-metals-trading"
Set-Location $projectPath
Write-Host "项目目录: $projectPath" -ForegroundColor Green
Write-Host ""

# 检查是否已安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装依赖..." -ForegroundColor Yellow
    npm install
    Write-Host "依赖安装完成！" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "依赖已安装，跳过安装步骤" -ForegroundColor Green
    Write-Host ""
}

# 启动开发服务器
Write-Host "正在启动开发服务器..." -ForegroundColor Yellow
Write-Host "访问地址: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npm run dev
