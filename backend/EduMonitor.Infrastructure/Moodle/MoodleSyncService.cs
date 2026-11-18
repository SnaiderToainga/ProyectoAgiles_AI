using System.Data;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EduMonitor.Infrastructure.Moodle;

public sealed partial class MoodleSyncService(AcademicoDbContext db, CatalogoService catalogo,
    IMoodleService moodle, IOptions<MoodleOptions> options)
{
    public static decimal? Normalizar(MoodleItemDto item)
    {
        if(item.Graderaw is null) return null;
        if(item.Grademin is not decimal min || item.Grademax is not decimal max || max<=min
            || item.Graderaw<min || item.Graderaw>max)
            throw new MoodleException("moodle_grade_scale", "Escala de calificación no válida; no se importaron datos.");
        return Math.Round((item.Graderaw.Value-min)/(max-min)*10m,4);
    }

    public async Task<SincronizacionDto> Cursos(int usuarioId,CancellationToken ct=default)
    {
        var docente = await catalogo.Docente(usuarioId, ct);
        return await Ejecutar(docente.Id,null,"Cursos",async log=>
        {
            if(docente.MoodleUserId is not >0)throw new AcademicoException(409,"El docente no tiene usuario Moodle vinculado.");
            var cursos=await moodle.ObtenerCursosPorDocente(docente.MoodleUserId.Value,ct);
            await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            foreach(var source in cursos)
            {
                var curso=await db.Cursos.SingleOrDefaultAsync(c=>c.MoodleCourseId==source.Id || c.Codigo==source.Shortname,ct);
                if(curso is not null && (curso.DocenteId!=docente.Id || (curso.MoodleCourseId>0 && curso.MoodleCourseId!=source.Id)))
                    throw new AcademicoException(409,"Curso ya vinculado a otra identidad; requiere revisión administrativa.");
                if(curso is null)
                {
                    curso=new Curso{DocenteId=docente.Id,Periodo="Octubre 2026 – Febrero 2027"};
                    db.Cursos.Add(curso);
                    await db.SaveChangesAsync(ct);

                    var p1=new Parcial{CursoId=curso.Id,Numero=1};
                    var p2=new Parcial{CursoId=curso.Id,Numero=2};
                    db.Parciales.AddRange(p1,p2);
                    await db.SaveChangesAsync(ct);

                }
                curso.MoodleCourseId=source.Id;curso.Codigo=source.Shortname;curso.Nombre=source.Fullname;
            }
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
            return new SincronizacionDto(log.Id,"Cursos",cursos.Count,0,0,0,0,DateTime.UtcNow);
        },ct);
    }

    public Task<SincronizacionDto> Notas(int usuarioId, int cursoId, CancellationToken ct = default) =>
        SincronizarNotas(usuarioId, cursoId, ct);

    private async Task<SincronizacionDto> Ejecutar(int docente,int? curso,string operacion,
        Func<LogSincronizacion,Task<SincronizacionDto>> action,CancellationToken ct)
    {
        var log=new LogSincronizacion{DocenteId=docente,CursoId=curso,Operacion=operacion,Estado="Iniciado"};
        db.LogsSincronizacion.Add(log);await db.SaveChangesAsync(ct);
        var logId=log.Id;
        try
        {
            var result=await action(log);
            log.Estado="Completado";log.Exitoso=true;log.TotalRegistros=result.Cursos+result.Estudiantes+result.Items+result.Calificaciones;
            await db.SaveChangesAsync(CancellationToken.None);return result;
        }
        catch(Exception ex)
        {
            db.ChangeTracker.Clear();
            var failure=await db.LogsSincronizacion.SingleAsync(l=>l.Id==logId,CancellationToken.None);
            failure.Estado="Fallido";failure.Exitoso=false;
            failure.MensajeError=ex switch {MoodleException e=>e.Code,AcademicoException=>"academic_validation",OperationCanceledException=>"cancelled",_=>"local_persistence_error"};
            await db.SaveChangesAsync(CancellationToken.None);
            if(ex is DbUpdateException)throw new AcademicoException(409,"Conflicto de integridad; revise la vinculación o repita la sincronización.");
            throw;
        }
    }
}
