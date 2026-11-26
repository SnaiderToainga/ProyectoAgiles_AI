# Script para levantar todos los servicios de EduMonitor AI
param([switch]$SoloValidar)

# La API y el Gateway exigen una clave JWT propia (no hay clave por defecto en appsettings.json).
# Se lee del mismo .env de la raíz que usa Docker Compose; los procesos hijos heredan estas variables.
$archivoEnv = Join-Path $PSScriptRoot '.env'
if (!(Test-Path $archivoEnv)) {
    Write-Host "Falta el archivo .env en la raíz. Copie .env.example como .env y complete JWT_KEY." -ForegroundColor Red
    exit 1
}
$variables = @{}
foreach ($linea in Get-Content $archivoEnv) {
    if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $variables[$Matches[1]] = $Matches[2].Trim().Trim('"')
    }
}
$jwt = $variables['JWT_KEY']
if (-not $jwt -or [Text.Encoding]::UTF8.GetByteCount($jwt) -lt 32) {
    Write-Host "JWT_KEY falta o tiene menos de 32 caracteres en .env. Genérela con:" -ForegroundColor Red
    Write-Host "  [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))" -ForegroundColor Yellow
    exit 1
}
$env:Jwt__Key = $jwt
# Igual que en Docker: la API aplica sus migraciones pendientes al arrancar (operación idempotente).
$env:Database__MigrateOnStartup = 'true'
if ($variables['MOODLE_TOKEN']) { $env:Moodle__MoodleToken = $variables['MOODLE_TOKEN'] }
# Fuera de Docker, Moodle se alcanza por localhost.
if ($variables['MOODLE_BASE_URL']) { $env:Moodle__BaseUrl = $variables['MOODLE_BASE_URL'] -replace 'host\.docker\.internal', 'localhost' }
if ($SoloValidar) {
    Write-Host "Configuración válida: JWT_KEY presente; token de Moodle $(if ($env:Moodle__MoodleToken) {'presente'} else {'vacío'})." -ForegroundColor Green
    exit 0
}

Write-Host "Iniciando Docker (MariaDB y Moodle)..." -ForegroundColor Cyan
docker compose -f "$PSScriptRoot\docker\moodle\compose.yaml" start

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
