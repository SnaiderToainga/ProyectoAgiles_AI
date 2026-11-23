using EduMonitor.Core.DTOs;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EduMonitor.Tests;

/// <summary>
/// T-12.9: Pruebas unitarias xUnit de extracción curricular dinámica,
/// fotos de estudiantes y consistencia relacional (HU-06).
/// </summary>
public class CurriculoConsistenciaRelacionalTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AcademicoDbContext _db = null!;
    private readonly MockMoodleCurricularService _moodleMock = new();
    private readonly MoodleOptions _options = new();
    private MoodleSyncService _syncService = null!;
    private CatalogoService _catalogoService = null!;
    private CalculoPonderadoService _calculoPonderado = null!;
    private int _cursoId;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.EnsureCreatedAsync();

        // Docente titular vinculado
        _db.Docentes.Add(new Docente
        {
            UsuarioId = 77,
            MoodleUserId = 900,
            Nombre = "Ing. Carlos Docente Titular",
            Correo = "carlos.docente@uta.edu.ec"
        });
        await _db.SaveChangesAsync();

        _catalogoService = new CatalogoService(_db);
        _calculoPonderado = new CalculoPonderadoService(_db);
        _syncService = new MoodleSyncService(_db, _catalogoService, _moodleMock, Options.Create(_options));

        // Sincronizar catálogo inicial de cursos
        await _syncService.Cursos(77);
        _cursoId = await _db.Cursos.Select(c => c.Id).SingleAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task ExtraccionCurricular_CreaJerarquiaCompletaSinDuplicadosNiDatosQuemados()
    {
        // CA-06.1: Ingesta de unidades temáticas reales desde Moodle sin datos estáticos
        var resultado1 = await _syncService.Notas(77, _cursoId);
        Assert.True(resultado1.Items > 0);

        var parciales = await _db.Parciales.Where(p => p.CursoId == _cursoId).ToListAsync();
        Assert.Equal(2, parciales.Count);

        var unidades = await _db.Unidades.Include(u => u.Temas).ToListAsync();
        Assert.Equal(2, unidades.Count);

        var temas = await _db.Temas.ToListAsync();
        Assert.True(temas.Count >= 4);

        // Re-sincronizar para verificar idempotencia (no duplicar unidades ni temas)
        var resultado2 = await _syncService.Notas(77, _cursoId);
        Assert.Equal(resultado1.Items, resultado2.Items);

        Assert.Equal(2, await _db.Parciales.Where(p => p.CursoId == _cursoId).CountAsync());
        Assert.Equal(2, await _db.Unidades.CountAsync());
        Assert.Equal(temas.Count, await _db.Temas.CountAsync());
    }

    [Fact]
    public async Task ConsistenciaRelacional_TodaEvaluacionTieneTemasDelMismoParcial()
    {
        // CA-06.2: Toda actividad evaluativa categorizada bajo la unidad y tema respectivo
        await _syncService.Notas(77, _cursoId);

        var items = await _db.ItemsEvaluacion.Where(i => i.CursoId == _cursoId).ToListAsync();
        Assert.NotEmpty(items);

        var links = await _db.EvaluacionTemas
            .Include(et => et.Evaluacion)
            .Include(et => et.Tema)
                .ThenInclude(t => t.Unidad)
            .ToListAsync();

        Assert.NotEmpty(links);

        // 1. Cada evaluación debe tener al menos un tema vinculado
        var itemsConTemas = links.Select(l => l.ItemEvaluacionId).Distinct().ToHashSet();
        Assert.All(items, item => Assert.Contains(item.Id, itemsConTemas));

        // 2. Consistencia relacional estricta: Ningún tema pertenece a un parcial distinto
        Assert.All(links, link =>
        {
            Assert.NotNull(link.Evaluacion.ParcialId);
            Assert.Equal(link.Evaluacion.ParcialId, link.Tema.Unidad.ParcialId);
        });
    }

    [Fact]
    public async Task AsociacionCurricular_ExamenesCubrenTodosLosTemasDeLaUnidad()
    {
        await _syncService.Notas(77, _cursoId);

        var examenes = await _db.ItemsEvaluacion
            .Where(i => i.CursoId == _cursoId && i.Tipo == TipoItemEvaluacion.Examen)
            .ToListAsync();

        Assert.NotEmpty(examenes);

        foreach (var examen in examenes)
        {
            var temasVinculados = await _db.EvaluacionTemas
                .Where(et => et.ItemEvaluacionId == examen.Id)
                .Select(et => et.TemaId)
                .ToListAsync();

            var unidad = await _db.Unidades
                .Include(u => u.Temas)
                .FirstAsync(u => u.ParcialId == examen.ParcialId);

            // El examen debe cubrir la totalidad de los temas de la unidad
            Assert.Equal(unidad.Temas.Count, temasVinculados.Count);
            Assert.All(unidad.Temas, t => Assert.Contains(t.Id, temasVinculados));
        }
    }

    [Fact]
    public async Task AsociacionCurricular_CoincidenciaSemantica_VinculaTemasPorPalabrasClave()
    {
        // Preparar actividades específicas con palabras clave en Moodle
        _moodleMock.ActividadesPersonalizadas =
        [
            new(301, "Evaluación 1.2: Pilas y Colas en Memoria Dinámica", "assign", 401, Visible: 1, Uservisible: true),
            new(302, "Taller APE 1: Listas Enlazadas Simples y Dobles", "assign", 402, Visible: 1, Uservisible: true)
        ];

        await _syncService.Notas(77, _cursoId);

        var evalPilasColas = await _db.ItemsEvaluacion.SingleAsync(i => i.Nombre.Contains("Pilas y Colas"));
        var temasPilasColas = await _db.EvaluacionTemas
            .Where(et => et.ItemEvaluacionId == evalPilasColas.Id)
            .Include(et => et.Tema)
            .Select(et => et.Tema.Nombre)
            .ToListAsync();

        // Debe haber detectado "Pilas" y "colas"
        Assert.Contains(temasPilasColas, t => t.Contains("Pilas", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(temasPilasColas, t => t.Contains("colas", StringComparison.OrdinalIgnoreCase));

        var tallerListas = await _db.ItemsEvaluacion.SingleAsync(i => i.Nombre.Contains("Listas Enlazadas"));
        var temasListas = await _db.EvaluacionTemas
            .Where(et => et.ItemEvaluacionId == tallerListas.Id)
            .Include(et => et.Tema)
            .Select(et => et.Tema.Nombre)
            .ToListAsync();

        Assert.Contains(temasListas, t => t.Contains("listas", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task PreservacionDecisionesDocentes_SincronizacionRespetaClasificacionManual()
    {
        await _syncService.Notas(77, _cursoId);

        var item = await _db.ItemsEvaluacion.FirstAsync(i => i.CursoId == _cursoId);
        var parcial = await _db.Parciales.FirstAsync(p => p.Id == item.ParcialId);
        var temaElegido = await _db.Temas.FirstAsync(t => t.Unidad.ParcialId == parcial.Id);

        // Docente asigna manualmente un tema específico
        await _catalogoService.Clasificar(77, false, item.Id, new ClasificarRequest(parcial.Id, TipoItemEvaluacion.APE, [temaElegido.Id]));

        // Re-sincronizar desde Moodle
        await _syncService.Notas(77, _cursoId);

        var linksActuales = await _db.EvaluacionTemas
            .Where(et => et.ItemEvaluacionId == item.Id)
            .Select(et => et.TemaId)
            .ToListAsync();

        // Se conserva la decisión pedagógica manual del docente
        Assert.Single(linksActuales);
        Assert.Equal(temaElegido.Id, linksActuales[0]);

        var itemActualizado = await _db.ItemsEvaluacion.FindAsync(item.Id);
        Assert.Equal(TipoItemEvaluacion.APE, itemActualizado!.Tipo);
    }

    [Fact]
    public async Task ReubicacionSeccionMoodle_LimpiaTemasObsoletosYReasociaAlNuevoParcial()
    {
        await _syncService.Notas(77, _cursoId);

        var item = await _db.ItemsEvaluacion.FirstAsync(i => i.CursoId == _cursoId && i.MoodleItemId == 301);
        var parcialInicial = item.ParcialId;

        // Moodle traslada la actividad a la Sección 2 (Parcial 2)
        _moodleMock.ReubicarActividad(301, nuevaSeccion: 2);

        await _syncService.Notas(77, _cursoId);

        var itemReubicado = await _db.ItemsEvaluacion.SingleAsync(i => i.Id == item.Id);
        Assert.NotEqual(parcialInicial, itemReubicado.ParcialId);

        var parcial2 = await _db.Parciales.SingleAsync(p => p.CursoId == _cursoId && p.Numero == 2);
        Assert.Equal(parcial2.Id, itemReubicado.ParcialId);

        // Los temas vinculados deben pertenecer exclusivamente al Parcial 2
        var links = await _db.EvaluacionTemas
            .Where(et => et.ItemEvaluacionId == item.Id)
            .Include(et => et.Tema)
                .ThenInclude(t => t.Unidad)
            .ToListAsync();

        Assert.NotEmpty(links);
        Assert.All(links, l => Assert.Equal(parcial2.Id, l.Tema.Unidad.ParcialId));
    }

    [Fact]
    public async Task PerfilesEstudiantes_PersisteFotoUrlYConservaHistorialEnBajaDeMatricula()
    {
        // CA-06.3: URLs de fotografías de perfil oficiales
        await _syncService.Notas(77, _cursoId);

        var estudiantes = await _db.Estudiantes.ToListAsync();
        Assert.Equal(12, estudiantes.Count);

        // Validar que se persistieron fotos de perfil
        Assert.All(estudiantes, e =>
        {
            Assert.NotNull(e.FotoUrl);
            Assert.StartsWith("https://moodle.uta.edu.ec/avatar/", e.FotoUrl);
        });

        // Simular que un estudiante ya no consta en la nómina activa de Moodle
        _moodleMock.RetirarEstudianteId = 12; // Retirar alumno #12
        await _syncService.Notas(77, _cursoId);

        // La matrícula se retira de la materia activa
        Assert.Equal(11, await _db.Matriculas.Where(m => m.CursoId == _cursoId).CountAsync());

        // Pero la identidad del estudiante y sus notas históricas no se eliminan
        Assert.Equal(12, await _db.Estudiantes.CountAsync());
        Assert.Equal(144, await _db.Calificaciones.CountAsync());
    }

    [Fact]
    public async Task CalculoPonderadoIntegradoConCurriculo_AsociaTemasCriticosAEstudiantesEnRiesgo()
    {
        // Sincronizar escenario donde hay estudiantes con notas < 7.00
        _moodleMock.SimularNotaDeficienteEnTarea1 = true;
        await _syncService.Notas(77, _cursoId);

        // En el flujo académico las actividades clasificadas/visibles se publican para el cálculo de notas
        var items = await _db.ItemsEvaluacion.Where(i => i.CursoId == _cursoId).ToListAsync();
        items.ForEach(i => i.Publicado = true);
        await _db.SaveChangesAsync();

        var parcial1 = await _db.Parciales.FirstAsync(p => p.CursoId == _cursoId && p.Numero == 1);
        var resumenes = await _calculoPonderado.CalcularCursoAsync(_cursoId, parcial1.Id);

        Assert.Equal(12, resumenes.Count);

        var estudianteDeficienteDb = await _db.Estudiantes.SingleAsync(e => e.MoodleUserId == 1);
        var estudianteDeficiente = resumenes.First(r => r.EstudianteId == estudianteDeficienteDb.Id);
        Assert.NotEmpty(estudianteDeficiente.TemasDeficientes);

        foreach (var temaCritico in estudianteDeficiente.TemasDeficientes)
        {
            Assert.True(temaCritico.TemaId > 0);
            Assert.False(string.IsNullOrWhiteSpace(temaCritico.NombreTema));
            Assert.NotNull(temaCritico.NotaObtenida);
            Assert.True(temaCritico.NotaObtenida < 7.00m);
        }
    }

    private sealed class MockMoodleCurricularService : IMoodleService
    {
        public int? RetirarEstudianteId;
        public bool SimularNotaDeficienteEnTarea1;
        public List<MoodleModuloDto>? ActividadesPersonalizadas;
        private readonly Dictionary<int, int> _seccionPorModulo = new();

        public void ReubicarActividad(int moduloId, int nuevaSeccion)
        {
            _seccionPorModulo[moduloId] = nuevaSeccion;
        }

        public Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int docenteId, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<MoodleCursoDto>>([
                new(2, "Metodologías Ágiles", "SOF-401")
            ]);

        public Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int cursoId, CancellationToken ct = default)
        {
            var participantes = new List<MoodleParticipanteDto>
            {
                new(900, "Carlos", "Docente Titular", "Carlos Docente Titular", "carlos.docente@uta.edu.ec", [new("editingteacher")], null)
            };

            for (int i = 1; i <= 12; i++)
            {
                if (RetirarEstudianteId == i) continue;
                participantes.Add(new(
                    Id: i,
                    Firstname: $"Estudiante {i}",
                    Lastname: "UTA",
                    Fullname: $"Estudiante {i} UTA",
                    Email: $"estudiante.{i:D2}@uta.edu.ec",
                    Roles: [new("student")],
                    Profileimageurl: $"https://moodle.uta.edu.ec/avatar/{i}.png"
                ));
            }

            return Task.FromResult<IReadOnlyList<MoodleParticipanteDto>>(participantes);
        }

        public Task<IReadOnlyList<MoodleSeccionDto>> ObtenerContenidoCurso(int cursoId, CancellationToken ct = default)
        {
            var modulosS1 = new List<MoodleModuloDto>();
            var modulosS2 = new List<MoodleModuloDto>();

            if (ActividadesPersonalizadas != null)
            {
                modulosS1.AddRange(ActividadesPersonalizadas);
            }
            else
            {
                for (int i = 1; i <= 6; i++)
                {
                    var id = 300 + i;
                    var inst = 400 + i;
                    var seccion = _seccionPorModulo.GetValueOrDefault(id, 1);
                    var mod = new MoodleModuloDto(
                        Id: id,
                        Name: i == 6 ? "Examen Teórico - Práctico Primer Parcial" : i == 3 ? "Taller APE 1: Listas Enlazadas" : i == 1 ? "Evaluación 1.1: Pilas y Colas" : $"Tarea Parcial 1 #{i}",
                        Modname: "assign",
                        Instance: inst,
                        Visible: 1,
                        Uservisible: true
                    );
                    if (seccion == 1) modulosS1.Add(mod); else modulosS2.Add(mod);
                }

                for (int i = 7; i <= 12; i++)
                {
                    var id = 300 + i;
                    var inst = 400 + i;
                    var seccion = _seccionPorModulo.GetValueOrDefault(id, 2);
                    var mod = new MoodleModuloDto(
                        Id: id,
                        Name: i == 12 ? "Examen Teórico - Práctico Segundo Parcial" : i == 9 ? "Taller APE 2: Grafos" : $"Tarea Parcial 2 #{i}",
                        Modname: "assign",
                        Instance: inst,
                        Visible: 1,
                        Uservisible: true
                    );
                    if (seccion == 1) modulosS1.Add(mod); else modulosS2.Add(mod);
                }
            }

            var secciones = new List<MoodleSeccionDto>
            {
                new(100, "General", 0, [], "<p>Información General</p>", 1, true),
                new(10, "PRIMER PARCIAL: Estructuras Lineales", 1, modulosS1, "<p>Pilas, colas, listas simples y doblemente enlazadas, análisis asintótico Big-O.</p>", 1, true),
                new(20, "SEGUNDO PARCIAL: Grafos y Árboles", 2, modulosS2, "<p>Árboles binarios, balanceo AVL, grafos y recorridos BFS/DFS.</p>", 1, true)
            };

            return Task.FromResult<IReadOnlyList<MoodleSeccionDto>>(secciones);
        }

        public Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int cursoId, CancellationToken ct = default)
        {
            var usergrades = new List<MoodleUsuarioNotasDto>();

            for (int i = 1; i <= 12; i++)
            {
                if (RetirarEstudianteId == i) continue;

                var gradeitems = new List<MoodleItemDto>();
                int totalItems = ActividadesPersonalizadas?.Count ?? 12;

                for (int a = 1; a <= totalItems; a++)
                {
                    decimal? nota = 8.5m;
                    if (SimularNotaDeficienteEnTarea1 && i == 1 && a == 1)
                    {
                        nota = 4.0m; // Nota deficiente (< 7.00)
                    }

                    string itemNombre;
                    if (ActividadesPersonalizadas != null && a <= ActividadesPersonalizadas.Count)
                    {
                        itemNombre = ActividadesPersonalizadas[a - 1].Name;
                    }
                    else
                    {
                        itemNombre = a == 6 ? "Examen Teórico - Práctico Primer Parcial"
                            : a == 12 ? "Examen Teórico - Práctico Segundo Parcial"
                            : a == 3 ? "Taller APE 1: Listas Enlazadas"
                            : a == 1 ? "Evaluación 1.1: Pilas y Colas"
                            : $"Tarea Parcial #{a}";
                    }

                    gradeitems.Add(new MoodleItemDto(
                        Id: 300 + a,
                        Itemname: itemNombre,
                        Itemtype: "mod",
                        Itemmodule: "assign",
                        Iteminstance: 400 + a,
                        Graderaw: nota,
                        Grademin: 0,
                        Grademax: 10,
                        Gradedatesubmitted: 1700000000
                    ));
                }

                usergrades.Add(new MoodleUsuarioNotasDto(cursoId, i, gradeitems));
            }

            return Task.FromResult(new MoodleCalificacionesDto(usergrades));
        }

        public Task<MoodleTareasDto> ObtenerTareas(int cursoId, CancellationToken ct = default) =>
            Task.FromResult(new MoodleTareasDto([]));

        public Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int assignId, int userId, CancellationToken ct = default) =>
            Task.FromResult(new MoodleEstadoEntregaDto(new(new("submitted", 1700000000), null, 0, true)));
    }
}
