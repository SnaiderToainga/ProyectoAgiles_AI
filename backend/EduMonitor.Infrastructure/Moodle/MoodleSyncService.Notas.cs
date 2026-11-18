using System.Data;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Moodle;

public sealed partial class MoodleSyncService
{
    private sealed record FilaNota(int Usuario, MoodleItemDto Item, decimal? Nota,
        EstadoCalificacion Estado, DateTime? Fecha);

    private async Task<SincronizacionDto> SincronizarNotas(int usuarioId, int cursoId, CancellationToken ct)
    {
        var docente = await catalogo.Docente(usuarioId, ct);
        await catalogo.ComprobarCurso(usuarioId, false, cursoId, ct);
        var curso = await db.Cursos.SingleAsync(c => c.Id == cursoId, ct);
        return await Ejecutar(docente.Id, cursoId, "Notas", async log =>
        {
            if (curso.MoodleCourseId <= 0 || docente.MoodleUserId is not > 0)
                throw new AcademicoException(409, "Sincronice primero los cursos del docente vinculado.");

            // Las peticiones independientes se solapan; nunca se comparte DbContext entre tareas.
            var participantesTask = moodle.ObtenerParticipantes(curso.MoodleCourseId, ct);
            var contenidoTask = moodle.ObtenerContenidoCurso(curso.MoodleCourseId, ct);
            var notasTask = moodle.ObtenerCalificacionesPorCurso(curso.MoodleCourseId, ct);
            await Task.WhenAll(participantesTask, contenidoTask, notasTask);
            var participantes = await participantesTask;
            if (!participantes.Any(p => p.Id == docente.MoodleUserId && p.Roles.Any(r => options.Value.TeacherRoles.Contains(r.Shortname))))
                throw new AcademicoException(403, "El docente ya no tiene permiso sobre este curso en Moodle.");
            var alumnos = participantes.Where(p => p.Roles.Any(r => options.Value.StudentRoles.Contains(r.Shortname))).ToList();
            var contenido = await contenidoTask;
            ValidarContenido(contenido);
            var notas = await notasTask;
            if (notas.Usergrades is null) throw Incompleto();
            var porAlumno = notas.Usergrades.Where(g => g.Courseid == curso.MoodleCourseId)
                .GroupBy(g => g.Userid).ToDictionary(g => g.Key, g => g.ToList());
            if (alumnos.Select(a => a.Id).Distinct().Count() != alumnos.Count ||
                alumnos.Any(a => !porAlumno.TryGetValue(a.Id, out var g) || g.Count != 1 || g[0].Gradeitems is null))
                throw Incompleto();

            var modulos = contenido.SelectMany(s => s.Modules.Select(m => (Seccion: s, Modulo: m)))
                .Where(x => x.Modulo.Modname is "assign" or "quiz")
                .ToDictionary(x => (x.Modulo.Modname, x.Modulo.Instance));
            var visibles = modulos.Where(x => x.Value.Seccion.Section > 0 && x.Value.Seccion.Visible == 1 &&
                x.Value.Modulo.Visible == 1).ToDictionary(x => x.Key, x => x.Value);
            var filasFuente = alumnos.SelectMany(a => porAlumno[a.Id][0].Gradeitems
                .Where(i => i.Itemtype == "mod" && i.Itemmodule is "assign" or "quiz")
                .Select(i => (Alumno: a, Item: i))).ToList();
            // Una actividad calificada ausente del contenido puede indicar un payload restringido.
            if (filasFuente.Any(x => x.Item.Iteminstance is not > 0 || !modulos.ContainsKey((x.Item.Itemmodule!, x.Item.Iteminstance.Value))))
                throw Incompleto();
            if (filasFuente.GroupBy(x => (x.Alumno.Id, x.Item.Id)).Any(g => g.Count() != 1)) throw Incompleto();
            var seleccion = filasFuente.Where(x => visibles.ContainsKey((x.Item.Itemmodule!, x.Item.Iteminstance!.Value))).ToList();
            // Una actividad sin nota debe llegar como fila con Graderaw=null, no desaparecer.
            // Contrastar cada alumno con el inventario evita confirmar matrices parciales como exitosas.
            var esperados = visibles.Keys.ToHashSet();
            foreach (var alumno in alumnos)
            {
                var filasAlumno = seleccion.Where(x => x.Alumno.Id == alumno.Id).ToList();
                var claves = filasAlumno.Select(x => (x.Item.Itemmodule!, x.Item.Iteminstance!.Value)).ToHashSet();
                if (!claves.SetEquals(esperados) || claves.Count != filasAlumno.Count) throw Incompleto();
            }
            if (filasFuente.Any(x => x.Item.Id <= 0) || filasFuente
                .GroupBy(x => (x.Item.Itemmodule, x.Item.Iteminstance))
                .Any(g => g.Select(x => x.Item.Id).Distinct().Count() != 1)) throw Incompleto();
            var fuentes = seleccion.GroupBy(x => x.Item.Id).ToDictionary(g => g.Key, g => g.First().Item);
            foreach (var grupo in filasFuente.GroupBy(x => x.Item.Id))
                if (grupo.Any(x => x.Item.Itemmodule != grupo.First().Item.Itemmodule || x.Item.Iteminstance != grupo.First().Item.Iteminstance))
                    throw Incompleto();

            // Solo pedir metadatos/estado de tareas cuando hay notas ausentes.
            var tareas = new Dictionary<int, MoodleTareaDto>();
            if (seleccion.Any(x => x.Item.Itemmodule == "assign" && !x.Item.Graderaw.HasValue))
            {
                var respuesta = await moodle.ObtenerTareas(curso.MoodleCourseId, ct);
                tareas = respuesta.Courses.Where(c => c.Id == curso.MoodleCourseId)
                    .SelectMany(c => c.Assignments).ToDictionary(t => t.Id);
            }
            using var limite = new SemaphoreSlim(4);
            var filas = await Task.WhenAll(seleccion.Select(async x =>
            {
                MoodleTareaDto? tarea = null;
                MoodleEstadoEntregaDto? entrega = null;
                if (!x.Item.Graderaw.HasValue && x.Item.Itemmodule == "assign")
                {
                    if (!tareas.TryGetValue(x.Item.Iteminstance!.Value, out tarea)) throw Incompleto();
                    await limite.WaitAsync(ct);
                    try { entrega = await moodle.ObtenerEstadoEntrega(tarea.Id, x.Alumno.Id, ct); }
                    finally { limite.Release(); }
                }
                var estado = EstadoCalificacionResolver.Resolver(x.Item, tarea, entrega, DateTimeOffset.UtcNow,
                    options.Value.CourseDueDatesAreAuthoritative);
                var fecha = x.Item.Gradedatesubmitted;
                var envio = tarea?.Teamsubmission == 1 ? entrega?.Lastattempt?.Teamsubmission : entrega?.Lastattempt?.Submission;
                if (envio?.Status == "submitted") fecha = envio.Timemodified;
                return new FilaNota(x.Alumno.Id, x.Item, Normalizar(x.Item), estado,
                    fecha is > 0 ? DateTimeOffset.FromUnixTimeSeconds(fecha.Value).UtcDateTime : null);
            }));

            // Toda la escritura del curso es atómica. No hay HTTP dentro de la transacción.
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var parciales = await db.Parciales.Where(p => p.CursoId == cursoId)
                .Include(p => p.Unidades).ThenInclude(u => u.Temas).AsSplitQuery().ToListAsync(ct);
            foreach (var seccion in contenido.Where(s => s.Section > 0 && s.Visible == 1))
            {
                var numero = MoodleCurriculoResolver.ResolverParcial(seccion.Section, seccion.Name);
                if (numero is null) throw new MoodleException("moodle_curriculum_ambiguous", "No se pudo determinar el parcial de una sección.", 409);
                var parcial = parciales.SingleOrDefault(p => p.Numero == numero);
                if (parcial is null)
                {
                    parcial = new Parcial { CursoId = cursoId, Numero = numero.Value };
                    parciales.Add(parcial); db.Parciales.Add(parcial);
                }
                // El número de sección es la identidad estable dentro del parcial acordada con el equipo.
                var unidad = parcial.Unidades.SingleOrDefault(u => u.Numero == seccion.Section)
                    ?? parcial.Unidades.SingleOrDefault(u => string.Equals(u.Nombre, seccion.Name, StringComparison.OrdinalIgnoreCase));
                if (unidad is null)
                {
                    unidad = new Unidad { Numero = seccion.Section, Parcial = parcial };
                    parcial.Unidades.Add(unidad); db.Unidades.Add(unidad);
                }
                unidad.Nombre = Texto(seccion.Name, 200);
                if (unidad.Temas.Count == 0)
                    foreach (var tema in MoodleCurriculoResolver.ExtraerTemas(seccion.Summary))
                    {
                        var entity = new Tema { Unidad = unidad, Nombre = Texto(tema, 200), Descripcion = "" };
                        unidad.Temas.Add(entity); db.Temas.Add(entity);
                    }
            }
            var idsAlumnos = alumnos.Select(a => a.Id).ToArray();
            var estudiantes = await db.Estudiantes.Where(e => idsAlumnos.Contains(e.MoodleUserId)).ToDictionaryAsync(e => e.MoodleUserId, ct);
            var matriculas = await db.Matriculas.Where(m => m.CursoId == cursoId).Include(m => m.Estudiante).ToListAsync(ct);
            // Actualizar la nómina vigente sin borrar estudiantes ni su historial de calificaciones.
            db.Matriculas.RemoveRange(matriculas.Where(m => !idsAlumnos.Contains(m.Estudiante.MoodleUserId)));
            var items = await db.ItemsEvaluacion.Where(i => i.CursoId == cursoId && i.MoodleItemId > 0).ToDictionaryAsync(i => i.MoodleItemId, ct);
            // Recuperar también el vínculo de ítems ocultos si aún aparecen en el reporte de notas.
            foreach (var fila in filasFuente)
                if (items.TryGetValue(fila.Item.Id, out var existente))
                    existente.MoodleModuleId = modulos[(fila.Item.Itemmodule!, fila.Item.Iteminstance!.Value)].Modulo.Id;
            var modulosOcultos = modulos.Values.Where(m => m.Seccion.Visible == 0 || m.Modulo.Visible == 0)
                .Select(m => m.Modulo.Id).ToHashSet();
            // En datos anteriores a la migración no inferir el módulo por nombre ni inventar un vínculo.
            if (modulosOcultos.Count > 0 && items.Values.Any(i => i.Publicado && i.MoodleModuleId is null))
                throw new MoodleException("moodle_module_mapping_required", "Sincronice el vínculo del módulo antes de procesar ocultamientos de ítems publicados.", 409);
            var notasDb = await db.Calificaciones.Where(g => g.ItemEvaluacion.CursoId == cursoId).ToListAsync(ct);
            foreach (var alumno in alumnos)
            {
                if (!estudiantes.TryGetValue(alumno.Id, out var estudiante))
                {
                    estudiante = new Estudiante { MoodleUserId = alumno.Id };
                    estudiantes.Add(alumno.Id, estudiante); db.Estudiantes.Add(estudiante);
                }
                estudiante.Nombres = Texto(alumno.Firstname ?? alumno.Fullname, 100);
                estudiante.Apellidos = Texto(alumno.Lastname ?? "", 100);
                estudiante.Correo = Texto(alumno.Email ?? "", 150);
                estudiante.FotoUrl = string.IsNullOrWhiteSpace(alumno.Profileimageurl) ? null : alumno.Profileimageurl.Trim();
                if (!matriculas.Any(m => m.EstudianteId == estudiante.Id && estudiante.Id > 0))
                    db.Matriculas.Add(new Matricula { CursoId = cursoId, Estudiante = estudiante });
            }
            foreach (var fuente in fuentes.Values)
            {
                var modulo = visibles[(fuente.Itemmodule!, fuente.Iteminstance!.Value)];
                if (!items.TryGetValue(fuente.Id, out var item))
                {
                    item = new ItemEvaluacion { CursoId = cursoId, MoodleItemId = fuente.Id };
                    items.Add(fuente.Id, item); db.ItemsEvaluacion.Add(item);
                }
                if (item.Tipo == TipoItemEvaluacion.SinClasificar && !item.Publicado)
                {
                    item.Tipo = MoodleCurriculoResolver.ResolverTipo(fuente.Itemname ?? modulo.Modulo.Name);
                }
                item.Nombre = Texto(fuente.Itemname ?? modulo.Modulo.Name, 200);
                item.MoodleModuleId = modulo.Modulo.Id;
                item.MinimoMoodle = fuente.Grademin; item.MaximoMoodle = fuente.Grademax; item.CalificacionMaxima = 10;
            }
            // Obtener claves generadas en un solo lote, no por estudiante/evaluación.
            await db.SaveChangesAsync(ct);
            foreach (var fuente in fuentes.Values)
            {
                var seccion = visibles[(fuente.Itemmodule!, fuente.Iteminstance!.Value)].Seccion;
                var numero = MoodleCurriculoResolver.ResolverParcial(seccion.Section, seccion.Name);
                // La sección determina el parcial incluso si la clasificación manual se conserva.
                items[fuente.Id].ParcialId = parciales.Single(p => p.Numero == numero).Id;
            }
            var porClave = notasDb.ToDictionary(g => (g.EstudianteId, g.ItemEvaluacionId));
            foreach (var fila in filas)
            {
                var estudiante = estudiantes[fila.Usuario]; var item = items[fila.Item.Id];
                if (!porClave.TryGetValue((estudiante.Id, item.Id), out var nota))
                {
                    nota = new Calificacion { EstudianteId = estudiante.Id, ItemEvaluacionId = item.Id };
                    porClave.Add((estudiante.Id, item.Id), nota); db.Calificaciones.Add(nota);
                }
                nota.Nota = fila.Nota; nota.NotaMoodle = fila.Item.Graderaw; nota.Estado = fila.Estado; nota.FechaEntrega = fila.Fecha;
            }
            // Ocultamiento explícito: no inferir eliminación por ausencia en una respuesta filtrable.
            foreach (var item in items.Values.Where(i => i.MoodleModuleId is int id && modulosOcultos.Contains(id)))
                item.Publicado = false;
            // Solo un administrador que verificó permisos/inventario puede habilitar ausencia autoritativa.
            if (options.Value.ContentInventoryIsAuthoritative)
            {
                var presentes = filasFuente.Select(f => f.Item.Id).ToHashSet();
                foreach (var item in items.Values.Where(i => !presentes.Contains(i.MoodleItemId))) item.Publicado = false;
            }
            var resultado = new SincronizacionDto(log.Id, "Notas", 1, alumnos.Count, fuentes.Count, filas.Length,
                filas.Count(f => f.Estado == EstadoCalificacion.NoDeterminado), DateTime.UtcNow);
            log.Estado = "Completado"; log.Exitoso = true;
            log.TotalRegistros = resultado.Cursos + resultado.Estudiantes + resultado.Items + resultado.Calificaciones;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return resultado;
        }, ct);
    }

    private static string Texto(string valor, int limite)
    {
        var texto = valor.Trim();
        if (texto.Length > limite) throw new MoodleException("moodle_field_length", "Un campo de Moodle excede el tamaño admitido.", 409);
        return texto;
    }

    private static MoodleException Incompleto() => new("moodle_incomplete", "Moodle devolvió contenido incompleto o restringido; no se importaron datos.");

    private static void ValidarContenido(IReadOnlyList<MoodleSeccionDto> contenido)
    {
        if (contenido.Count == 0 || contenido.Select(s => s.Id).Distinct().Count() != contenido.Count ||
            contenido.Select(s => s.Section).Distinct().Count() != contenido.Count) throw Incompleto();
        foreach (var s in contenido)
        {
            if (s.Id <= 0 || s.Modules is null || s.Visible is not (0 or 1) ||
                (s.Visible == 1 && s.Uservisible != true)) throw Incompleto();
            foreach (var m in s.Modules)
                if (m.Id <= 0 || m.Instance <= 0 || m.Visible is not (0 or 1) ||
                    (s.Visible == 1 && m.Visible == 1 && m.Uservisible != true)) throw Incompleto();
        }
        if (contenido.SelectMany(s => s.Modules).GroupBy(m => m.Id).Any(g => g.Count() > 1) ||
            contenido.SelectMany(s => s.Modules).GroupBy(m => (m.Modname, m.Instance)).Any(g => g.Count() > 1)) throw Incompleto();
    }
}
