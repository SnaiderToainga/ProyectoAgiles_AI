# Sprint 1 — Backend académico e integración Moodle

Base: `origin/develop`, commit `1e3cec1913b2176d8643d1806be256aa2515a7d5`.
Rama: `feature/HU-02-academicodb`. No requiere incorporar la rama Docker para compilar.
Para pruebas reales de Moodle, iniciar el entorno de `feature/HU-03-moodle-docker`.

## Modelo y compatibilidad

`Curso` representa Materia; `ItemEvaluacion` representa Evaluación. Se reutilizan Estudiante,
Matricula y Calificacion. Jerarquía: Curso → Parcial → Unidad → Tema; EvaluacionTema es N:M.
Se conserva el servicio IndicadoresService y sus componentes Tarea=1 (30%), APE=2 (30%) y Examen=3 (40%).
SinClasificar=0 identifica los borradores; no incluirlos en indicadores hasta clasificarlos.

`AcademicoDbContext` usa `ConnectionStrings:AcademicoConnection`. El contexto histórico
`EduMonitorDbContext` mantiene Usuarios, LogsAcceso y las tablas académicas previas: no se trasladan
ni borran datos automáticamente. Los endpoints nuevos consultan exclusivamente AcademicoDB.
Si el equipo ya tiene datos académicos en la base histórica, su traslado requiere revisión aparte.

La identidad no depende de coincidencias numéricas: JWT `NameIdentifier` → `Usuario.Id` →
`Docente.UsuarioId` → `Docente.MoodleUserId`. UsuarioId es una referencia lógica entre bases,
no una FK SQL entre bases. Sus vínculos y los Moodle IDs tienen índices únicos.
El inicializador local busca al usuario por correo y utiliza el ID realmente creado.

## Arranque local

Requisitos: .NET 10 SDK y SQL Server LocalDB 2022. Desde la raíz de esta rama, PowerShell:

```powershell
./Start-Local.ps1 -Initialize
```

Solo se inicializan `(localdb)\MSSQLLocalDB` y las bases `EduMonitorAuth_Cristian_Sprint1` y
`AcademicoDB_Cristian_Sprint1`. DevSetup rechaza otros nombres/servidores. Repetirlo no duplica
materias, estructura curricular ni cuenta ficticia, y no reinicia contraseñas existentes.
Para usar una base nueva distinta, crear un flujo de inicialización explícito revisado por el equipo.

Usuario ficticio: `docente.sprint1@example.invalid`. Contraseña generada en `.local/demo-password.txt`.
JWT local independiente en `.local/jwt-key.txt`; ambos archivos están ignorados por Git.
No pegar sus valores en commits o capturas. La aplicación conserva los contratos de login originales.
El restablecimiento de contraseñas de ejemplo del código anterior queda desactivado por defecto;
solo es posible en Development con `Development:ResetExamplePasswords=true` explícito.
Auditoría y desbloqueo ahora exigen rol Administrador también en la API.

API: `http://localhost:5102`; Gateway: `http://localhost:5000`.
El script registra PIDs propios en `.local/processes.json` y logs en `.local/Api.log` y
`.local/Gateway.log`. No detiene procesos que ocupen esos puertos. Antes de repetir el arranque,
cerrar únicamente los procesos propios registrados, verificando que sus PIDs no fueron reutilizados.

## Migraciones

- `Migrations/Academico/InicialAcademicoSprint1`: esquema académico independiente.
- `RestaurarRestriccionesAcademicas`: corrección del esquema histórico manteniendo sus migraciones.
- `docs/sql/academico.sql` y `correctiva-legacy.sql`: SQL generado para revisión.

La correctiva repone índices únicos y límites de campos, cambia dos eliminaciones en cascada a
Restrict y permite logs sin curso. Sustituye índices no únicos por índices únicos compuestos;
no elimina tablas ni filas. **No aplicarla sin revisión sobre una base con datos del equipo**:
los duplicados, textos que superan los nuevos límites o valores fuera de decimal(12,4)
deben detectarse y resolverse previamente con sus responsables. No se aplicó sobre bases existentes.
Los métodos Down son rollback generado por EF y no forman parte del despliegue autorizado.

```powershell
dotnet ef migrations list --context AcademicoDbContext --project backend/EduMonitor.Infrastructure --startup-project backend/EduMonitor.Api
dotnet test backend/EduMonitorAI.slnx -m:1
```

Las factories de diseño no ejecutan el inicializador de cuentas del servidor.

## Contratos para frontend y Postman

Todas las rutas siguientes exigen JWT y rol Docente o Administrador. Los docentes solo acceden
a sus propias materias; sincronización exige además vínculo Moodle incluso para Administrador.
`docs/sprint1.http` puede importarse o reproducirse en Postman. Los IDs del ejemplo son orientativos:
usar los obtenidos del catálogo. No se agregó una dependencia Swagger innecesaria.

| Método y ruta | Entrada / salida |
|---|---|
| GET `/api/academico/materias` | Lista `{id,codigo,nombre,semestre,parciales:[{id,numero,unidades:[{id,numero,nombre,temas:[{id,nombre,descripcion}]}]}]}` |
| POST `/api/academico/temas` | `{unidadId,nombre,descripcion}` → 201 TemaDto |
| POST `/api/academico/evaluaciones` | `{parcialId,nombre,tipo,temaIds}` → 201 `{id}` |
| GET `/api/academico/materias/{cursoId}/evaluaciones` | Lista `{id,parcialId,nombre,tipo,ponderacion,publicado,temaIds}` |
| PUT `/api/academico/evaluaciones/{id}/clasificacion` | `{parcialId,tipo,temaIds}` → 204 |
| POST `/api/moodle/sync-cursos` | Sin cuerpo; usa identidad del JWT |
| POST `/api/moodle/sync-notas/{cursoId}` | ID local del curso, no MoodleCourseId |

Errores: 400 validación; 401 JWT ausente/inválido; 403 rol/vinculación/propiedad; 404 entidad ausente;
409 duplicado/conflicto; 502 error funcional Moodle o JSON; 503 falta de configuración/red; 504 timeout.
No se rediseñó el frontend: Cesar debe sustituir sus datos fijos consumiendo estos DTO.

## Ingesta y notas

Cliente `IHttpClientFactory` con POST `/webservice/rest/server.php`; wstoken va exclusivamente en
el cuerpo. Timeout y reintentos acotados; rechaza errores Moodle incluso con HTTP 200 y advertencias.
Se consultan cursos, participantes, grade items y estados de tareas cuando corresponda.

Escala: `Nota = round((NotaMoodle - MinimoMoodle)/(MaximoMoodle - MinimoMoodle)*10,4)`.
Se conserva el original y los extremos. Un valor fuera de escala aborta la transacción.
Cero es una nota válida; null no significa ausencia de entrega. Estados existentes conservan sus IDs:
0 NoDeterminado, 1 Entregado (nota asentada), 2 SinEntrega, 3 PendienteCalificar, 4 PendienteEntrega.
SinEntrega exige evidencia de plazo efectivo vencido. Fechas generales no se consideran autoritativas
por defecto, debido a las posibles excepciones individuales o de grupo de Moodle.

Las evaluaciones importadas nacen `Publicado=false`, `Tipo=0`, sin temas inventados. Deben clasificarse
con temas del mismo parcial antes de usarlas en indicadores. Reimportar conserva la clasificación.
No se borran alumnos, matrículas o notas no incluidos en una respuesta posterior; reconciliar bajas
requiere un criterio específico del equipo. Los índices y transacciones serializables previenen duplicados;
ante conflicto concurrente se aborta la operación, se audita el fallo y se puede reintentar.
LogSincronizacion se guarda antes de llamar a Moodle y admite CursoId null, para auditar sync-cursos.

Para conectar Moodle, copiar **localmente** `docker/moodle/.local/moodle-connection.json` del otro
worktree a `.local/moodle-connection.json` de este. Ejecutar nuevamente DevSetup con el entorno del
script de arranque para vincular el docente real. Reiniciar únicamente API/Gateway propios para cargar
el token. Nunca copiar ese archivo a documentación versionada.

## Evidencias y matriz

Verificación realizada el 27 de octubre de 2026, zona America/Guayaquil. Los IDs de migración
fueron generados automáticamente por el reloj UTC de EF (28 de octubre); no se alteraron fechas.

| Tarea | Archivos | Resultado |
|---|---|---|
| T-04.1 | Entities/Academico, AcademicoDbContext, CatalogoService | Modelo y catálogo implementados; SQLite y LocalDB verificados |
| T-04.2 | ItemEvaluacion, EvaluacionTema, Calificacion, MoodleSyncService | Validación temática, borradores, nota 0/null y escala probados |
| T-04.3 | Migrations, AcademicoSeeder, DevSetup | SQL revisado y aplicado en bases nuevas; seeds repetidos sin duplicados |
| HU-02 endpoints | AcademicoController, Gateway existente | Login, catálogo, alta de tema/evaluación reales a través de YARP |
| HU-03 ingesta | MoodleService, MoodleSyncService | Importaciones y fallos probados con Moodle simulado; integración Moodle real pendiente |

- Base antes de cambios: 4 pruebas existentes aprobadas.
- Resultado final de tests automatizados: 23 aprobadas, 0 fallidas (SQLite relacional en memoria,
  HttpMessageHandler simulado y servidor ASP.NET de pruebas con JWT firmado).
- SQL Server LocalDB real: migraciones aplicadas; seed inicial 2 materias, 4 parciales, 8 unidades,
  16 temas; repetición conserva esos conteos. La demostración HTTP agregó luego 1 tema y 1 evaluación ficticios.
- Gateway + API + LocalDB reales: login exitoso, catálogo de 2 materias, creación de tema/evaluación;
  sin JWT=401, auditoría con Docente=403, evaluación sin temas=400.
- Avisos preexistentes NU1902/NU1903 en System.Security.Cryptography.Pkcs 9.0.11 siguen presentes;
  corresponden a dependencias previas y deben actualizarse coordinadamente con el equipo.
- Docker instalado; motor pendiente de activación de VirtualMachinePlatform tras reiniciar Windows.
  No se afirma consulta real ni persistencia de Moodle hasta ejecutarlas después del reinicio.

## PR sugerido (no publicado)

Título: `feat(academic): implementar AcademicoDB, catálogo e ingesta Moodle del Sprint 1`

Descripción: Añade jerarquía curricular y asociación temática de evaluaciones usando Curso e
ItemEvaluacion existentes. Separa las operaciones académicas en AcademicoDB sin trasladar datos
históricos, restaura restricciones mediante migración correctiva y vincula JWT, docente y Moodle
explícitamente. Incluye endpoints protegidos, importación transaccional idempotente con auditoría,
normalización trazable y borradores pendientes de clasificación. Conserva cálculo ponderado y Gateway.

Validación: 23 tests aprobados; migraciones y seeds en LocalDB nueva; recorrido real por Gateway.
Pendiente: integración contra contenedores Moodle después del reinicio requerido por Windows.
La migración histórica requiere prevalidación antes de aplicarse sobre datos del equipo.
