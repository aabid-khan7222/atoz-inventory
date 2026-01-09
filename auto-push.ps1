# Auto Push Script for Windows PowerShell
# This script automatically commits and pushes changes to GitHub
# Usage: .\auto-push.ps1 "Your commit message"

param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "Auto commit: Update code"
)

Write-Host "🔄 Checking for changes..." -ForegroundColor Cyan

# Check if there are any changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ No changes to commit." -ForegroundColor Green
    exit 0
}

Write-Host "📝 Changes found. Staging files..." -ForegroundColor Yellow
git add -A

Write-Host "💾 Committing changes..." -ForegroundColor Yellow
git commit -m $Message

Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
git push origin HEAD:main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "📦 Render will auto-deploy if configured." -ForegroundColor Cyan
} else {
    Write-Host "❌ Error pushing to GitHub!" -ForegroundColor Red
    exit 1
}

