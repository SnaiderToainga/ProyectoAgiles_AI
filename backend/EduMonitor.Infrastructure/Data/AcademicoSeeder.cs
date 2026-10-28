using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using Microsoft.EntityFrameworkCore;
namespace EduMonitor.Infrastructure.Data;
public static class AcademicoSeeder
{
    public static async Task Seed(AcademicoDbContext db,int usuarioId,string nombre,string correo,CancellationToken ct=default)
    {
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        var docente=await db.Docentes.SingleOrDefaultAsync(d=>d.UsuarioId==usuarioId,ct);
        if(docente is null){docente=new(){UsuarioId=usuarioId,Nombre=nombre,Correo=correo,ClaveHash="EXTERNAL_AUTH_NO_LOCAL_LOGIN"};db.Docentes.Add(docente);await db.SaveChangesAsync(ct);}
        foreach(var (codigo,titulo) in new[]{("SOF-401","Metodologías Ágiles"),("SOF-402","Estructuras de Datos")})
        {
            var curso=await db.Cursos.SingleOrDefaultAsync(c=>c.Codigo==codigo,ct);
            if(curso is null){curso=new(){Codigo=codigo,Nombre=titulo,Periodo="2026-2",DocenteId=docente.Id};db.Cursos.Add(curso);await db.SaveChangesAsync(ct);}
            for(int p=1;p<=2;p++)
            {
                var parcial=await db.Parciales.SingleOrDefaultAsync(x=>x.CursoId==curso.Id && x.Numero==p,ct);
                if(parcial is null){parcial=new(){CursoId=curso.Id,Numero=p};db.Parciales.Add(parcial);await db.SaveChangesAsync(ct);}
                for(int u=1;u<=2;u++)
                {
                    var unidad=await db.Unidades.SingleOrDefaultAsync(x=>x.ParcialId==parcial.Id && x.Numero==u,ct);
                    if(unidad is null){unidad=new(){ParcialId=parcial.Id,Numero=u,Nombre=$"Unidad {u}: {titulo}"};db.Unidades.Add(unidad);await db.SaveChangesAsync(ct);}
                    foreach(var tema in (codigo=="SOF-401" ? new[]{"Fundamentos y roles Scrum","Historias de usuario y estimación"}:new[]{"Estructuras lineales","Árboles y grafos"}))
                        if(!await db.Temas.AnyAsync(t=>t.UnidadId==unidad.Id && t.Nombre==tema,ct))db.Temas.Add(new(){UnidadId=unidad.Id,Nombre=tema,Descripcion="Contenido piloto para validación local del Sprint 1."});
                    await db.SaveChangesAsync(ct);
                }
            }
        }
        await tx.CommitAsync(ct);
    }
}
