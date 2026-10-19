using EduMonitor.Core.Enums;

namespace EduMonitor.Core.Entities;

public class Calificacion
{
    public int Id { get; set; }

    public int ItemEvaluacionId { get; set; }
    public ItemEvaluacion ItemEvaluacion { get; set; } = null!;

    public int EstudianteId { get; set; }
    public Estudiante Estudiante { get; set; } = null!;

    public decimal? Nota { get; set; }
    public EstadoCalificacion Estado { get; set; }
    public DateTime? FechaEntrega { get; set; }
}
