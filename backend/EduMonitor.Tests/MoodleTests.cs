using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace EduMonitor.Tests;
public class MoodleTests
{
    [Fact]
    public async Task AdvertenciaAnidadaEnContenidoCancelaImportacion()
    {
        using var handler = new Handler("""[{"id":1,"warnings":[{"warningcode":"restricted"}]}]""");
        var service = new MoodleService(handler, Options.Create(new MoodleOptions { MoodleToken = "synthetic-token", MaxRetries = 0 }));
        var ex = await Assert.ThrowsAsync<MoodleException>(() => service.ObtenerContenidoCurso(2));
        Assert.Equal("moodle_incomplete", ex.Code);
    }
    private sealed class Handler(string json,bool timeout=false) : HttpMessageHandler,IHttpClientFactory
    {
        public string? Body;
        public Uri? Uri;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Body=await request.Content!.ReadAsStringAsync(ct);Uri=request.RequestUri;
            if(timeout)throw new TaskCanceledException();
            return new(HttpStatusCode.OK){Content=new StringContent(json)};
        }
        public HttpClient CreateClient(string name)=>new(this,false){BaseAddress=new Uri("http://localhost:8080/")};
    }
    [Theory]
    [InlineData("{\"exception\":\"moodle_exception\",\"errorcode\":\"invalidtoken\"}","moodle_invalid_token")]
    [InlineData("not json","moodle_invalid_json")]
    public async Task ErrorFuncionalHttp200YJsonInvalido(string json,string code)
    {
        using var handler=new Handler(json);
        var service=new MoodleService(handler,Options.Create(new MoodleOptions{MoodleToken="synthetic-token",MaxRetries=0}));
        Assert.Equal(code,(await Assert.ThrowsAsync<MoodleException>(()=>service.ObtenerParticipantes(2))).Code);
        Assert.DoesNotContain("synthetic-token",handler.Uri!.ToString());Assert.Contains("wstoken=synthetic-token",handler.Body);
    }
    [Fact] public async Task ConsultaContenidoCursoConFuncionYParametrosCorrectos()
    {
        const string json = """
        [
        {
            "id": 10,
            "name": "Unidad 1",
            "section": 1,
            "modules": [
            {
                "id": 20,
                "name": "Tarea Scrum",
                "modname": "assign",
                "instance": 30
            }
            ]
        }
        ]
        """;

        using var handler = new Handler(json);

        var service = new MoodleService(
            handler,
            Options.Create(new MoodleOptions
            {
                MoodleToken = "synthetic-token",
                MaxRetries = 0
            }));

        var contenido = await service.ObtenerContenidoCurso(2);

        var seccion = Assert.Single(contenido);
        Assert.Equal(10, seccion.Id);
        Assert.Equal("Unidad 1", seccion.Name);

        var modulo = Assert.Single(seccion.Modules);
        Assert.Equal(20, modulo.Id);
        Assert.Equal(30, modulo.Instance);
        Assert.Equal("assign", modulo.Modname);

        Assert.NotNull(handler.Body);
        Assert.Contains("wsfunction=core_course_get_contents", handler.Body);
        Assert.Contains("courseid=2", handler.Body);
        Assert.Contains("moodlewsrestformat=json", handler.Body);
        Assert.Contains("wstoken=synthetic-token", handler.Body);

        Assert.NotNull(handler.Uri);
        Assert.Equal("/webservice/rest/server.php", handler.Uri.AbsolutePath);
        Assert.DoesNotContain("synthetic-token", handler.Uri.ToString());
    }
    [Fact] public async Task TimeoutControlado()
    {
        using var handler=new Handler("",true);
        var service=new MoodleService(handler,Options.Create(new MoodleOptions{MoodleToken="synthetic-token",MaxRetries=0}));
        Assert.Equal(504,(await Assert.ThrowsAsync<MoodleException>(()=>service.ObtenerParticipantes(2))).HttpStatus);
    }
    [Theory]
    [InlineData("submitted", false, EstadoCalificacion.PendienteCalificar)]
    [InlineData("new", false, EstadoCalificacion.NoDeterminado)]
    [InlineData("new", true, EstadoCalificacion.SinEntrega)]
    public async Task LeeExtensionNulaEnRespuestaRealistaDeMoodle(
        string estadoEntrega, bool fechaCursoVerificada, EstadoCalificacion estadoEsperado)
    {
        var json = $$$"""
            {"lastattempt":{"submission":{"status":"{{{estadoEntrega}}}","timemodified":100},
            "extensionduedate":null,"submissionsenabled":true}}
            """;
        using var handler = new Handler(json);
        var options = Options.Create(new MoodleOptions { MoodleToken = "synthetic-token", MaxRetries = 0 });
        var service = new MoodleService(handler, options);

        var intento = await service.ObtenerEstadoEntrega(42, 4);
        var item = new MoodleItemDto(101, "Tarea", "mod", "assign", 42, null, 0, 100, null);
        var tarea = new MoodleTareaDto(42, 200, 0);
        var ahora = DateTimeOffset.FromUnixTimeSeconds(300);

        Assert.Null(intento.Lastattempt!.Extensionduedate);
        Assert.Equal(estadoEsperado,
            EstadoCalificacionResolver.Resolver(item, tarea, intento, ahora, fechaCursoVerificada));
    }

    public sealed class MoodleLocalFactAttribute : FactAttribute
    {
        public MoodleLocalFactAttribute()
        {
            if (Environment.GetEnvironmentVariable("EDUMONITOR_MOODLE_LIVE_TEST") != "1")
                Skip = "Requiere Moodle Docker, Gateway y AcademicoDB del piloto local.";
        }
    }

    [MoodleLocalFact]
    public async Task SincronizaEntregaRealPendienteSinDuplicarEnSqlServer()
    {
        static string Config(string variable) =>
            Environment.GetEnvironmentVariable(variable) is { Length: > 0 } value
                ? value
                : throw new InvalidOperationException($"Configura {variable} para la prueba local.");

        var cursoId = int.Parse(Config("EDUMONITOR_MOODLE_LIVE_CURSO_ID"));
        var tarea = Config("EDUMONITOR_MOODLE_LIVE_TAREA");
        var estudianteMoodleId = int.Parse(Config("EDUMONITOR_MOODLE_LIVE_ESTUDIANTE_ID"));
        var connection = Config("ConnectionStrings__AcademicoConnection");

        using var http = new HttpClient
        {
            BaseAddress = new Uri("http://localhost:5000"),
            Timeout = TimeSpan.FromSeconds(90)
        };
        http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", Config("EDUMONITOR_MOODLE_LIVE_JWT"));

        await using var db = new AcademicoDbContext(
            new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlServer(connection).Options);

        async Task<int> SincronizarYVerificar()
        {
            using var response = await http.PostAsync($"/api/moodle/sync-notas/{cursoId}", null);
            response.EnsureSuccessStatusCode();
            var sync = await response.Content.ReadFromJsonAsync<SincronizacionDto>();
            Assert.NotNull(sync);

            var log = await db.LogsSincronizacion.AsNoTracking().SingleAsync(x => x.Id == sync.LogId);
            Assert.Equal(cursoId, log.CursoId);
            Assert.True(log.Exitoso);

            var nota = await (
                from calificacion in db.Calificaciones.AsNoTracking()
                join item in db.ItemsEvaluacion on calificacion.ItemEvaluacionId equals item.Id
                join estudiante in db.Estudiantes on calificacion.EstudianteId equals estudiante.Id
                where item.CursoId == cursoId && item.Nombre == tarea
                    && estudiante.MoodleUserId == estudianteMoodleId
                select calificacion).SingleAsync();
            Assert.Null(nota.NotaMoodle);
            Assert.Null(nota.Nota);
            Assert.Equal(EstadoCalificacion.PendienteCalificar, nota.Estado);
            return nota.Id;
        }

        var idOriginal = await SincronizarYVerificar();
        Assert.Equal(idOriginal, await SincronizarYVerificar());
    }

    private sealed class FakeMoodle : IMoodleService
    {
        public bool Fail;
        public string? FotoUrl;
        public Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int id,CancellationToken ct=default)
        {if(Fail)throw new MoodleException("moodle_invalid_token","Token inválido");return Task.FromResult<IReadOnlyList<MoodleCursoDto>>([new(201,"Metodologías Ágiles","SOF-401")]);}
        public Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int id,CancellationToken ct=default)=>Task.FromResult<IReadOnlyList<MoodleParticipanteDto>>([
            new(900,"Docente","Ficticio","Docente Ficticio","docente@example.invalid",[new("editingteacher")]),
            new(901,"Estudiante","Uno","Estudiante Uno","uno@example.invalid",[new("student")], FotoUrl)]);
        public Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int id,CancellationToken ct=default)=>Task.FromResult(new MoodleCalificacionesDto([
            new(id,901,[new(301,"Cero","mod","assign",101,0,0,100,null),new(302,"Sin nota","mod","assign",102,null,0,100,null)])]));
        public Task<MoodleTareasDto> ObtenerTareas(int id,CancellationToken ct=default)=>Task.FromResult(new MoodleTareasDto([new(id,[new(102,0,0)])]));
        public Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int id,int user,CancellationToken ct=default)=>Task.FromResult(new MoodleEstadoEntregaDto(null));
        public Task<IReadOnlyList<MoodleSeccionDto>> ObtenerContenidoCurso(int cursoMoodleId,CancellationToken ct = default)
    {
        return Task.FromResult<IReadOnlyList<MoodleSeccionDto>>(
        [new(10,"PRIMER PARCIAL",1,[new(11,"Cero","assign",101,Visible:1,Uservisible:true),new(12,"Sin nota","assign",102,Visible:1,Uservisible:true)],Visible:1,Uservisible:true)]);
    }
    }
    [Fact] public async Task SincronizaFotoYLaExponeEnRendimiento()
    {
        await using var connection =
            new SqliteConnection("Data Source=:memory:");

        await connection.OpenAsync();

        await using var db = new AcademicoDbContext(
            new DbContextOptionsBuilder<AcademicoDbContext>()
                .UseSqlite(connection)
                .Options);

        await db.Database.EnsureCreatedAsync();
        await AcademicoSeeder.Seed(
            db, 77, "Docente", "docente@example.invalid");

        (await db.Docentes.SingleAsync()).MoodleUserId = 900;
        await db.SaveChangesAsync();

        var fake = new FakeMoodle();

        var sync = new MoodleSyncService(
            db,
            new CatalogoService(db),
            fake,
            Options.Create(new MoodleOptions()));

        await sync.Cursos(77);

        var curso = await db.Cursos.SingleAsync(
            c => c.MoodleCourseId == 201);

        var parcial = await db.Parciales.FirstAsync(
            p => p.CursoId == curso.Id && p.Numero == 1);

        var calculo = new CalculoPonderadoService(db);

        string?[] fotos =
        [
            "  http://localhost:8080/foto-prueba.png  ",
            "   ",
            null
        ];

        foreach (var foto in fotos)
        {
            fake.FotoUrl = foto;
            await sync.Notas(77, curso.Id);

            db.ChangeTracker.Clear();

            var estudiante = await db.Estudiantes.SingleAsync(
                e => e.MoodleUserId == 901);

            var esperada = string.IsNullOrWhiteSpace(foto)
                ? null
                : foto.Trim();

            Assert.Equal(esperada, estudiante.FotoUrl);

            var resumen = await calculo.CalcularEstudianteAsync(
                curso.Id, parcial.Id, estudiante.Id);

            Assert.Equal(esperada, resumen.FotoUrl);
        }

        Assert.Equal(1, await db.Estudiantes.CountAsync());
    }
    [Fact] public async Task ReimportarNoDuplicaYPreservaCeroNullBorradoresYLogDeFalloSinCurso()
    {
        await using var connection=new SqliteConnection("Data Source=:memory:");await connection.OpenAsync();
        await using var db=new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();await AcademicoSeeder.Seed(db,77,"Docente","docente@example.invalid");
        (await db.Docentes.SingleAsync()).MoodleUserId=900;await db.SaveChangesAsync();
        var fake=new FakeMoodle();var service=new MoodleSyncService(db,new CatalogoService(db),fake,Options.Create(new MoodleOptions()));
        await service.Cursos(77);await service.Cursos(77);
        var curso=await db.Cursos.SingleAsync(c=>c.MoodleCourseId==201);
        await service.Notas(77,curso.Id);await service.Notas(77,curso.Id);
        Assert.Equal(2,await db.Cursos.CountAsync());Assert.Equal(1,await db.Estudiantes.CountAsync());
        Assert.Equal(1,await db.Matriculas.CountAsync());Assert.Equal(2,await db.Calificaciones.CountAsync());
        Assert.False(await db.ItemsEvaluacion.AnyAsync(i=>i.Publicado));
        Assert.Equal(0,(await db.Calificaciones.Include(g=>g.ItemEvaluacion).SingleAsync(g=>g.ItemEvaluacion.MoodleItemId==301)).Nota);
        Assert.Null((await db.Calificaciones.Include(g=>g.ItemEvaluacion).SingleAsync(g=>g.ItemEvaluacion.MoodleItemId==302)).Nota);
        fake.Fail=true;await Assert.ThrowsAsync<MoodleException>(()=>service.Cursos(77));
        var log=await db.LogsSincronizacion.OrderBy(l=>l.Id).LastAsync();
        Assert.Null(log.CursoId);Assert.Equal("Fallido",log.Estado);Assert.Equal("moodle_invalid_token",log.MensajeError);
    }
}
