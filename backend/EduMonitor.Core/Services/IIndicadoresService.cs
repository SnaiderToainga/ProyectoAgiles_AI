using EduMonitor.Core.DTOs;
using EduMonitor.Core.Entities;

namespace EduMonitor.Core.Services;

public interface IIndicadoresService
{
    decimal CalcularPorcentajeProgreso(IEnumerable<Calificacion> calificaciones, int totalActividadesCurso);
    decimal CalcularPromedioGeneralEvaluado(IEnumerable<Calificacion> calificaciones);
    decimal CalcularPromedioPonderadoUta(IEnumerable<Calificacion> calificaciones, bool penalizarSinEntregaConCero = false);
    ResultadoIndicadoresDto GenerarResumenEstudiante(IEnumerable<Calificacion> calificaciones, int totalActividadesCurso);
}
