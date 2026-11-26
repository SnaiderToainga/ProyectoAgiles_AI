using System.Net;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EduMonitor.Tests;

public class MoodleEstadoTests
{
    [Fact]
    public async Task InfoSitio_UsaFuncionDeDiagnostico()
    {
        using var handler = new Handler("""{"sitename":"SISRA","username":"edumonitor_ws","release":"4.5"}""");
        var service = new MoodleService(handler, Options.Create(new MoodleOptions { MoodleToken = "synthetic-token", MaxRetries = 0 }));
        var sitio = await service.ObtenerInfoSitio();
        Assert.Equal("SISRA", sitio.Sitename);
        Assert.Contains("wsfunction=core_webservice_get_site_info", handler.Body);
    }

    [Fact]
    public async Task Estado_SinRespuestaDeMoodle_NoSeInformaEnLinea()
    {
        await using var ctx = await Contexto.Crear(new SitioFalso { Error = new MoodleException("moodle_network", "Sin conexión", 503) });
        var estado = await ctx.Sync.Estado();
        Assert.False(estado.EnLinea);
        Assert.Equal("moodle_network", estado.CodigoError);
        Assert.Null(estado.Sitio);
    }

    [Fact]
    public async Task Estado_ConRespuesta_DevuelveDatosRealesYUltimaSincronizacion()
    {
        await using var ctx = await Contexto.Crear(new SitioFalso());
        var fecha = new DateTime(2026, 11, 20, 15, 30, 0, DateTimeKind.Utc);
        ctx.Db.LogsSincronizacion.Add(new LogSincronizacion { Operacion = "Notas", Estado = "Completado", Exitoso = true, Fecha = fecha });
        await ctx.Db.SaveChangesAsync();

        var estado = await ctx.Sync.Estado();
        Assert.True(estado.EnLinea);
        Assert.Equal("SISRA", estado.Sitio);
        Assert.Equal("4.5", estado.Version);
        Assert.Equal(fecha, estado.UltimaSincronizacionExitosa);
        Assert.Equal(DateTimeKind.Utc, estado.UltimaSincronizacionExitosa!.Value.Kind);
    }

    [Fact]
    public async Task Logs_DocenteSoloVeLosSuyos_AdminVeTodos()
    {
        await using var ctx = await Contexto.Crear(new SitioFalso());
        var docente = await ctx.Db.Docentes.SingleAsync();
        var otro = new Docente { Nombre = "Otro Docente", Correo = "otro@example.invalid" };
        ctx.Db.Docentes.Add(otro);
        await ctx.Db.SaveChangesAsync();
        ctx.Db.LogsSincronizacion.AddRange(
            new LogSincronizacion { DocenteId = docente.Id, Operacion = "Cursos", Estado = "Completado", Exitoso = true },
            new LogSincronizacion { DocenteId = otro.Id, Operacion = "Cursos", Estado = "Fallido", MensajeError = "moodle_network" });
        await ctx.Db.SaveChangesAsync();

        var propios = await ctx.Sync.Logs(77, admin: false, limite: 20);
        var todos = await ctx.Sync.Logs(77, admin: true, limite: 20);
        Assert.Single(propios);
        Assert.Equal(docente.Nombre, propios[0].Docente);
        Assert.Equal(2, todos.Count);
    }

    [Fact]
    public async Task Materias_IncluyenFechaDeUltimaIngestaDeNotasExitosa()
    {
        await using var ctx = await Contexto.Crear(new SitioFalso());
        var curso = await ctx.Db.Cursos.OrderBy(c => c.Id).FirstAsync();
        var buena = new DateTime(2026, 11, 21, 10, 0, 0, DateTimeKind.Utc);
        ctx.Db.LogsSincronizacion.AddRange(
            new LogSincronizacion { CursoId = curso.Id, Operacion = "Notas", Estado = "Completado", Exitoso = true, Fecha = buena },
            new LogSincronizacion { CursoId = curso.Id, Operacion = "Notas", Estado = "Fallido", Fecha = buena.AddHours(2) });
        await ctx.Db.SaveChangesAsync();

        var materias = await new CatalogoService(ctx.Db).Materias(77, admin: true);
        Assert.Equal(buena, materias.Single(m => m.Id == curso.Id).UltimaSincronizacion);
        Assert.All(materias.Where(m => m.Id != curso.Id), m => Assert.Null(m.UltimaSincronizacion));
    }

    private sealed class Contexto : IAsyncDisposable
    {
        public required SqliteConnection Conexion { get; init; }
        public required AcademicoDbContext Db { get; init; }
        public required MoodleSyncService Sync { get; init; }

        public static async Task<Contexto> Crear(IMoodleService moodle)
        {
            var conexion = new SqliteConnection("Data Source=:memory:");
            await conexion.OpenAsync();
            var db = new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(conexion).Options);
            await db.Database.EnsureCreatedAsync();
            await AcademicoSeeder.Seed(db, 77, "Docente", "docente@example.invalid");
            var sync = new MoodleSyncService(db, new CatalogoService(db), moodle,
                Options.Create(new MoodleOptions { MoodleToken = "synthetic-token" }));
            return new Contexto { Conexion = conexion, Db = db, Sync = sync };
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await Conexion.DisposeAsync();
        }
    }

    private sealed class SitioFalso : IMoodleService
    {
        public MoodleException? Error;
        public Task<MoodleSitioDto> ObtenerInfoSitio(CancellationToken ct = default) =>
            Error is null ? Task.FromResult(new MoodleSitioDto("SISRA", "edumonitor_ws", "4.5", "http://localhost:8080")) : throw Error;
        public Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int id, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int id, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int id, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MoodleTareasDto> ObtenerTareas(int id, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int id, int user, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<MoodleSeccionDto>> ObtenerContenidoCurso(int id, CancellationToken ct = default) => throw new NotSupportedException();
    }

    private sealed class Handler(string json) : HttpMessageHandler, IHttpClientFactory
    {
        public string? Body;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Body = await request.Content!.ReadAsStringAsync(ct);
            return new(HttpStatusCode.OK) { Content = new StringContent(json) };
        }
        public HttpClient CreateClient(string name) => new(this, false) { BaseAddress = new Uri("http://localhost:8080/") };
    }
}
