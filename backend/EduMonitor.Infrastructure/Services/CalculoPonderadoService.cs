using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs.Calculo;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Services;

public class CalculoPonderadoService(AcademicoDbContext db) : ICalculoPonderadoService
{
    private const decimal PonderacionTareas = 0.30m;
    private const decimal PonderacionApe = 0.30m;
    private const decimal PonderacionExamen = 0.40m;
    private const decimal UmbralAprobacion = 7.00m;

    public async Task<ResumenAcademicoEstudianteDto> CalcularEstudianteAsync(
        int cursoId,
        int parcialId,
        int estudianteId,
        CancellationToken ct = default)
    {
        var estudiante = await db.Estudiantes.AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == estudianteId, ct)
            ?? throw new AcademicoException(404, "Estudiante no encontrado.");

        var items = await ObtenerItemsEvaluacionAsync(cursoId, parcialId, ct);
        var itemIds = items.Select(i => i.Id).ToList();

        var temasMap = await ObtenerTemasPorEvaluacionAsync(itemIds, ct);

        var calificaciones = await db.Calificaciones.AsNoTracking()
            .Where(c => c.EstudianteId == estudianteId && itemIds.Contains(c.ItemEvaluacionId))
            .ToListAsync(ct);

        return ProcesarCalculoEstudiante(estudiante, cursoId, parcialId, items, calificaciones, temasMap);
    }

    public async Task<List<ResumenAcademicoEstudianteDto>> CalcularCursoAsync(
        int cursoId,
        int parcialId,
        CancellationToken ct = default)
    {
        var cursoExiste = await db.Cursos.AnyAsync(c => c.Id == cursoId, ct);
        if (!cursoExiste)
            throw new AcademicoException(404, "Materia inexistente.");

        var items = await ObtenerItemsEvaluacionAsync(cursoId, parcialId, ct);
        var itemIds = items.Select(i => i.Id).ToList();

        var temasMap = await ObtenerTemasPorEvaluacionAsync(itemIds, ct);

        var estudiantes = await db.Matriculas.AsNoTracking()
            .Where(m => m.CursoId == cursoId)
            .Select(m => m.Estudiante)
            .OrderBy(e => e.Apellidos)
            .ThenBy(e => e.Nombres)
            .ToListAsync(ct);

        var estudianteIds = estudiantes.Select(e => e.Id).ToList();

        var calificaciones = await db.Calificaciones.AsNoTracking()
            .Where(c => estudianteIds.Contains(c.EstudianteId) && itemIds.Contains(c.ItemEvaluacionId))
            .ToListAsync(ct);

        return estudiantes.Select(estudiante =>
        {
            var notasEstudiante = calificaciones.Where(c => c.EstudianteId == estudiante.Id).ToList();
            return ProcesarCalculoEstudiante(estudiante, cursoId, parcialId, items, notasEstudiante, temasMap);
        }).ToList();
    }

    private async Task<List<ItemEvaluacion>> ObtenerItemsEvaluacionAsync(int cursoId, int parcialId, CancellationToken ct)
    {
        return await db.ItemsEvaluacion.AsNoTracking()
            .Where(i => i.CursoId == cursoId &&
                        i.ParcialId == parcialId &&
                        i.Publicado &&
                        i.Tipo != TipoItemEvaluacion.SinClasificar)
            .ToListAsync(ct);
    }

    private async Task<Dictionary<int, List<TemaReferenciaDto>>> ObtenerTemasPorEvaluacionAsync(List<int> itemIds, CancellationToken ct)
    {
        var links = await db.EvaluacionTemas.AsNoTracking()
            .Where(et => itemIds.Contains(et.ItemEvaluacionId))
            .Include(et => et.Tema)
            .ToListAsync(ct);

        return links
            .GroupBy(l => l.ItemEvaluacionId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => new TemaReferenciaDto(x.TemaId, x.Tema.Nombre)).ToList()
            );
    }

    private static ResumenAcademicoEstudianteDto ProcesarCalculoEstudiante(
        Estudiante estudiante,
        int cursoId,
        int parcialId,
        List<ItemEvaluacion> items,
        List<Calificacion> calificaciones,
        Dictionary<int, List<TemaReferenciaDto>> temasMap)
    {
        var notasDict = calificaciones.ToDictionary(c => c.ItemEvaluacionId);

        var compTareas = ConstruirComponente(TipoItemEvaluacion.Tarea, PonderacionTareas, items, notasDict, temasMap);
        var compApe = ConstruirComponente(TipoItemEvaluacion.APE, PonderacionApe, items, notasDict, temasMap);
        var compExamen = ConstruirComponente(TipoItemEvaluacion.Examen, PonderacionExamen, items, notasDict, temasMap);

        var componentes = new List<ComponentePonderadoDto> { compTareas, compApe, compExamen };

        // Un componente sin actividades evaluadas no suma 0: la nota se calcula sobre la ponderación
        // evaluada y se marca como provisional (RNF-03: sin métricas engañosas ante datos ausentes).
        var evaluados = componentes.Where(c => c.Evaluado).ToList();
        var ponderacionEvaluada = evaluados.Sum(c => c.Ponderacion);
        var sinEvaluaciones = ponderacionEvaluada == 0m;
        var notaFinal = sinEvaluaciones
            ? 0m
            : Math.Round(evaluados.Sum(c => c.PromedioComponente * c.Ponderacion) / ponderacionEvaluada, 2, MidpointRounding.AwayFromZero);
        var enRiesgo = !sinEvaluaciones && notaFinal < UmbralAprobacion;
        var calculoProvisional = !sinEvaluaciones && ponderacionEvaluada < 1.00m;

        var temasDeficientes = new List<TemaCriticoDto>();

        foreach (var comp in componentes)
        {
            foreach (var eval in comp.Evaluaciones.Where(e => e.EsDeficiente))
            {
                foreach (var tema in eval.Temas)
                {
                    if (!temasDeficientes.Any(t => t.TemaId == tema.TemaId))
                    {
                        temasDeficientes.Add(new TemaCriticoDto(
                            tema.TemaId,
                            tema.Nombre,
                            eval.Nombre,
                            eval.Nota
                        ));
                    }
                }
            }
        }

        return new ResumenAcademicoEstudianteDto(
            estudiante.Id,
            estudiante.Nombres,
            estudiante.Apellidos,
            estudiante.Correo,
            cursoId,
            parcialId,
            notaFinal,
            enRiesgo,
            componentes,
            temasDeficientes,
            estudiante.FotoUrl,
            sinEvaluaciones,
            calculoProvisional,
            ponderacionEvaluada
        );
    }

    private static ComponentePonderadoDto ConstruirComponente(
        TipoItemEvaluacion tipo,
        decimal ponderacion,
        List<ItemEvaluacion> items,
        Dictionary<int, Calificacion> notasDict,
        Dictionary<int, List<TemaReferenciaDto>> temasMap)
    {
        var itemsTipo = items.Where(i => i.Tipo == tipo).ToList();
        var listaDetalle = new List<EvaluacionDetalleDto>();

        decimal sumaNotas = 0m;
        int totalCalificadas = 0;

        foreach (var item in itemsTipo)
        {
            decimal? nota = null;
            var estado = EstadoCalificacion.NoDeterminado;
            if (notasDict.TryGetValue(item.Id, out var calif))
            {
                nota = calif.Nota;
                estado = calif.Estado;
            }

            // Una entrega vencida sin presentar cuenta como 0; pendiente de calificar, por entregar o
            // sin dato es información ausente y no se promedia.
            var sinEntrega = !nota.HasValue && estado == EstadoCalificacion.SinEntrega;
            bool esDeficiente = sinEntrega || (nota.HasValue && nota.Value < UmbralAprobacion);

            if (nota.HasValue || sinEntrega)
            {
                sumaNotas += nota ?? 0m;
                totalCalificadas++;
            }

            var temasAsignados = temasMap.TryGetValue(item.Id, out var temas)
                ? temas
                : new List<TemaReferenciaDto>();

            listaDetalle.Add(new EvaluacionDetalleDto(
                item.Id,
                item.Nombre,
                item.Tipo,
                nota,
                esDeficiente,
                temasAsignados,
                estado
            ));
        }

        var evaluado = totalCalificadas > 0;
        decimal promedio = evaluado
            ? Math.Round(sumaNotas / totalCalificadas, 2, MidpointRounding.AwayFromZero)
            : 0m;

        decimal aporte = Math.Round(promedio * ponderacion, 2, MidpointRounding.AwayFromZero);
        bool componenteDeficiente = evaluado && promedio < UmbralAprobacion;

        return new ComponentePonderadoDto(
            tipo,
            ponderacion,
            promedio,
            aporte,
            componenteDeficiente,
            listaDetalle,
            evaluado
        );
    }
}