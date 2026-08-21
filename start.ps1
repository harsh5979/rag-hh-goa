param(
    [string]$Action = "start"
)

if ($Action -eq "stop") {
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host "🛑 Shutting down VoiceRAG Development Environment" -ForegroundColor Yellow
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host ""

    docker compose down

    Write-Host ""
    Write-Host "✅ All containers have been stopped and removed cleanly." -ForegroundColor Green
    Write-Host "Have a great day!" -ForegroundColor Cyan
    exit
}

# Default start behavior
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting VoiceRAG Development Environment" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Building Docker containers sequentially to prevent Docker hanging..." -ForegroundColor Yellow

Write-Host "[1/2] Building Backend (This downloads ~200MB PyTorch)..." -ForegroundColor Magenta
docker compose build backend

Write-Host "[2/2] Building Frontend (Next.js production build)..." -ForegroundColor Blue
docker compose build frontend

Write-Host "Starting all services..." -ForegroundColor Yellow
docker compose up -d

Write-Host ""
Write-Host "✅ Environment is now running!" -ForegroundColor Green
Write-Host "🌐 Frontend is live at: http://localhost:3000" -ForegroundColor Blue
Write-Host "⚙️  Backend API is live at: http://localhost:8000" -ForegroundColor Magenta
Write-Host ""
Write-Host "Opening separate terminal windows for Backend and Frontend logs..." -ForegroundColor DarkGray

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'VoiceRAG Backend Logs'; docker compose logs -f backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'VoiceRAG Frontend Logs'; docker compose logs -f frontend"

Write-Host "Done!" -ForegroundColor Green
