using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
namespace EduMonitor.Infrastructure.Services;
public class CatalogoService(AcademicoDbContext db)
{
    public async Task<Docente> Docente(int usuarioId,CancellationToken ct=default) =>
        await db.Docentes.SingleOrDefaultAsync(d=>d.UsuarioId==usuarioId && d.Activo,ct)
        ?? throw new AcademicoException(403,"Usuario sin vinculación académica activa.");
    public async Task ComprobarCurso(int usuarioId,bool admin,int cursoId,CancellationToken ct=default)
    {
        var curso=await db.Cursos.AsNoTracking().SingleOrDefaultAsync(c=>c.Id==cursoId,ct)
            ?? throw new AcademicoException(404,"Materia inexistente.");
        if(!admin && curso.DocenteId!=(await Docente(usuarioId,ct)).Id)
            throw new AcademicoException(403,"Materia no asignada al docente.");
    }
    public async Task<List<MateriaDto>> Materias(int usuarioId,bool admin,CancellationToken ct=default)
    {
        var query=db.Cursos.AsNoTracking();
        if(!admin) {var docente=await Docente(usuarioId,ct);query=query.Where(c=>c.DocenteId==docente.Id);}
        var cursos=await query.OrderBy(c=>c.Id).ToListAsync(ct);
        var ids=cursos.Select(c=>c.Id).ToArray();
        var parciales=await db.Parciales.AsNoTracking().Where(p=>ids.Contains(p.CursoId)).Include(p=>p.Unidades).ThenInclude(u=>u.Temas).ToListAsync(ct);
        return cursos.Select(c=>new MateriaDto(c.Id,c.Codigo,c.Nombre,c.Periodo,
            parciales.Where(p=>p.CursoId==c.Id).OrderBy(p=>p.Numero).Select(p=>new ParcialDto(p.Id,p.Numero,
                p.Unidades.OrderBy(u=>u.Numero).Select(u=>new UnidadDto(u.Id,u.Numero,u.Nombre,
                    u.Temas.OrderBy(t=>t.Id).Select(t=>new TemaDto(t.Id,t.Nombre,t.Descripcion)).ToList())).ToList())).ToList())).ToList();
    }
    public async Task<TemaDto> CrearTema(int user,bool admin,TemaRequest request,CancellationToken ct=default)
    {
        var unidad=await db.Unidades.Include(u=>u.Parcial).SingleOrDefaultAsync(u=>u.Id==request.UnidadId,ct)
            ?? throw new AcademicoException(404,"Unidad inexistente.");
        await ComprobarCurso(user,admin,unidad.Parcial.CursoId,ct);
        if(string.IsNullOrWhiteSpace(request.Nombre))throw new AcademicoException(400,"Nombre obligatorio.");
        var nombre=request.Nombre.Trim();
        if(await db.Temas.AnyAsync(t=>t.UnidadId==unidad.Id && t.Nombre==nombre,ct))throw new AcademicoException(409,"El tema ya existe en esa unidad.");
        var tema=new Tema{UnidadId=unidad.Id,Nombre=nombre,Descripcion=(request.Descripcion ?? "").Trim()};
        db.Temas.Add(tema);await db.SaveChangesAsync(ct);return new(tema.Id,tema.Nombre,tema.Descripcion);
    }
    private async Task<Parcial> Validar(int user,bool admin,int parcialId,TipoItemEvaluacion tipo,int[] temas,CancellationToken ct)
    {
        if(tipo is not (TipoItemEvaluacion.Tarea or TipoItemEvaluacion.APE or TipoItemEvaluacion.Examen))throw new AcademicoException(400,"Componente inválido.");
        if(temas is null || temas.Length==0 || temas.Distinct().Count()!=temas.Length)throw new AcademicoException(400,"Seleccione temas distintos.");
        var parcial=await db.Parciales.FindAsync([parcialId],ct) ?? throw new AcademicoException(404,"Parcial inexistente.");
        await ComprobarCurso(user,admin,parcial.CursoId,ct);
        if(await db.Temas.CountAsync(t=>temas.Contains(t.Id) && t.Unidad.ParcialId==parcialId,ct)!=temas.Length)
            throw new AcademicoException(400,"Todos los temas deben pertenecer al parcial de la evaluación.");
        return parcial;
    }
    public async Task<int> CrearEvaluacion(int user,bool admin,EvaluacionRequest request,CancellationToken ct=default)
    {
        var parcial=await Validar(user,admin,request.ParcialId,request.Tipo,request.TemaIds,ct);
        if(string.IsNullOrWhiteSpace(request.Nombre))throw new AcademicoException(400,"Nombre obligatorio.");
        var item=new ItemEvaluacion{CursoId=parcial.CursoId,ParcialId=parcial.Id,Nombre=request.Nombre.Trim(),Tipo=request.Tipo,Publicado=true,CalificacionMaxima=10};
        db.ItemsEvaluacion.Add(item);
        foreach(var id in request.TemaIds)db.EvaluacionTemas.Add(new(){Evaluacion=item,TemaId=id});
        await db.SaveChangesAsync(ct);return item.Id;
    }
    public async Task Clasificar(int user,bool admin,int id,ClasificarRequest request,CancellationToken ct=default)
    {
        var parcial=await Validar(user,admin,request.ParcialId,request.Tipo,request.TemaIds,ct);
        var item=await db.ItemsEvaluacion.FindAsync([id],ct) ?? throw new AcademicoException(404,"Evaluación inexistente.");
        if(item.CursoId!=parcial.CursoId)throw new AcademicoException(400,"La evaluación pertenece a otra materia.");
        var links=await db.EvaluacionTemas.Where(x=>x.ItemEvaluacionId==id).ToListAsync(ct);
        db.EvaluacionTemas.RemoveRange(links.Where(x=>!request.TemaIds.Contains(x.TemaId)));
        foreach(var tema in request.TemaIds.Except(links.Select(x=>x.TemaId)))db.EvaluacionTemas.Add(new(){ItemEvaluacionId=id,TemaId=tema});
        item.ParcialId=parcial.Id;item.Tipo=request.Tipo;item.Publicado=true;await db.SaveChangesAsync(ct);
    }
    public async Task<List<EvaluacionDto>> Evaluaciones(int user,bool admin,int cursoId,CancellationToken ct=default)
    {
        await ComprobarCurso(user,admin,cursoId,ct);
        var items=await db.ItemsEvaluacion.AsNoTracking().Where(i=>i.CursoId==cursoId).ToListAsync(ct);
        var links=await db.EvaluacionTemas.AsNoTracking().Where(x=>x.Evaluacion.CursoId==cursoId).ToListAsync(ct);
        return items.Select(i=>new EvaluacionDto(i.Id,i.ParcialId,i.Nombre,i.Tipo,i.Tipo switch {TipoItemEvaluacion.Tarea=>.3m,TipoItemEvaluacion.APE=>.3m,TipoItemEvaluacion.Examen=>.4m,_=>0},i.Publicado,links.Where(x=>x.ItemEvaluacionId==i.Id).Select(x=>x.TemaId).ToArray())).ToList();
    }
}
