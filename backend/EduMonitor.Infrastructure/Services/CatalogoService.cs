using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs.Calculo;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Services;

public class CatalogoService(AcademicoDbContext db, ICalculoPonderadoService? calculoPonderado = null)
{
    private const int RegistrosPorPaginaPdf = 15;
    private readonly ICalculoPonderadoService _calculoPonderado = calculoPonderado ?? new CalculoPonderadoService(db);
    public async Task<Docente> Docente(int usuarioId, CancellationToken ct = default) =>
        await db.Docentes.SingleOrDefaultAsync(d => d.UsuarioId == usuarioId && d.Activo, ct)
        ?? throw new AcademicoException(403, "Usuario sin vinculación académica activa.");

    public async Task ComprobarCurso(int usuarioId, bool admin, int cursoId, CancellationToken ct = default)
    {
        var curso = await db.Cursos.AsNoTracking().SingleOrDefaultAsync(c => c.Id == cursoId, ct)
            ?? throw new AcademicoException(404, "Materia inexistente.");
        if (!admin && curso.DocenteId != (await Docente(usuarioId, ct)).Id)
            throw new AcademicoException(403, "Materia no asignada al docente.");
    }

    public async Task<List<MateriaDto>> Materias(int usuarioId, bool admin, CancellationToken ct = default)
    {
        var query = db.Cursos.AsNoTracking();
        if (!admin) { var docente = await Docente(usuarioId, ct); query = query.Where(c => c.DocenteId == docente.Id); }
        var cursos = await query.OrderBy(c => c.Id).ToListAsync(ct);
        var ids = cursos.Select(c => c.Id).ToArray();
        var parciales = await db.Parciales.AsNoTracking().Where(p => ids.Contains(p.CursoId)).Include(p => p.Unidades).ThenInclude(u => u.Temas).ToListAsync(ct);
        return cursos.Select(c => new MateriaDto(c.Id, c.Codigo, c.Nombre, c.Periodo,
            parciales.Where(p => p.CursoId == c.Id).OrderBy(p => p.Numero).Select(p => new ParcialDto(p.Id, p.Numero,
                p.Unidades.OrderBy(u => u.Numero).Select(u => new UnidadDto(u.Id, u.Numero, u.Nombre,
                    u.Temas.OrderBy(t => t.Id).Select(t => new TemaDto(t.Id, t.Nombre, t.Descripcion)).ToList())).ToList())).ToList())).ToList();
    }

    public async Task<TemaDto> CrearTema(int user, bool admin, TemaRequest request, CancellationToken ct = default)
    {
        var unidad = await db.Unidades.Include(u => u.Parcial).SingleOrDefaultAsync(u => u.Id == request.UnidadId, ct)
            ?? throw new AcademicoException(404, "Unidad inexistente.");
        await ComprobarCurso(user, admin, unidad.Parcial.CursoId, ct);
        if (string.IsNullOrWhiteSpace(request.Nombre)) throw new AcademicoException(400, "Nombre obligatorio.");
        var nombre = request.Nombre.Trim();
        if (await db.Temas.AnyAsync(t => t.UnidadId == unidad.Id && t.Nombre == nombre, ct)) throw new AcademicoException(409, "El tema ya existe en esa unidad.");
        var tema = new Tema { UnidadId = unidad.Id, Nombre = nombre, Descripcion = (request.Descripcion ?? "").Trim() };
        db.Temas.Add(tema); await db.SaveChangesAsync(ct); return new(tema.Id, tema.Nombre, tema.Descripcion);
    }

    private async Task<Parcial> Validar(int user, bool admin, int parcialId, TipoItemEvaluacion tipo, int[] temas, CancellationToken ct)
    {
        if (tipo is not (TipoItemEvaluacion.Tarea or TipoItemEvaluacion.APE or TipoItemEvaluacion.Examen)) throw new AcademicoException(400, "Componente inválido.");
        if (temas is null || temas.Length == 0 || temas.Distinct().Count() != temas.Length) throw new AcademicoException(400, "Seleccione temas distintos.");
        var parcial = await db.Parciales.FindAsync([parcialId], ct) ?? throw new AcademicoException(404, "Parcial inexistente.");
        await ComprobarCurso(user, admin, parcial.CursoId, ct);
        if (await db.Temas.CountAsync(t => temas.Contains(t.Id) && t.Unidad.ParcialId == parcialId, ct) != temas.Length)
            throw new AcademicoException(400, "Todos los temas deben pertenecer al parcial de la evaluación.");
        return parcial;
    }

    public async Task<int> CrearEvaluacion(int user, bool admin, EvaluacionRequest request, CancellationToken ct = default)
    {
        var parcial = await Validar(user, admin, request.ParcialId, request.Tipo, request.TemaIds, ct);
        if (string.IsNullOrWhiteSpace(request.Nombre)) throw new AcademicoException(400, "Nombre obligatorio.");
        var item = new ItemEvaluacion { CursoId = parcial.CursoId, ParcialId = parcial.Id, Nombre = request.Nombre.Trim(), Tipo = request.Tipo, Publicado = true, CalificacionMaxima = 10 };
        db.ItemsEvaluacion.Add(item);
        foreach (var id in request.TemaIds) db.EvaluacionTemas.Add(new() { Evaluacion = item, TemaId = id });
        await db.SaveChangesAsync(ct); return item.Id;
    }

    public async Task Clasificar(int user, bool admin, int id, ClasificarRequest request, CancellationToken ct = default)
    {
        var parcial = await Validar(user, admin, request.ParcialId, request.Tipo, request.TemaIds, ct);
        var item = await db.ItemsEvaluacion.FindAsync([id], ct) ?? throw new AcademicoException(404, "Evaluación inexistente.");
        if (item.CursoId != parcial.CursoId) throw new AcademicoException(400, "La evaluación pertenece a otra materia.");
        var links = await db.EvaluacionTemas.Where(x => x.ItemEvaluacionId == id).ToListAsync(ct);
        db.EvaluacionTemas.RemoveRange(links.Where(x => !request.TemaIds.Contains(x.TemaId)));
        foreach (var tema in request.TemaIds.Except(links.Select(x => x.TemaId))) db.EvaluacionTemas.Add(new() { ItemEvaluacionId = id, TemaId = tema });
        item.ParcialId = parcial.Id; item.Tipo = request.Tipo; item.Publicado = true; await db.SaveChangesAsync(ct);
    }

    public async Task<List<EvaluacionDto>> Evaluaciones(int user, bool admin, int cursoId, CancellationToken ct = default)
    {
        await ComprobarCurso(user, admin, cursoId, ct);
        var items = await db.ItemsEvaluacion.AsNoTracking().Where(i => i.CursoId == cursoId).ToListAsync(ct);
        var links = await db.EvaluacionTemas.AsNoTracking().Where(x => x.Evaluacion.CursoId == cursoId).ToListAsync(ct);
        return items.Select(i => new EvaluacionDto(i.Id, i.ParcialId, i.Nombre, i.Tipo, i.Tipo switch { TipoItemEvaluacion.Tarea => .3m, TipoItemEvaluacion.APE => .3m, TipoItemEvaluacion.Examen => .4m, _ => 0 }, i.Publicado, links.Where(x => x.ItemEvaluacionId == i.Id).Select(x => x.TemaId).ToArray())).ToList();
    }

    public async Task<int> CrearPlan(int user, bool admin, CrearPlanRefuerzoRequest request, CancellationToken ct = default)
    {
        await ComprobarCurso(user, admin, request.CursoId, ct);
        var estudiante = await db.Estudiantes.FindAsync([request.EstudianteId], ct)
            ?? throw new AcademicoException(404, "Estudiante inexistente.");
        var matriculado = await db.Matriculas.AnyAsync(m => m.CursoId == request.CursoId && m.EstudianteId == request.EstudianteId, ct);
        if (!matriculado)
            throw new AcademicoException(400, "El estudiante no se encuentra matriculado en el curso.");

        if (request.Detalles == null || request.Detalles.Count == 0)
            throw new AcademicoException(400, "El plan de refuerzo debe contener al menos un detalle de actividad.");

        var temaIds = request.Detalles.Select(d => d.TemaId).Distinct().ToList();
        var temasValidos = await db.Temas.CountAsync(t => temaIds.Contains(t.Id), ct);
        if (temasValidos != temaIds.Count)
            throw new AcademicoException(400, "Uno o más temas referenciados no existen en el catálogo curricular.");

        var plan = new PlanRefuerzo
        {
            EstudianteId = request.EstudianteId,
            CursoId = request.CursoId,
            DiagnosticoGeneral = request.DiagnosticoGeneral.Trim(),
            NivelRiesgo = request.NivelRiesgo.Trim(),
            EsFallback = request.EsFallback,
            FechaGeneracion = DateTime.UtcNow,
            Detalles = request.Detalles.Select(d => new DetallePlanRefuerzo
            {
                TemaId = d.TemaId,
                ActividadSugerida = d.ActividadSugerida.Trim(),
                Prioridad = d.Prioridad.Trim(),
                TiempoEstimadoHoras = d.TiempoEstimadoHoras,
                RecursoRecomendado = (d.RecursoRecomendado ?? "").Trim()
            }).ToList()
        };

        db.PlanesRefuerzo.Add(plan);
        await db.SaveChangesAsync(ct);
        return plan.Id;
    }

    public async Task<List<PlanRefuerzoDto>> PlanesPorCurso(int user, bool admin, int cursoId, CancellationToken ct = default)
    {
        await ComprobarCurso(user, admin, cursoId, ct);
        var planes = await db.PlanesRefuerzo
            .AsNoTracking()
            .Where(p => p.CursoId == cursoId)
            .Include(p => p.Estudiante)
            .Include(p => p.Detalles)
                .ThenInclude(d => d.Tema)
            .OrderByDescending(p => p.FechaGeneracion)
            .ToListAsync(ct);

        return planes.Select(MapearPlanDto).ToList();
    }

    public async Task<PlanRefuerzoDto> ActualizarPlan(
        int user,
        bool admin,
        int planId,
        ActualizarPlanRefuerzoRequest request,
        CancellationToken ct = default)
    {
        var plan = await db.PlanesRefuerzo
            .Include(p => p.Estudiante)
            .Include(p => p.Detalles)
                .ThenInclude(d => d.Tema)
            .SingleOrDefaultAsync(p => p.Id == planId, ct)
            ?? throw new AcademicoException(404, "Plan de refuerzo inexistente.");

        await ComprobarCurso(user, admin, plan.CursoId, ct);

        plan.DiagnosticoGeneral = request.DiagnosticoGeneral.Trim();
        if (!string.IsNullOrWhiteSpace(request.NivelRiesgo))
            plan.NivelRiesgo = request.NivelRiesgo.Trim();

        if (request.Detalles != null)
        {
            foreach (var edit in request.Detalles)
            {
                var detalle = plan.Detalles.SingleOrDefault(d => d.Id == edit.Id);
                if (detalle != null)
                {
                    detalle.ActividadSugerida = edit.ActividadSugerida.Trim();
                    detalle.Prioridad = edit.Prioridad.Trim();
                    detalle.TiempoEstimadoHoras = edit.TiempoEstimadoHoras;
                    detalle.RecursoRecomendado = (edit.RecursoRecomendado ?? "").Trim();
                }
            }
        }

        await db.SaveChangesAsync(ct);
        return MapearPlanDto(plan);
    }

    private static PlanRefuerzoDto MapearPlanDto(PlanRefuerzo p) => new(
        p.Id,
        p.EstudianteId,
        p.Estudiante != null ? p.Estudiante.NombreCompleto : "",
        p.CursoId,
        p.DiagnosticoGeneral,
        p.NivelRiesgo,
        p.EsFallback,
        p.FechaGeneracion,
        p.Detalles.Select(d => new DetallePlanRefuerzoDto(
            d.Id,
            d.TemaId,
            d.Tema != null ? d.Tema.Nombre : $"Tema #{d.TemaId}",
            d.ActividadSugerida,
            d.Prioridad,
            d.TiempoEstimadoHoras,
            d.RecursoRecomendado
        )).ToList()
    );

    public async Task<ReporteConsolidadoCursoDto> ReporteConsolidadoCurso(
        int user,
        bool admin,
        int cursoId,
        int? parcialId = null,
        int? parcialNumero = null,
        CancellationToken ct = default)
    {
        var curso = await ObtenerCursoAutorizadoAsync(user, admin, cursoId, ct);
        var parcial = await ResolverParcialCursoAsync(cursoId, parcialId, parcialNumero, ct);

        var rendimiento = await _calculoPonderado.CalcularCursoAsync(cursoId, parcial.Id, ct);
        var planes = await PlanesPorCurso(user, admin, cursoId, ct);

        var planesVigentesPorEstudiante = planes
            .GroupBy(p => p.EstudianteId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.FechaGeneracion).ThenByDescending(p => p.Id).First());

        var filas = rendimiento
            .Select((est, index) => MapearFilaConsolidada(
                index + 1,
                est,
                planesVigentesPorEstudiante.GetValueOrDefault(est.EstudianteId)))
            .ToList();

        var resumenEstadistico = ConstruirResumenEstadistico(filas);
        var fechaEmision = DateTime.UtcNow;

        var membrete = ConstruirMembrete(
            curso,
            parcial,
            "INFORME OFICIAL CONSOLIDADO DE RENDIMIENTO ACADÉMICO Y TUTORÍA",
            fechaEmision);

        var bloqueFirma = ConstruirBloqueFirma(curso);
        var piePagina = ConstruirPiePagina(curso, parcial, filas.Count, fechaEmision, sufijo: "CONS");

        return new ReporteConsolidadoCursoDto(
            curso.Id,
            parcial.Id,
            parcial.Numero,
            membrete,
            resumenEstadistico,
            filas,
            bloqueFirma,
            piePagina
        );
    }

    public async Task<ReporteIndividualTutoriaDto> ReporteIndividualTutoria(
        int user,
        bool admin,
        int cursoId,
        int estudianteId,
        int? parcialId = null,
        int? parcialNumero = null,
        CancellationToken ct = default)
    {
        var curso = await ObtenerCursoAutorizadoAsync(user, admin, cursoId, ct);
        var parcial = await ResolverParcialCursoAsync(cursoId, parcialId, parcialNumero, ct);

        var matriculado = await db.Matriculas.AsNoTracking()
            .AnyAsync(m => m.CursoId == cursoId && m.EstudianteId == estudianteId, ct);
        if (!matriculado)
            throw new AcademicoException(404, "El estudiante no se encuentra matriculado en la materia.");

        var resumenEstudiante = await _calculoPonderado.CalcularEstudianteAsync(cursoId, parcial.Id, estudianteId, ct);
        var planes = await PlanesPorCurso(user, admin, cursoId, ct);
        var planVigente = planes
            .Where(p => p.EstudianteId == estudianteId)
            .OrderByDescending(p => p.FechaGeneracion)
            .ThenByDescending(p => p.Id)
            .FirstOrDefault();

        var fila = MapearFilaConsolidada(1, resumenEstudiante, planVigente);
        var causaPrincipal = DeterminarCausaPrincipal(fila);
        var fechaEmision = DateTime.UtcNow;

        var membrete = ConstruirMembrete(
            curso,
            parcial,
            "INFORME OFICIAL INDIVIDUAL DE TUTORÍA Y REFUERZO ACADÉMICO",
            fechaEmision);

        var bloqueFirma = ConstruirBloqueFirma(curso);
        var piePagina = ConstruirPiePagina(
            curso,
            parcial,
            Math.Max(1, planVigente?.Detalles.Count ?? 1),
            fechaEmision,
            sufijo: $"EST{estudianteId}");

        return new ReporteIndividualTutoriaDto(
            curso.Id,
            parcial.Id,
            parcial.Numero,
            membrete,
            fila,
            causaPrincipal,
            planVigente,
            bloqueFirma,
            piePagina
        );
    }

    private async Task<Curso> ObtenerCursoAutorizadoAsync(int usuarioId, bool admin, int cursoId, CancellationToken ct)
    {
        var curso = await db.Cursos.AsNoTracking()
            .Include(c => c.Docente)
            .SingleOrDefaultAsync(c => c.Id == cursoId, ct)
            ?? throw new AcademicoException(404, "Materia inexistente.");

        if (!admin && curso.DocenteId != (await Docente(usuarioId, ct)).Id)
            throw new AcademicoException(403, "Materia no asignada al docente.");

        return curso;
    }

    private async Task<Parcial> ResolverParcialCursoAsync(int cursoId, int? parcialId, int? parcialNumero, CancellationToken ct)
    {
        var query = db.Parciales.AsNoTracking().Where(p => p.CursoId == cursoId);

        if (parcialId.HasValue)
        {
            return await query.SingleOrDefaultAsync(p => p.Id == parcialId.Value, ct)
                ?? throw new AcademicoException(404, "Parcial inexistente en la materia.");
        }

        if (parcialNumero.HasValue)
        {
            return await query.SingleOrDefaultAsync(p => p.Numero == parcialNumero.Value, ct)
                ?? throw new AcademicoException(404, "Parcial inexistente en la materia.");
        }

        return await query.OrderBy(p => p.Numero).FirstOrDefaultAsync(ct)
            ?? throw new AcademicoException(404, "La materia no registra parciales configurados.");
    }

    private static FilaMatrizConsolidadaDto MapearFilaConsolidada(
        int numeroOrden,
        ResumenAcademicoEstudianteDto est,
        PlanRefuerzoDto? planVigente)
    {
        var compTareas = est.Componentes.FirstOrDefault(c => c.Tipo == TipoItemEvaluacion.Tarea);
        var compApe = est.Componentes.FirstOrDefault(c => c.Tipo == TipoItemEvaluacion.APE);
        var compExamen = est.Componentes.FirstOrDefault(c => c.Tipo == TipoItemEvaluacion.Examen);

        var nombreCompleto = $"{est.Apellidos} {est.Nombres}".Trim();
        var estadoAcademico = est.SinEvaluaciones
            ? "Sin evaluaciones calificadas"
            : (est.EnRiesgo ? "En Riesgo Académico (< 7.00)" : "Aprobado (>= 7.00)")
              + (est.CalculoProvisional ? $" · provisional ({est.PonderacionEvaluada:P0} evaluado)" : "");

        return new FilaMatrizConsolidadaDto(
            numeroOrden,
            est.EstudianteId,
            est.Nombres,
            est.Apellidos,
            nombreCompleto,
            est.Correo,
            est.FotoUrl,
            compTareas?.PromedioComponente ?? 0m,
            compTareas?.AporteFinal ?? 0m,
            compApe?.PromedioComponente ?? 0m,
            compApe?.AporteFinal ?? 0m,
            compExamen?.PromedioComponente ?? 0m,
            compExamen?.AporteFinal ?? 0m,
            est.NotaFinalParcial,
            est.EnRiesgo,
            estadoAcademico,
            est.Componentes,
            est.TemasDeficientes,
            planVigente,
            est.SinEvaluaciones,
            est.CalculoProvisional
        );
    }

    private static ResumenEstadisticoReporteDto ConstruirResumenEstadistico(List<FilaMatrizConsolidadaDto> filas)
    {
        var total = filas.Count;
        if (total == 0)
        {
            return new ResumenEstadisticoReporteDto(0, 0, 0, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 7.00m);
        }

        // Los estudiantes sin evaluaciones calificadas no cuentan como aprobados ni entran en los promedios.
        var evaluadas = filas.Where(f => !f.SinEvaluaciones).ToList();
        var enRiesgo = evaluadas.Count(f => f.EnRiesgo);
        var aprobados = evaluadas.Count - enRiesgo;

        var pctAprobados = Math.Round(aprobados * 100m / total, 2, MidpointRounding.AwayFromZero);
        var pctRiesgo = Math.Round(enRiesgo * 100m / total, 2, MidpointRounding.AwayFromZero);

        decimal Promedio(Func<FilaMatrizConsolidadaDto, decimal> selector) =>
            evaluadas.Count == 0 ? 0m : Math.Round(evaluadas.Sum(selector) / evaluadas.Count, 2, MidpointRounding.AwayFromZero);

        return new ResumenEstadisticoReporteDto(
            total,
            aprobados,
            enRiesgo,
            pctAprobados,
            pctRiesgo,
            Promedio(f => f.NotaFinalParcial),
            Promedio(f => f.PromedioTareas),
            Promedio(f => f.AporteTareas),
            Promedio(f => f.PromedioApe),
            Promedio(f => f.AporteApe),
            Promedio(f => f.PromedioExamen),
            Promedio(f => f.AporteExamen),
            7.00m
        );
    }

    private static MembreteInstitucionalDto ConstruirMembrete(
        Curso curso,
        Parcial parcial,
        string tituloReporte,
        DateTime fechaEmisionUtc)
    {
        return new MembreteInstitucionalDto(
            Universidad: "Universidad Técnica de Ambato",
            Facultad: "Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI)",
            Carrera: "Carrera de Ingeniería en Software",
            Sistema: "SISRA — EduMonitor AI",
            TituloReporte: tituloReporte,
            MateriaCodigo: curso.Codigo,
            MateriaNombre: curso.Nombre,
            PeriodoLectivo: curso.Periodo,
            ParcialId: parcial.Id,
            ParcialNumero: parcial.Numero,
            DocenteTitular: !string.IsNullOrWhiteSpace(curso.Docente?.Nombre) ? curso.Docente.Nombre : "Docente Titular",
            DocenteCorreo: curso.Docente?.Correo ?? string.Empty,
            FechaEmisionUtc: fechaEmisionUtc
        );
    }

    private static FirmaDocenteDto ConstruirBloqueFirma(Curso curso)
    {
        var nombreDocente = !string.IsNullOrWhiteSpace(curso.Docente?.Nombre)
            ? curso.Docente.Nombre
            : "Docente Titular";

        return new FirmaDocenteDto(
            NombreDocente: nombreDocente,
            CorreoDocente: curso.Docente?.Correo ?? string.Empty,
            Cargo: "Docente Titular de la Asignatura — FISEI UTA",
            EtiquetaCasillero: "Firma y Rúbrica del Docente Titular",
            LeyendaConformidad: "Certifico que las calificaciones ponderadas bajo el modelo 30/30/40 y los planes de seguimiento pedagógico consignados en este documento corresponden a los registros oficiales de la asignatura.",
            LineaFirma: "__________________________________________"
        );
    }

    private static PiePaginaReporteDto ConstruirPiePagina(
        Curso curso,
        Parcial parcial,
        int totalRegistros,
        DateTime fechaEmisionUtc,
        string sufijo)
    {
        var totalPaginas = Math.Max(1, (int)Math.Ceiling(totalRegistros / (double)RegistrosPorPaginaPdf));
        var paginas = Enumerable.Range(1, totalPaginas)
            .Select(p => $"Página {p} de {totalPaginas}")
            .ToList();

        var codigo = $"UTA-FISEI-{curso.Codigo}-P{parcial.Numero}-{sufijo}-{fechaEmisionUtc:yyyyMMdd}";

        return new PiePaginaReporteDto(
            TextoInstitucional: "Universidad Técnica de Ambato — FISEI | Sistema Inteligente de Seguimiento y Refuerzo Académico (EduMonitor AI)",
            PlantillaNumeracion: "Página {pagina} de {total}",
            NumeracionInicial: paginas[0],
            TotalPaginasEstimadas: totalPaginas,
            RegistrosPorPagina: RegistrosPorPaginaPdf,
            Paginas: paginas,
            CodigoDocumento: codigo,
            FechaEmisionUtc: fechaEmisionUtc
        );
    }

    private static string DeterminarCausaPrincipal(FilaMatrizConsolidadaDto fila)
    {
        var deficientes = fila.Componentes
            .Where(c => c.EsDeficiente)
            .OrderBy(c => c.PromedioComponente)
            .Select(c =>
            {
                var nombre = c.Tipo switch
                {
                    TipoItemEvaluacion.Tarea => "Tareas (30%)",
                    TipoItemEvaluacion.APE => "APE (30%)",
                    TipoItemEvaluacion.Examen => "Examen (40%)",
                    _ => c.Tipo.ToString()
                };
                return $"{nombre}: {c.PromedioComponente:0.00}/10";
            })
            .ToList();

        if (deficientes.Count > 0)
        {
            return $"Deficiencia académica detectada en componentes ponderados: {string.Join(", ", deficientes)}.";
        }

        return fila.EnRiesgo
            ? $"Promedio ponderado general ({fila.NotaFinalParcial:0.00}/10) inferior al umbral de aprobación reglamentario (7.00/10)."
            : "Rendimiento académico satisfactorio sobre el umbral reglamentario de aprobación (>= 7.00/10).";
    }
}
