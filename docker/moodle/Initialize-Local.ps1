$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path .env)) {
    $lines = foreach ($name in @('MOODLE_DB_PASSWORD','MARIADB_ROOT_PASSWORD','MOODLE_ADMIN_PASSWORD','MOODLE_DEMO_PASSWORD')) {
        $value = 'Aa1!' + [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
        "$name=$value"
    }
    [IO.File]::WriteAllLines((Join-Path $PSScriptRoot '.env'), $lines)
}
New-Item -ItemType Directory -Force .local | Out-Null
Write-Output 'Configuración local creada o conservada; ningún secreto se imprime.'
