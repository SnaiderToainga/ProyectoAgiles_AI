$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$config = Get-Content .local/moodle-connection.json -Raw | ConvertFrom-Json
function Read-Pilot {
    $body = @{wstoken=$config.moodleToken;wsfunction='core_enrol_get_users_courses';moodlewsrestformat='json';userid=$config.docenteMoodleId}
    $result = Invoke-RestMethod -Method Post -Uri "$($config.baseUrl)/webservice/rest/server.php" -Body $body
    if ($result -isnot [array] -and $result.exception) {throw 'Moodle rechazó la consulta; revise el servicio y permisos.'}
    $ids = @($result | Sort-Object id | Select-Object -ExpandProperty id)
    if ($ids.Count -ne 2) {throw 'No se encontraron los dos cursos piloto.'}
    foreach ($id in $ids) {
        $body.wsfunction='core_enrol_get_enrolled_users';$body.Remove('userid');$body.courseid=$id
        $users=Invoke-RestMethod -Method Post -Uri "$($config.baseUrl)/webservice/rest/server.php" -Body $body
        if (($users -isnot [array] -and $users.exception) -or @($users).Count -ne 4) {throw 'Matrículas incompletas.'}
    }
    return $ids -join ','
}
$before=Read-Pilot
docker compose restart
if ($LASTEXITCODE -ne 0) {throw 'No se pudo reiniciar Compose.'}
$ready=$false
for ($i=0;$i -lt 60;$i++) {
    Start-Sleep -Seconds 3
    try {$after=Read-Pilot;$ready=$true;break} catch { }
}
if (!$ready -or $before -ne $after) {throw 'No se verificó persistencia.'}
Write-Output 'REST y persistencia verificados: mismos cursos y 4 participantes por curso después del reinicio.'
