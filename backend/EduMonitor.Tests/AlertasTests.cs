using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs.Calculo;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Tests;

/// <summary>Reglas de alerta deterministas (RF-07) e indicadores de progreso (RF-05/RF-06).</summary>
public class AlertasReglasTests
{
    private readonly IndicadoresService _servicio = new();
    private static readonly ConfiguracionAlertasDto Config = ConfiguracionAlertasDto.Predeterminada;

    private static Calificacion C(int orden, string nombre, decimal? nota, EstadoCalificacion estado = EstadoCalificacion.Entregado) => new()
    {
        Nota = nota,
        Estado = nota.HasValue ? EstadoCalificacion.Entregado : estado,
        ItemEvaluacion = new ItemEvaluacion { Id = orden, Orden = orden, Nombre = nombre, Tipo = TipoItemEvaluacion.Tarea },
    };

    private static ResumenAcademicoEstudianteDto Resumen(decimal nota, bool sinEvaluaciones = false, bool provisional = false) =>
        new(1, "Ana", "Lema", "a@x.invalid", 1, 1, nota, !sinEvaluaciones && nota < 7, [], [], null, sinEvaluaciones, provisional);

    private List<AlertaAcademicaDto> Evaluar(ResumenAcademicoEstudianteDto r, List<Calificacion> cals, ConfiguracionAlertasDto? config = null) =>
        _servicio.EvaluarAlertas(r, cals, _servicio.CalcularProgreso(cals, cals.Count), config ?? Config);

    [Fact]
    public void Progreso_DiferenciaEstadosYExcluyeLoQueAunNoVence()
    {
        var cals = new List<Calificacion>
        {
            C(1, "T1", 8m), C(2, "T2", 0m), C(3, "T3", null, EstadoCalificacion.SinEntrega),
            C(4, "T4", null, EstadoCalificacion.PendienteCalificar), C(5, "T5", null, EstadoCalificacion.PendienteEntrega),
        };
        var p = _servicio.CalcularProgreso(cals, totalActividades: 6);

        Assert.Equal((6, 2, 1, 1, 1, 1), (p.TotalActividades, p.Calificadas, p.SinEntrega, p.PendientesCalificar, p.PendientesEntrega, p.SinDato));
        Assert.Equal(3, p.Completadas);   // dos calificadas (incluido el 0) + una entregada por calificar
        Assert.Equal(4, p.Exigibles);     // la que aún no vence y la desconocida no cuentan
        Assert.Equal(75.0m, p.PorcentajeFinalizacion);
    }

    [Fact]
    public void Descenso_SeActivaConEvidenciaDeLasUltimasEvaluaciones()
    {
        var cals = new List<Calificacion> { C(1, "Taller 1", 9m), C(2, "Taller 2", 8.5m), C(3, "Taller 3", 5m), C(4, "Taller 4", 4m) };
        var alerta = Assert.Single(Evaluar(Resumen(7.1m), cals), a => a.Regla == ReglasAlerta.Descenso);

        Assert.Contains("4.50", alerta.Evidencia);   // promedio de las 2 últimas
        Assert.Contains("8.75", alerta.Evidencia);   // promedio de las anteriores
        Assert.Contains("4.25", alerta.Evidencia);   // caída
        Assert.Equal(["Taller 3 (5.00)", "Taller 4 (4.00)"], alerta.Actividades);
    }

    [Fact]
    public void Descenso_RespetaElOrdenDelCursoYNoSeActivaSiMejora()
    {
        // Mismas notas que el caso anterior, pero en el curso las bajas fueron primero: es una mejora.
        var cals = new List<Calificacion> { C(3, "Taller 3", 9m), C(4, "Taller 4", 8.5m), C(1, "Taller 1", 5m), C(2, "Taller 2", 4m) };
        Assert.DoesNotContain(Evaluar(Resumen(7.1m), cals), a => a.Regla == ReglasAlerta.Descenso);
    }

    [Fact]
    public void Atrasos_CuentaSoloVencidasSinEntrega()
    {
        var cals = new List<Calificacion>
        {
            C(1, "T1", 9m), C(2, "T2", null, EstadoCalificacion.SinEntrega), C(3, "T3", null, EstadoCalificacion.SinEntrega),
            C(4, "T4", null, EstadoCalificacion.PendienteCalificar), C(5, "T5", null, EstadoCalificacion.PendienteEntrega),
        };
        var alerta = Assert.Single(Evaluar(Resumen(8m), cals), a => a.Regla == ReglasAlerta.Atrasos);
        Assert.Equal(["T2", "T3"], alerta.Actividades);
        Assert.StartsWith("2 actividades vencieron sin entrega", alerta.Evidencia);
    }

    [Fact]
    public void Finalizacion_UsaElUmbralConfigurado()
    {
        var cals = new List<Calificacion>
        {
            C(1, "T1", 9m), C(2, "T2", null, EstadoCalificacion.SinEntrega), C(3, "T3", null, EstadoCalificacion.SinEntrega),
        };
        var alerta = Assert.Single(Evaluar(Resumen(8m), cals), a => a.Regla == ReglasAlerta.Finalizacion);
        Assert.Contains("1 de 3", alerta.Evidencia);

        var tolerante = Config with { FinalizacionMinimaPct = 30m, AtrasosActivo = false, DescensoActivo = false };
        Assert.Empty(Evaluar(Resumen(8m), cals, tolerante));
    }

    [Fact]
    public void Rendimiento_IndicaCalculoProvisionalYNoAplicaSinEvaluaciones()
    {
        var alerta = Assert.Single(Evaluar(Resumen(5.4m, provisional: true), [C(1, "Examen", 5.4m)]), a => a.Regla == ReglasAlerta.Rendimiento);
        Assert.Contains("5.40", alerta.Evidencia);
        Assert.Contains("provisional", alerta.Evidencia);

        var pendientes = new List<Calificacion> { C(1, "T1", null, EstadoCalificacion.PendienteCalificar) };
        Assert.Empty(Evaluar(Resumen(0m, sinEvaluaciones: true), pendientes));
    }

    [Fact]
    public void ReglasDesactivadas_NoGeneranAlertas()
    {
        var cals = new List<Calificacion>
        {
            C(1, "T1", 9m), C(2, "T2", 9m), C(3, "T3", 2m), C(4, "T4", null, EstadoCalificacion.SinEntrega),
            C(5, "T5", null, EstadoCalificacion.SinEntrega),
        };
        var apagadas = new ConfiguracionAlertasDto(false, 7m, false, 2, 1.5m, false, 2, false, 60m);
        Assert.Empty(Evaluar(Resumen(4m), cals, apagadas));
    }

    [Fact]
    public void Evidencia_NoUsaEtiquetasDefinitivas()
    {
        var cals = new List<Calificacion>
        {
            C(1, "T1", 9m), C(2, "T2", 2m), C(3, "T3", 1m), C(4, "T4", null, EstadoCalificacion.SinEntrega),
            C(5, "T5", null, EstadoCalificacion.SinEntrega),
        };
        var texto = string.Join(" ", Evaluar(Resumen(3m), cals).Select(a => a.Titulo + " " + a.Evidencia)).ToLowerInvariant();
        foreach (var etiqueta in new[] { "reprob", "fracas", "no es capaz", "perdió" })
            Assert.DoesNotContain(etiqueta, texto);
    }
}

public class AlertasServiceTests : IAsyncLifetime
{
    private const int UsuarioDocente = 81;
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AcademicoDbContext _db = null!;
    private AlertasService _alertas = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(_connection).Options);
        await _db.Database.EnsureCreatedAsync();
        var catalogo = new CatalogoService(_db);
        _alertas = new AlertasService(_db, catalogo, new CalculoPonderadoService(_db), new IndicadoresService());
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task CasoDePrueba_ActivaAtrasosConEvidenciaYRespetaLaConfiguracionGuardada()
    {
        var (cursoId, parcialId) = await Preparar();

        var resultado = await _alertas.Alertas(UsuarioDocente, false, cursoId, parcialId);
        Assert.False(resultado.ConfiguracionPersonalizada);
        var conAlerta = resultado.Estudiantes[0];
        Assert.Equal("Pérez", conAlerta.Apellidos);
        var atraso = Assert.Single(conAlerta.Alertas, a => a.Regla == ReglasAlerta.Atrasos);
        Assert.Equal(["Tarea 2", "Tarea 3"], atraso.Actividades);
        Assert.Empty(resultado.Estudiantes.Single(e => e.Apellidos == "Lema").Alertas);
        Assert.Equal(1, resultado.EstudiantesConAlertas);

        // El docente sube el mínimo de atrasos: la misma situación deja de alertar.
        var config = ConfiguracionAlertasDto.Predeterminada with { AtrasosMinimo = 3, FinalizacionActivo = false };
        await _alertas.GuardarConfiguracion(UsuarioDocente, false, cursoId, config);
        Assert.Equal(config, await _alertas.Configuracion(UsuarioDocente, false, cursoId));

        var despues = await _alertas.Alertas(UsuarioDocente, false, cursoId, parcialId);
        Assert.True(despues.ConfiguracionPersonalizada);
        Assert.DoesNotContain(despues.Estudiantes.SelectMany(e => e.Alertas), a => a.Regla == ReglasAlerta.Atrasos);
        Assert.Equal(UsuarioDocente, (await _db.ConfiguracionesAlertas.SingleAsync()).ActualizadoPorUsuarioId);
    }

    [Fact]
    public async Task OtroDocenteNoPuedeVerNiConfigurarAlertas()
    {
        var (cursoId, parcialId) = await Preparar();
        Assert.Equal(403, (await Assert.ThrowsAsync<AcademicoException>(() => _alertas.Alertas(999, false, cursoId, parcialId))).Status);
        Assert.Equal(403, (await Assert.ThrowsAsync<AcademicoException>(() =>
            _alertas.GuardarConfiguracion(999, false, cursoId, ConfiguracionAlertasDto.Predeterminada))).Status);
    }

    private async Task<(int, int)> Preparar()
    {
        var docente = new Docente { UsuarioId = UsuarioDocente, Nombre = "Docente", Correo = "d@x.invalid", ClaveHash = "h" };
        _db.Docentes.Add(docente);
        await _db.SaveChangesAsync();
        var curso = new Curso { Codigo = "SOF-401", Nombre = "Ágiles", Periodo = "2026-2", DocenteId = docente.Id };
        _db.Cursos.Add(curso);
        await _db.SaveChangesAsync();
        var parcial = new Parcial { CursoId = curso.Id, Numero = 1 };
        _db.Parciales.Add(parcial);
        var atrasado = new Estudiante { Nombres = "Juan", Apellidos = "Pérez", Correo = "j@x.invalid", MoodleUserId = 1 };
        var alDia = new Estudiante { Nombres = "Ana", Apellidos = "Lema", Correo = "a@x.invalid", MoodleUserId = 2 };
        _db.Estudiantes.AddRange(atrasado, alDia);
        await _db.SaveChangesAsync();
        _db.Matriculas.AddRange(
            new Matricula { CursoId = curso.Id, EstudianteId = atrasado.Id, FechaMatricula = DateTime.UtcNow },
            new Matricula { CursoId = curso.Id, EstudianteId = alDia.Id, FechaMatricula = DateTime.UtcNow });

        var items = Enumerable.Range(1, 3).Select(i => new ItemEvaluacion
        {
            CursoId = curso.Id, ParcialId = parcial.Id, Nombre = $"Tarea {i}", Orden = i, Tipo = TipoItemEvaluacion.Tarea, Publicado = true,
        }).ToList();
        _db.ItemsEvaluacion.AddRange(items);
        await _db.SaveChangesAsync();
        _db.Calificaciones.AddRange(
            new Calificacion { ItemEvaluacionId = items[0].Id, EstudianteId = atrasado.Id, Nota = 9m, Estado = EstadoCalificacion.Entregado },
            new Calificacion { ItemEvaluacionId = items[1].Id, EstudianteId = atrasado.Id, Estado = EstadoCalificacion.SinEntrega },
            new Calificacion { ItemEvaluacionId = items[2].Id, EstudianteId = atrasado.Id, Estado = EstadoCalificacion.SinEntrega },
            new Calificacion { ItemEvaluacionId = items[0].Id, EstudianteId = alDia.Id, Nota = 8m, Estado = EstadoCalificacion.Entregado },
            new Calificacion { ItemEvaluacionId = items[1].Id, EstudianteId = alDia.Id, Nota = 8.5m, Estado = EstadoCalificacion.Entregado },
            new Calificacion { ItemEvaluacionId = items[2].Id, EstudianteId = alDia.Id, Estado = EstadoCalificacion.PendienteCalificar });
        await _db.SaveChangesAsync();
        return (curso.Id, parcial.Id);
    }
}
