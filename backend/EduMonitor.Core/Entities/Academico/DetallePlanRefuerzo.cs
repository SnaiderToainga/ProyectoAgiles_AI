namespace EduMonitor.Core.Entities.Academico;

public class DetallePlanRefuerzo
{
    public int Id { get; set; }
    public int PlanRefuerzoId { get; set; }
    public PlanRefuerzo PlanRefuerzo { get; set; } = null!;
    public int TemaId { get; set; }
    public Tema? Tema { get; set; }
    public string ActividadSugerida { get; set; } = string.Empty;
    public string Prioridad { get; set; } = string.Empty;
    public int TiempoEstimadoHoras { get; set; }
    public string RecursoRecomendado { get; set; } = string.Empty;
}
