$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$config = Get-Content .local/moodle-connection.json -Raw | ConvertFrom-Json
$endpoint = "$($config.baseUrl)/webservice/rest/server.php"

# Devuelve una firma "curso:participantes" de los cursos piloto para compararla tras el reinicio.
function Read-Pilot {
    $body = @{wstoken=$config.moodleToken;wsfunction='core_enrol_get_users_courses';moodlewsrestformat='json';userid=$config.docenteMoodleId}
    $result = Invoke-RestMethod -Method Post -Uri $endpoint -Body $body
    if ($result -isnot [array] -and $result.exception) {throw 'Moodle rechazó la consulta; revise el servicio y permisos.'}
    $ids = @($result | Sort-Object id | Select-Object -ExpandProperty id)
    if ($ids.Count -ne 2) {throw 'No se encontraron los dos cursos piloto.'}
    $firma = foreach ($id in $ids) {
        $body = @{wstoken=$config.moodleToken;wsfunction='core_enrol_get_enrolled_users';moodlewsrestformat='json';courseid=$id}
        $respuesta = Invoke-RestMethod -Method Post -Uri $endpoint -Body $body
        if ($respuesta -isnot [array] -and $respuesta.exception) {throw 'Moodle rechazó la consulta de matrículas.'}
        $users = @($respuesta)
        if (-not ($users | Where-Object { $_.id -eq [int]$config.docenteMoodleId })) {throw "El docente no está matriculado en el curso $id."}
        if ($users.Count -lt 2) {throw "El curso $id no tiene estudiantes matriculados."}
        "${id}:$($users.Count)"
    }
    return $firma -join ','
}

$before = Read-Pilot
docker compose restart
if ($LASTEXITCODE -ne 0) {throw 'No se pudo reiniciar Compose.'}
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 3
    try {$after = Read-Pilot; $ready = $true; break} catch { }
}
if (!$ready -or $before -ne $after) {throw "No se verificó persistencia (antes: $before; después: $after)."}
Write-Output "REST y persistencia verificados tras el reinicio: mismos cursos y participantes ($after)."
