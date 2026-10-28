# Moodle local — Sprint 1 (T-03)

Rama `feature/HU-03-moodle-docker`, desde `origin/develop` `1e3cec1`.
Entorno exclusivo de desarrollo con usuarios ficticios. Publica solo `127.0.0.1:8080`.

## Versiones verificadas

- Moodle 4.5.10: fuente oficial, commit `b2c2f2a0c5f9a141896df6c322a0b6b29bb77646`.
- PHP 8.3.30 Apache Bookworm y MariaDB 10.6.24: etiquetas comprobadas en Docker Hub y fijadas
  por digest en Dockerfile/Compose. No se usa `latest` ni una imagen Moodle de terceros.
- El contenido de paquetes apt depende del repositorio Debian al construir; la fuente Moodle
  y las imágenes base sí están fijadas. Antes de exponer fuera de localhost, revisar actualizaciones.

Fuentes: [Moodle v4.5.10](https://github.com/moodle/moodle/tree/v4.5.10),
[requisitos Moodle 4.5](https://moodledev.io/general/releases/4.5),
[Docker Desktop Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

## Despliegue

Requisitos: Docker Desktop con motor Linux y Compose; WSL2 activo. Verificar `docker info`.
Si Windows acaba de habilitar VirtualMachinePlatform, reiniciar Windows antes de iniciar Docker.
Desde esta carpeta, PowerShell:

```powershell
./Initialize-Local.ps1
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 900
docker compose ps
./Test-Persistence.ps1
```

No continuar con up si 8080 lo ocupa un servicio ajeno; no detener ese servicio.
Primer arranque instala el esquema con CLI oficial, crea cursos y matrículas mediante APIs core,
configura REST y guarda el token. Los reinicios reutilizan los volúmenes `mariadb_data` y `moodle_data`.
Proyecto Compose: `edumonitor-cristian-sprint1`; no comparte volúmenes con otros proyectos.
No ejecutar `down -v`, `system prune` ni borrar los volúmenes.

Acceso: http://localhost:8080. Usuario administrador `edumonitoradmin`, contraseña en la variable
MOODLE_ADMIN_PASSWORD de `.env`. Docente `docente.sprint1`, estudiantes `estudiante.uno`,
`estudiante.dos`, `estudiante.tres`; contraseña ficticia MOODLE_DEMO_PASSWORD de `.env`.
Las credenciales se generan aleatoriamente, se conservan al repetir el inicializador y no se versionan.

El aprovisionamiento no escribe tablas internas directamente: usa APIs de cursos, usuarios,
matrículas, roles, gradebook y webservice. Solo consulta registros existentes para evitar duplicados.
Crea SOF-401 Metodologías Ágiles y SOF-402 Estructuras de Datos; cada curso contiene un docente,
tres estudiantes y tres ítems manuales (Tarea, APE, Examen) con notas originales 0, 80 y null sobre 100.
No se fabrican entregas: las notas ausentes de esos ítems serán NoDeterminado en el backend.
La clasificación curricular de los ítems importados se realiza luego mediante los endpoints académicos.

## Servicio REST e integración

Servicio restringido `edumonitor_sprint1`, autorizado solo para el docente piloto, quien tiene rol
editingteacher exclusivamente en los dos cursos. El rol global adicional solo habilita REST.
Funciones: core_webservice_get_site_info, core_enrol_get_users_courses,
core_enrol_get_enrolled_users, gradereport_user_get_grade_items, mod_assign_get_assignments,
mod_assign_get_submission_status.

Token y IDs quedan en `.local/moodle-connection.json` (ignorado). El token se conserva en moodledata
y no se imprime. Copiar ese JSON solo a `.local/` del worktree académico, nunca al repositorio.
El backend usa POST con wstoken en el cuerpo, no en URLs.

`Test-Persistence.ps1` consulta REST real, verifica 2 cursos y 4 participantes por curso, ejecuta
`docker compose restart` sin eliminar volúmenes y repite las consultas con los mismos IDs/token.
Para detener el entorno: `docker compose stop`; para retomarlo: `docker compose start`.
No cambiar credenciales .env de un volumen ya inicializado esperando que se modifiquen en la base.
Un primer arranque interrumpido durante la instalación requiere inspección de logs; no borrar datos
para ocultar el fallo. Las actualizaciones de versión/esquema requieren un procedimiento separado.

## Evidencias y estado real

27 de octubre de 2026, America/Guayaquil:

| Tarea | Archivos | Estado |
|---|---|---|
| T-03.1 | compose.yaml, Dockerfile, config.php | Implementado; imágenes/digests verificados, Compose válido; build/runtime pendiente |
| T-03.2 | scripts/provision.php | Aprovisionamiento idempotente implementado; ejecución contra Moodle pendiente |
| T-03.3 | provision.php, Test-Persistence.ps1 | Servicio/token y prueba preparados; consulta REST real pendiente |
| T-03.4 | volúmenes, healthchecks, Test-Persistence.ps1 | Reinicio/persistencia implementados como prueba; ejecución pendiente |

Instalados y firmados: LocalDB, WSL, Docker Desktop. VirtualMachinePlatform terminó con código
3010 (reinicio necesario). Docker CLI funciona, pero el motor no pudo iniciar en esta sesión.
No se reinició Windows. Validación realizada: `docker compose config --quiet`, `php -n -l`
sobre los tres PHP y `bash -n` sobre entrypoint, todos correctos. No se confunden estas revisiones
con un despliegue funcional: faltan build, aprovisionamiento, REST y persistencia tras reiniciar Windows.

## PR sugerido (no publicado)

Título: `feat(moodle): preparar entorno Docker y aprovisionamiento piloto del Sprint 1`

Descripción: Añade Moodle 4.5.10 desde fuente oficial, PHP y MariaDB fijados por digest, volúmenes
propios y healthchecks. Incluye creación idempotente de cursos, usuarios y matrículas ficticias,
servicio REST restringido y secretos locales ignorados. Añade prueba de consulta REST y persistencia
tras reinicio sin borrar volúmenes. Compose y sintaxis validados; ejecución completa pendiente del
reinicio de Windows necesario para habilitar el motor Docker.
