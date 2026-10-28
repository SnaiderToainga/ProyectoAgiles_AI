param([switch]$Initialize)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force .local | Out-Null
foreach($file in @('demo-password.txt','jwt-key.txt')) {
    $path=Join-Path $PSScriptRoot ".local/$file"
    if (!(Test-Path $path)) {[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)) | Set-Content $path}
}
$env:ConnectionStrings__DefaultConnection='Server=(localdb)\MSSQLLocalDB;Database=EduMonitorAuth_Cristian_Sprint1;Trusted_Connection=True;TrustServerCertificate=True'
$env:ConnectionStrings__AcademicoConnection='Server=(localdb)\MSSQLLocalDB;Database=AcademicoDB_Cristian_Sprint1;Trusted_Connection=True;TrustServerCertificate=True'
$env:EDUMONITOR_DEMO_PASSWORD=(Get-Content .local/demo-password.txt -Raw).Trim()
$env:Jwt__Key=(Get-Content .local/jwt-key.txt -Raw).Trim()
$env:Jwt__Issuer='EduMonitorApi'
$env:Jwt__Audience='EduMonitorClient'
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:Development__ResetExamplePasswords='false'
if(Test-Path .local/moodle-connection.json) {
    $moodle=Get-Content .local/moodle-connection.json -Raw | ConvertFrom-Json
    $env:Moodle__BaseUrl=$moodle.baseUrl;$env:Moodle__MoodleToken=$moodle.moodleToken
    $env:EDUMONITOR_MOODLE_DOCENTE_ID=[string]$moodle.docenteMoodleId
}
if ($Initialize) {
    dotnet run --project backend/EduMonitor.DevSetup
    if($LASTEXITCODE -ne 0){throw 'Falló la inicialización local.'}
}
foreach($port in @(5000,5102)) {
    if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {throw "Puerto $port ocupado; no se detuvo ningún proceso."}
}
dotnet build backend/EduMonitorAI.slnx -m:1 -p:BuildInParallel=false
if($LASTEXITCODE -ne 0){throw 'Falló la compilación.'}
$pids=@()
foreach($app in @(@('Api',5102),@('Gateway',5000))) {
    $name=$app[0];$port=$app[1]
    $directory=Join-Path $PSScriptRoot "backend/EduMonitor.$name"
    $dll=Join-Path $directory "bin/Debug/net10.0/EduMonitor.$name.dll"
    $process=Start-Process dotnet -ArgumentList @(('"'+$dll+'"'),'--urls',"http://localhost:$port") -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput "$PSScriptRoot/.local/$name.log" -RedirectStandardError "$PSScriptRoot/.local/$name.error.log"
    $pids+=$process.Id
}
$pids | ConvertTo-Json | Set-Content .local/processes.json
Write-Output 'API: http://localhost:5102; Gateway: http://localhost:5000. Procesos propios registrados en .local/processes.json.'
