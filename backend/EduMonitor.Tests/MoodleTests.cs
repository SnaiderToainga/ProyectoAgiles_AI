using System.Net;
using EduMonitor.Core.DTOs;
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
    [Fact] public async Task TimeoutControlado()
    {
        using var handler=new Handler("",true);
        var service=new MoodleService(handler,Options.Create(new MoodleOptions{MoodleToken="synthetic-token",MaxRetries=0}));
        Assert.Equal(504,(await Assert.ThrowsAsync<MoodleException>(()=>service.ObtenerParticipantes(2))).HttpStatus);
    }
    private sealed class FakeMoodle : IMoodleService
    {
        public bool Fail;
        public Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int id,CancellationToken ct=default)
        {if(Fail)throw new MoodleException("moodle_invalid_token","Token inválido");return Task.FromResult<IReadOnlyList<MoodleCursoDto>>([new(201,"Metodologías Ágiles","SOF-401")]);}
        public Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int id,CancellationToken ct=default)=>Task.FromResult<IReadOnlyList<MoodleParticipanteDto>>([
            new(900,"Docente","Ficticio","Docente Ficticio","docente@example.invalid",[new("editingteacher")]),
            new(901,"Estudiante","Uno","Estudiante Uno","uno@example.invalid",[new("student")])]);
        public Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int id,CancellationToken ct=default)=>Task.FromResult(new MoodleCalificacionesDto([
            new(id,901,[new(301,"Cero","manual",null,null,0,0,100,null),new(302,"Sin nota","manual",null,null,null,0,100,null)])]));
        public Task<MoodleTareasDto> ObtenerTareas(int id,CancellationToken ct=default)=>Task.FromResult(new MoodleTareasDto([]));
        public Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int id,int user,CancellationToken ct=default)=>Task.FromResult(new MoodleEstadoEntregaDto(null));
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
