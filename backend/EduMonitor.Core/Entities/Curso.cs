namespace EduMonitor.Core.Entities;

public class Curso
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public int MoodleCourseId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Periodo { get; set; } = string.Empty;

    public int DocenteId { get; set; }
    public Docente Docente { get; set; } = null!;

    public ICollection<Matricula> Matriculas { get; set; } = new List<Matricula>();
    public ICollection<ItemEvaluacion> ItemsEvaluacion { get; set; } = new List<ItemEvaluacion>();
    public ICollection<LogSincronizacion> LogsSincronizacion { get; set; } = new List<LogSincronizacion>();
}
