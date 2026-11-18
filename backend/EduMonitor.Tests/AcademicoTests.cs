using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using EduMonitor.Infrastructure.Moodle;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Tests;
public class AcademicoTests : IAsyncLifetime
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private AcademicoDbContext db = null!;
    public async Task InitializeAsync()
    {
        await connection.OpenAsync();
        db = new(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        await AcademicoSeeder.Seed(db, 77, "Docente Prueba", "docente@example.invalid");
    }
    public async Task DisposeAsync() { await db.DisposeAsync(); await connection.DisposeAsync(); }
    [Fact]
    public async Task SeedEsIdempotenteYCatalogaJerarquia()
    {
        await AcademicoSeeder.Seed(db, 77, "Docente Prueba", "docente@example.invalid");
        var materias = await new CatalogoService(db).Materias(77, false);
        Assert.Equal(2, materias.Count); Assert.All(materias, m => Assert.Equal(2, m.Parciales.Count));
        Assert.Equal(8, await db.Unidades.CountAsync()); Assert.Equal(16, await db.Temas.CountAsync());
    }
    [Fact]
    public async Task TemaValidaUnidadDuplicadoYPropietario()
    {
        var service = new CatalogoService(db); var unidad = await db.Unidades.FirstAsync();
        var tema = await service.CrearTema(77, false, new(unidad.Id, "Tema adicional")); Assert.True(tema.Id > 0);
        Assert.Equal(409, (await Assert.ThrowsAsync<AcademicoException>(() => service.CrearTema(77, false, new(unidad.Id, "Tema adicional")))).Status);
        Assert.Equal(403, (await Assert.ThrowsAsync<AcademicoException>(() => service.Materias(88, false))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<AcademicoException>(() => service.CrearTema(77, false, new(999, "Tema")))).Status);
    }
    [Fact]
    public async Task EvaluacionExigeTemasDelMismoParcial()
    {
        var service = new CatalogoService(db); var tema = await db.Temas.Include(t => t.Unidad).FirstAsync();
        var other = await db.Parciales.FirstAsync(p => p.Id != tema.Unidad.ParcialId);
        await Assert.ThrowsAsync<AcademicoException>(() => service.CrearEvaluacion(77, false, new(tema.Unidad.ParcialId, "Vacía", TipoItemEvaluacion.Tarea, [])));
        await Assert.ThrowsAsync<AcademicoException>(() => service.CrearEvaluacion(77, false, new(other.Id, "Cruce", TipoItemEvaluacion.Tarea, [tema.Id])));
        var id = await service.CrearEvaluacion(77, false, new(tema.Unidad.ParcialId, "Válida", TipoItemEvaluacion.APE, [tema.Id]));
        Assert.True((await db.ItemsEvaluacion.FindAsync(id))!.Publicado); Assert.Equal(1, await db.EvaluacionTemas.CountAsync());
    }
    [Fact]
    public async Task IntegridadRechazaTemaHuerfano()
    {
        db.Temas.Add(new() { UnidadId = 999, Nombre = "Huérfano" });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
    [Theory]
    [InlineData(0, 0)]
    [InlineData(80, 8)]
    [InlineData(100, 10)]
    public void NormalizaSinPerderCero(int raw, int expected) => Assert.Equal(expected, MoodleSyncService.Normalizar(Item(raw)));
    [Fact]
    public void NullNoEquivaleACeroNiSinEntrega()
    {
        Assert.Null(MoodleSyncService.Normalizar(Item(null)));
        Assert.Equal(EstadoCalificacion.NoDeterminado, EstadoCalificacionResolver.Resolver(Item(null), null, null, DateTimeOffset.UtcNow));
        Assert.Equal(EstadoCalificacion.Entregado, EstadoCalificacionResolver.Resolver(Item(0), null, null, DateTimeOffset.UtcNow));
    }
    [Fact]
    public void EntregaSinNotaEsPendienteDeCalificar()
    {
        var estado = new MoodleEstadoEntregaDto(new(new("submitted", 100), null, 0, true));
        Assert.Equal(EstadoCalificacion.PendienteCalificar, EstadoCalificacionResolver.Resolver(Item(null), new(1, 50, 0), estado, DateTimeOffset.UtcNow));
    }
    [Fact]
    public void NoEntregaNecesitaEvidenciaDeFechaEfectiva()
    {
        var estado = new MoodleEstadoEntregaDto(new(new("new", 0), null, 50, true));
        Assert.Equal(EstadoCalificacion.SinEntrega, EstadoCalificacionResolver.Resolver(Item(null), new(1, 50, 0), estado, DateTimeOffset.FromUnixTimeSeconds(100)));
    }
    [Fact] public void EscalaInvalidaSeRechaza() => Assert.Throws<MoodleException>(() => MoodleSyncService.Normalizar(Item(101)));

    [Fact]
    public async Task PlanRefuerzo_PersistenciaYConsultaPorCurso()
    {
        var service = new CatalogoService(db);
        var curso = await db.Cursos.FirstAsync();
        var tema = await db.Temas.FirstAsync();
        var estudiante = new Estudiante { MoodleUserId = 101, Nombres = "Juan", Apellidos = "Pérez", Correo = "juan@example.invalid" };
        db.Estudiantes.Add(estudiante);
        await db.SaveChangesAsync();
        db.Matriculas.Add(new Matricula { CursoId = curso.Id, EstudianteId = estudiante.Id });
        await db.SaveChangesAsync();

        var request = new CrearPlanRefuerzoRequest(
            EstudianteId: estudiante.Id,
            CursoId: curso.Id,
            DiagnosticoGeneral: "Presenta dificultades en estimación ágil.",
            NivelRiesgo: "Alto",
            EsFallback: false,
            Detalles:
            [
                new CrearDetallePlanRequest(
                    TemaId: tema.Id,
                    ActividadSugerida: "Resolver ejercicios prácticos de Planning Poker",
                    Prioridad: "Alta",
                    TiempoEstimadoHoras: 4,
                    RecursoRecomendado: "Guía Scrum UTA Capítulo 3"
                )
            ]
        );

        var planId = await service.CrearPlan(77, false, request);
        Assert.True(planId > 0);

        var planes = await service.PlanesPorCurso(77, false, curso.Id);
        Assert.Single(planes);
        var p = planes[0];
        Assert.Equal("Juan Pérez", p.EstudianteNombre);
        Assert.Equal("Alto", p.NivelRiesgo);
        Assert.False(p.EsFallback);
        Assert.Single(p.Detalles);
        Assert.Equal(tema.Id, p.Detalles[0].TemaId);
        Assert.Equal(4, p.Detalles[0].TiempoEstimadoHoras);
    }

    [Fact]
    public async Task ReporteConsolidadoCurso_IncluyeMembreteEstadisticas303040FirmaYPaginacion()
    {
        var service = new CatalogoService(db);
        var curso = await db.Cursos.OrderBy(c => c.Id).FirstAsync();
        var parcial = await db.Parciales.Where(p => p.CursoId == curso.Id).OrderBy(p => p.Numero).FirstAsync();
        var tema = await db.Temas.Include(t => t.Unidad).FirstAsync(t => t.Unidad.ParcialId == parcial.Id);

        var idTarea = await service.CrearEvaluacion(77, false, new(parcial.Id, "Tarea 1", TipoItemEvaluacion.Tarea, [tema.Id]));
        var idApe = await service.CrearEvaluacion(77, false, new(parcial.Id, "APE 1", TipoItemEvaluacion.APE, [tema.Id]));
        var idExamen = await service.CrearEvaluacion(77, false, new(parcial.Id, "Examen 1", TipoItemEvaluacion.Examen, [tema.Id]));

        // Matricular 16 estudiantes (1 aprobado y 15 en riesgo para validar paginación de 2 páginas)
        var estudiantes = new List<Estudiante>();
        for (int i = 1; i <= 16; i++)
        {
            var est = new Estudiante
            {
                MoodleUserId = 500 + i,
                Nombres = $"Nombre{i:D2}",
                Apellidos = $"Apellido{i:D2}",
                Correo = $"est{i:D2}@uta.edu.ec",
                FotoUrl = $"https://moodle.uta.edu.ec/avatar/{i}.png"
            };
            db.Estudiantes.Add(est);
            estudiantes.Add(est);
        }
        await db.SaveChangesAsync();

        foreach (var (est, idx) in estudiantes.Select((e, idx) => (e, idx)))
        {
            db.Matriculas.Add(new Matricula { CursoId = curso.Id, EstudianteId = est.Id });
            var nota = idx == 0 ? 9.0m : 5.0m;
            db.Calificaciones.AddRange(
                new Calificacion { ItemEvaluacionId = idTarea, EstudianteId = est.Id, Nota = nota, Estado = EstadoCalificacion.Entregado },
                new Calificacion { ItemEvaluacionId = idApe, EstudianteId = est.Id, Nota = nota, Estado = EstadoCalificacion.Entregado },
                new Calificacion { ItemEvaluacionId = idExamen, EstudianteId = est.Id, Nota = nota, Estado = EstadoCalificacion.Entregado }
            );
        }
        await db.SaveChangesAsync();

        await service.CrearPlan(77, false, new CrearPlanRefuerzoRequest(
            EstudianteId: estudiantes[1].Id,
            CursoId: curso.Id,
            DiagnosticoGeneral: "Requiere refuerzo en pruebas unitarias.",
            NivelRiesgo: "Alto",
            EsFallback: false,
            Detalles: [new CrearDetallePlanRequest(tema.Id, "Taller guiado", "Alta", 3, "Guía FISEI")]
        ));

        var reporte = await service.ReporteConsolidadoCurso(77, false, curso.Id, parcialNumero: parcial.Numero);

        Assert.Equal(curso.Id, reporte.CursoId);
        Assert.Equal(parcial.Id, reporte.ParcialId);
        Assert.Equal("Universidad Técnica de Ambato", reporte.Membrete.Universidad);
        Assert.Contains("FISEI", reporte.Membrete.Facultad);
        Assert.Equal("Docente Prueba", reporte.Membrete.DocenteTitular);

        Assert.Equal(16, reporte.ResumenEstadistico.TotalEstudiantes);
        Assert.Equal(1, reporte.ResumenEstadistico.TotalAprobados);
        Assert.Equal(15, reporte.ResumenEstadistico.TotalEnRiesgo);
        Assert.Equal(6.25m, reporte.ResumenEstadistico.PorcentajeAprobados);
        Assert.Equal(93.75m, reporte.ResumenEstadistico.PorcentajeEnRiesgo);

        Assert.Equal("Docente Prueba", reporte.BloqueFirma.NombreDocente);
        Assert.Equal("Firma y Rúbrica del Docente Titular", reporte.BloqueFirma.EtiquetaCasillero);
        Assert.Contains("30/30/40", reporte.BloqueFirma.LeyendaConformidad);

        Assert.Equal(2, reporte.PiePagina.TotalPaginasEstimadas);
        Assert.Equal("Página 1 de 2", reporte.PiePagina.NumeracionInicial);
        Assert.Equal(["Página 1 de 2", "Página 2 de 2"], reporte.PiePagina.Paginas);

        var filaConPlan = reporte.Estudiantes.Single(e => e.EstudianteId == estudiantes[1].Id);
        Assert.True(filaConPlan.EnRiesgo);
        Assert.NotNull(filaConPlan.PlanRefuerzoVigente);
        Assert.Equal("Requiere refuerzo en pruebas unitarias.", filaConPlan.PlanRefuerzoVigente!.DiagnosticoGeneral);
    }

    [Fact]
    public async Task ReporteIndividualTutoria_IncluyeDiagnosticoCausaPrincipalYFirma()
    {
        var service = new CatalogoService(db);
        var curso = await db.Cursos.OrderBy(c => c.Id).FirstAsync();
        var parcial = await db.Parciales.Where(p => p.CursoId == curso.Id).OrderBy(p => p.Numero).FirstAsync();
        var tema = await db.Temas.Include(t => t.Unidad).FirstAsync(t => t.Unidad.ParcialId == parcial.Id);

        var idExamen = await service.CrearEvaluacion(77, false, new(parcial.Id, "Examen Parcial", TipoItemEvaluacion.Examen, [tema.Id]));
        var estudiante = new Estudiante { MoodleUserId = 801, Nombres = "Ana", Apellidos = "Gómez", Correo = "agomez@uta.edu.ec" };
        db.Estudiantes.Add(estudiante);
        await db.SaveChangesAsync();

        db.Matriculas.Add(new Matricula { CursoId = curso.Id, EstudianteId = estudiante.Id });
        db.Calificaciones.Add(new Calificacion { ItemEvaluacionId = idExamen, EstudianteId = estudiante.Id, Nota = 4.5m, Estado = EstadoCalificacion.Entregado });
        await db.SaveChangesAsync();

        var reporteInd = await service.ReporteIndividualTutoria(77, false, curso.Id, estudiante.Id, parcialId: parcial.Id);

        Assert.Equal(estudiante.Id, reporteInd.Estudiante.EstudianteId);
        Assert.True(reporteInd.Estudiante.EnRiesgo);
        Assert.Contains("Examen (40%)", reporteInd.CausaPrincipalRendimiento);
        Assert.Equal("Página 1 de 1", reporteInd.PiePagina.NumeracionInicial);
        Assert.Equal("Docente Prueba", reporteInd.BloqueFirma.NombreDocente);
    }

    private static MoodleItemDto Item(decimal? raw) => new(1, "Tarea", "mod", "assign", 1, raw, 0, 100, null);
}
