using System.Text.Json;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Tests;

public class AgenteServiceTests : IAsyncLifetime
{
    private const int UsuarioDocente = 55;
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AcademicoDbContext _db = null!;
    private AgenteService _agente = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(_connection).Options);
        await _db.Database.EnsureCreatedAsync();
        _agente = new AgenteService(_db, new CatalogoService(_db), new CalculoPonderadoService(_db));
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task DatosCurso_NoExponeNombresNiCorreosYUsaCodigoEstable()
    {
        var e = await Preparar();
        var datos = await _agente.DatosCurso(UsuarioDocente, admin: false, e.CursoId, e.ParcialId);

        var json = JsonSerializer.Serialize(datos);
        Assert.DoesNotContain("Pérez", json);
        Assert.DoesNotContain("Juan", json);
        Assert.DoesNotContain("@uta.edu.ec", json);
        Assert.DoesNotContain("Ana", json);

        var estudiante = Assert.Single(datos.Estudiantes);
        Assert.Equal(AgenteService.CodigoEstudiante(e.EvaluadoId), estudiante.Codigo);
        // Tarea vencida (0 × 30 %) + examen 4.00 × 40 %, normalizado sobre el 70 % evaluado = 2.29 provisional.
        Assert.Equal(2.29m, estudiante.NotaFinal);
        Assert.True(estudiante.CalculoProvisional);
        Assert.True(estudiante.EnRiesgo);
        Assert.Contains("Árboles AVL", estudiante.TemasDeficientes);
    }

    [Fact]
    public async Task DatosCurso_ExcluyeSinEvaluacionesYPendientesPeroCuentaSinEntrega()
    {
        var e = await Preparar();
        var datos = await _agente.DatosCurso(UsuarioDocente, admin: false, e.CursoId, e.ParcialId);

        Assert.Equal(1, datos.Contexto.TotalEstudiantes);
        Assert.Equal(1, datos.Contexto.SinEvaluaciones);
        var evaluaciones = datos.Estudiantes.Single().Evaluaciones;
        Assert.Contains(evaluaciones, ev => ev.Nombre == "Tarea vencida" && ev.Nota == 0m && ev.Estado == "Sin entrega");
        Assert.DoesNotContain(evaluaciones, ev => ev.Nombre == "Tarea por calificar");
    }

    [Fact]
    public async Task Estudiante_PorCodigo_DevuelveSoloEseEstudiante()
    {
        var e = await Preparar();
        var codigo = AgenteService.CodigoEstudiante(e.EvaluadoId).ToLowerInvariant();
        var estudiante = await _agente.Estudiante(UsuarioDocente, false, e.CursoId, e.ParcialId, codigo);
        Assert.Equal(AgenteService.CodigoEstudiante(e.EvaluadoId), estudiante.Codigo);

        var noEvaluado = AgenteService.CodigoEstudiante(e.SinNotasId);
        var ex = await Assert.ThrowsAsync<AcademicoException>(() =>
            _agente.Estudiante(UsuarioDocente, false, e.CursoId, e.ParcialId, noEvaluado));
        Assert.Equal(404, ex.Status);
        Assert.Equal(400, (await Assert.ThrowsAsync<AcademicoException>(() =>
            _agente.Estudiante(UsuarioDocente, false, e.CursoId, e.ParcialId, "Juan Pérez"))).Status);
    }

    [Fact]
    public async Task DatosCurso_RechazaParcialAjenoYDocenteSinAsignacion()
    {
        var e = await Preparar();
        var otro = new Curso { Codigo = "SOF-999", Nombre = "Otra", Periodo = "2026-2", DocenteId = e.DocenteId };
        _db.Cursos.Add(otro);
        await _db.SaveChangesAsync();
        var parcialAjeno = new Parcial { CursoId = otro.Id, Numero = 1 };
        _db.Parciales.Add(parcialAjeno);
        await _db.SaveChangesAsync();

        Assert.Equal(404, (await Assert.ThrowsAsync<AcademicoException>(() =>
            _agente.DatosCurso(UsuarioDocente, false, e.CursoId, parcialAjeno.Id))).Status);
        Assert.Equal(403, (await Assert.ThrowsAsync<AcademicoException>(() =>
            _agente.DatosCurso(9999, false, e.CursoId, e.ParcialId))).Status);
    }

    [Fact]
    public async Task Trazas_SeRegistranConElUsuarioDelTokenYElDocenteSoloVeLasSuyas()
    {
        var e = await Preparar();
        var paso = new PasoTrazaAgenteDto("listar_estudiantes_en_riesgo", "{}", "1 en riesgo", true, null, 12);
        await _agente.RegistrarTraza(UsuarioDocente, false,
            new RegistrarTrazaAgenteRequest(e.CursoId, e.ParcialId, "curso", "¿Quién está en riesgo?", "gemini", false, true, null, 900, [paso]));
        _db.TrazasAgente.Add(new TrazaAgente { UsuarioId = 777, Modo = "curso", Consulta = "otra", Exitoso = true });
        await _db.SaveChangesAsync();

        var propias = await _agente.Trazas(UsuarioDocente, admin: false, limite: 10);
        var traza = Assert.Single(propias);
        Assert.Equal("Docente Prueba", traza.Usuario);
        Assert.Equal("listar_estudiantes_en_riesgo", Assert.Single(traza.Pasos).Herramienta);
        Assert.Equal(DateTimeKind.Utc, traza.Fecha.Kind);
        Assert.Equal(2, (await _agente.Trazas(UsuarioDocente, admin: true, limite: 10)).Count);
    }

    private sealed record Escenario(int DocenteId, int CursoId, int ParcialId, int EvaluadoId, int SinNotasId);

    private async Task<Escenario> Preparar()
    {
        var docente = new Docente { UsuarioId = UsuarioDocente, Nombre = "Docente Prueba", Correo = "docente@uta.edu.ec", ClaveHash = "hash" };
        _db.Docentes.Add(docente);
        await _db.SaveChangesAsync();
        var curso = new Curso { Codigo = "SOF-501", Nombre = "Sistemas Inteligentes", Periodo = "2026-1", DocenteId = docente.Id };
        _db.Cursos.Add(curso);
        await _db.SaveChangesAsync();
        var parcial = new Parcial { CursoId = curso.Id, Numero = 1 };
        _db.Parciales.Add(parcial);
        await _db.SaveChangesAsync();
        var unidad = new Unidad { ParcialId = parcial.Id, Numero = 1, Nombre = "Unidad 1" };
        _db.Unidades.Add(unidad);
        await _db.SaveChangesAsync();
        var tema = new Tema { UnidadId = unidad.Id, Nombre = "Árboles AVL", Descripcion = "" };
        _db.Temas.Add(tema);

        var evaluado = new Estudiante { Nombres = "Juan", Apellidos = "Pérez", Correo = "jperez@uta.edu.ec", MoodleUserId = 1001 };
        var sinNotas = new Estudiante { Nombres = "Ana", Apellidos = "Lema", Correo = "alema@uta.edu.ec", MoodleUserId = 1002 };
        _db.Estudiantes.AddRange(evaluado, sinNotas);
        await _db.SaveChangesAsync();
        _db.Matriculas.AddRange(
            new Matricula { CursoId = curso.Id, EstudianteId = evaluado.Id, FechaMatricula = DateTime.UtcNow },
            new Matricula { CursoId = curso.Id, EstudianteId = sinNotas.Id, FechaMatricula = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        var examen = await Item(curso.Id, parcial.Id, TipoItemEvaluacion.Examen, "Examen parcial");
        _db.EvaluacionTemas.Add(new EvaluacionTema { ItemEvaluacionId = examen.Id, TemaId = tema.Id });
        var vencida = await Item(curso.Id, parcial.Id, TipoItemEvaluacion.Tarea, "Tarea vencida");
        var porCalificar = await Item(curso.Id, parcial.Id, TipoItemEvaluacion.Tarea, "Tarea por calificar");
        _db.Calificaciones.AddRange(
            new Calificacion { ItemEvaluacionId = examen.Id, EstudianteId = evaluado.Id, Nota = 4.0m, Estado = EstadoCalificacion.Entregado },
            new Calificacion { ItemEvaluacionId = vencida.Id, EstudianteId = evaluado.Id, Nota = null, Estado = EstadoCalificacion.SinEntrega },
            new Calificacion { ItemEvaluacionId = porCalificar.Id, EstudianteId = evaluado.Id, Nota = null, Estado = EstadoCalificacion.PendienteCalificar },
            new Calificacion { ItemEvaluacionId = examen.Id, EstudianteId = sinNotas.Id, Nota = null, Estado = EstadoCalificacion.PendienteCalificar });
        await _db.SaveChangesAsync();
        return new Escenario(docente.Id, curso.Id, parcial.Id, evaluado.Id, sinNotas.Id);
    }

    private async Task<ItemEvaluacion> Item(int cursoId, int parcialId, TipoItemEvaluacion tipo, string nombre)
    {
        var item = new ItemEvaluacion { CursoId = cursoId, ParcialId = parcialId, Nombre = nombre, Tipo = tipo, Publicado = true, CalificacionMaxima = 10.0m };
        _db.ItemsEvaluacion.Add(item);
        await _db.SaveChangesAsync();
        return item;
    }
}
