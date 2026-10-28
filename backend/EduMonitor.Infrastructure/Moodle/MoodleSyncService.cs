using System.Data;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EduMonitor.Infrastructure.Moodle;

public sealed class MoodleSyncService(AcademicoDbContext db, CatalogoService catalogo,
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
        var docente=await catalogo.Docente(usuarioId,ct);
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
                if(curso is null){curso=new Curso{DocenteId=docente.Id,Periodo="Sin asignar"};db.Cursos.Add(curso);}
                curso.MoodleCourseId=source.Id;curso.Codigo=source.Shortname;curso.Nombre=source.Fullname;
            }
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
            return new SincronizacionDto(log.Id,"Cursos",cursos.Count,0,0,0,0,DateTime.UtcNow);
        },ct);
    }

    public async Task<SincronizacionDto> Notas(int usuarioId,int cursoId,CancellationToken ct=default)
    {
        var docente=await catalogo.Docente(usuarioId,ct);
        await catalogo.ComprobarCurso(usuarioId,false,cursoId,ct);
        var curso=await db.Cursos.SingleAsync(c=>c.Id==cursoId,ct);
        return await Ejecutar(docente.Id,cursoId,"Notas",async log=>
        {
            if(curso.MoodleCourseId<=0 || docente.MoodleUserId is not >0)
                throw new AcademicoException(409,"Sincronice primero los cursos del docente vinculado.");
            var participantes=await moodle.ObtenerParticipantes(curso.MoodleCourseId,ct);
            if(!participantes.Any(p=>p.Id==docente.MoodleUserId && p.Roles.Any(r=>options.Value.TeacherRoles.Contains(r.Shortname))))
                throw new AcademicoException(403,"El docente ya no tiene permiso sobre este curso en Moodle.");
            var students=participantes.Where(p=>p.Roles.Any(r=>options.Value.StudentRoles.Contains(r.Shortname))).ToList();
            var grades=await moodle.ObtenerCalificacionesPorCurso(curso.MoodleCourseId,ct);
            var assignments=(await moodle.ObtenerTareas(curso.MoodleCourseId,ct)).Courses
                .Where(c=>c.Id==curso.MoodleCourseId).SelectMany(c=>c.Assignments).ToDictionary(a=>a.Id);
            var rows=new List<(MoodleParticipanteDto User,MoodleItemDto Item,decimal? Nota,EstadoCalificacion Estado,DateTime? Fecha)>();
            foreach(var user in students)
            {
                foreach(var item in grades.Usergrades.Where(g=>g.Userid==user.Id && g.Courseid==curso.MoodleCourseId)
                    .SelectMany(g=>g.Gradeitems).Where(i=>i.Itemtype is "mod" or "manual"))
                {
                    MoodleTareaDto? task=null;MoodleEstadoEntregaDto? submission=null;
                    if(item.Itemmodule=="assign" && item.Iteminstance is int taskId && assignments.TryGetValue(taskId,out task))
                        submission=await moodle.ObtenerEstadoEntrega(taskId,user.Id,ct);
                    var status=EstadoCalificacionResolver.Resolver(item,task,submission,DateTimeOffset.UtcNow,options.Value.CourseDueDatesAreAuthoritative);
                    var timestamp=item.Gradedatesubmitted;
                    var delivery=task?.Teamsubmission==1?submission?.Lastattempt?.Teamsubmission:submission?.Lastattempt?.Submission;
                    if(delivery?.Status=="submitted")timestamp=delivery.Timemodified;
                    rows.Add((user,item,Normalizar(item),status,timestamp is >0?DateTimeOffset.FromUnixTimeSeconds(timestamp.Value).UtcDateTime:null));
                }
            }
            await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            foreach(var user in students)
            {
                var student=await db.Estudiantes.SingleOrDefaultAsync(s=>s.MoodleUserId==user.Id,ct);
                if(student is null){student=new Estudiante{MoodleUserId=user.Id};db.Estudiantes.Add(student);}
                student.Nombres=user.Firstname??user.Fullname;student.Apellidos=user.Lastname??"";student.Correo=user.Email??"";
                await db.SaveChangesAsync(ct);
                if(!await db.Matriculas.AnyAsync(m=>m.CursoId==cursoId && m.EstudianteId==student.Id,ct))
                    db.Matriculas.Add(new(){CursoId=cursoId,EstudianteId=student.Id});
                foreach(var row in rows.Where(r=>r.User.Id==user.Id))
                {
                    var item=await db.ItemsEvaluacion.SingleOrDefaultAsync(i=>i.CursoId==cursoId && i.MoodleItemId==row.Item.Id,ct);
                    if(item is null){item=new ItemEvaluacion{CursoId=cursoId,MoodleItemId=row.Item.Id,Tipo=TipoItemEvaluacion.SinClasificar,Publicado=false};db.ItemsEvaluacion.Add(item);}
                    item.Nombre=row.Item.Itemname??$"Evaluación Moodle {row.Item.Id}";
                    item.MinimoMoodle=row.Item.Grademin;item.MaximoMoodle=row.Item.Grademax;item.CalificacionMaxima=10;
                    await db.SaveChangesAsync(ct);
                    var grade=await db.Calificaciones.SingleOrDefaultAsync(g=>g.ItemEvaluacionId==item.Id && g.EstudianteId==student.Id,ct);
                    if(grade is null){grade=new Calificacion{ItemEvaluacionId=item.Id,EstudianteId=student.Id};db.Calificaciones.Add(grade);}
                    grade.Nota=row.Nota;grade.NotaMoodle=row.Item.Graderaw;grade.Estado=row.Estado;grade.FechaEntrega=row.Fecha;
                    await db.SaveChangesAsync(ct);
                }
            }
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
            return new SincronizacionDto(log.Id,"Notas",1,students.Count,rows.Select(r=>r.Item.Id).Distinct().Count(),rows.Count,
                rows.Count(r=>r.Estado==EstadoCalificacion.NoDeterminado),DateTime.UtcNow);
        },ct);
    }

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
