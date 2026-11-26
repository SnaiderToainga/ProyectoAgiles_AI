using EduMonitor.Core.DTOs;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EduMonitor.Tests;

public class MoodleCurriculoSyncTests : IAsyncLifetime
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private AcademicoDbContext db = null!;
    private readonly Fuente source = new();
    private readonly MoodleOptions options = new();
    private MoodleSyncService sync = null!;
    private int curso;

    public async Task InitializeAsync()
    {
        await connection.OpenAsync();
        db = new(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.Docentes.Add(new Docente { UsuarioId = 77, MoodleUserId = 900, Correo = "teacher@example.invalid" });
        await db.SaveChangesAsync();
        sync = new(db, new CatalogoService(db), source, Options.Create(options));
        await sync.Cursos(77);
        curso = await db.Cursos.Select(c => c.Id).SingleAsync();
    }

    public async Task DisposeAsync() { await db.DisposeAsync(); await connection.DisposeAsync(); }

    [Fact]
    public async Task DocePorDoceSinLlamadasIndividualesYReimportacionEstable()
    {
        var primera = await sync.Notas(77, curso);
        var ids = await db.Calificaciones.OrderBy(c => c.Id).Select(c => c.Id).ToArrayAsync();
        await sync.Notas(77, curso);
        Assert.Equal(12, primera.Estudiantes); Assert.Equal(12, primera.Items); Assert.Equal(144, primera.Calificaciones);
        Assert.Equal(0, source.ConsultasEstado); Assert.Equal(0, source.ConsultasTareas);
        Assert.Equal(ids, await db.Calificaciones.OrderBy(c => c.Id).Select(c => c.Id).ToArrayAsync());
        Assert.Equal(12, await db.Matriculas.CountAsync());
        Assert.Equal(2, await db.Unidades.CountAsync()); Assert.Equal(4, await db.Temas.CountAsync());
        Assert.All(await db.Estudiantes.ToListAsync(), e => Assert.Equal("https://example.invalid/foto.png", e.FotoUrl));
        Assert.All(await db.Calificaciones.ToListAsync(), c => Assert.Equal(EstadoCalificacion.Entregado, c.Estado));
        Assert.Equal(16, await db.EvaluacionTemas.CountAsync());
        var tipos = await db.ItemsEvaluacion.Select(i => i.Tipo).Distinct().ToListAsync();
        Assert.Contains(TipoItemEvaluacion.APE, tipos); Assert.Contains(TipoItemEvaluacion.Examen, tipos);
        Assert.All(await db.ItemsEvaluacion.ToListAsync(), i => Assert.NotNull(i.ParcialId));
    }

    [Fact]
    public async Task EvaluacionTemas_VinculaAutomaticamenteYRespetaConsistenciaParcial()
    {
        await sync.Notas(77, curso);

        var items = await db.ItemsEvaluacion.ToListAsync();
        Assert.Equal(12, items.Count);

        var links = await db.EvaluacionTemas
            .Include(et => et.Evaluacion)
            .Include(et => et.Tema)
                .ThenInclude(t => t.Unidad)
            .ToListAsync();

        Assert.NotEmpty(links);

        // Toda evaluación debe tener al menos un tema asociado
        var itemsConTemas = links.Select(l => l.ItemEvaluacionId).Distinct().ToHashSet();
        Assert.All(items, i => Assert.Contains(i.Id, itemsConTemas));

        // Todo tema asociado debe pertenecer al mismo parcial de la evaluación (consistencia relacional)
        Assert.All(links, link =>
            Assert.Equal(link.Evaluacion.ParcialId, link.Tema.Unidad.ParcialId));

        // Las evaluaciones tipo Examen deben vincularse a todos los temas de la unidad
        var examenes = items.Where(i => i.Tipo == TipoItemEvaluacion.Examen).ToList();
        Assert.NotEmpty(examenes);
        foreach (var ex in examenes)
        {
            var temasDelExamen = links.Where(l => l.ItemEvaluacionId == ex.Id).Select(l => l.TemaId).ToList();
            Assert.Equal(2, temasDelExamen.Count); // Unidad 1 tiene 2 temas ("Tema Alfa", "Tema Beta")
        }
    }

    [Fact]
    public async Task EvaluacionTemas_ConservaAsociacionesManualesDocentesEnReimportacion()
    {
        await sync.Notas(77, curso);

        var item = await db.ItemsEvaluacion.FirstAsync();
        var parcial = await db.Parciales.FirstAsync(p => p.Id == item.ParcialId);
        var temaManual = await db.Temas.FirstAsync(t => t.Unidad.ParcialId == parcial.Id);

        // El docente reclasifica manualmente la evaluación para asociarla exclusivamente a un tema
        var catalogo = new CatalogoService(db);
        await catalogo.Clasificar(77, false, item.Id, new ClasificarRequest(parcial.Id, item.Tipo, [temaManual.Id]));

        var temasAntes = await db.EvaluacionTemas
            .Where(et => et.ItemEvaluacionId == item.Id)
            .Select(et => et.TemaId)
            .ToListAsync();
        Assert.Single(temasAntes);
        Assert.Equal(temaManual.Id, temasAntes[0]);

        // Re-sincronizar calificaciones desde Moodle
        await sync.Notas(77, curso);

        // La decisión manual del docente se conserva intacta
        var temasDespues = await db.EvaluacionTemas
            .Where(et => et.ItemEvaluacionId == item.Id)
            .Select(et => et.TemaId)
            .ToListAsync();
        Assert.Single(temasDespues);
        Assert.Equal(temaManual.Id, temasDespues[0]);
    }

    [Fact]
    public async Task RenombrarConservaIdsClasificacionPublicacionYTemasExistentes()
    {
        await sync.Notas(77, curso);
        var item = await db.ItemsEvaluacion.FirstAsync(); var id = item.Id;
        item.Tipo = TipoItemEvaluacion.Examen; item.Publicado = true;
        var totalTemas = await db.Temas.CountAsync(); await db.SaveChangesAsync();
        source.Prefijo = "Tarea renombrada ";
        await sync.Notas(77, curso);
        var actual = await db.ItemsEvaluacion.SingleAsync(i => i.Id == id);
        Assert.StartsWith(source.Prefijo, actual.Nombre);
        Assert.Equal(TipoItemEvaluacion.Examen, actual.Tipo); Assert.True(actual.Publicado);
        Assert.Equal(totalTemas, await db.Temas.CountAsync());
    }

    [Fact]
    public async Task NotaCeroEvitaConsultaPeroNotaNulaConsultaEntrega()
    {
        source.Nota = null;
        await sync.Notas(77, curso);
        Assert.Equal(144, source.ConsultasEstado);
        Assert.All(await db.Calificaciones.ToListAsync(), c => {
            Assert.Null(c.Nota); Assert.Equal(EstadoCalificacion.PendienteCalificar, c.Estado);
        });
        source.Nota = 0;
        await sync.Notas(77, curso);
        Assert.Equal(144, source.ConsultasEstado);
        Assert.All(await db.Calificaciones.ToListAsync(), c => {
            Assert.Equal(0m, c.Nota); Assert.Equal(EstadoCalificacion.Entregado, c.Estado);
        });
    }

    [Theory]
    [InlineData("restricted")]
    [InlineData("missing-module")]
    [InlineData("missing-grades")]
    [InlineData("network")]
    public async Task PayloadIncompletoNoModificaDatosYRegistraFallo(string fallo)
    {
        await sync.Notas(77, curso);
        var item = await db.ItemsEvaluacion.FirstAsync(); item.Publicado = true; await db.SaveChangesAsync();
        source.Fallo = fallo; source.Prefijo = "No guardar ";
        await Assert.ThrowsAsync<MoodleException>(() => sync.Notas(77, curso));
        db.ChangeTracker.Clear();
        Assert.True((await db.ItemsEvaluacion.SingleAsync(i => i.Id == item.Id)).Publicado);
        Assert.DoesNotContain(await db.ItemsEvaluacion.ToListAsync(), i => i.Nombre.StartsWith("No guardar"));
        var log = await db.LogsSincronizacion.OrderBy(l => l.Id).LastAsync();
        Assert.False(log.Exitoso); Assert.Equal("Fallido", log.Estado);
        Assert.Equal(fallo == "network" ? "moodle_network" : "moodle_incomplete", log.MensajeError);
    }

    [Fact]
    public async Task FalloSqlRevierteTambienFotosUnidadesEItems()
    {
        await db.Database.ExecuteSqlRawAsync("CREATE TRIGGER rechazar_nota BEFORE INSERT ON Calificaciones BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
        await Assert.ThrowsAsync<AcademicoException>(() => sync.Notas(77, curso));
        db.ChangeTracker.Clear();
        Assert.Equal(0, await db.Estudiantes.CountAsync()); Assert.Equal(0, await db.Unidades.CountAsync());
        Assert.Equal(0, await db.ItemsEvaluacion.CountAsync()); Assert.Equal(0, await db.Calificaciones.CountAsync());
        Assert.Equal("local_persistence_error", (await db.LogsSincronizacion.OrderBy(l => l.Id).LastAsync()).MensajeError);
    }

    [Fact]
    public async Task OcultamientoExplicitoDespublicaSinBorrarHistoria()
    {
        await sync.Notas(77, curso);
        var items = await db.ItemsEvaluacion.ToListAsync(); items.ForEach(i => i.Publicado = true); await db.SaveChangesAsync();
        source.Oculto = true;
        await sync.Notas(77, curso);
        Assert.All(await db.ItemsEvaluacion.ToListAsync(), i => Assert.False(i.Publicado));
        Assert.Equal(144, await db.Calificaciones.CountAsync());
    }

    [Fact]
    public async Task SinAlumnosVisiblesAbortaYConservaMatriculas()
    {
        // Una cuenta de Moodle sin permiso para ver estudiantes solo devuelve al docente.
        await sync.Notas(77, curso);
        source.SinAlumnosVisibles = true;
        var ex = await Assert.ThrowsAsync<MoodleException>(() => sync.Notas(77, curso));
        Assert.Equal("moodle_incomplete", ex.Code);
        Assert.Equal(12, await db.Matriculas.CountAsync());
        Assert.Equal(144, await db.Calificaciones.CountAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AusenciaSoloDespublicaConInventarioVerificado(bool autoritativo)
    {
        await sync.Notas(77, curso);
        var item = await db.ItemsEvaluacion.SingleAsync(i => i.MoodleItemId == 301);
        item.Publicado = true; await db.SaveChangesAsync();
        options.ContentInventoryIsAuthoritative = autoritativo; source.EliminarPrimero = true;
        await sync.Notas(77, curso);
        Assert.Equal(!autoritativo, item.Publicado); Assert.Equal(144, await db.Calificaciones.CountAsync());
    }

    [Fact]
    public async Task SinVinculoDocenteNoUsaOtraIdentidad()
    {
        await Assert.ThrowsAsync<AcademicoException>(() => sync.Cursos(999));
        await Assert.ThrowsAsync<AcademicoException>(() => sync.Notas(999, curso));
    }

    [Fact]
    public async Task CuestionarioSinNotaNoConsultaEstadoDeTareaNiInventaEntrega()
    {
        source.EsQuiz = true; source.Nota = null;
        await sync.Notas(77, curso);
        Assert.Equal(0, source.ConsultasEstado); Assert.Equal(0, source.ConsultasTareas);
        Assert.Equal(144, await db.Calificaciones.CountAsync());
        Assert.All(await db.Calificaciones.ToListAsync(), n => Assert.Equal(EstadoCalificacion.NoDeterminado, n.Estado));
    }

    [Fact]
    public async Task NominaActualRetiraMatriculaPeroConservaAlumnoYNotasHistoricas()
    {
        await sync.Notas(77, curso);
        source.RetirarUltimoAlumno = true;
        await sync.Notas(77, curso);
        Assert.Equal(11, await db.Matriculas.CountAsync());
        Assert.Equal(12, await db.Estudiantes.CountAsync());
        Assert.Equal(144, await db.Calificaciones.CountAsync());
        var parcialId = await db.Parciales.Where(p => p.CursoId == curso && p.Numero == 1).Select(p => p.Id).SingleAsync();
        Assert.Equal(11, (await new CalculoPonderadoService(db).CalcularCursoAsync(curso, parcialId)).Count);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task MatrizParcialDeUnAlumnoAbortaSinGuardar(bool omitirTodas)
    {
        await sync.Notas(77, curso);
        var ids = await db.Calificaciones.OrderBy(n => n.Id).Select(n => n.Id).ToArrayAsync();
        source.OmitirPrimeraNota = !omitirTodas; source.OmitirNotasAlumno = omitirTodas;
        source.Prefijo = "No guardar "; source.Nota = 1;
        var ex = await Assert.ThrowsAsync<MoodleException>(() => sync.Notas(77, curso));
        Assert.Equal("moodle_incomplete", ex.Code);
        db.ChangeTracker.Clear();
        Assert.Equal(ids, await db.Calificaciones.OrderBy(n => n.Id).Select(n => n.Id).ToArrayAsync());
        Assert.All(await db.Calificaciones.ToListAsync(), n => Assert.Equal(8m, n.Nota));
        Assert.DoesNotContain(await db.ItemsEvaluacion.ToListAsync(), i => i.Nombre.StartsWith("No guardar"));
        Assert.False((await db.LogsSincronizacion.OrderBy(l => l.Id).LastAsync()).Exitoso);
    }

    [Fact]
    public async Task IdDelLibroDistintoPorAlumnoAborta()
    {
        source.CambiarIdPrimeraNota = true;
        var ex = await Assert.ThrowsAsync<MoodleException>(() => sync.Notas(77, curso));
        Assert.Equal("moodle_incomplete", ex.Code);
        Assert.Empty(await db.Calificaciones.ToListAsync());
    }

    [Fact]
    public async Task ModuloOcultoSinFilaDeNotasDespublicaYConservaHistorial()
    {
        await sync.Notas(77, curso);
        var items = await db.ItemsEvaluacion.ToListAsync();
        Assert.All(items, i => Assert.NotNull(i.MoodleModuleId));
        items.ForEach(i => i.Publicado = true); await db.SaveChangesAsync();
        source.Oculto = true; source.OmitirNotasOcultas = true;
        var result = await sync.Notas(77, curso);
        Assert.Equal(0, result.Calificaciones);
        Assert.All(await db.ItemsEvaluacion.ToListAsync(), i => Assert.False(i.Publicado));
        Assert.Equal(144, await db.Calificaciones.CountAsync());
        Assert.True((await db.LogsSincronizacion.SingleAsync(l => l.Id == result.LogId)).Exitoso);
    }

    [Fact]
    public async Task OcultamientoDeDatosLegadosSinVinculoNoConfirmaExitoSilencioso()
    {
        await sync.Notas(77, curso);
        var items = await db.ItemsEvaluacion.ToListAsync();
        items.ForEach(i => { i.Publicado = true; i.MoodleModuleId = null; });
        await db.SaveChangesAsync();
        source.Oculto = true; source.OmitirNotasOcultas = true;
        var ex = await Assert.ThrowsAsync<MoodleException>(() => sync.Notas(77, curso));
        Assert.Equal("moodle_module_mapping_required", ex.Code);
        db.ChangeTracker.Clear();
        Assert.All(await db.ItemsEvaluacion.ToListAsync(), i => Assert.True(i.Publicado));
        Assert.False((await db.LogsSincronizacion.OrderBy(l => l.Id).LastAsync()).Exitoso);
    }

    private sealed class Fuente : IMoodleService
    {
        public decimal? Nota = 8;
        public string Prefijo = "";
        public string Fallo = "";
        public bool Oculto, EliminarPrimero, EsQuiz, RetirarUltimoAlumno, SinAlumnosVisibles;
        public bool OmitirPrimeraNota, OmitirNotasAlumno, OmitirNotasOcultas, CambiarIdPrimeraNota;
        public int ConsultasEstado, ConsultasTareas;
        private IEnumerable<int> Actividades => Enumerable.Range(1, 12).Where(i => !EliminarPrimero || i != 1);
        private string Nombre(int i) => Prefijo + (i % 3 == 0 ? "Examen " : i % 3 == 1 ? "Evaluación " : "Taller APE ") + i;
        public Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int id, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<MoodleCursoDto>>([new(201, "Curso de prueba", "TEST-201")]);
        public Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int id, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<MoodleParticipanteDto>>(
                new[] { new MoodleParticipanteDto(900, "Docente", "Prueba", "Docente", null, [new("editingteacher")]) }
                .Concat(Enumerable.Range(1, SinAlumnosVisibles ? 0 : RetirarUltimoAlumno ? 11 : 12).Select(i => new MoodleParticipanteDto(i, "Alumno", i.ToString(), "Alumno", null,
                    [new("student")], "https://example.invalid/foto.png"))).ToList());
        public Task<IReadOnlyList<MoodleSeccionDto>> ObtenerContenidoCurso(int id, CancellationToken ct = default)
        {
            if (Fallo == "network") throw new MoodleException("moodle_network", "Synthetic network error");
            return Task.FromResult<IReadOnlyList<MoodleSeccionDto>>(Enumerable.Range(1, 2).Select(s => new MoodleSeccionDto(
                s, s == 1 ? "PRIMER PARCIAL" : "SEGUNDO PARCIAL", s,
                Actividades.Where(i => (i <= 6 ? 1 : 2) == s && (Fallo != "missing-module" || i != 1))
                    .Select(i => new MoodleModuloDto(100 + i, Nombre(i), EsQuiz ? "quiz" : "assign", 200 + i,
                        Visible: Oculto ? 0 : 1, Uservisible: !Oculto)).ToList(),
                "<p>Pilas, colas</p>", 1, Fallo != "restricted")).ToList());
        }
        public Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int id, CancellationToken ct = default) =>
            Task.FromResult(new MoodleCalificacionesDto(Enumerable.Range(1, Fallo == "missing-grades" ? 11 : 12)
                .Select(i => new MoodleUsuarioNotasDto(id, i, Actividades
                    .Where(a => !(OmitirPrimeraNota && i == 1 && a == 1) && !(OmitirNotasAlumno && i == 1) && !(OmitirNotasOcultas && Oculto))
                    .Select(a => new MoodleItemDto(
                    CambiarIdPrimeraNota && i == 1 && a == 1 ? 999 : 300 + a,
                    Nombre(a), "mod", EsQuiz ? "quiz" : "assign", 200 + a, Nota, 0, 10, null)).ToList())).ToList()));
        public Task<MoodleTareasDto> ObtenerTareas(int id, CancellationToken ct = default)
        {
            ConsultasTareas++;
            return Task.FromResult(new MoodleTareasDto([new(id, Actividades.Select(i => new MoodleTareaDto(200 + i, 0, 0)).ToList())]));
        }
        public Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int tarea, int usuario, CancellationToken ct = default)
        {
            Interlocked.Increment(ref ConsultasEstado);
            return Task.FromResult(new MoodleEstadoEntregaDto(new(new("submitted", 100), null, null, true)));
        }
    }
}
