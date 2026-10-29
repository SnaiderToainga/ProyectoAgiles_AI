using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Tests;

public class CalculoPonderadoTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AcademicoDbContext _db = null!;
    private CalculoPonderadoService _service = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>()
            .UseSqlite(_connection)
            .Options);

        await _db.Database.EnsureCreatedAsync();
        _service = new CalculoPonderadoService(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task CalculoPonderado_AplicaFormulaFiseiExacta_30_30_40()
    {
        // Tareas: 10.0 (30% -> 3.00), APE: 8.0 (30% -> 2.40), Examen: 9.0 (40% -> 3.60)
        // Nota final esperada = 3.00 + 2.40 + 3.60 = 9.00
        var (cursoId, parcialId, estudianteId) = await PrepararEscenarioAcademicoAsync();

        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Tarea, "Tarea 1", 10.0m);
        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.APE, "Taller Práctico", 8.0m);
        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Examen, "Examen Parcial", 9.0m);

        var resultado = await _service.CalcularEstudianteAsync(cursoId, parcialId, estudianteId);

        Assert.Equal(9.00m, resultado.NotaFinalParcial);
        Assert.False(resultado.EnRiesgo);
        Assert.Empty(resultado.TemasDeficientes);
    }

    [Fact]
    public async Task CalculoPonderado_CeroNumerico_EsValidoYNoSeIgnora()
    {
        // Tarea 1: 0.0, Tarea 2: 10.0 -> Promedio Tareas = 5.0 (Aporte 30% -> 1.50)
        // APE: 10.0 -> Aporte 30% -> 3.00
        // Examen: 10.0 -> Aporte 40% -> 4.00
        // Nota final = 1.50 + 3.00 + 4.00 = 8.50
        var (cursoId, parcialId, estudianteId) = await PrepararEscenarioAcademicoAsync();

        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Tarea, "Tarea Reprobada", 0.0m);
        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Tarea, "Tarea Perfecta", 10.0m);
        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.APE, "APE", 10.0m);
        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Examen, "Examen", 10.0m);

        var resultado = await _service.CalcularEstudianteAsync(cursoId, parcialId, estudianteId);

        Assert.Equal(8.50m, resultado.NotaFinalParcial);
        var compTareas = resultado.Componentes.Single(c => c.Tipo == TipoItemEvaluacion.Tarea);
        Assert.Equal(5.00m, compTareas.PromedioComponente);
        Assert.True(compTareas.EsDeficiente);
    }

    [Fact]
    public async Task CalculoPonderado_NotaNula_NoSeComputaEnPromedio()
    {
        // Tarea 1: 8.0, Tarea 2: null (pendiente) -> Promedio Tareas = 8.0 (no divide entre 2)
        var (cursoId, parcialId, estudianteId) = await PrepararEscenarioAcademicoAsync();

        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Tarea, "Tarea 1", 8.0m);
        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Tarea, "Tarea Pendiente", null);

        var resultado = await _service.CalcularEstudianteAsync(cursoId, parcialId, estudianteId);

        var compTareas = resultado.Componentes.Single(c => c.Tipo == TipoItemEvaluacion.Tarea);
        Assert.Equal(8.00m, compTareas.PromedioComponente);
    }

    [Fact]
    public async Task CalculoPonderado_DetectaEstudianteEnRiesgoYTemasCriticos()
    {
        // Examen con nota 4.0 (< 7.00) vinculado a "Árboles AVL"
        // Tarea: 5.0 (< 7.00), APE: 5.0 (< 7.00)
        // Nota = (5*0.3) + (5*0.3) + (4*0.4) = 1.5 + 1.5 + 1.6 = 4.60 (< 7.00 -> EnRiesgo = true)
        var (cursoId, parcialId, estudianteId) = await PrepararEscenarioAcademicoAsync();

        var unidad = await _db.Unidades.FirstAsync(u => u.ParcialId == parcialId);
        var tema = new Tema { UnidadId = unidad.Id, Nombre = "Árboles AVL", Descripcion = "Balanceo binario" };
        _db.Temas.Add(tema);
        await _db.SaveChangesAsync();

        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Tarea, "Tarea 1", 5.0m);
        await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.APE, "APE 1", 5.0m);
        var evalExamen = await RegistrarEvaluacionConNotaAsync(cursoId, parcialId, estudianteId, TipoItemEvaluacion.Examen, "Examen Parcial", 4.0m);

        _db.EvaluacionTemas.Add(new EvaluacionTema { ItemEvaluacionId = evalExamen.Id, TemaId = tema.Id });
        await _db.SaveChangesAsync();

        var resultado = await _service.CalcularEstudianteAsync(cursoId, parcialId, estudianteId);

        Assert.Equal(4.60m, resultado.NotaFinalParcial);
        Assert.True(resultado.EnRiesgo);
        Assert.Single(resultado.TemasDeficientes);
        Assert.Equal("Árboles AVL", resultado.TemasDeficientes[0].NombreTema);
        Assert.Equal(4.0m, resultado.TemasDeficientes[0].NotaObtenida);
    }

    private async Task<(int cursoId, int parcialId, int estudianteId)> PrepararEscenarioAcademicoAsync()
    {
        var docente = new Docente { Nombre = "Docente Prueba", Correo = "docente@uta.edu.ec", ClaveHash = "hash", Rol = "Docente" };
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

        var estudiante = new Estudiante { Nombres = "Juan", Apellidos = "Pérez", Correo = "jperez@uta.edu.ec", MoodleUserId = 1001 };
        _db.Estudiantes.Add(estudiante);
        await _db.SaveChangesAsync();

        _db.Matriculas.Add(new Matricula { CursoId = curso.Id, EstudianteId = estudiante.Id, FechaMatricula = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        return (curso.Id, parcial.Id, estudiante.Id);
    }

    private async Task<ItemEvaluacion> RegistrarEvaluacionConNotaAsync(
        int cursoId,
        int parcialId,
        int estudianteId,
        TipoItemEvaluacion tipo,
        string nombre,
        decimal? nota)
    {
        var item = new ItemEvaluacion
        {
            CursoId = cursoId,
            ParcialId = parcialId,
            Nombre = nombre,
            Tipo = tipo,
            Publicado = true,
            CalificacionMaxima = 10.0m
        };
        _db.ItemsEvaluacion.Add(item);
        await _db.SaveChangesAsync();

        if (nota.HasValue || nota == null)
        {
            _db.Calificaciones.Add(new Calificacion
            {
                ItemEvaluacionId = item.Id,
                EstudianteId = estudianteId,
                Nota = nota,
                Estado = nota.HasValue ? EstadoCalificacion.Entregado : EstadoCalificacion.PendienteCalificar
            });
            await _db.SaveChangesAsync();
        }

        return item;
    }
}