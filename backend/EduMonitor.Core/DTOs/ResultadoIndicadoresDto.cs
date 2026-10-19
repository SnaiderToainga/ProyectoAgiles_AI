namespace EduMonitor.Core.DTOs;

public record ResultadoIndicadoresDto(
    int TotalActividades,
    int ActividadesEntregadas,
    int ActividadesPendientes,
    int ActividadesSinEntrega,
    decimal PorcentajeProgreso,
    decimal PromedioGeneralEvaluado,
    decimal PromedioPonderadoUta,
    bool RequiereAlertaTemprana
);
