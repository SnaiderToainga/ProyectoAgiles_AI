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
Proyecto Compose: `edumonitor-moodle`; no comparte volúmenes con otros proyectos.
No ejecutar `down -v`, `system prune` ni borrar los volúmenes.

### Migración desde el nombre anterior

Hasta noviembre de 2026 el proyecto se llamaba `edumonitor-cristian-sprint1`. Si tu equipo aún
tiene esos volúmenes, copia los datos al nombre nuevo antes del primer `up` (conserva usuarios,
cursos, notas y el token REST; no borra los volúmenes antiguos):

```powershell
./Migrar-Volumenes.ps1
docker compose up -d --build --wait --wait-timeout 900
```

Cuando compruebes que Moodle funciona, puedes eliminar los volúmenes y contenedores antiguos.

### Usuarios y roles

Acceso: http://localhost:8080. Todos los usuarios son ficticios y usan autenticación manual.

| Rol en Moodle | Usuario | Contraseña (variable de `.env`) |
|---|---|---|
| Administrador del sitio | `edumonitoradmin` | `MOODLE_ADMIN_PASSWORD` |
| Docente con edición (`editingteacher`) en SOF-401 y SOF-402 | `docente.sprint1` (Ing. Diego Proaño, la misma persona que `d.proano@uta.edu.ec` en SISRA) | `MOODLE_DEMO_PASSWORD` |
| Estudiante (`student`) en ambos cursos | `andrea.morales`, `estiven.chiluisa`, `maria.sanchez`, `snaider.toainga`, `cristian.sivinta`, `cesar.carrasco`, `diana.ortiz`, `juan.torres`, `sofia.lopez`, `kevin.fuerez`, `mateo.perez`, `carlos.gomez` | `MOODLE_DEMO_PASSWORD` |

La API no entra con ninguna de estas cuentas: usa la cuenta de servicio `sisra.servicio`
(ver «Servicio REST e integración»). Las credenciales se generan aleatoriamente con `Initialize-Local.ps1`, se conservan al
repetirlo y no se versionan. La contraseña de los estudiantes se reaplica en cada arranque.
Moodle toma el idioma al iniciar sesión: al cambiar de rol, cerrar sesión o usar una ventana privada.

### Contenido académico

El aprovisionamiento no escribe tablas internas directamente: usa APIs de cursos, usuarios,
matrículas, roles, gradebook y webservice. Solo consulta registros existentes para evitar duplicados.
Crea SOF-401 Metodologías Ágiles y SOF-402 Estructuras de Datos con:

- Secciones 0 a 4 (presentación, tres parciales y proyecto integrador).
- Categorías de calificación PRIMER y SEGUNDO PARCIAL, cada una con ACD/Tareas (30 %),
  APE (30 %) y AA/Examen (40 %).
- 12 tareas por curso (6 por parcial) calificadas sobre 10, con aprobación en 7.
- Notas de los 12 estudiantes en escala 0 a 10 con retroalimentación, desde perfiles sobresalientes
  hasta críticos; solo se registran cuando la nota no existe, para no pisar cambios manuales.

Los usuarios `estudiante.uno`, `estudiante.dos` y `estudiante.tres` y los ítems manuales del
Sprint 1 se eliminan al aprovisionar. La clasificación curricular de los ítems importados se realiza
luego en SISRA mediante los endpoints académicos.

## Identidad visual SISRA

`scripts/branding.php` se ejecuta en cada arranque, después de `provision.php`, y solo aplica lo que
haya cambiado. Usa el tema estándar Boost configurado, sin temas de terceros:

- Nombre del sitio «SISRA · Aula Virtual FISEI», zona horaria America/Guayaquil e interfaz en
  español (paquete oficial `es` de Moodle 4.5, descargado al construir la imagen en `/opt/moodle-lang`).
- Logo, logo compacto, favicon, fondo de acceso e imágenes de curso propios en `branding/` (SVG),
  más estilos en `branding/sisra.scss` (azul `#1F3B73` y rojo `#8B151A`).
- Categorías «Octubre 2026 – Febrero 2027 → SOFTWARE → Cuarto Semestre» con SOF-401 y SOF-402;
  la categoría inicial «Category 1» queda oculta si está vacía.
- Página principal con buscador de cursos, árbol de categorías y bloque «Usuarios en línea».
- Acceso sin botón de invitado y con el aviso «Entorno académico de pruebas».

No usa logos, fotografías ni marcas institucionales oficiales; el entorno debe seguir siendo
reconocible como laboratorio. Los códigos de curso no cambian, por lo que la sincronización de la API
no se ve afectada. Para aplicar cambios de `branding/`: `docker compose up -d --build`.

## Servicio REST e integración

La API de SISRA usa una **cuenta de servicio de solo lectura**, `sisra.servicio`, y no el token de
un docente concreto. `scripts/servicio.php` la crea y mantiene en cada arranque:

- Autenticación `webservice`: solo sirve para la API y no puede iniciar sesión en la web.
- Rol `sisralectura`, asignable solo en categorías y asignado en «Octubre 2026 – Febrero 2027».
  Solo permite consultar: cursos sin matrícula, participantes y sus perfiles, secciones y
  actividades ocultas, calificaciones de todo el curso y estados de entrega. No puede crear,
  editar ni calificar. Los cursos fuera de esa categoría no son visibles para la API.
- Rol `edumonitorrest` a nivel de sitio, que solo habilita el protocolo REST.
- Servicio externo `edumonitor_sprint1` («SISRA lectura»), autorizado solo para esta cuenta, con las
  funciones core_webservice_get_site_info, core_enrol_get_users_courses,
  core_enrol_get_enrolled_users, gradereport_user_get_grade_items, mod_assign_get_assignments,
  mod_assign_get_submission_status y core_course_get_contents.
- Retira el acceso REST y el token del docente `docente.sprint1`, que la API usaba antes.

Cada docente de SISRA se enlaza con su propio usuario de Moodle desde *Gestión de Usuarios*; la
cuenta de servicio consulta los cursos donde ese usuario es profesor.

Token y IDs quedan en `.local/moodle-connection.json` (ignorado). El token se conserva en moodledata
y no se imprime. Copiar ese JSON solo a `.local/` del worktree académico, nunca al repositorio.
El backend usa POST con wstoken en el cuerpo, no en URLs.

**Al actualizar desde una versión anterior** el token cambia: copia el valor `moodleToken` de
`.local/moodle-connection.json` en `MOODLE_TOKEN` del `.env` de la raíz (Docker Compose) o en
`Moodle:MoodleToken` de tu configuración local, y reinicia la API. El token anterior queda revocado.

### Agregar un docente nuevo

1. En Moodle, como `edumonitoradmin`: crea el usuario y matricúlalo con rol **Profesor** en sus
   cursos, que deben estar dentro de «Octubre 2026 – Febrero 2027». Anota su ID (número tras `id=`
   en la dirección de su perfil).
2. En SISRA, como administrador: *Gestión de Usuarios → + Nuevo Usuario*, rol Docente, con ese ID
   de Moodle. SISRA verifica en qué cursos es profesor antes de guardar.
3. El docente inicia sesión en SISRA y sincroniza sus cursos desde *Evaluaciones*.

`Test-Persistence.ps1` consulta REST real, verifica los 2 cursos piloto con el docente y al menos un
estudiante matriculados, ejecuta `docker compose restart` sin eliminar volúmenes y comprueba que
después del reinicio se obtengan los mismos cursos y el mismo número de participantes con el mismo token.
Para detener el entorno: `docker compose stop`; para retomarlo: `docker compose start`.
No cambiar credenciales .env de un volumen ya inicializado esperando que se modifiquen en la base.
Un primer arranque interrumpido durante la instalación requiere inspección de logs; no borrar datos
para ocultar el fallo. Las actualizaciones de versión/esquema requieren un procedimiento separado.

## Evidencias y estado real

Verificación completada el 27 de octubre de 2026, America/Guayaquil.

| Tarea | Resultado |
|---|---|
| T-03.1 | Imagen construida; Moodle y MariaDB healthy |
| T-03.2 | 2 cursos, 1 docente y 3 estudiantes; 4 participantes por curso |
| T-03.3 | Token local y consultas REST reales aprobadas; integración por Gateway aprobada |
| T-03.4 | Test-Persistence.ps1 aprobado tras reiniciar contenedores sin borrar volúmenes |

Se corrigió el test PowerShell para distinguir respuestas de lista de objetos de error.
Los ítems manuales usan update_final_grade; las notas del piloto se inicializan solo si faltan.
Repetir la ingesta conserva 6 matrículas, 6 ítems Moodle y 18 notas: seis 0, seis 8/10
(original 80/100) y seis null. Los borradores conservan su clasificación al reimportarlos.
Docker y WSL2 quedaron operativos tras el reinicio autorizado de Windows.

## PR sugerido (no publicado)

Título: `feat(moodle): añadir entorno Docker y aprovisionamiento piloto del Sprint 1`

Descripción: Añade Moodle 4.5.10 desde fuente oficial, PHP y MariaDB fijados por digest,
volúmenes propios, healthchecks y aprovisionamiento repetible de cursos, usuarios y notas.
Servicio REST restringido con secretos locales ignorados. Validado con build real,
consultas REST, sincronización a SQL Server por Gateway y persistencia tras restart.
