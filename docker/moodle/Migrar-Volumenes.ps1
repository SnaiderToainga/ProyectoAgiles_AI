# Copia los volúmenes del proyecto Compose anterior (edumonitor-cristian-sprint1)
# a los del nombre actual (edumonitor-moodle). No borra nada: los volúmenes antiguos
# se conservan hasta que el usuario verifique Moodle y decida eliminarlos.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$anterior = 'edumonitor-cristian-sprint1'
$actual = 'edumonitor-moodle'
# Imagen ya utilizada por Compose (fijada por digest): evita descargar herramientas adicionales.
$imagen = 'mariadb:10.6.24@sha256:ea23e7cd253323f6a7c0abedb5a7ce9646bc5620e9be38373cff1fecbd5b57e0'

docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker no está disponible; abra Docker Desktop.' }

$enEjecucion = docker ps --filter "label=com.docker.compose.project=$anterior" --format '{{.Names}}'
if ($enEjecucion) {
    Write-Output "Deteniendo contenedores de $anterior para copiar datos consistentes..."
    docker stop $enEjecucion | Out-Null
}

foreach ($volumen in 'mariadb_data', 'moodle_data') {
    $origen = "${anterior}_$volumen"
    $destino = "${actual}_$volumen"

    docker volume inspect $origen 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Output "No existe $origen; nada que migrar."; continue }

    docker volume inspect $destino 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Output "$destino ya existe; se omite para no sobrescribir datos."; continue }

    docker volume create --label "com.docker.compose.project=$actual" --label "com.docker.compose.volume=$volumen" $destino | Out-Null
    docker run --rm -v "${origen}:/desde:ro" -v "${destino}:/hacia" --entrypoint sh $imagen -c 'cp -a /desde/. /hacia/'
    if ($LASTEXITCODE -ne 0) { throw "Falló la copia de $origen." }
    Write-Output "Copiado $origen -> $destino"
}

Write-Output 'Migración terminada. Levante Moodle con: docker compose up -d --build --wait --wait-timeout 900'
