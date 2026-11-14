using EduMonitor.Core.DTOs;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;

namespace EduMonitor.Infrastructure.Services;

public class IndicadoresService : IIndicadoresService
{
    private const decimal PonderacionTareas = 0.30m;
    private const decimal PonderacionApe = 0.30m;
    private const decimal PonderacionExamen = 0.40m;

    public decimal CalcularPorcentajeProgreso(IEnumerable<Calificacion> calificaciones, int totalActividadesCurso)
    {
        if (totalActividadesCurso <= 0) return 0.00m;

        var entregadas = calificaciones.Count(c => 
            c.Estado == EstadoCalificacion.Entregado || 
            c.Estado == EstadoCalificacion.PendienteCalificar);

        var porcentaje = ((decimal)entregadas / totalActividadesCurso) * 100m;
        return Math.Round(Math.Clamp(porcentaje, 0m, 100m), 2);
    }

    public decimal CalcularPromedioGeneralEvaluado(IEnumerable<Calificacion> calificaciones)
    {
        var notas = calificaciones
            .Where(c => c.Estado == EstadoCalificacion.Entregado && c.Nota.HasValue)
            .Select(c => c.Nota!.Value)
            .ToList();

        if (notas.Count == 0) return 0.00m;
        return Math.Round(notas.Average(), 2);
    }

    public decimal CalcularPromedioPonderadoUta(IEnumerable<Calificacion> calificaciones, bool penalizarSinEntregaConCero = false)
    {
        var lista = calificaciones.ToList();

        decimal promTareas = ObtenerPromedioCategoria(lista, TipoItemEvaluacion.Tarea, penalizarSinEntregaConCero);
        decimal promApe = ObtenerPromedioCategoria(lista, TipoItemEvaluacion.APE, penalizarSinEntregaConCero);
        decimal promExamen = ObtenerPromedioCategoria(lista, TipoItemEvaluacion.Examen, penalizarSinEntregaConCero);

        decimal notaFinal = (promTareas * PonderacionTareas) +
                            (promApe * PonderacionApe) +
                            (promExamen * PonderacionExamen);

        return Math.Round(Math.Clamp(notaFinal, 0.00m, 10.00m), 2);
    }

    public ResultadoIndicadoresDto GenerarResumenEstudiante(IEnumerable<Calificacion> calificaciones, int totalActividadesCurso)
    {
        var lista = calificaciones.ToList();

        int totalEvaluadas = lista.Count(c => c.Estado == EstadoCalificacion.Entregado && c.Nota.HasValue);
        int totalPendientes = lista.Count(c => c.Estado == EstadoCalificacion.PendienteCalificar);
        int totalSinEntrega = lista.Count(c => c.Estado == EstadoCalificacion.SinEntrega);

        decimal progreso = CalcularPorcentajeProgreso(lista, totalActividadesCurso);
        decimal promGeneral = CalcularPromedioGeneralEvaluado(lista);
        decimal promUta = CalcularPromedioPonderadoUta(lista, penalizarSinEntregaConCero: false);

        bool alerta = (promUta < 7.00m && totalEvaluadas > 0) || totalSinEntrega >= 2;

        return new ResultadoIndicadoresDto(
            totalActividadesCurso,
            totalEvaluadas,
            totalPendientes,
            totalSinEntrega,
            progreso,
            promGeneral,
            promUta,
            alerta
        );
    }

    private static decimal ObtenerPromedioCategoria(List<Calificacion> items, TipoItemEvaluacion tipo, bool penalizarSinEntregaConCero)
    {
        var itemsTipo = items.Where(c => c.ItemEvaluacion != null && c.ItemEvaluacion.Tipo == tipo).ToList();
        if (itemsTipo.Count == 0) return 0.00m;

        var valores = new List<decimal>();
        foreach (var c in itemsTipo)
        {
            if (c.Estado == EstadoCalificacion.Entregado && c.Nota.HasValue)
            {
                valores.Add(c.Nota.Value);
            }
            else if (c.Estado == EstadoCalificacion.SinEntrega && penalizarSinEntregaConCero)
            {
                valores.Add(0.00m);
            }
        }

        return valores.Count == 0 ? 0.00m : valores.Average();
    }
}
