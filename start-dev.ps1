# Script para levantar todos los servicios de EduMonitor AI
Write-Host "Iniciando Docker (MariaDB y Moodle)..." -ForegroundColor Cyan
docker start edumonitor-cristian-sprint1-mariadb-1 edumonitor-cristian-sprint1-moodle-1

Write-Host "Iniciando Microservicio de IA (:8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\ai-service'; .\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

Write-Host "Iniciando Backend API (:5102)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend\EduMonitor.Api'; dotnet run --no-launch-profile --urls 'http://localhost:5102'"

Write-Host "Iniciando API Gateway YARP (:5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend\EduMonitor.Gateway'; dotnet run --no-launch-profile --urls 'http://localhost:5000'"

Write-Host "Iniciando Frontend Vite (:5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "Todos los servicios fueron lanzados." -ForegroundColor Green
Write-Host "Abre tu navegador en: http://localhost:5173" -ForegroundColor Yellow
