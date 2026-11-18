using System.Diagnostics;
using System.Text.Json;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Xunit.Abstractions;

namespace EduMonitor.Tests;

public class MoodleCurriculoLiveTests(ITestOutputHelper output)
{
    public sealed class EntornoRealAttribute : FactAttribute
    {
        public EntornoRealAttribute()
        {
            if (Environment.GetEnvironmentVariable("EDUMONITOR_CURRICULO_LIVE_TEST") != "1")
                Skip = "Requiere Moodle y AcademicoDB existentes; habilitar explícitamente para sincronizar datos reales.";
        }
    }

    [EntornoReal]
    public async Task SincronizaCursosRealesConFotosParcialesEIdempotencia()
    {
        var root = Environment.GetEnvironmentVariable("EDUMONITOR_PROJECT_ROOT")
            ?? throw new InvalidOperationException("Configure EDUMONITOR_PROJECT_ROOT.");
        using var config = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(root, "docker/moodle/.local/moodle-connection.json")));
        var settings = config.RootElement;
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__AcademicoConnection")
            ?? throw new InvalidOperationException("Configure la conexión a la base existente.");
        await using var db = new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlServer(connection).Options);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        var docenteId = int.Parse(settings.GetProperty("docenteMoodleId").ToString());
        var docente = await db.Docentes.SingleAsync(d => d.MoodleUserId == docenteId && d.Activo);
        Assert.NotNull(docente.UsuarioId);
        var options = new MoodleOptions {
            BaseUrl = settings.GetProperty("baseUrl").GetString()!,
            MoodleToken = settings.GetProperty("moodleToken").GetString()!,
            MaxRetries = 0
        };
        using var factory = new ClienteReal(options.BaseUrl);
        var moodle = new MoodleService(factory, Options.Create(options));
        var sync = new MoodleSyncService(db, new CatalogoService(db), moodle, Options.Create(options));
        var courses = await db.Cursos.Where(c => c.DocenteId == docente.Id && c.MoodleCourseId > 0).ToListAsync();
        Assert.NotEmpty(courses);
        foreach (var course in courses)
        {
            var timer = Stopwatch.StartNew();
            var first = await sync.Notas(docente.UsuarioId.Value, course.Id);
            timer.Stop();
            var firstTime = timer.Elapsed.TotalMilliseconds;
            var ids = await db.Calificaciones.Where(c => c.ItemEvaluacion.CursoId == course.Id).OrderBy(c => c.Id).Select(c => c.Id).ToArrayAsync();
            timer.Restart();
            var second = await sync.Notas(docente.UsuarioId.Value, course.Id);
            timer.Stop();
            Assert.Equal(ids, await db.Calificaciones.Where(c => c.ItemEvaluacion.CursoId == course.Id).OrderBy(c => c.Id).Select(c => c.Id).ToArrayAsync());
            Assert.True(first.Estudiantes >= 12); Assert.True(first.Items >= 12);
            Assert.Equal(first.Calificaciones, second.Calificaciones);
            var studentIds = await db.Matriculas.Where(m => m.CursoId == course.Id).Select(m => m.EstudianteId).ToArrayAsync();
            Assert.True(await db.Estudiantes.AnyAsync(e => studentIds.Contains(e.Id) && e.FotoUrl != null));
            var parcialId = await db.Parciales.Where(p => p.CursoId == course.Id && p.Numero == 1).Select(p => p.Id).SingleAsync();
            Assert.Equal(first.Estudiantes, (await new CalculoPonderadoService(db).CalcularCursoAsync(course.Id, parcialId)).Count);
            var itemIds = await db.Calificaciones.Where(c => c.ItemEvaluacion.CursoId == course.Id && studentIds.Contains(c.EstudianteId))
                .Select(c => c.ItemEvaluacionId).Distinct().ToArrayAsync();
            var items = await db.ItemsEvaluacion.Where(i => itemIds.Contains(i.Id)).ToListAsync();
            Assert.True(items.Count(i => i.ParcialId.HasValue) >= first.Items);
            var log = await db.LogsSincronizacion.SingleAsync(l => l.Id == second.LogId);
            Assert.True(log.Exitoso);
            output.WriteLine($"Curso={course.Codigo}; estudiantes={first.Estudiantes}; items={first.Items}; notas={first.Calificaciones}; primeraMs={firstTime:F0}; segundaMs={timer.Elapsed.TotalMilliseconds:F0}; log={second.LogId}");
            Assert.True(firstTime < 10000, "La primera sincronización superó los 10 s acordados.");
            Assert.True(timer.Elapsed.TotalMilliseconds < 10000, "La segunda sincronización superó los 10 s acordados.");
        }
    }

    private sealed class ClienteReal(string baseUrl) : IHttpClientFactory, IDisposable
    {
        private readonly SocketsHttpHandler handler = new();
        public HttpClient CreateClient(string name) => new(handler, false) {
            BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(30)
        };
        public void Dispose() => handler.Dispose();
    }
}
