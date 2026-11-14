namespace EduMonitor.Core.Entities;

public class Matricula
{
    public int Id { get; set; }
    public int EstudianteId { get; set; }
    public Estudiante Estudiante { get; set; } = null!;

    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;

    public DateTime FechaMatricula { get; set; } = DateTime.UtcNow;
}
