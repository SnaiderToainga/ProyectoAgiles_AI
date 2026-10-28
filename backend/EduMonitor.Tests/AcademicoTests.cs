using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using EduMonitor.Infrastructure.Moodle;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Tests;
public class AcademicoTests : IAsyncLifetime
{
    private readonly SqliteConnection connection=new("Data Source=:memory:");
    private AcademicoDbContext db=null!;
    public async Task InitializeAsync()
    {
        await connection.OpenAsync();
        db=new(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        await AcademicoSeeder.Seed(db,77,"Docente Prueba","docente@example.invalid");
    }
    public async Task DisposeAsync(){await db.DisposeAsync();await connection.DisposeAsync();}
    [Fact] public async Task SeedEsIdempotenteYCatalogaJerarquia()
    {
        await AcademicoSeeder.Seed(db,77,"Docente Prueba","docente@example.invalid");
        var materias=await new CatalogoService(db).Materias(77,false);
        Assert.Equal(2,materias.Count);Assert.All(materias,m=>Assert.Equal(2,m.Parciales.Count));
        Assert.Equal(8,await db.Unidades.CountAsync());Assert.Equal(16,await db.Temas.CountAsync());
    }
    [Fact] public async Task TemaValidaUnidadDuplicadoYPropietario()
    {
        var service=new CatalogoService(db);var unidad=await db.Unidades.FirstAsync();
        var tema=await service.CrearTema(77,false,new(unidad.Id,"Tema adicional"));Assert.True(tema.Id>0);
        Assert.Equal(409,(await Assert.ThrowsAsync<AcademicoException>(()=>service.CrearTema(77,false,new(unidad.Id,"Tema adicional")))).Status);
        Assert.Equal(403,(await Assert.ThrowsAsync<AcademicoException>(()=>service.Materias(88,false))).Status);
        Assert.Equal(404,(await Assert.ThrowsAsync<AcademicoException>(()=>service.CrearTema(77,false,new(999,"Tema")))).Status);
    }
    [Fact] public async Task EvaluacionExigeTemasDelMismoParcial()
    {
        var service=new CatalogoService(db);var tema=await db.Temas.Include(t=>t.Unidad).FirstAsync();
        var other=await db.Parciales.FirstAsync(p=>p.Id!=tema.Unidad.ParcialId);
        await Assert.ThrowsAsync<AcademicoException>(()=>service.CrearEvaluacion(77,false,new(tema.Unidad.ParcialId,"Vacía",TipoItemEvaluacion.Tarea,[])));
        await Assert.ThrowsAsync<AcademicoException>(()=>service.CrearEvaluacion(77,false,new(other.Id,"Cruce",TipoItemEvaluacion.Tarea,[tema.Id])));
        var id=await service.CrearEvaluacion(77,false,new(tema.Unidad.ParcialId,"Válida",TipoItemEvaluacion.APE,[tema.Id]));
        Assert.True((await db.ItemsEvaluacion.FindAsync(id))!.Publicado);Assert.Equal(1,await db.EvaluacionTemas.CountAsync());
    }
    [Fact] public async Task IntegridadRechazaTemaHuerfano()
    {
        db.Temas.Add(new(){UnidadId=999,Nombre="Huérfano"});
        await Assert.ThrowsAsync<DbUpdateException>(()=>db.SaveChangesAsync());
    }
    [Theory] [InlineData(0,0)] [InlineData(80,8)] [InlineData(100,10)]
    public void NormalizaSinPerderCero(int raw,int expected)=>Assert.Equal(expected,MoodleSyncService.Normalizar(Item(raw)));
    [Fact] public void NullNoEquivaleACeroNiSinEntrega()
    {
        Assert.Null(MoodleSyncService.Normalizar(Item(null)));
        Assert.Equal(EstadoCalificacion.NoDeterminado,EstadoCalificacionResolver.Resolver(Item(null),null,null,DateTimeOffset.UtcNow));
        Assert.Equal(EstadoCalificacion.Entregado,EstadoCalificacionResolver.Resolver(Item(0),null,null,DateTimeOffset.UtcNow));
    }
    [Fact] public void EntregaSinNotaEsPendienteDeCalificar()
    {
        var estado=new MoodleEstadoEntregaDto(new(new("submitted",100),null,0,true));
        Assert.Equal(EstadoCalificacion.PendienteCalificar,EstadoCalificacionResolver.Resolver(Item(null),new(1,50,0),estado,DateTimeOffset.UtcNow));
    }
    [Fact] public void NoEntregaNecesitaEvidenciaDeFechaEfectiva()
    {
        var estado=new MoodleEstadoEntregaDto(new(new("new",0),null,50,true));
        Assert.Equal(EstadoCalificacion.SinEntrega,EstadoCalificacionResolver.Resolver(Item(null),new(1,50,0),estado,DateTimeOffset.FromUnixTimeSeconds(100)));
    }
    [Fact] public void EscalaInvalidaSeRechaza()=>Assert.Throws<MoodleException>(()=>MoodleSyncService.Normalizar(Item(101)));
    private static MoodleItemDto Item(decimal? raw)=>new(1,"Tarea","mod","assign",1,raw,0,100,null);
}
