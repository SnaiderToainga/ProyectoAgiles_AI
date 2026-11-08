using EduMonitor.Core.Entities;

namespace EduMonitor.Core.Entities.Academico;

public class PlanRefuerzo
{
    public int Id { get; set; }
    public int EstudianteId { get; set; }
    public Estudiante Estudiante { get; set; } = null!;
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;
    public string DiagnosticoGeneral { get; set; } = string.Empty;
    public string NivelRiesgo { get; set; } = string.Empty;
    public bool EsFallback { get; set; }
    public DateTime FechaGeneracion { get; set; } = DateTime.UtcNow;

    public ICollection<DetallePlanRefuerzo> Detalles { get; set; } = new List<DetallePlanRefuerzo>();
}
